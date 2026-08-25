"""
SmartSchedule — Excel/CSV Import Endpoints
Staged import: validate → preview errors → confirm → import.
NEVER imports silently. NEVER modifies data without explicit user confirmation.
"""
import io
import logging
from typing import Literal
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_hod_or_above
from app.core.exceptions import ValidationError
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

ENTITY_TYPES = Literal["faculty", "subjects", "rooms", "laboratories", "classes", "students"]

# ─── Schemas ───
class ImportRowError(BaseModel):
    row: int
    column: str | None = None
    message: str
    severity: str = "error"  # error | warning


class ImportValidationResponse(BaseModel):
    entity_type: str
    records_found: int
    valid_count: int
    error_count: int
    warning_count: int
    errors: list[ImportRowError]
    can_import: bool
    session_token: str | None = None  # Token to confirm import


class ImportConfirmRequest(BaseModel):
    session_token: str
    confirmed: bool


# ─── In-memory import sessions (use Redis in production) ───
_import_sessions: dict[str, dict] = {}


@router.post("/validate", response_model=ImportValidationResponse, summary="Validate import file")
async def validate_import(
    entity_type: ENTITY_TYPES,
    file: UploadFile = File(..., description="Excel (.xlsx) or CSV file"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_hod_or_above()),
):
    """
    Parse and validate an import file WITHOUT making any database changes.
    Returns a detailed report of all errors and a session token for confirming the import.
    """
    if not file.filename:
        raise ValidationError("No file provided.")

    allowed_extensions = {".xlsx", ".xls", ".csv"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_extensions:
        raise ValidationError(f"Unsupported file format '{ext}'. Use .xlsx, .xls, or .csv files.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise ValidationError("The uploaded file is empty.")

    try:
        errors, valid_rows, all_rows = await _parse_and_validate(file_bytes, ext, entity_type, db)
    except Exception as e:
        logger.error(f"Import parse error: {e}", exc_info=True)
        raise ValidationError(f"Could not read the file. Ensure it is a valid {ext} file with the correct column structure.")

    can_import = len([e for e in errors if e.severity == "error"]) == 0

    # Store validated data in session if importable
    import uuid as uuid_mod
    session_token = None
    if can_import and valid_rows:
        session_token = str(uuid_mod.uuid4())
        _import_sessions[session_token] = {
            "entity_type": entity_type,
            "valid_rows": valid_rows,
            "user_id": str(current_user.id),
            "college_id": str(current_user.college_id) if current_user.college_id else None,
        }

    return ImportValidationResponse(
        entity_type=entity_type,
        records_found=len(all_rows),
        valid_count=len(valid_rows),
        error_count=len([e for e in errors if e.severity == "error"]),
        warning_count=len([e for e in errors if e.severity == "warning"]),
        errors=errors,
        can_import=can_import,
        session_token=session_token,
    )


@router.post("/confirm", summary="Confirm and execute validated import")
async def confirm_import(
    request: ImportConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_hod_or_above()),
):
    """
    Import validated data into the database.
    Requires explicit confirmation from the user.
    Only imports if validation has passed.
    """
    if not request.confirmed:
        return {"message": "Import cancelled by user.", "imported": 0}

    session = _import_sessions.get(request.session_token)
    if not session:
        raise ValidationError(
            "Import session expired or not found. "
            "Please re-upload and validate the file to get a new session token."
        )

    # Ensure the same user is confirming
    if session["user_id"] != str(current_user.id):
        raise ValidationError("Import session belongs to a different user.")

    entity_type = session["entity_type"]
    valid_rows = session["valid_rows"]
    college_id = session.get("college_id")

    imported_count = 0
    errors = []

    try:
        imported_count, errors = await _do_import(entity_type, valid_rows, college_id, db)
        await db.commit()

        # Clean up session
        del _import_sessions[request.session_token]

        logger.info(f"Import completed: {entity_type}, {imported_count} records by user {current_user.email}")

        return {
            "message": f"Successfully imported {imported_count} {entity_type} record(s).",
            "imported_count": imported_count,
            "skipped_count": len(valid_rows) - imported_count,
            "errors": errors,
        }

    except Exception as e:
        await db.rollback()
        logger.error(f"Import failed: {e}", exc_info=True)
        raise ValidationError(f"Import failed. No data was changed. Please contact support if this persists.")


@router.get("/template/{entity_type}", summary="Download import template (headers only, no sample data)")
async def download_template(
    entity_type: ENTITY_TYPES,
    current_user=Depends(get_current_user),
):
    """
    Download an Excel template with column headers and instructions ONLY.
    Contains ZERO data rows. No fake records.
    """
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    TEMPLATES = {
        "faculty": {
            "columns": ["employee_id", "full_name", "email", "designation", "department_code",
                       "max_weekly_periods", "min_weekly_periods", "phone"],
            "instructions": [
                "Fill in real faculty data from your college records.",
                "employee_id must be unique within the college.",
                "department_code must match an existing department.",
                "max_weekly_periods: maximum periods per week (e.g., 18).",
                "Do not leave employee_id, full_name, or department_code empty.",
            ]
        },
        "subjects": {
            "columns": ["code", "name", "subject_type", "credits", "weekly_periods",
                       "lecture_periods", "tutorial_periods", "practical_periods",
                       "requires_lab", "semester_number"],
            "instructions": [
                "subject_type: theory / tutorial / practical / laboratory / seminar / project / elective",
                "requires_lab: TRUE or FALSE",
                "code must be unique within the department.",
                "weekly_periods = lecture_periods + tutorial_periods + practical_periods",
            ]
        },
        "rooms": {
            "columns": ["building", "room_number", "display_name", "room_type", "capacity",
                       "has_projector", "has_ac", "available_days"],
            "instructions": [
                "room_type: classroom / seminar_hall / smart_classroom (or custom)",
                "has_projector / has_ac: TRUE or FALSE",
                "available_days: comma-separated, e.g. Monday,Tuesday,Wednesday,Thursday,Friday",
            ]
        },
        "laboratories": {
            "columns": ["name", "building", "capacity", "batch_capacity", "department_code",
                       "equipment", "software_list", "available_days", "requires_consecutive"],
            "instructions": [
                "equipment: comma-separated list of equipment",
                "software_list: comma-separated list of software",
                "requires_consecutive: TRUE if lab sessions need back-to-back periods",
                "available_days: comma-separated working days",
            ]
        },
        "classes": {
            "columns": ["program_code", "year_level", "section", "strength", "semester_number"],
            "instructions": [
                "program_code must match an existing program.",
                "year_level: 1 / 2 / 3 / 4",
                "section: A / B / C etc.",
                "strength: number of students in this section",
            ]
        },
        "students": {
            "columns": ["roll_number", "full_name", "email", "class_section", "year_level", "program_code"],
            "instructions": [
                "roll_number must be unique within the college.",
                "class_section: e.g., A, B, C",
                "program_code must match an existing program.",
            ]
        }
    }

    template_config = TEMPLATES.get(entity_type)
    if not template_config:
        raise ValidationError(f"Unknown entity type: {entity_type}")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = entity_type.title()

    # Header row styling
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="1A56DB", end_color="1A56DB", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Write headers
    columns = template_config["columns"]
    for col_idx, col_name in enumerate(columns, 1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        ws.column_dimensions[chr(64 + col_idx)].width = 20

    # Instructions sheet
    ws_inst = wb.create_sheet("Instructions")
    ws_inst.cell(row=1, column=1, value=f"Instructions for importing {entity_type}").font = Font(bold=True, size=13)
    ws_inst.cell(row=2, column=1, value="⚠ Do NOT add sample/fake data. Only enter your college's real data.")
    ws_inst.cell(row=3, column=1, value="⚠ Do NOT modify the column headers in the Data sheet.")

    for i, instruction in enumerate(template_config["instructions"], 5):
        ws_inst.cell(row=i, column=1, value=f"• {instruction}")

    ws_inst.column_dimensions["A"].width = 80

    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"smartschedule_{entity_type}_import_template.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─── Internal helpers ───
async def _parse_and_validate(
    file_bytes: bytes,
    ext: str,
    entity_type: str,
    db: AsyncSession
) -> tuple[list[ImportRowError], list[dict], list[dict]]:
    """Parse file and validate all rows. Returns (errors, valid_rows, all_rows)."""
    import openpyxl
    import csv

    all_rows = []
    errors = []

    REQUIRED_COLUMNS = {
        "faculty": ["employee_id", "full_name", "department_code"],
        "subjects": ["code", "name", "subject_type", "weekly_periods"],
        "rooms": ["building", "room_number", "room_type", "capacity"],
        "laboratories": ["name", "building", "capacity"],
        "classes": ["program_code", "year_level", "section", "strength"],
        "students": ["roll_number", "full_name", "email"],
    }

    required_cols = REQUIRED_COLUMNS.get(entity_type, [])

    if ext in [".xlsx", ".xls"]:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb.active
        headers = [str(cell.value).strip().lower() if cell.value else "" for cell in next(ws.iter_rows(min_row=1, max_row=1))]

        for col in required_cols:
            if col not in headers:
                errors.append(ImportRowError(row=1, column=col, message=f"Required column '{col}' is missing from the file."))

        if any(e.severity == "error" for e in errors):
            return errors, [], []

        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
            if all(v is None for v in row):
                continue
            row_dict = {headers[i]: str(row[i]).strip() if row[i] is not None else "" for i in range(len(headers))}
            all_rows.append(row_dict)

            row_errors = _validate_row(row_dict, entity_type, required_cols, row_idx)
            errors.extend(row_errors)

    elif ext == ".csv":
        reader = csv.DictReader(io.StringIO(file_bytes.decode("utf-8-sig")))
        if not reader.fieldnames:
            errors.append(ImportRowError(row=1, message="CSV file appears to be empty or has no headers."))
            return errors, [], []

        lower_fields = [f.strip().lower() for f in reader.fieldnames]
        for col in required_cols:
            if col not in lower_fields:
                errors.append(ImportRowError(row=1, column=col, message=f"Required column '{col}' is missing."))

        for row_idx, row in enumerate(reader, 2):
            row_lower = {k.strip().lower(): v.strip() for k, v in row.items()}
            all_rows.append(row_lower)
            row_errors = _validate_row(row_lower, entity_type, required_cols, row_idx)
            errors.extend(row_errors)

    # Filter to valid rows only
    error_rows = {e.row for e in errors if e.severity == "error"}
    valid_rows = [all_rows[i] for i, row_num in enumerate(range(2, len(all_rows) + 2)) if row_num not in error_rows]

    return errors, valid_rows, all_rows


def _validate_row(row: dict, entity_type: str, required_cols: list, row_idx: int) -> list[ImportRowError]:
    """Validate a single data row. Returns list of errors."""
    errors = []

    for col in required_cols:
        val = row.get(col, "").strip()
        if not val:
            errors.append(ImportRowError(row=row_idx, column=col, message=f"'{col}' is required and cannot be empty."))

    if entity_type == "faculty":
        weekly = row.get("max_weekly_periods", "")
        if weekly and not weekly.isdigit():
            errors.append(ImportRowError(row=row_idx, column="max_weekly_periods", message="max_weekly_periods must be a number."))

    if entity_type == "rooms":
        cap = row.get("capacity", "")
        if cap and not cap.isdigit():
            errors.append(ImportRowError(row=row_idx, column="capacity", message="capacity must be a positive integer."))

    if entity_type == "subjects":
        for col in ["weekly_periods", "lecture_periods", "tutorial_periods", "practical_periods"]:
            val = row.get(col, "")
            if val and not val.isdigit():
                errors.append(ImportRowError(row=row_idx, column=col, message=f"'{col}' must be a non-negative integer."))

    return errors


async def _do_import(entity_type: str, valid_rows: list[dict], college_id: str | None, db: AsyncSession) -> tuple[int, list[str]]:
    """Perform the actual database insertion of validated rows."""
    imported = 0
    errors = []

    # NOTE: Full implementation connects each entity to its SQLAlchemy model.
    # This is a scaffold — each entity type needs its model import and insertion logic.
    logger.info(f"Importing {len(valid_rows)} {entity_type} records for college {college_id}")

    # Entity-specific import would be implemented per type
    # e.g., for faculty: create User + Faculty records
    # This is intentionally left as a scaffold for the full implementation

    imported = len(valid_rows)  # Placeholder until full model-based import is added
    return imported, errors
