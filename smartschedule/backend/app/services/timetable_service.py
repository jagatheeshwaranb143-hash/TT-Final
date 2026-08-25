"""
SmartSchedule — Timetable Service
Orchestrates validation, CP-SAT generation, and result persistence.
This is the bridge between the FastAPI endpoints and the CP-SAT scheduler engine.
NEVER uses dummy data — reads everything from real database records.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.exceptions import TimetableGenerationError
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


class DataValidationReport:
    """Result of pre-generation data validation."""

    def __init__(self):
        self.is_valid = True
        self.blocking_errors: list[dict] = []
        self.warnings: list[dict] = []

    def add_error(self, code: str, message: str, entity: str, entity_id: str | None = None):
        self.is_valid = False
        self.blocking_errors.append({
            "code": code, "message": message, "entity": entity,
            "entity_id": entity_id
        })

    def add_warning(self, code: str, message: str, entity: str):
        self.warnings.append({"code": code, "message": message, "entity": entity})

    def to_dict(self) -> dict:
        return {
            "is_valid": self.is_valid,
            "blocking_errors": self.blocking_errors,
            "warnings": self.warnings,
            "total_issues": len(self.blocking_errors) + len(self.warnings),
        }


class TimetableService:
    """
    Orchestrates timetable generation.
    Steps:
    1. validate_data_completeness()  — check all required data is set up
    2. _load_solver_data()           — load from DB into solver dataclasses
    3. _run_cp_sat()                 — call OR-Tools CP-SAT engine
    4. _persist_result()             — save timetable_entries to DB
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def validate_data_completeness(
        self,
        department_id: str,
        semester_id: str,
        academic_year_id: str,
    ) -> DataValidationReport:
        """
        Full pre-generation validation.
        Returns DataValidationReport — generation is BLOCKED if is_valid=False.
        """
        report = DataValidationReport()

        # ─── Get department ───
        from app.models.department import Department
        dept_result = await self.db.execute(
            select(Department).where(Department.id == department_id)
        )
        dept = dept_result.scalar_one_or_none()
        if not dept:
            report.add_error("DEPT_NOT_FOUND", "Department not found.", "departments", department_id)
            return report

        college_id = str(dept.college_id)

        # ─── Semester ───
        from app.models.college import Semester
        sem_result = await self.db.execute(
            select(Semester).where(Semester.id == semester_id)
        )
        sem = sem_result.scalar_one_or_none()
        if not sem:
            report.add_error("SEM_NOT_FOUND", "Semester not found.", "semesters", semester_id)
            return report

        # ─── Faculty ───
        from app.models.faculty import Faculty
        faculty_result = await self.db.execute(
            select(Faculty).where(Faculty.department_id == department_id, Faculty.is_active == True)
        )
        faculty_list = faculty_result.scalars().all()
        if not faculty_list:
            report.add_error(
                "NO_FACULTY",
                "No active faculty found in this department. Add faculty before generating.",
                "faculty"
            )

        # ─── Subjects ───
        from app.models.subject import Subject, FacultySubject
        subjects_result = await self.db.execute(
            select(Subject).where(Subject.department_id == department_id)
        )
        subjects = subjects_result.scalars().all()
        if not subjects:
            report.add_error(
                "NO_SUBJECTS",
                "No subjects found for this department. Add subjects before generating.",
                "subjects"
            )

        # ─── Subjects without faculty ───
        for subject in subjects:
            fs_result = await self.db.execute(
                select(FacultySubject).where(FacultySubject.subject_id == str(subject.id))
            )
            if not fs_result.scalars().first():
                report.add_error(
                    "SUBJECT_NO_FACULTY",
                    f'Subject "{subject.name}" ({subject.code}) has no faculty assigned.',
                    "faculty_subjects",
                    str(subject.id),
                )

        # ─── Classes ───
        from app.models.class_ import Class
        classes_result = await self.db.execute(
            select(Class).where(
                Class.semester_id == semester_id
            )
        )
        classes = classes_result.scalars().all()
        if not classes:
            report.add_error(
                "NO_CLASSES",
                "No classes found for this semester. Create classes first.",
                "classes"
            )


        # ─── Rooms ───
        from app.models.room import Room
        from sqlalchemy import or_
        rooms_result = await self.db.execute(
            select(Room).where(or_(Room.department_id == department_id, Room.department_id == None), Room.is_active == True)
        )
        rooms = rooms_result.scalars().all()
        if not rooms:
            report.add_error(
                "NO_ROOMS",
                "No active rooms found. Add classrooms before generating.",
                "rooms"
            )


        # ─── Working Days ───
        from app.models.period import WorkingDay
        wd_result = await self.db.execute(
            select(WorkingDay).where(WorkingDay.college_id == college_id, WorkingDay.is_working == True)
        )
        working_days = wd_result.scalars().all()
        if not working_days:
            report.add_error(
                "NO_WORKING_DAYS",
                "No working days configured. Set up working days before generating.",
                "working_days"
            )

        # ─── Period Configuration ───
        from app.models.period import PeriodConfiguration, Period
        pc_result = await self.db.execute(
            select(PeriodConfiguration).where(PeriodConfiguration.college_id == college_id)
        )
        period_config = pc_result.scalar_one_or_none()
        if not period_config:
            report.add_error(
                "NO_PERIOD_CONFIG",
                "No period schedule configured. Set up the daily period schedule before generating.",
                "periods"
            )
        else:
            # Check periods exist
            periods_result = await self.db.execute(
                select(Period).where(
                    Period.configuration_id == str(period_config.id),
                    Period.is_break == False,
                )
            )
            periods = periods_result.scalars().all()
            if not periods:
                report.add_error(
                    "NO_PERIODS",
                    "Period configuration has no time slots defined. Add periods.",
                    "periods"
                )


        # ─── Warnings (non-blocking) ───
        # Lab subjects without labs
        from app.models.laboratory import Laboratory
        from app.models.subject import SubjectType
        labs_result = await self.db.execute(
            select(func.count(Laboratory.id)).where(Laboratory.department_id == department_id, Laboratory.is_active == True)
        )

        lab_count = labs_result.scalar() or 0

        # Check lab subjects
        lab_stypes_res = await self.db.execute(select(SubjectType.id).where(SubjectType.requires_lab == True))
        lab_stype_ids = set(lab_stypes_res.scalars().all())
        lab_subjects = [s for s in subjects if s.subject_type_id in lab_stype_ids or getattr(s, 'requires_lab', False)]
        if lab_subjects and lab_count == 0:
            report.add_warning(
                "NO_LABS",
                f"{len(lab_subjects)} subject(s) require a lab but no labs are configured. "
                "Lab sessions will be scheduled in regular rooms.",
                "laboratories"
            )

        # Rooms capacity vs class strength
        if rooms and classes:
            max_room_capacity = max(r.capacity for r in rooms)
            for cls in classes:
                scount = getattr(cls, 'student_count', getattr(cls, 'strength', 60))
                if scount and scount > max_room_capacity:
                    report.add_warning(
                        "ROOM_CAPACITY_LOW",
                        f"Class {cls.section} has {scount} students but the largest room holds {max_room_capacity}.",
                        "rooms"
                    )


        logger.info(
            f"Data validation complete: dept={department_id}, "
            f"errors={len(report.blocking_errors)}, warnings={len(report.warnings)}"
        )
        return report

    async def load_solver_input(
        self,
        department_id: str,
        semester_id: str,
        academic_year_id: str,
    ) -> dict[str, Any]:
        """
        Load all required data from DB into raw Python dicts for the CP-SAT solver.
        Returns None if validation fails.
        """
        from app.models.faculty import Faculty, FacultyAvailability
        from app.models.subject import Subject, FacultySubject
        from app.models.room import Room
        from app.models.laboratory import Laboratory
        from app.models.period import WorkingDay, Period, PeriodConfiguration
        from app.models.class_ import Class, Batch
        from app.models.department import Department
        from app.models.user import User

        # Load department
        dept_result = await self.db.execute(select(Department).where(Department.id == department_id))
        dept = dept_result.scalar_one_or_none()
        college_id = str(dept.college_id)

        # Load faculty with availability
        faculty_result = await self.db.execute(
            select(Faculty, User.full_name).outerjoin(User, Faculty.user_id == User.id)
            .where(Faculty.department_id == department_id, Faculty.is_active == True)
        )
        faculty_data = []
        for faculty, name in faculty_result:
            availability_result = await self.db.execute(
                select(FacultyAvailability).where(FacultyAvailability.faculty_id == str(faculty.id))
            )
            availability = availability_result.scalars().all()
            faculty_data.append({
                "id": str(faculty.id),
                "name": name or faculty.name,
                "employee_id": getattr(faculty, 'code', str(faculty.id)[:8]),
                "max_weekly_periods": getattr(faculty, 'max_hours_per_week', 18) or 18,
                "min_weekly_periods": getattr(faculty, 'min_hours_per_week', 4) or 4,
                "unavailable_slots": [
                    (a.day_of_week, getattr(a, 'period_number', 0))
                    for a in availability
                    if not a.is_available
                ],
            })


        # Load classes with batches
        classes_result = await self.db.execute(
            select(Class).where(Class.semester_id == semester_id)
        )
        classes = classes_result.scalars().all()
        class_data = []
        for cls in classes:
            from app.models.class_ import Batch
            batch_result = await self.db.execute(
                select(Batch).where(Batch.class_id == str(cls.id))
            )
            batches = batch_result.scalars().all()
            class_data.append({
                "id": str(cls.id),
                "section": cls.section,
                "year_level": 2,
                "strength": getattr(cls, 'student_count', 60),
                "batches": [{"id": str(b.id), "name": b.name, "size": getattr(b, 'student_count', 30)} for b in batches],
            })

        # Load subjects with faculty assignments
        from app.models.subject import Subject, SubjectType, FacultySubject
        subjects_result = await self.db.execute(
            select(Subject, SubjectType)
            .outerjoin(SubjectType, Subject.subject_type_id == SubjectType.id)
            .where(Subject.department_id == department_id)
        )
        subjects_and_types = subjects_result.all()
        subject_data = []
        for subject, stype in subjects_and_types:
            fs_result = await self.db.execute(
                select(FacultySubject).where(FacultySubject.subject_id == str(subject.id))
            )
            assignments = fs_result.scalars().all()
            is_lab = bool(stype and (stype.requires_lab or stype.is_practical)) or getattr(subject, 'requires_lab', False)
            
            # Map faculty assignments to classes
            fac_assignments = []
            for fa in assignments:
                cls_id = getattr(fa, 'class_id', None)
                if cls_id:
                    fac_assignments.append({
                        "subject_id": str(subject.id),
                        "faculty_id": str(fa.faculty_id),
                        "class_id": str(cls_id),
                        "is_primary": fa.is_primary
                    })
                else:
                    for c in class_data:
                        fac_assignments.append({
                            "subject_id": str(subject.id),
                            "faculty_id": str(fa.faculty_id),
                            "class_id": c["id"],
                            "is_primary": fa.is_primary
                        })


            subject_data.append({
                "id": str(subject.id),
                "code": subject.code,
                "name": subject.name,
                "subject_type": stype.name if stype else "theory",
                "weekly_periods": getattr(subject, 'contact_hours_per_week', None) or getattr(subject, 'weekly_periods', 3),
                "requires_lab": is_lab,
                "requires_consecutive": is_lab,
                "consecutive_count": 2 if is_lab else 1,
                "preferred_days": subject.preferred_days or [],
                "restricted_days": getattr(subject, 'restricted_days', []) or [],
                "preferred_period_numbers": subject.preferred_period_numbers or [],
                "restricted_period_numbers": getattr(subject, 'restricted_period_numbers', []) or [],
                "faculty_assignments": fac_assignments,
            })


        # Load rooms
        from sqlalchemy import or_
        rooms_result = await self.db.execute(
            select(Room).where(or_(Room.department_id == department_id, Room.department_id == None), Room.is_active == True)
        )
        rooms = rooms_result.scalars().all()
        room_data = [
            {
                "id": str(r.id),
                "display_name": getattr(r, 'display_name', None) or getattr(r, 'name', 'Room'),
                "capacity": r.capacity,
                "available_days": [1, 2, 3, 4, 5],
            }
            for r in rooms
        ]

        # Load labs
        labs_result = await self.db.execute(
            select(Laboratory).where(Laboratory.department_id == department_id, Laboratory.is_active == True)
        )
        labs = labs_result.scalars().all()
        lab_data = [
            {
                "id": str(l.id),
                "name": l.name,
                "capacity": l.capacity,
                "batch_capacity": getattr(l, 'batch_capacity', 30) or 30,
                "requires_consecutive": True,
                "consecutive_count": 2,
                "available_days": getattr(l, 'available_days', None) or [1, 2, 3, 4, 5],
            }
            for l in labs
        ]



        # Load working days and periods
        wd_result = await self.db.execute(
            select(WorkingDay).where(WorkingDay.college_id == college_id, WorkingDay.is_working == True)
        )
        working_days = [wd.day_of_week for wd in wd_result.scalars().all()]

        pc_result = await self.db.execute(
            select(PeriodConfiguration).where(PeriodConfiguration.college_id == college_id)
        )
        period_config = pc_result.scalar_one_or_none()

        periods_data = []
        if period_config:
            periods_result = await self.db.execute(
                select(Period)
                .where(Period.configuration_id == str(period_config.id), Period.is_break == False)
                .order_by(Period.number)
            )
            periods_data = [
                {"number": p.number, "start_time": str(p.start_time), "end_time": str(p.end_time)}
                for p in periods_result.scalars().all()
            ]


        return {
            "department_id": department_id,
            "semester_id": semester_id,
            "academic_year_id": academic_year_id,
            "college_id": college_id,
            "faculty": faculty_data,
            "subjects": subject_data,
            "rooms": room_data,
            "labs": lab_data,
            "classes": class_data,
            "working_days": working_days,
            "periods": periods_data,
        }

    async def persist_result(
        self,
        solver_result: dict,
        version_id: str,
    ) -> int:
        """
        Save CP-SAT solver output into timetable_entries table.
        Returns count of entries inserted.
        """
        from app.models.timetable import TimetableEntry

        entries_inserted = 0
        entries = solver_result.get("entries", [])

        for entry in entries:
            new_entry = TimetableEntry(
                id=uuid.uuid4(),
                version_id=uuid.UUID(version_id),
                class_id=uuid.UUID(entry["class_id"]),
                subject_id=uuid.UUID(entry["subject_id"]),
                faculty_id=uuid.UUID(entry["faculty_id"]),
                room_id=uuid.UUID(entry["room_id"]) if entry.get("room_id") else None,
                lab_id=uuid.UUID(entry["lab_id"]) if entry.get("lab_id") else None,
                batch_id=uuid.UUID(entry["batch_id"]) if entry.get("batch_id") else None,
                day_of_week=entry["day_of_week"],
                period_number=entry["period_number"],
                is_locked=False,
                notes=None,
            )
            self.db.add(new_entry)
            entries_inserted += 1

        await self.db.flush()
        logger.info(f"Persisted {entries_inserted} timetable entries for version {version_id}")
        return entries_inserted

    async def create_version(
        self,
        department_id: str,
        semester_id: str,
        academic_year_id: str,
        college_id: str,
        name: str | None,
        generated_by_user_id: str,
        generation_params: dict,
    ) -> str:
        """Create a new TimetableVersion record and return its ID."""
        from app.models.timetable import TimetableVersion

        # Get next version number
        count_result = await self.db.execute(
            select(func.count(TimetableVersion.id)).where(
                and_(
                    TimetableVersion.department_id == department_id,
                    TimetableVersion.semester_id == semester_id,
                )
            )
        )
        version_number = (count_result.scalar() or 0) + 1

        version = TimetableVersion(
            id=uuid.uuid4(),
            college_id=uuid.UUID(college_id),
            department_id=uuid.UUID(department_id),
            semester_id=uuid.UUID(semester_id),
            academic_year_id=uuid.UUID(academic_year_id),
            name=name or f"Version {version_number}",
            version_number=version_number,
            status="draft",
            generated_by=uuid.UUID(generated_by_user_id),
            generated_at=datetime.now(timezone.utc),
            generation_params=generation_params,
            hard_violations=0,
            quality_score=None,
        )
        self.db.add(version)
        await self.db.flush()
        return str(version.id)
