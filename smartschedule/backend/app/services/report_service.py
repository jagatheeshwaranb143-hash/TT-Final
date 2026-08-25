"""
SmartSchedule — Report Service
Generates PDF, Excel, and CSV reports using REAL database data only.
Never uses hardcoded or sample data.
"""
import io
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

logger = logging.getLogger(__name__)


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_class_timetable_excel(
        self, class_id: str, version_id: str | None = None
    ) -> bytes:
        """
        Generate an Excel workbook for a single class's timetable.
        Layout: Days as columns, Periods as rows.
        """
        try:
            import openpyxl
            from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
            from openpyxl.utils import get_column_letter
        except ImportError:
            raise RuntimeError("openpyxl is required for Excel export")

        from app.models.timetable import TimetableEntry, TimetableVersion
        from app.models.period import Period, PeriodConfiguration
        from app.models.class_ import Class
        from app.models.subject import Subject
        from app.models.faculty import Faculty
        from app.models.room import Room
        from app.models.user import User

        # ─── Get class info ───
        class_result = await self.db.execute(select(Class).where(Class.id == class_id))
        cls = class_result.scalar_one_or_none()
        if not cls:
            raise ValueError(f"Class {class_id} not found")

        # ─── Get published version ───
        if version_id:
            version_result = await self.db.execute(
                select(TimetableVersion).where(TimetableVersion.id == version_id)
            )
        else:
            version_result = await self.db.execute(
                select(TimetableVersion).where(
                    and_(
                        TimetableVersion.status.in_(["published", "locked"]),
                    )
                ).order_by(TimetableVersion.version_number.desc()).limit(1)
            )
        version = version_result.scalar_one_or_none()
        if not version:
            raise ValueError("No published timetable version found")

        # ─── Get entries ───
        entries_result = await self.db.execute(
            select(TimetableEntry).where(
                and_(
                    TimetableEntry.version_id == version.id,
                    TimetableEntry.class_id == class_id,
                )
            )
        )
        entries = entries_result.scalars().all()

        # ─── Build entry lookup (day, period) → entry ───
        entry_map: dict[tuple, TimetableEntry] = {}
        for entry in entries:
            entry_map[(entry.day_of_week, entry.period_number)] = entry

        # ─── Get periods ───
        pc_result = await self.db.execute(
            select(PeriodConfiguration).limit(1)
        )
        pc = pc_result.scalar_one_or_none()
        periods = []
        if pc:
            p_result = await self.db.execute(
                select(Period).where(Period.config_id == str(pc.id)).order_by(Period.period_number)
            )
            periods = p_result.scalars().all()

        # ─── Build Excel workbook ───
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"Class Timetable"

        DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        WORKING_DAYS = [1, 2, 3, 4, 5]  # Default Mon-Fri

        # Styles
        header_fill = PatternFill(start_color="1A56DB", end_color="1A56DB", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF", size=11)
        period_fill = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
        center = Alignment(horizontal="center", vertical="center", wrap_text=True)
        thin_border = Border(
            left=Side(style="thin"), right=Side(style="thin"),
            top=Side(style="thin"), bottom=Side(style="thin")
        )

        # Title row
        ws.merge_cells(f"A1:{get_column_letter(len(WORKING_DAYS) + 1)}1")
        title_cell = ws["A1"]
        title_cell.value = f"Class Timetable — Section {cls.section} (Year {cls.year_level})"
        title_cell.font = Font(bold=True, size=14, color="0F172A")
        title_cell.alignment = center

        ws.row_dimensions[1].height = 30

        # Generated date
        ws.merge_cells(f"A2:{get_column_letter(len(WORKING_DAYS) + 1)}2")
        ws["A2"].value = f"Generated: {datetime.now().strftime('%d %B %Y')} | Version: {version.name}"
        ws["A2"].alignment = center

        # Day headers
        ws["A3"].value = "Period / Time"
        ws["A3"].fill = header_fill
        ws["A3"].font = header_font
        ws["A3"].alignment = center
        ws["A3"].border = thin_border

        for col_i, day_idx in enumerate(WORKING_DAYS, start=2):
            cell = ws.cell(row=3, column=col_i)
            cell.value = DAYS[day_idx - 1]
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center
            cell.border = thin_border
            ws.column_dimensions[get_column_letter(col_i)].width = 22

        ws.column_dimensions["A"].width = 18

        # Period rows
        for row_i, period in enumerate(periods, start=4):
            period_label = period.label or f"Period {period.period_number}"
            time_label = f"{period.start_time.strftime('%H:%M') if hasattr(period.start_time, 'strftime') else str(period.start_time)[:5]} - {period.end_time.strftime('%H:%M') if hasattr(period.end_time, 'strftime') else str(period.end_time)[:5]}"

            period_cell = ws.cell(row=row_i, column=1)
            period_cell.value = f"{period_label}\n{time_label}"
            period_cell.fill = period_fill
            period_cell.font = Font(bold=True, size=9)
            period_cell.alignment = center
            period_cell.border = thin_border
            ws.row_dimensions[row_i].height = 45

            if period.is_break or period.is_lunch:
                # Break/lunch row
                ws.merge_cells(f"A{row_i}:{get_column_letter(len(WORKING_DAYS) + 1)}{row_i}")
                period_cell.value = period.label or ("Lunch Break" if period.is_lunch else "Break")
                period_cell.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
                continue

            for col_i, day_idx in enumerate(WORKING_DAYS, start=2):
                cell = ws.cell(row=row_i, column=col_i)
                entry = entry_map.get((day_idx, period.period_number))

                if entry:
                    # Fetch subject + faculty + room info
                    sub_result = await self.db.execute(select(Subject).where(Subject.id == str(entry.subject_id)))
                    subject = sub_result.scalar_one_or_none()
                    fac_result = await self.db.execute(
                        select(User).join(Faculty, Faculty.user_id == User.id)
                        .where(Faculty.id == str(entry.faculty_id))
                    )
                    faculty_user = fac_result.scalar_one_or_none()
                    room = None
                    if entry.room_id:
                        room_result = await self.db.execute(select(Room).where(Room.id == str(entry.room_id)))
                        room = room_result.scalar_one_or_none()

                    sub_name = subject.name if subject else "Unknown"
                    fac_name = faculty_user.full_name if faculty_user else "TBD"
                    room_name = room.display_name if room else (room.room_number if room else "TBD")

                    cell.value = f"{sub_name}\n{fac_name}\n{room_name}"
                    cell.fill = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
                    cell.font = Font(size=9)
                else:
                    cell.value = ""
                    cell.fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

                cell.alignment = center
                cell.border = thin_border

        # Save to bytes
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer.read()

    async def generate_faculty_workload_excel(self, department_id: str | None = None) -> bytes:
        """
        Generate faculty workload Excel report.
        Shows each faculty member's assigned period count vs max.
        """
        try:
            import openpyxl
            from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
        except ImportError:
            raise RuntimeError("openpyxl is required for Excel export")

        from app.models.faculty import Faculty
        from app.models.user import User
        from app.models.timetable import TimetableEntry, TimetableVersion
        from app.models.department import Department
        from sqlalchemy import func

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Faculty Workload"

        # Headers
        headers = ["Employee ID", "Name", "Department", "Designation",
                   "Max Weekly Periods", "Assigned Periods", "Remaining", "Status"]

        header_fill = PatternFill(start_color="1A56DB", end_color="1A56DB", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")

        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        # Get all faculty with their assignment counts
        query = select(Faculty, User.full_name, Department.name.label('dept_name'))
        if department_id:
            query = query.where(Faculty.department_id == department_id)
        query = query.join(User, Faculty.user_id == User.id).join(Department, Faculty.department_id == Department.id)
        query = query.where(Faculty.is_active == True)

        result = await self.db.execute(query)
        faculty_data = result.all()

        for row_i, (faculty, full_name, dept_name) in enumerate(faculty_data, start=2):
            # Count assigned periods in published timetable
            count_result = await self.db.execute(
                select(func.count(TimetableEntry.id))
                .join(TimetableVersion, TimetableEntry.version_id == TimetableVersion.id)
                .where(
                    and_(
                        TimetableEntry.faculty_id == str(faculty.id),
                        TimetableVersion.status.in_(["published", "locked", "generated"])
                    )
                )
            )
            assigned = count_result.scalar() or 0
            remaining = faculty.max_weekly_periods - assigned
            status = "OK" if assigned <= faculty.max_weekly_periods else "OVERLOADED"

            row_data = [
                faculty.employee_id,
                full_name,
                dept_name,
                faculty.designation,
                faculty.max_weekly_periods,
                assigned,
                remaining,
                status,
            ]

            for col, value in enumerate(row_data, start=1):
                cell = ws.cell(row=row_i, column=col, value=value)
                if col == 8:  # Status column
                    cell.fill = PatternFill(
                        start_color="ECFDF5" if status == "OK" else "FEF2F2",
                        end_color="ECFDF5" if status == "OK" else "FEF2F2",
                        fill_type="solid"
                    )
                    cell.font = Font(
                        bold=True,
                        color="065F46" if status == "OK" else "991B1B"
                    )

        # Auto-width
        for col in ws.columns:
            max_len = max((len(str(cell.value or "")) for cell in col), default=10)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer.read()

    async def generate_template_excel(self, entity_type: str) -> bytes:
        """
        Generate an Excel template with ONLY headers and column descriptions.
        Never includes any data rows.
        """
        try:
            import openpyxl
            from openpyxl.styles import Font, PatternFill, Alignment
        except ImportError:
            raise RuntimeError("openpyxl is required for template generation")

        TEMPLATES: dict[str, list[tuple[str, str]]] = {
            "faculty": [
                ("employee_id", "Required. Unique employee ID (e.g. EMP001)"),
                ("full_name", "Required. Full name of faculty"),
                ("email", "Required. Institutional email address"),
                ("department_code", "Required. Department code (must match existing dept)"),
                ("designation", "Required. e.g. Assistant Professor / Lecturer"),
                ("specialization", "Optional. Area of specialization"),
                ("max_weekly_periods", "Optional. Default: 18"),
                ("min_weekly_periods", "Optional. Default: 0"),
            ],
            "subjects": [
                ("code", "Required. Unique subject code (e.g. CS301)"),
                ("name", "Required. Full subject name"),
                ("subject_type", "Required. theory/practical/laboratory/tutorial/seminar/elective"),
                ("credits", "Required. Number of credits"),
                ("weekly_periods", "Required. Periods per week"),
                ("lecture_periods", "Optional. Lecture periods per week"),
                ("tutorial_periods", "Optional. Tutorial periods per week"),
                ("practical_periods", "Optional. Practical periods per week"),
                ("semester_number", "Required. e.g. 1, 2, 3..."),
                ("requires_lab", "Optional. TRUE or FALSE"),
                ("requires_consecutive", "Optional. TRUE or FALSE (for lab sessions)"),
                ("consecutive_count", "Optional. Default: 2"),
            ],
            "rooms": [
                ("building", "Required. Building name/block"),
                ("room_number", "Required. Room number (e.g. 101, Lab-A)"),
                ("display_name", "Optional. Display name (auto-generated if empty)"),
                ("capacity", "Required. Seating capacity"),
                ("has_projector", "Optional. TRUE or FALSE"),
                ("has_ac", "Optional. TRUE or FALSE"),
            ],
            "classes": [
                ("program_code", "Required. Program code (must match existing program)"),
                ("year_level", "Required. Year (1/2/3/4)"),
                ("section", "Required. Section (A/B/C)"),
                ("strength", "Required. Number of students"),
            ],
        }

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"{entity_type.capitalize()} Import Template"

        columns = TEMPLATES.get(entity_type, [])
        if not columns:
            raise ValueError(f"Unknown entity type: {entity_type}")

        # Title
        ws.merge_cells(f"A1:{chr(65 + len(columns) - 1)}1")
        ws["A1"].value = f"SmartSchedule — {entity_type.capitalize()} Import Template"
        ws["A1"].font = Font(bold=True, size=13)
        ws["A1"].alignment = Alignment(horizontal="center")

        # Instruction
        ws.merge_cells(f"A2:{chr(65 + len(columns) - 1)}2")
        ws["A2"].value = "⚠️ Do NOT modify column headers. Fill data from row 4 onwards. Delete this instruction row before importing."
        ws["A2"].font = Font(color="991B1B", size=10)

        # Column headers row 3
        for col_i, (col_name, description) in enumerate(columns, start=1):
            header_cell = ws.cell(row=3, column=col_i, value=col_name)
            header_cell.fill = PatternFill(start_color="1A56DB", end_color="1A56DB", fill_type="solid")
            header_cell.font = Font(bold=True, color="FFFFFF")
            header_cell.alignment = Alignment(horizontal="center")

            # Description row 4
            desc_cell = ws.cell(row=4, column=col_i, value=description)
            desc_cell.fill = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
            desc_cell.font = Font(italic=True, size=9, color="475569")
            ws.column_dimensions[chr(65 + col_i - 1)].width = max(len(col_name), 20) + 2

        # Row 5 is where user data starts — intentionally empty

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer.read()
