"""Create and assign an 8-semester AI&DS curriculum without duplicating data."""
import asyncio
import uuid

from sqlalchemy import delete, func, select

from app.db.session import AsyncSessionLocal
from app.models.models import (
    Class,
    ClassSubject,
    Department,
    Faculty,
    FacultySubject,
    Subject,
    SubjectType,
    TimetableEntry,
)


CURRICULUM = {
    1: (["Engineering Mathematics I", "Engineering Physics", "Programming in C", "Basic Electrical Engineering", "Engineering Graphics", "Communication Skills"], ["C Programming Lab", "Engineering Physics Lab"]),
    2: (["Engineering Mathematics II", "Data Structures", "Digital Logic Design", "Object Oriented Programming", "Probability and Statistics", "Environmental Studies"], ["Data Structures Lab", "OOP Lab"]),
    3: (["Discrete Mathematics", "Database Management Systems", "Computer Organization", "Design and Analysis of Algorithms", "Operating Systems", "Artificial Intelligence Foundations"], ["DBMS Lab", "Algorithms Lab"]),
    4: (["Linear Algebra for AI", "Machine Learning", "Computer Networks", "Software Engineering", "Data Mining", "Theory of Computation"], ["Machine Learning Lab", "Networks Lab"]),
    5: (["Deep Learning", "Natural Language Processing", "Big Data Analytics", "Cloud Computing", "Information Security", "Operations Research"], ["Deep Learning Lab", "Big Data Analytics Lab"]),
    6: (["Computer Vision", "Data Visualization", "Internet of Things", "Distributed Systems", "Reinforcement Learning", "Web Technologies"], ["Computer Vision Lab", "IoT Lab"]),
    7: (["Generative AI", "MLOps", "Responsible AI", "Data Engineering", "Edge AI", "Professional Elective I"], ["MLOps Lab", "Generative AI Lab"]),
    8: (["Explainable AI", "AI Product Management", "Advanced Analytics", "Cyber Physical Systems", "Professional Elective II", "Entrepreneurship and Ethics"], ["Advanced AI Lab", "Capstone Project Lab"]),
}


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Department).where(
                (func.upper(Department.code).in_(["AI&DS", "AIDS", "AI-DS"]))
                | (func.upper(Department.name).like("%ARTIFICIAL INTELLIGENCE%DATA SCIENCE%"))
            )
        )
        department = result.scalars().first()
        if not department:
            raise RuntimeError("AI&DS department was not found. Create it first.")

        faculty = list((await db.execute(
            select(Faculty).where(Faculty.department_id == department.id).order_by(Faculty.name)
        )).scalars())
        while len(faculty) < 4:
            member = Faculty(
                id=str(uuid.uuid4()),
                name=f"AI&DS Faculty {len(faculty) + 1}",
                department_id=department.id,
                can_teach_all_classes=True,
            )
            db.add(member)
            faculty.append(member)

        created_subjects = 0
        created_classes = 0
        assigned_classes = 0

        for semester, (theory_names, lab_names) in CURRICULUM.items():
            year = (semester + 1) // 2
            semester_subjects = []
            for index, (name, subject_type) in enumerate(
                [(name, SubjectType.theory) for name in theory_names]
                + [(name, SubjectType.lab) for name in lab_names],
                start=1,
            ):
                code = f"AIDS{semester}{index:02d}"
                subject = (await db.execute(
                    select(Subject).where(
                        Subject.department_id == department.id,
                        func.upper(Subject.code) == code,
                    )
                )).scalar_one_or_none()
                if not subject:
                    subject = Subject(
                        id=str(uuid.uuid4()), name=name, code=code,
                        department_id=department.id, year=year, semester=semester,
                        type=subject_type,
                        periods_per_week=4 if subject_type == SubjectType.theory else 2,
                        lab_block_size=1 if subject_type == SubjectType.theory else 2,
                    )
                    db.add(subject)
                    created_subjects += 1
                else:
                    subject.year = year
                    subject.semester = semester
                    subject.type = subject_type
                semester_subjects.append(subject)

            await db.flush()
            for index, subject in enumerate(semester_subjects):
                teacher = faculty[index % len(faculty)]
                mapping = (await db.execute(select(FacultySubject).where(
                    FacultySubject.faculty_id == teacher.id,
                    FacultySubject.subject_id == subject.id,
                ))).scalar_one_or_none()
                if not mapping:
                    db.add(FacultySubject(id=str(uuid.uuid4()), faculty_id=teacher.id, subject_id=subject.id))

            classes = list((await db.execute(select(Class).where(
                Class.department_id == department.id,
                Class.year == year,
                Class.semester == semester,
            ))).scalars())
            if not classes:
                new_class = Class(id=str(uuid.uuid4()), department_id=department.id, year=year, semester=semester, section="A")
                db.add(new_class)
                await db.flush()
                classes = [new_class]
                created_classes += 1

            for class_ in classes:
                await db.execute(delete(TimetableEntry).where(TimetableEntry.class_id == class_.id))
                await db.execute(delete(ClassSubject).where(ClassSubject.class_id == class_.id))
                for index, subject in enumerate(semester_subjects):
                    teacher = faculty[index % len(faculty)]
                    db.add(ClassSubject(
                        id=str(uuid.uuid4()), class_id=class_.id,
                        subject_id=subject.id, faculty_id=teacher.id,
                    ))
                assigned_classes += 1

        await db.commit()
        print(f"AI&DS curriculum ready: {created_subjects} subjects created, "
              f"{created_classes} classes created, {assigned_classes} classes assigned.")


if __name__ == "__main__":
    asyncio.run(main())
