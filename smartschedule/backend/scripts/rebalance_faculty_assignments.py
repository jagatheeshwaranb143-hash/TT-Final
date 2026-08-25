"""Balance faculty teaching load across each department's odd/even cycle."""
import asyncio
import sys
import uuid
from pathlib import Path

from sqlalchemy import delete, select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.models import (  # noqa: E402
    Class, ClassSubject, Department, Faculty, FacultySubject, Subject, TimetableEntry,
)


async def main() -> None:
    async with AsyncSessionLocal() as db:
        departments = list((await db.execute(select(Department).order_by(Department.code))).scalars())
        for department in departments:
            faculty = list((await db.execute(
                select(Faculty).where(Faculty.department_id == department.id).order_by(Faculty.name)
            )).scalars())
            subjects = list((await db.execute(
                select(Subject).where(Subject.department_id == department.id)
            )).scalars())
            classes = list((await db.execute(
                select(Class).where(Class.department_id == department.id)
            )).scalars())
            if not faculty or not subjects:
                continue

            subject_ids = [subject.id for subject in subjects]
            class_ids = [class_.id for class_ in classes]
            if class_ids:
                await db.execute(delete(TimetableEntry).where(TimetableEntry.class_id.in_(class_ids)))
            await db.execute(delete(FacultySubject).where(FacultySubject.subject_id.in_(subject_ids)))
            await db.flush()

            assignments = {}
            cycle_loads = {0: {member.id: 0 for member in faculty}, 1: {member.id: 0 for member in faculty}}
            for subject in sorted(subjects, key=lambda item: (-item.periods_per_week, item.code)):
                parity = (subject.semester or 1) % 2
                selected = min(
                    faculty,
                    key=lambda member: (cycle_loads[parity][member.id], member.name),
                )
                cycle_loads[parity][selected.id] += subject.periods_per_week
                assignments[subject.id] = selected.id
                db.add(FacultySubject(
                    id=str(uuid.uuid4()), faculty_id=selected.id, subject_id=subject.id
                ))

            class_subjects = list((await db.execute(
                select(ClassSubject).where(ClassSubject.class_id.in_(class_ids))
            )).scalars()) if class_ids else []
            for link in class_subjects:
                link.faculty_id = assignments[link.subject_id]

            print(
                f"{department.code}: odd loads={sorted(cycle_loads[1].values())}, "
                f"even loads={sorted(cycle_loads[0].values())}"
            )

        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
