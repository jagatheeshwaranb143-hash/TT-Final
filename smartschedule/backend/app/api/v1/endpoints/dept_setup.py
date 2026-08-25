"""
SmartSchedule — Department + Year Setup Wizard API
Provides a single-shot save (upsert) endpoint for the wizard form,
a pre-fill GET endpoint, and a generate-timetable wrapper.

Endpoints:
  GET  /dept-setup/departments-summary              — dept list for Step 1 dropdown
  GET  /dept-setup/{dept_id}/{year_level}           — fetch existing config for wizard pre-fill
  POST /dept-setup/save                             — upsert full wizard payload in one transaction
  POST /dept-setup/generate                         — validate + trigger CP-SAT generation
"""
import uuid
import logging
from datetime import time as dtime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError

from app.core.security import get_current_user, require_hod_or_above
from app.core.exceptions import DataNotFoundError, ConflictError, ValidationError
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class SubjectEntry(BaseModel):
    """One subject row from the wizard."""
    id: Optional[str] = None           # existing UUID — None means create new
    code: str
    name: str
    subject_type: str = "theory"       # "theory" | "lab" | "project"
    credits: int = 3
    weekly_periods: int = 3
    requires_consecutive: bool = False
    consecutive_count: int = 2
    preferred_days: list[int] = Field(default_factory=list)
    restricted_days: list[int] = Field(default_factory=list)
    preferred_period_numbers: list[int] = Field(default_factory=list)
    restricted_period_numbers: list[int] = Field(default_factory=list)
    faculty_id: Optional[str] = None   # primary assigned faculty UUID


class BlockedSlot(BaseModel):
    """One unavailable slot for a faculty member."""
    faculty_id: str
    day_of_week: int   # 1=Mon … 5=Fri
    period_number: int # 1-indexed period (used to derive approximate time)


class WizardSavePayload(BaseModel):
    """Full payload from the 5-step wizard."""
    # Step 1 — Context
    department_id: str
    program_id: str
    academic_year_id: str
    semester_id: str
    year_level: int              # 1 | 2 | 3 | 4
    section: str = "A"
    student_strength: int = 60
    hall_number: str = ""

    # Step 2 — Subjects
    subjects: list[SubjectEntry] = Field(default_factory=list)

    # Step 3 — Faculty blocked slots
    blocked_slots: list[BlockedSlot] = Field(default_factory=list)

    # Step 4 — Rooms & Timings (informational — stored on class/constraints)
    room_ids: list[str] = Field(default_factory=list)
    lab_ids: list[str] = Field(default_factory=list)
    working_days: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])


class GeneratePayload(BaseModel):
    department_id: str
    semester_id: str
    academic_year_id: str
    version_name: Optional[str] = None
    time_limit_seconds: int = 300
    regeneration_mode: str = "full"
    preserve_locked: bool = False


# ─── Helper: get or create SubjectType ───────────────────────────────────────

