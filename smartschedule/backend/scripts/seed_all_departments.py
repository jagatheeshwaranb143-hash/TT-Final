"""Idempotently complete demo curricula and faculty assignments for every department."""
import asyncio
import sys
import uuid
from pathlib import Path

from sqlalchemy import select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.models import (  # noqa: E402
    Class,
    ClassSubject,
    Department,
    Faculty,
    FacultySubject,
    Subject,
    SubjectType,
)


DEMO_DATA = {
    "CSE": {
        "faculty": ["Dr. C. Karthikeyan", "Ms. P. Nivetha", "Mr. R. Praveen", "Ms. S. Divya"],
        "subjects": [
            ("CS2301", "Data Structures", "theory", 4),
            ("CS2302", "Database Management Systems", "theory", 4),
            ("CS2303", "Operating Systems", "theory", 4),
            ("CS2304", "Computer Networks", "theory", 3),
            ("CS2311", "Data Structures Laboratory", "lab", 4),
            ("CS2312", "Database Management Systems Laboratory", "lab", 4),
        ],
    },
    "AIML": {
        "faculty": ["Dr. A. Meenakshi", "Mr. V. Arun", "Ms. K. Priyadharshini", "Mr. S. Naveen"],
        "subjects": [
            ("AM2301", "Artificial Intelligence", "theory", 4),
            ("AM2302", "Machine Learning", "theory", 4),
            ("AM2303", "Python Programming", "theory", 3),
            ("AM2304", "Data Science Fundamentals", "theory", 3),
            ("AM2311", "Machine Learning Laboratory", "lab", 4),
            ("AM2312", "Python Programming Laboratory", "lab", 4),
        ],
    },
    "EEE": {
        "faculty": ["Dr. E. Rajasekar", "Ms. T. Revathi", "Mr. K. Suresh", "Ms. R. Anitha"],
        "subjects": [
            ("EE2301", "Circuit Theory", "theory", 4),
            ("EE2302", "Electrical Machines", "theory", 4),
            ("EE2303", "Analog Electronics", "theory", 3),
            ("EE2304", "Electrical Measurements", "theory", 3),
            ("EE2311", "Electrical Machines Laboratory", "lab", 4),
            ("EE2312", "Circuits Laboratory", "lab", 4),
        ],
    },
    "CIVIL": {
        "faculty": ["Dr. R. Senthil", "Ms. V. Kavitha", "Mr. P. Aravind", "Ms. N. Deepa"],
        "subjects": [
            ("CE2301", "Structural Analysis", "theory", 4),
            ("CE2302", "Fluid Mechanics", "theory", 4),
            ("CE2303", "Surveying", "theory", 3),
            ("CE2304", "Concrete Technology", "theory", 3),
            ("CE2311", "Surveying Laboratory", "lab", 4),
            ("CE2312", "Construction Materials Laboratory", "lab", 4),
        ],
    },
}

