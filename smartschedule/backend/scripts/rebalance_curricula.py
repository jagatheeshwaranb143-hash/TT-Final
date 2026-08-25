"""Balance department curricula so every semester fits the 42-slot timetable grid."""
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
    Class, ClassSubject, Department, FacultySubject, Subject, SubjectType, TimetableEntry,
)


async def main() -> None:
    async with AsyncSessionLocal() as db:
        departments = list((await db.execute(select(Department).order_by(Department.code))).scalars())
        for department in departments:
            subjects = list((await db.execute(
                select(Subject).where(Subject.department_id == department.id)
                .order_by(Subject.code)
            )).scalars())
            if not subjects:
                continue

            # Consecutive lab blocks can only satisfy weekly totals that are an
            # exact multiple of the configured block size.
            for subject in subjects:
                if subject.type == SubjectType.lab:
                    block_size = max(subject.lab_block_size or 2, 2)
                    remainder = subject.periods_per_week % block_size
                    if remainder:
                        subject.periods_per_week += block_size - remainder

            # Largest courses are placed first into the currently lightest
            # semester. This balances period load, not merely subject count.
            buckets = [{"periods": 0, "subjects": []} for _ in range(8)]
            for subject in sorted(subjects, key=lambda item: (-item.periods_per_week, item.code)):
                target = min(buckets, key=lambda bucket: (bucket["periods"], len(bucket["subjects"])))
                target["subjects"].append(subject)
                target["periods"] += subject.periods_per_week

            if max(bucket["periods"] for bucket in buckets) > 42:
                raise RuntimeError(f"{department.code} cannot fit within 42 periods per semester")

            classes = list((await db.execute(
                select(Class).where(Class.department_id == department.id)
            )).scalars())
            class_ids = [class_.id for class_ in classes]
            if class_ids:
                await db.execute(delete(TimetableEntry).where(TimetableEntry.class_id.in_(class_ids)))
                await db.execute(delete(ClassSubject).where(ClassSubject.class_id.in_(class_ids)))

            classes_by_semester = {class_.semester: class_ for class_ in classes if class_.section == "A"}
            for semester, bucket in enumerate(buckets, start=1):
                class_ = classes_by_semester.get(semester)
                if not class_:
                    class_ = Class(
                        id=str(uuid.uuid4()), department_id=department.id,
                        year=(semester + 1) // 2, semester=semester, section="A",
                    )
                    db.add(class_)
                    await db.flush()
                else:
                    class_.year = (semester + 1) // 2

                for subject in bucket["subjects"]:
                    subject.semester = semester
                    subject.year = (semester + 1) // 2
                    faculty_link = (await db.execute(select(FacultySubject).where(
                        FacultySubject.subject_id == subject.id
                    ).order_by(FacultySubject.id))).scalars().first()
                    if not faculty_link:
                        raise RuntimeError(f"Subject {subject.code} has no faculty assignment")
                    db.add(ClassSubject(
                        id=str(uuid.uuid4()), class_id=class_.id,
                        subject_id=subject.id, faculty_id=faculty_link.faculty_id,
                    ))

            print(
                f"{department.code}: subjects={len(subjects)}, "
                f"semester periods={[bucket['periods'] for bucket in buckets]}"
            )

        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