async def _get_or_create_subject_type(db: AsyncSession, type_name: str):
    from app.models import SubjectType
    is_practical = type_name.lower() in ("lab", "practical", "project")
    res = await db.execute(select(SubjectType).where(SubjectType.name == type_name))
    st = res.scalar_one_or_none()
    if not st:
        st = SubjectType(
            name=type_name,
            is_practical=is_practical,
            requires_lab=is_practical,
        )
        db.add(st)
        await db.flush()
    return st


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/departments-summary", summary="Departments with subject/faculty counts for wizard selector")
async def list_departments_summary(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List of departments enriched with subject + faculty counts for the wizard Step 1 selector."""
    from app.models import Department, Faculty, Subject
    from sqlalchemy import func as sql_func

    college_id = getattr(current_user, "college_id", None)
    dept_query = select(Department)
    if college_id:
        dept_query = dept_query.where(Department.college_id == college_id)
    dept_res = await db.execute(dept_query)
    departments = dept_res.scalars().all()

    results = []
    for dept in departments:
        fac_count = (await db.execute(
            select(sql_func.count(Faculty.id)).where(Faculty.department_id == str(dept.id))
        )).scalar() or 0

        subj_count = (await db.execute(
            select(sql_func.count(Subject.id)).where(Subject.department_id == str(dept.id))
        )).scalar() or 0

        results.append({
            "id": str(dept.id),
            "name": dept.name,
            "code": dept.code,
            "faculty_count": fac_count,
            "subject_count": subj_count,
        })

    return results


@router.get("/{dept_id}/{year_level}", summary="Pre-fill wizard with existing dept+year data")
async def get_dept_year_setup(
    dept_id: str,
    year_level: int,
    semester_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns existing subjects, faculty, rooms and class info for a department + year
    so the wizard can pre-populate its form fields.
    """
    from app.models import Subject, SubjectType, Faculty, FacultySubject, FacultyAvailability
    from app.models import Room, Laboratory, Class, Program, Program

    # --- Subjects for dept ---
    subj_res = await db.execute(
        select(Subject).where(Subject.department_id == dept_id)
    )
    subjects_raw = subj_res.scalars().all()

    subject_list = []
    for s in subjects_raw:
        # Get subject type name
        st_res = await db.execute(select(SubjectType).where(SubjectType.id == str(s.subject_type_id)))
        st = st_res.scalar_one_or_none()
        # Get primary faculty
        fs_res = await db.execute(
            select(FacultySubject).where(
                FacultySubject.subject_id == str(s.id),
                FacultySubject.is_primary == True,
            )
        )
        fs = fs_res.scalar_one_or_none()
        subject_list.append({
            "id": str(s.id),
            "code": s.code,
            "name": s.name,
            "subject_type": st.name if st else "Theory",
            "credits": s.credits,
            "weekly_periods": s.contact_hours_per_week,
            "preferred_days": s.preferred_days or [],
            "preferred_period_numbers": s.preferred_period_numbers or [],
            "faculty_id": str(fs.faculty_id) if fs else None,
        })

    # --- Faculty in this department ---
    fac_res = await db.execute(
        select(Faculty).where(Faculty.department_id == dept_id, Faculty.is_active == True)
    )
    faculty_raw = fac_res.scalars().all()
    faculty_list = []
    for f in faculty_raw:
        # Blocked slots
        blocked_res = await db.execute(
            select(FacultyAvailability).where(
                FacultyAvailability.faculty_id == str(f.id),
                FacultyAvailability.is_available == False,
            )
        )
        blocked = [
            {"day_of_week": a.day_of_week, "start_time": str(a.start_time), "end_time": str(a.end_time)}
            for a in blocked_res.scalars().all()
        ]
        faculty_list.append({
            "id": str(f.id),
            "name": f.name,
            "code": f.code,
            "email": f.email,
            "max_hours_per_week": f.max_hours_per_week,
            "blocked_slots": blocked,
        })

    # --- Rooms for dept ---
    room_res = await db.execute(
        select(Room).where(Room.department_id == dept_id, Room.is_active == True)
    )
    rooms = [{"id": str(r.id), "name": r.name, "building": r.building, "capacity": r.capacity}
             for r in room_res.scalars().all()]

    # --- Labs ---
    lab_res = await db.execute(
        select(Laboratory).where(Laboratory.department_id == dept_id)
    )
    labs = [{"id": str(l.id), "name": l.name, "capacity": l.capacity}
            for l in lab_res.scalars().all()]

    # --- Programs for dept ---
    prog_res = await db.execute(select(Program).where(Program.department_id == dept_id))
    programs = [{"id": str(p.id), "name": p.name, "code": p.code, "duration_years": p.duration_years}
                for p in prog_res.scalars().all()]

    # --- Class record ---
    cls = None
    if programs:
        cls_res = await db.execute(
            select(Class)
            .join(Program, Class.program_id == Program.id)
            .where(
                Program.department_id == dept_id,
                Class.name.contains(str(year_level)),
            )
        )
        cls_row = cls_res.scalar_one_or_none()
        if cls_row:
            cls = {"id": str(cls_row.id), "name": cls_row.name, "section": cls_row.section, "student_count": cls_row.student_count}

    return {
        "subjects": subject_list,
        "faculty": faculty_list,
        "rooms": rooms,
        "labs": labs,
        "programs": programs,
        "class": cls,
    }


@router.post("/save", summary="Save full wizard payload — upserts all entities in one transaction")
async def save_wizard(
    payload: WizardSavePayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_hod_or_above()),
):
    """
    Upserts all wizard data in a single transaction:
      1. Gets or creates a Class record for dept+year.
      2. Gets or creates SubjectType for each subject type string.
      3. Creates or updates Subject records.
      4. Creates FacultySubject (primary) assignments.
      5. Creates FacultyAvailability blocks for unavailable slots.
    Returns a summary dict.
    """
    from app.models import Subject, SubjectType, FacultySubject, FacultyAvailability, Class, Program

    stats = {"subjects_created": 0, "subjects_updated": 0, "faculty_links": 0, "blocked_slots": 0}

    try:
        # ── 1. Upsert Class ──────────────────────────────────────────────────
        cls_res = await db.execute(
            select(Class).where(
                Class.program_id == payload.program_id,
                Class.semester_id == payload.semester_id,
                Class.section == payload.section,
            )
        )
        cls = cls_res.scalar_one_or_none()
        if not cls:
            year_names = {1: "I", 2: "II", 3: "III", 4: "IV"}
            yr = year_names.get(payload.year_level, str(payload.year_level))
            cls = Class(
                program_id=payload.program_id,
                semester_id=payload.semester_id,
                name=f"Year {yr} – Section {payload.section}",
                section=payload.section,
                student_count=payload.student_strength,
            )
            db.add(cls)
            await db.flush()
        else:
            cls.student_count = payload.student_strength

        class_id = str(cls.id)

        # ── 2. Upsert Subjects ───────────────────────────────────────────────
        subject_id_map: dict[str, str] = {}  # wizard temp id → real db id

        for s in payload.subjects:
            # Resolve subject type
            type_label = {"theory": "Theory", "lab": "Practical / Lab", "project": "Project"}.get(
                s.subject_type.lower(), s.subject_type
            )
            st = await _get_or_create_subject_type(db, type_label)

            if s.id:
                # Try to fetch existing subject by ID
                res = await db.execute(select(Subject).where(Subject.id == s.id))
                subj = res.scalar_one_or_none()
            else:
                # Try to find by code+dept to avoid duplicates
                res = await db.execute(
                    select(Subject).where(
                        Subject.department_id == payload.department_id,
                        Subject.code == s.code,
                    )
                )
                subj = res.scalar_one_or_none()

            if subj:
                # Update
                subj.subject_type_id = st.id
                subj.name = s.name
                subj.code = s.code
                subj.credits = s.credits
                subj.contact_hours_per_week = s.weekly_periods
                subj.preferred_days = s.preferred_days or [1, 2, 3, 4, 5]
                subj.preferred_period_numbers = s.preferred_period_numbers or []
                stats["subjects_updated"] += 1
            else:
                # Create
                subj = Subject(
                    department_id=payload.department_id,
                    subject_type_id=st.id,
                    code=s.code,
                    name=s.name,
                    credits=s.credits,
                    contact_hours_per_week=s.weekly_periods,
                    preferred_days=s.preferred_days or [1, 2, 3, 4, 5],
                    preferred_period_numbers=s.preferred_period_numbers or [],
                )
                db.add(subj)
                await db.flush()
                stats["subjects_created"] += 1

            subj_id = str(subj.id)
            if s.id:
                subject_id_map[s.id] = subj_id

            # ── 3. Faculty-Subject primary assignment ────────────────────────
            if s.faculty_id:
                # Remove old primary for this subject and re-create
                await db.execute(
                    delete(FacultySubject).where(
                        FacultySubject.subject_id == subj_id,
                        FacultySubject.is_primary == True,
                    )
                )
                fs = FacultySubject(
                    faculty_id=s.faculty_id,
                    subject_id=subj_id,
                    is_primary=True,
                )
                db.add(fs)
                stats["faculty_links"] += 1

        # ── 4. Faculty blocked slots ─────────────────────────────────────────
        if payload.blocked_slots:
            # Collect unique faculty IDs to clear their existing blocks first
            unique_fac_ids = list({slot.faculty_id for slot in payload.blocked_slots})
            for fac_id in unique_fac_ids:
                await db.execute(
                    delete(FacultyAvailability).where(
                        FacultyAvailability.faculty_id == fac_id,
                        FacultyAvailability.is_available == False,
                    )
                )

            # Re-create blocks from wizard data
            # Approximate: period 1 → 09:00-09:50, period 2 → 09:50-10:40, etc.
            period_times = {
                1: (dtime(9, 0),  dtime(9, 50)),
                2: (dtime(9, 50), dtime(10, 40)),
                3: (dtime(10, 55), dtime(11, 45)),
                4: (dtime(11, 45), dtime(12, 35)),
                5: (dtime(13, 20), dtime(14, 10)),
                6: (dtime(14, 10), dtime(15, 0)),
                7: (dtime(15, 0),  dtime(15, 50)),
            }

            for slot in payload.blocked_slots:
                start_t, end_t = period_times.get(slot.period_number, (dtime(9, 0), dtime(10, 0)))
                avail = FacultyAvailability(
                    faculty_id=slot.faculty_id,
                    day_of_week=slot.day_of_week,
                    start_time=start_t,
                    end_time=end_t,
                    is_available=False,
                )
                db.add(avail)
                stats["blocked_slots"] += 1

        await db.commit()

        return {
            "status": "saved",
            "class_id": class_id,
            "stats": stats,
            "message": (
                f"Wizard saved: {stats['subjects_created']} subjects created, "
                f"{stats['subjects_updated']} updated, "
                f"{stats['faculty_links']} faculty assignments made."
            ),
        }

    except IntegrityError as e:
        await db.rollback()
        logger.error(f"IntegrityError in wizard save: {e}")
        raise ConflictError(
            "A conflict occurred while saving. Check for duplicate subject codes."
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in wizard save: {e}", exc_info=True)
        raise


@router.post("/generate", summary="Validate + trigger timetable generation for dept+year")
async def generate_from_wizard(
    payload: GeneratePayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_hod_or_above()),
):
    """
    Thin wrapper: validates data first, then starts CP-SAT background job.
    Returns job_id for polling via /timetable/status/{job_id}.
    """
    from fastapi import BackgroundTasks
    from app.api.v1.endpoints.timetable import (
        validate_data,
        generate_timetable,
        GenerateRequest,
    )

    # Validate first
    validation = await validate_data(
        department_id=payload.department_id,
        semester_id=payload.semester_id,
        academic_year_id=payload.academic_year_id,
        db=db,
        current_user=current_user,
    )

    if not validation.is_valid:
        blocking = [e.get("message", str(e)) for e in validation.blocking_errors]
        raise ValidationError(
            f"Data validation failed ({len(blocking)} error(s)): "
            + "; ".join(blocking[:3])
        )

    bg = BackgroundTasks()
    gen_req = GenerateRequest(
        department_id=payload.department_id,
        semester_id=payload.semester_id,
        academic_year_id=payload.academic_year_id,
        version_name=payload.version_name or "Wizard Generated",
        time_limit_seconds=payload.time_limit_seconds,
        regeneration_mode=payload.regeneration_mode,
        preserve_locked=payload.preserve_locked,
    )

    result = await generate_timetable(
        request=gen_req,
        background_tasks=bg,
        db=db,
        current_user=current_user,
    )

    # Execute the background tasks inline (fire-and-forget pattern)
    await bg()

    return result