# Department-specific topic catalogs used to name the 74 demonstration subjects.
# Each topic has a core course and an advanced/application course (37 x 2).
DEPARTMENT_TOPICS = {
    "CSE": [
        "Programming in C", "Programming in Python", "Object Oriented Programming",
        "Data Structures", "Design and Analysis of Algorithms", "Discrete Mathematics",
        "Computer Organization", "Operating Systems", "Database Management Systems",
        "Computer Networks", "Software Engineering", "Web Technologies",
        "Theory of Computation", "Compiler Design", "Artificial Intelligence",
        "Machine Learning", "Data Science", "Cloud Computing", "Cyber Security",
        "Cryptography and Network Security", "Internet of Things", "Mobile Computing",
        "Distributed Systems", "Big Data Analytics", "DevOps Engineering",
        "Human Computer Interaction", "Computer Graphics", "Digital Image Processing",
        "Natural Language Processing", "Blockchain Technology", "Parallel Computing",
        "Quantum Computing Fundamentals", "Information Retrieval", "Embedded Systems",
        "Full Stack Development", "Software Testing", "Project Engineering",
    ],
    "AIML": [
        "Python for Artificial Intelligence", "Data Structures for AI", "Linear Algebra for AI",
        "Probability and Statistics", "Artificial Intelligence", "Machine Learning",
        "Deep Learning", "Data Science", "Data Visualization", "Database Systems",
        "Optimization Techniques", "Natural Language Processing", "Computer Vision",
        "Reinforcement Learning", "Pattern Recognition", "Big Data Analytics",
        "Cloud Computing for AI", "Edge AI", "Explainable Artificial Intelligence",
        "Responsible AI and Ethics", "Generative Artificial Intelligence", "Large Language Models",
        "Speech Processing", "Robotics and Intelligent Systems", "Evolutionary Computing",
        "Fuzzy Logic", "Knowledge Representation", "Recommendation Systems",
        "Time Series Forecasting", "Graph Machine Learning", "MLOps",
        "AI Product Engineering", "Data Mining", "Business Intelligence",
        "Internet of Things Analytics", "Autonomous Systems", "AI Project Engineering",
    ],
    "EEE": [
        "Electrical Circuit Theory", "Engineering Electromagnetics", "Electrical Machines",
        "Power System Analysis", "Power Electronics", "Control Systems",
        "Analog Electronics", "Digital Electronics", "Signals and Systems",
        "Electrical Measurements", "Microprocessors and Microcontrollers", "Digital Signal Processing",
        "Transmission and Distribution", "Power System Protection", "High Voltage Engineering",
        "Renewable Energy Systems", "Smart Grid Technology", "Electric Drives",
        "Energy Conservation and Management", "Electrical Machine Design", "Embedded Systems",
        "Industrial Automation", "PLC and SCADA", "Electric Vehicle Technology",
        "Battery Management Systems", "Power Quality", "Flexible AC Transmission Systems",
        "Internet of Things for Electrical Systems", "Robotics and Mechatronics", "VLSI Design",
        "Biomedical Instrumentation", "Digital Control Systems", "Modern Power Converters",
        "Solar and Wind Energy", "Substation Engineering", "Electrical Safety",
        "Electrical Project Engineering",
    ],
    "CIVIL": [
        "Engineering Mechanics", "Construction Materials", "Building Planning and Drawing",
        "Surveying", "Strength of Materials", "Fluid Mechanics",
        "Structural Analysis", "Concrete Technology", "Geotechnical Engineering",
        "Transportation Engineering", "Environmental Engineering", "Water Resources Engineering",
        "Reinforced Concrete Design", "Steel Structure Design", "Foundation Engineering",
        "Hydrology", "Irrigation Engineering", "Highway Engineering",
        "Railway and Airport Engineering", "Construction Management", "Estimation and Costing",
        "Remote Sensing and GIS", "Earthquake Engineering", "Bridge Engineering",
        "Advanced Concrete Technology", "Soil Dynamics", "Coastal Engineering",
        "Urban Planning", "Wastewater Engineering", "Solid Waste Management",
        "Green Building Technology", "Building Information Modelling", "Prefabricated Structures",
        "Repair and Rehabilitation of Structures", "Traffic Engineering", "Disaster Management",
        "Civil Project Engineering",
    ],
}


async def main() -> None:
    stats = {"faculty": 0, "subjects": 0, "faculty_links": 0, "classes": 0, "class_links": 0}
    async with AsyncSessionLocal() as db:
        departments = {d.code.upper(): d for d in (await db.execute(select(Department))).scalars()}

        for code, config in DEMO_DATA.items():
            department = departments.get(code)
            if not department:
                print(f"[SKIP] Department {code} does not exist")
                continue

            existing_faculty = list((await db.execute(
                select(Faculty).where(Faculty.department_id == department.id).order_by(Faculty.name)
            )).scalars())
            names = {f.name.casefold() for f in existing_faculty}
            for name in config["faculty"]:
                if name.casefold() not in names:
                    faculty = Faculty(
                        id=str(uuid.uuid4()), name=name, department_id=department.id,
                        can_teach_all_classes=True,
                    )
                    db.add(faculty)
                    existing_faculty.append(faculty)
                    names.add(name.casefold())
                    stats["faculty"] += 1
            await db.flush()

            subjects_by_code = {
                s.code.upper(): s for s in (await db.execute(
                    select(Subject).where(Subject.department_id == department.id)
                )).scalars()
            }
            for index, (subject_code, name, kind, periods) in enumerate(config["subjects"]):
                subject = subjects_by_code.get(subject_code)
                if not subject:
                    subject = Subject(
                        id=str(uuid.uuid4()), name=name, code=subject_code,
                        department_id=department.id, year=2, semester=3,
                        type=SubjectType.lab if kind == "lab" else SubjectType.theory,
                        periods_per_week=periods, lab_block_size=2,
                    )
                    db.add(subject)
                    subjects_by_code[subject_code] = subject
                    stats["subjects"] += 1
                await db.flush()
                link = (await db.execute(select(FacultySubject).where(
                    FacultySubject.subject_id == subject.id
                ))).scalars().first()
                if not link:
                    faculty = existing_faculty[index % len(existing_faculty)]
                    db.add(FacultySubject(
                        id=str(uuid.uuid4()), faculty_id=faculty.id, subject_id=subject.id
                    ))
                    stats["faculty_links"] += 1
                    await db.flush()

            # Ensure older subjects are also assigned, without replacing any choice.
            all_subjects = list((await db.execute(
                select(Subject).where(Subject.department_id == department.id).order_by(Subject.code)
            )).scalars())
            for index, subject in enumerate(all_subjects):
                if subject.year is None:
                    subject.year = 2
                if subject.semester is None:
                    subject.semester = 3
                link = (await db.execute(select(FacultySubject).where(
                    FacultySubject.subject_id == subject.id
                ))).scalars().first()
                if not link:
                    faculty = existing_faculty[index % len(existing_faculty)]
                    db.add(FacultySubject(
                        id=str(uuid.uuid4()), faculty_id=faculty.id, subject_id=subject.id
                    ))
                    stats["faculty_links"] += 1
            await db.flush()

            class_ = (await db.execute(select(Class).where(
                Class.department_id == department.id,
                Class.year == 2,
                Class.semester == 3,
                Class.section == "A",
            ))).scalar_one_or_none()
            if not class_:
                class_ = Class(
                    id=str(uuid.uuid4()), department_id=department.id,
                    year=2, semester=3, section="A",
                )
                db.add(class_)
                stats["classes"] += 1
                await db.flush()

            for subject in all_subjects:
                if subject.year != 2 or subject.semester != 3:
                    continue
                class_link = (await db.execute(select(ClassSubject).where(
                    ClassSubject.class_id == class_.id,
                    ClassSubject.subject_id == subject.id,
                ))).scalar_one_or_none()
                if not class_link:
                    faculty_link = (await db.execute(select(FacultySubject).where(
                        FacultySubject.subject_id == subject.id
                    ))).scalars().first()
                    db.add(ClassSubject(
                        id=str(uuid.uuid4()), class_id=class_.id,
                        subject_id=subject.id,
                        faculty_id=faculty_link.faculty_id if faculty_link else None,
                    ))
                    stats["class_links"] += 1

        # Expand every department to the uniform demonstration target requested
        # by the project owner. AI&DS supplies the eight-semester distribution;
        # existing department records are preserved and only missing rows added.
        template_department = departments.get("AI&DS")
        template_subjects = list((await db.execute(
            select(Subject).where(Subject.department_id == template_department.id)
            .order_by(Subject.semester, Subject.code)
        )).scalars()) if template_department else []

        for code, department in departments.items():
            faculty = list((await db.execute(
                select(Faculty).where(Faculty.department_id == department.id).order_by(Faculty.name)
            )).scalars())
            while len(faculty) < 8:
                number = len(faculty) + 1
                member = Faculty(
                    id=str(uuid.uuid4()),
                    name=f"{code} Demo Faculty {number:02d}",
                    department_id=department.id,
                    can_teach_all_classes=True,
                )
                db.add(member)
                faculty.append(member)
                stats["faculty"] += 1
            await db.flush()

            subjects = list((await db.execute(
                select(Subject).where(Subject.department_id == department.id).order_by(Subject.code)
            )).scalars())
            existing_codes = {subject.code.upper() for subject in subjects}
            template_index = 0
            while len(subjects) < 74:
                source = template_subjects[template_index % len(template_subjects)]
                sequence = len(subjects) + 1
                subject_code = f"{code.replace('&', '')}{sequence:03d}"
                while subject_code.upper() in existing_codes:
                    sequence += 1
                    subject_code = f"{code.replace('&', '')}{sequence:03d}"
                subject = Subject(
                    id=str(uuid.uuid4()),
                    name=source.name,
                    code=subject_code,
                    department_id=department.id,
                    year=source.year or ((source.semester or 1) + 1) // 2,
                    semester=source.semester or 1,
                    type=source.type,
                    periods_per_week=source.periods_per_week,
                    lab_block_size=source.lab_block_size,
                )
                db.add(subject)
                subjects.append(subject)
                existing_codes.add(subject_code.upper())
                stats["subjects"] += 1
                template_index += 1
            await db.flush()

            topics = DEPARTMENT_TOPICS.get(code)
            if topics:
                ordered_subjects = sorted(
                    subjects,
                    key=lambda item: (item.semester or 1, item.type.value, item.code),
                )
                for index, subject in enumerate(ordered_subjects):
                    topic = topics[index % len(topics)]
                    if subject.type == SubjectType.lab:
                        subject.name = f"{topic} Laboratory"
                    elif index >= len(topics):
                        subject.name = topic if topic.startswith("Advanced ") else f"Advanced {topic}"
                    else:
                        subject.name = topic

            for index, subject in enumerate(subjects):
                faculty_link = (await db.execute(select(FacultySubject).where(
                    FacultySubject.subject_id == subject.id
                ))).scalars().first()
                if not faculty_link:
                    faculty_link = FacultySubject(
                        id=str(uuid.uuid4()), faculty_id=faculty[index % 8].id,
                        subject_id=subject.id,
                    )
                    db.add(faculty_link)
                    stats["faculty_links"] += 1
                    await db.flush()

                year = subject.year or ((subject.semester or 1) + 1) // 2
                semester = subject.semester or 1
                class_ = (await db.execute(select(Class).where(
                    Class.department_id == department.id,
                    Class.year == year,
                    Class.semester == semester,
                    Class.section == "A",
                ))).scalar_one_or_none()
                if not class_:
                    class_ = Class(
                        id=str(uuid.uuid4()), department_id=department.id,
                        year=year, semester=semester, section="A",
                    )
                    db.add(class_)
                    stats["classes"] += 1
                    await db.flush()
                class_link = (await db.execute(select(ClassSubject).where(
                    ClassSubject.class_id == class_.id,
                    ClassSubject.subject_id == subject.id,
                ))).scalar_one_or_none()
                if not class_link:
                    db.add(ClassSubject(
                        id=str(uuid.uuid4()), class_id=class_.id,
                        subject_id=subject.id, faculty_id=faculty_link.faculty_id,
                    ))
                    stats["class_links"] += 1

            # Keep all eight semester selectors available even if a department
            # currently has no subject in one of those semesters.
            for semester in range(1, 9):
                class_ = (await db.execute(select(Class).where(
                    Class.department_id == department.id,
                    Class.year == (semester + 1) // 2,
                    Class.semester == semester,
                    Class.section == "A",
                ))).scalar_one_or_none()
                if not class_:
                    db.add(Class(
                        id=str(uuid.uuid4()), department_id=department.id,
                        year=(semester + 1) // 2, semester=semester, section="A",
                    ))
                    stats["classes"] += 1

        await db.commit()

    print("Completed demo academic data:", stats)


if __name__ == "__main__":
    asyncio.run(main())
