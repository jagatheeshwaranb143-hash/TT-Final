"""
SmartSchedule — Academic Data Seeder & Timetable Generation Script
Seeds complete academic dataset into SQLite including:
- Department AI&DS (Artificial Intelligence and Data Science)
- Departments MBA, AI&ML, PHY, ENG, CSE
- Faculty:
    * Mrs. K.Pradeepa (KPA) - Human Value and Ethics (HVE, 4 p/wk) - MBA
    * Ms. M.Bharathi (MBI) - Total Quality Management (TQM, 5 p/wk) - MBA
    * Mr. E.Sriram Manishkumar (ESR) - IT in Agricultural Sector (ITA, 6 p/wk) - AI&ML
    * Mr. R.Vijay Anand (RVD) - Nano Technology (NT, 6 p/wk) - PHY
    * Ms. A.Rexcy (ARY) - Project Report Writing (PRW, 5 p/wk) - ENG
    * AI&DS Faculty (PKT, SWM, SEL, DVM, IND, JPR)
- Master Class Timetables & Derived Staff Personal Timetables
"""
import asyncio
import uuid
import sys
import os
from datetime import date, time, datetime, timezone
from pathlib import Path

# Add backend and parent directories to sys.path
backend_dir = Path(__file__).resolve().parent
parent_dir = backend_dir.parent
for d in (str(backend_dir), str(parent_dir)):
    if d not in sys.path:
        sys.path.insert(0, d)

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(backend_dir, '.env'))

from app.db.session import AsyncSessionLocal, engine, Base
from sqlalchemy import select, delete


async def seed_and_generate():
    print("=" * 70)
    print("  SmartSchedule — Academic Seeder & AI Timetable Generator")
    print("=" * 70)

    # Import ALL models so SQLAlchemy Base metadata knows about all tables
    import app.models  # noqa: F401
    from app.models.college import College, AcademicYear, Semester
    from app.models.department import Department, Program
    from app.models.class_ import Class, Batch
    from app.models.faculty import Faculty, FacultyAvailability
    from app.models.subject import Subject, SubjectType, FacultySubject
    from app.models.room import Room, RoomType
    from app.models.laboratory import Laboratory
    from app.models.period import WorkingDay, PeriodConfiguration, Period
    from app.models.user import User
    from app.models.timetable import TimetableVersion, TimetableEntry

    # Recreate tables to ensure schema modifications are active
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. College
        res = await session.execute(select(College).where(College.code == "SEC"))
        college = res.scalar_one_or_none()
        if not college:
            college = College(
                id=uuid.uuid4(),
                name="Sudharsan Engineering College",
                code="SEC",
                address="Sathiyamangalam, Pudukkottai - 622501, Tamil Nadu",
                contact_email="principal@sec.ac.in",
                contact_phone="+91 9843490901",
                website="https://www.sec.ac.in",
            )
            session.add(college)
            await session.flush()
            print(f"[+] Created College: {college.name} ({college.code})")

        # Admin user association
        from app.core.security import hash_password
        admin_res = await session.execute(select(User).where(User.email == "admin@smartschedule.dev"))
        admin_user = admin_res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                email="admin@smartschedule.dev",
                full_name="System Administrator",
                role="super_admin",
                password_hash=hash_password("admin123"),
                college_id=str(college.id),
                is_active=True,
            )
            session.add(admin_user)
            await session.flush()
        else:
            admin_user.college_id = str(college.id)

        # 2. Academic Year
        res = await session.execute(
            select(AcademicYear).where(AcademicYear.college_id == college.id, AcademicYear.name == "2026-2027")
        )
        acad_year = res.scalar_one_or_none()
        if not acad_year:
            acad_year = AcademicYear(
                id=uuid.uuid4(),
                college_id=college.id,
                name="2026-2027",
                start_date=date(2026, 8, 1),
                end_date=date(2027, 5, 31),
                is_current=True,
                status="active",
            )
            session.add(acad_year)
            await session.flush()

        # 3. Semesters (Sem 7 for AI&DS, Sem 3 for CSE, Sem 1 for others)
        semesters = {}
        for sem_num, name in [(7, "Semester 7 (Odd)"), (5, "Semester 5 (Odd)"), (3, "Semester 3 (Odd)"), (1, "Semester 1 (Odd)")]:
            res = await session.execute(
                select(Semester).where(Semester.academic_year_id == acad_year.id, Semester.number == sem_num)
            )
            sem = res.scalar_one_or_none()
            if not sem:
                sem = Semester(
                    id=uuid.uuid4(),
                    academic_year_id=acad_year.id,
                    name=name,
                    number=sem_num,
                    start_date=date(2026, 8, 1),
                    end_date=date(2026, 12, 31),
                    status="active",
                )
                session.add(sem)
                await session.flush()
            semesters[sem_num] = sem

        # 4. Departments
        depts_info = [
            ("Artificial Intelligence and Data Science", "AI&DS"),
            ("Master of Business Administration",       "MBA"),
            ("Artificial Intelligence & Machine Learning","AI&ML"),
            ("Department of Physics",                   "PHY"),
            ("Department of English",                   "ENG"),
            ("Computer Science & Engineering",          "CSE"),
        ]
        depts = {}
        for dname, dcode in depts_info:
            res = await session.execute(
                select(Department).where(Department.college_id == college.id, Department.code == dcode)
            )
            dept = res.scalar_one_or_none()
            if not dept:
                dept = Department(
                    id=uuid.uuid4(),
                    college_id=college.id,
                    name=dname,
                    code=dcode,
                )
                session.add(dept)
                await session.flush()
                print(f"[+] Created Department: {dept.name} ({dept.code})")
            depts[dcode] = dept

        # 5. Programs
        programs = {}
        progs_info = [
            ("AI&DS", "B.Tech - Artificial Intelligence and Data Science", "BTECH-AIDS", 4),
            ("MBA",   "Master of Business Administration",                 "MBA",        2),
            ("AI&ML", "B.E. - Artificial Intelligence and Machine Learning","BE-AIML",   4),
            ("PHY",   "Physics Humanities Division",                       "BSC-PHY",    3),
            ("ENG",   "English Language & Humanities",                     "BA-ENG",     3),
            ("CSE",   "B.E. Computer Science & Engineering",               "BE-CSE",     4),
        ]
        for dcode, pname, pcode, duration in progs_info:
            dept = depts[dcode]
            res = await session.execute(
                select(Program).where(Program.department_id == dept.id, Program.code == pcode)
            )
            prog = res.scalar_one_or_none()
            if not prog:
                prog = Program(
                    id=uuid.uuid4(),
                    department_id=dept.id,
                    name=pname,
                    code=pcode,
                    duration_years=duration,
                )
                session.add(prog)
                await session.flush()
            programs[dcode] = prog

        # 6. Subject Types
        st_theory_res = await session.execute(select(SubjectType).where(SubjectType.name == "Theory"))
        st_theory = st_theory_res.scalar_one_or_none()
        if not st_theory:
            st_theory = SubjectType(id=uuid.uuid4(), name="Theory", is_practical=False, requires_lab=False)
            session.add(st_theory)

        st_lab_res = await session.execute(select(SubjectType).where(SubjectType.name == "Practical / Lab"))
        st_lab = st_lab_res.scalar_one_or_none()
        if not st_lab:
            st_lab = SubjectType(id=uuid.uuid4(), name="Practical / Lab", is_practical=True, requires_lab=True)
            session.add(st_lab)
        await session.flush()

        # 7. Classes
        classes = {}
        classes_data = [
            ("AI&DS", 7, "AI&DS IV-A", "A", 60),
            ("MBA",   1, "MBA I-A",     "A", 50),
            ("AI&ML", 5, "AI&ML III-A", "A", 60),
            ("PHY",   1, "PHY I-A",     "A", 40),
            ("ENG",   1, "ENG I-A",     "A", 40),
            ("CSE",   3, "CSE III-A",   "A", 60),
        ]
        for dcode, sem_num, cname, sec, count in classes_data:
            prog = programs[dcode]
            sem = semesters[sem_num]
            res = await session.execute(
                select(Class).where(Class.program_id == prog.id, Class.semester_id == sem.id, Class.section == sec)
            )
            cls = res.scalar_one_or_none()
            if not cls:
                cls = Class(
                    id=uuid.uuid4(),
                    program_id=prog.id,
                    semester_id=sem.id,
                    name=cname,
                    section=sec,
                    student_count=count,
                )
                session.add(cls)
                await session.flush()
                print(f"[+] Created Class: {cls.name}")
            classes[dcode] = cls

        # 8. Faculty Members (including prompt requirements)
        faculty_dataset = [
            # Prompt specified faculty
            ("Mrs. K.Pradeepa",          "KPA", "kpradeepa@sec.ac.in",        "Assistant Professor", "MBA",   4, 2),
            ("Ms. M.Bharathi",           "MBI", "mbharathi@sec.ac.in",        "Assistant Professor", "MBA",   5, 2),
            ("Mr. E.Sriram Manishkumar", "ESR", "esriram@sec.ac.in",          "Assistant Professor", "AI&ML", 6, 2),
            ("Mr. R.Vijay Anand",        "RVD", "rvijayanand@sec.ac.in",     "Assistant Professor", "PHY",   6, 2),
            ("Ms. A.Rexcy",              "ARY", "arexcy@sec.ac.in",           "Assistant Professor", "ENG",   5, 2),
            # AI&DS faculty
            ("Mrs. T. Porkodi",          "PKT", "porkodit@sec.ac.in",         "Head of Department",  "AI&DS", 18, 4),
            ("Ms. M. Sowmiya",           "SWM", "sowmiyam@sec.ac.in",         "Assistant Professor", "AI&DS", 18, 4),
            ("Mrs. N. Selvakumari",      "SEL", "selvakumarin@sec.ac.in",    "Assistant Professor", "AI&DS", 18, 4),
            ("Mr. M. Dhavamani",         "DVM", "dhavamanim@sec.ac.in",       "Assistant Professor", "AI&DS", 18, 4),
            ("Mrs. P. Indu",             "IND", "indup@sec.ac.in",            "Assistant Professor", "AI&DS", 18, 4),
            ("Mrs. I. Jeni Priyanga",    "JPR", "jenipriyangi@sec.ac.in",     "Teaching Assistant",  "AI&DS", 15, 3),
            # CSE faculty
            ("Dr. Sujatha P",            "SUJ", "sujathap@sec.ac.in",         "Professor & HOD",     "CSE",   20, 4),
            ("Mrs. Parvathi P",          "PAR", "parvathip@sec.ac.in",        "Assistant Professor", "CSE",   18, 4),
        ]

        faculties = {}
        for name, code, email, desig, dcode, max_w, max_d in faculty_dataset:
            dept = depts[dcode]
            res = await session.execute(
                select(Faculty).where(Faculty.department_id == dept.id, Faculty.code == code)
            )
            fac = res.scalar_one_or_none()
            if not fac:
                fac = Faculty(
                    id=uuid.uuid4(),
                    department_id=dept.id,
                    name=name,
                    code=code,
                    email=email,
                    designation=desig,
                    max_hours_per_week=max_w,
                    max_hours_per_day=max_d,
                    is_active=True,
                )
                session.add(fac)
                await session.flush()
                # Availability
                for d in range(1, 6):
                    avail = FacultyAvailability(
                        id=uuid.uuid4(),
                        faculty_id=fac.id,
                        day_of_week=d,
                        start_time=time(9, 0),
                        end_time=time(16, 0),
                        is_available=True,
                    )
                    session.add(avail)
                print(f"[+] Created Faculty: {fac.name} ({fac.code}) - {fac.designation} [{dcode}]")
            faculties[code] = fac

        # 9. Subjects (Prompt requirements & curriculum)
        subject_dataset = [
            # (Name, Code, Credits, Contact_hrs, SubjectType, Dept, FacultyCode)
            ("Human Value and Ethics",          "HVE",    4, 4, st_theory, "MBA",   "KPA"),
            ("Total Quality Management",        "TQM",    5, 5, st_theory, "MBA",   "MBI"),
            ("IT in Agricultural Sector",       "ITA",    6, 6, st_theory, "AI&ML", "ESR"),
            ("Nano Technology",                 "NT",     3, 6, st_theory, "PHY",   "RVD"),
            ("Project Report Writing",          "PRW",    5, 5, st_theory, "ENG",   "ARY"),
            # AI&DS curriculum
            ("Deep Learning",                   "AI4011", 4, 4, st_theory, "AI&DS", "PKT"),
            ("Natural Language Processing",     "AI4021", 3, 3, st_theory, "AI&DS", "SWM"),
            ("Reinforcement Learning",          "AI4031", 3, 3, st_theory, "AI&DS", "SEL"),
            ("Cloud Computing & IoT",           "AI4041", 3, 3, st_theory, "AI&DS", "DVM"),
            ("Professional Ethics",             "HS4011", 2, 2, st_theory, "AI&DS", "ARY"),  # Cross-dept ARY
            ("Deep Learning Lab",               "AI4081", 2, 4, st_lab,    "AI&DS", "PKT"),
            ("NLP Lab",                         "AI4091", 2, 4, st_lab,    "AI&DS", "SWM"),
            ("Project Work",                    "AI4099", 6, 6, st_lab,    "AI&DS", "PKT"),
            # CSE
            ("Data Structures",                 "CS3301", 4, 4, st_theory, "CSE",   "SUJ"),
            ("Computer Architecture",           "CS3302", 4, 4, st_theory, "CSE",   "PAR"),
        ]

        subjects = {}
        for sname, scode, creds, contact_hrs, stype, dcode, fac_code in subject_dataset:
            dept = depts[dcode]
            res = await session.execute(
                select(Subject).where(Subject.department_id == dept.id, Subject.code == scode)
            )
            subj = res.scalar_one_or_none()
            if not subj:
                subj = Subject(
                    id=uuid.uuid4(),
                    department_id=dept.id,
                    subject_type_id=stype.id,
                    name=sname,
                    code=scode,
                    credits=creds,
                    contact_hours_per_week=contact_hrs,
                    preferred_days=[1, 2, 3, 4, 5],
                    preferred_period_numbers=[1, 2, 3, 4, 5, 6, 7],
                )
                session.add(subj)
                await session.flush()
                # Assign faculty subject mapping
                if fac_code in faculties:
                    fs = FacultySubject(
                        id=uuid.uuid4(),
                        faculty_id=faculties[fac_code].id,
                        subject_id=subj.id,
                        is_primary=True,
                    )
                    session.add(fs)
                print(f"[+] Created Subject: {subj.name} ({subj.code}) [{dcode}] -> {fac_code}")
            subjects[scode] = subj

        # 10. Rooms & Labs
        rt_res = await session.execute(select(RoomType).where(RoomType.name == "Lecture Hall"))
        room_type = rt_res.scalar_one_or_none()
        if not room_type:
            room_type = RoomType(id=uuid.uuid4(), name="Lecture Hall")
            session.add(room_type)
            await session.flush()

        rooms = {}
        rooms_data = [
            ("AI&DS", "Hall 202 (AI&DS)"),
            ("MBA",   "MBA Seminar Room 1"),
            ("AI&ML", "AI&ML Room 104"),
            ("PHY",   "Physics Lab Hall"),
            ("ENG",   "Language Lab Hall"),
            ("CSE",   "CSE Seminar Hall A"),
        ]
        for dcode, rname in rooms_data:
            dept = depts[dcode]
            res = await session.execute(
                select(Room).where(Room.department_id == dept.id, Room.name == rname)
            )
            rm = res.scalar_one_or_none()
            if not rm:
                rm = Room(
                    id=uuid.uuid4(),
                    department_id=dept.id,
                    room_type_id=room_type.id,
                    building=f"{dcode} Block",
                    name=rname,
                    floor="1",
                    capacity=60,
                    is_active=True,
                )
                session.add(rm)
                await session.flush()
            rooms[dcode] = rm

        labs = {}
        labs_data = [
            ("AI&DS", "AI & Data Science High-Perf Lab"),
            ("CSE",   "Advanced Computing Lab"),
        ]
        for dcode, lname in labs_data:
            dept = depts[dcode]
            res = await session.execute(
                select(Laboratory).where(Laboratory.department_id == dept.id, Laboratory.name == lname)
            )
            lab = res.scalar_one_or_none()
            if not lab:
                lab = Laboratory(
                    id=uuid.uuid4(),
                    department_id=dept.id,
                    building=f"{dcode} Lab Complex",
                    name=lname,
                    capacity=40,
                    available_days=[1, 2, 3, 4, 5],
                    is_active=True,
                )
                session.add(lab)
                await session.flush()
            labs[dcode] = lab

        # 11. Working Days & Periods
        res = await session.execute(select(WorkingDay).where(WorkingDay.college_id == college.id))
        if not res.scalars().all():
            for d in range(1, 8):
                session.add(WorkingDay(id=uuid.uuid4(), college_id=college.id, day_of_week=d, is_working=(d <= 5)))

        res = await session.execute(select(PeriodConfiguration).where(PeriodConfiguration.college_id == college.id))
        pconfig = res.scalar_one_or_none()
        if not pconfig:
            pconfig = PeriodConfiguration(id=uuid.uuid4(), college_id=college.id, name="SEC 7-Period Daily Schedule", is_default=True)
            session.add(pconfig)
            await session.flush()

            slots = [
                (1, time(9, 0),  time(9, 50),  False, None),
                (2, time(9, 50), time(10, 40), False, None),
                (0, time(10,40), time(10, 55), True,  "Tea Break"),
                (3, time(10,55), time(11, 45), False, None),
                (4, time(11,45), time(12, 35), False, None),
                (0, time(12,35), time(13, 20), True,  "Lunch Break"),
                (5, time(13,20), time(14, 10), False, None),
                (6, time(14,10), time(15, 0),  False, None),
                (7, time(15,0),  time(15, 50), False, None),
            ]
            for pnum, st, et, is_b, bname in slots:
                session.add(Period(id=uuid.uuid4(), configuration_id=pconfig.id, number=pnum, start_time=st, end_time=et, is_break=is_b, break_name=bname))

        await session.flush()

        # 12. Create Master Timetable Versions & Timetable Entries
        print("\n[*] Populating Master Timetable Versions & Schedule Grid Entries...")
        
        # Published version for AI&DS
        aids_dept = depts["AI&DS"]
        aids_sem = semesters[7]
        aids_class = classes["AI&DS"]

        res = await session.execute(
            select(TimetableVersion).where(
                TimetableVersion.department_id == aids_dept.id,
                TimetableVersion.semester_id == aids_sem.id,
                TimetableVersion.status == "published"
            )
        )
        aids_version = res.scalar_one_or_none()
        if not aids_version:
            aids_version = TimetableVersion(
                id=uuid.uuid4(),
                college_id=college.id,
                department_id=aids_dept.id,
                semester_id=aids_sem.id,
                academic_year_id=acad_year.id,
                name="AI&DS IV-A Official Master Timetable (2026-27)",
                version_number=1,
                status="published",
                quality_score=98.5,
                published_at=datetime.now(timezone.utc),
            )
            session.add(aids_version)
            await session.flush()

        # Build Master Grid Entries for AI&DS IV-A (Days 1..5, Periods 1..7)
        grid_schedule = {
            # (Day, Period) -> (SubjectCode, FacultyCode, SlotType, RoomOrLab)
            (1, 1): ("AI4011", "PKT", "regular", "room"),
            (1, 2): ("AI4021", "SWM", "regular", "room"),
            (1, 3): ("NT",     "RVD", "regular", "room"),
            (1, 4): ("AI4031", "SEL", "regular", "room"),
            (1, 5): ("AI4041", "DVM", "regular", "room"),
            (1, 6): ("HS4011", "ARY", "regular", "room"),
            (1, 7): ("LIB",    None,  "library", "room"),

            (2, 1): ("AI4081", "PKT", "shared",  "lab"),
            (2, 2): ("AI4081", "PKT", "shared",  "lab"),
            (2, 3): ("AI4011", "PKT", "regular", "room"),
            (2, 4): ("NT",     "RVD", "regular", "room"),
            (2, 5): ("AI4021", "SWM", "regular", "room"),
            (2, 6): ("AI4031", "SEL", "regular", "room"),
            (2, 7): ("SEM",    None,  "shared",  "room"),

            (3, 1): ("AI4091", "SWM", "shared",  "lab"),
            (3, 2): ("AI4091", "SWM", "shared",  "lab"),
            (3, 3): ("AI4041", "DVM", "regular", "room"),
            (3, 4): ("NT",     "RVD", "regular", "room"),
            (3, 5): ("HS4011", "ARY", "regular", "room"),
            (3, 6): ("AI4011", "PKT", "regular", "room"),
            (3, 7): ("UNAS",   "XYZ", "unassigned", "room"), # Unassigned placeholder edge case!

            (4, 1): ("AI4031", "SEL", "regular", "room"),
            (4, 2): ("AI4021", "SWM", "regular", "room"),
            (4, 3): ("AI4011", "PKT", "regular", "room"),
            (4, 4): ("AI4041", "DVM", "regular", "room"),
            (4, 5): ("NT",     "RVD", "regular", "room"),
            (4, 6): ("AI4099", "PKT", "shared",  "lab"),
            (4, 7): ("AI4099", "PKT", "shared",  "lab"),

            (5, 1): ("NT",     "RVD", "regular", "room"),
            (5, 2): ("NT",     "RVD", "regular", "room"),
            (5, 3): ("HS4011", "ARY", "regular", "room"),
            (5, 4): ("HS4011", "ARY", "regular", "room"),
            (5, 5): ("HS4011", "ARY", "regular", "room"),
            (5, 6): ("LIB",    None,  "library", "room"),
            (5, 7): ("LIB",    None,  "library", "room"),
        }

        # Clear existing entries for this version
        await session.execute(delete(TimetableEntry).where(TimetableEntry.version_id == aids_version.id))

        for (day, period), (scode, fcode, stype, rtype) in grid_schedule.items():
            subj = subjects.get(scode)
            if not subj:
                # Placeholder subject for Library / Unassigned
                res_s = await session.execute(select(Subject).where(Subject.code == scode))
                subj = res_s.scalar_one_or_none()
                if not subj:
                    subj = Subject(
                        id=uuid.uuid4(),
                        department_id=aids_dept.id,
                        subject_type_id=st_theory.id,
                        name=f"Special Slot: {scode}",
                        code=scode,
                        credits=1,
                        contact_hours_per_week=1,
                    )
                    session.add(subj)
                    await session.flush()
                    subjects[scode] = subj

            fac = faculties.get(fcode) if fcode in faculties else None
            unassigned_str = fcode if (stype == "unassigned" or not fac) else None

            entry = TimetableEntry(
                id=uuid.uuid4(),
                version_id=aids_version.id,
                class_id=aids_class.id,
                subject_id=subj.id,
                faculty_id=fac.id if fac else None,
                room_id=rooms["AI&DS"].id if rtype == "room" else None,
                lab_id=labs["AI&DS"].id if rtype == "lab" else None,
                day_of_week=day,
                period_number=period,
                slot_type=stype,
                unassigned_initials=unassigned_str,
            )
            session.add(entry)

        print(f"[+] Created {len(grid_schedule)} entries for AI&DS IV-A Master Timetable")

        # MBA Class (Mrs. K.Pradeepa - KPA 4 p/wk, Ms. M.Bharathi - MBI 5 p/wk)
        mba_dept = depts["MBA"]
        mba_class = classes["MBA"]
        res = await session.execute(select(TimetableVersion).where(TimetableVersion.department_id == mba_dept.id, TimetableVersion.status == "published"))
        mba_version = res.scalar_one_or_none()
        if not mba_version:
            mba_version = TimetableVersion(
                id=uuid.uuid4(),
                college_id=college.id,
                department_id=mba_dept.id,
                semester_id=semesters[1].id,
                academic_year_id=acad_year.id,
                name="MBA I-A Master Timetable (2026-27)",
                version_number=1,
                status="published",
                published_at=datetime.now(timezone.utc),
            )
            session.add(mba_version)
            await session.flush()

        mba_schedule = [
            (1, 1, "HVE", "KPA"), (1, 2, "HVE", "KPA"), (2, 1, "HVE", "KPA"), (3, 1, "HVE", "KPA"),
            (1, 3, "TQM", "MBI"), (2, 3, "TQM", "MBI"), (3, 3, "TQM", "MBI"), (4, 1, "TQM", "MBI"), (5, 1, "TQM", "MBI"),
        ]
        await session.execute(delete(TimetableEntry).where(TimetableEntry.version_id == mba_version.id))
        for day, period, scode, fcode in mba_schedule:
            subj = subjects[scode]
            fac = faculties[fcode]
            session.add(TimetableEntry(
                id=uuid.uuid4(),
                version_id=mba_version.id,
                class_id=mba_class.id,
                subject_id=subj.id,
                faculty_id=fac.id,
                room_id=rooms["MBA"].id,
                day_of_week=day,
                period_number=period,
                slot_type="regular",
            ))
        print(f"[+] Created {len(mba_schedule)} entries for MBA Master Timetable")

        # AI&ML Class (Mr. E.Sriram Manishkumar - ESR 6 p/wk)
        aiml_dept = depts["AI&ML"]
        aiml_class = classes["AI&ML"]
        res = await session.execute(select(TimetableVersion).where(TimetableVersion.department_id == aiml_dept.id, TimetableVersion.status == "published"))
        aiml_version = res.scalar_one_or_none()
        if not aiml_version:
            aiml_version = TimetableVersion(
                id=uuid.uuid4(),
                college_id=college.id,
                department_id=aiml_dept.id,
                semester_id=semesters[5].id,
                academic_year_id=acad_year.id,
                name="AI&ML III-A Master Timetable (2026-27)",
                version_number=1,
                status="published",
                published_at=datetime.now(timezone.utc),
            )
            session.add(aiml_version)
            await session.flush()

        aiml_schedule = [
            (1, 1, "ITA", "ESR"), (2, 1, "ITA", "ESR"), (3, 1, "ITA", "ESR"),
            (4, 1, "ITA", "ESR"), (5, 1, "ITA", "ESR"), (5, 2, "ITA", "ESR"),
        ]
        await session.execute(delete(TimetableEntry).where(TimetableEntry.version_id == aiml_version.id))
        for day, period, scode, fcode in aiml_schedule:
            subj = subjects[scode]
            fac = faculties[fcode]
            session.add(TimetableEntry(
                id=uuid.uuid4(),
                version_id=aiml_version.id,
                class_id=aiml_class.id,
                subject_id=subj.id,
                faculty_id=fac.id,
                room_id=rooms["AI&ML"].id,
                day_of_week=day,
                period_number=period,
                slot_type="regular",
            ))
        print(f"[+] Created {len(aiml_schedule)} entries for AI&ML Master Timetable")

        # PHY Class (Mr. R.Vijay Anand - RVD)
        phy_dept = depts["PHY"]
        phy_class = classes["PHY"]
        res = await session.execute(select(TimetableVersion).where(TimetableVersion.department_id == phy_dept.id, TimetableVersion.status == "published"))
        phy_version = res.scalar_one_or_none()
        if not phy_version:
            phy_version = TimetableVersion(
                id=uuid.uuid4(),
                college_id=college.id,
                department_id=phy_dept.id,
                semester_id=semesters[1].id,
                academic_year_id=acad_year.id,
                name="PHY I-A Master Timetable (2026-27)",
                version_number=1,
                status="published",
                published_at=datetime.now(timezone.utc),
            )
            session.add(phy_version)
            await session.flush()

        phy_schedule = [
            (1, 2, "NT", "RVD"), (2, 2, "NT", "RVD"), (3, 2, "NT", "RVD"),
            (4, 2, "NT", "RVD"), (5, 3, "NT", "RVD"), (5, 4, "NT", "RVD"),
        ]
        await session.execute(delete(TimetableEntry).where(TimetableEntry.version_id == phy_version.id))
        for day, period, scode, fcode in phy_schedule:
            subj = subjects[scode]
            fac = faculties[fcode]
            session.add(TimetableEntry(
                id=uuid.uuid4(),
                version_id=phy_version.id,
                class_id=phy_class.id,
                subject_id=subj.id,
                faculty_id=fac.id,
                room_id=rooms["PHY"].id,
                day_of_week=day,
                period_number=period,
                slot_type="regular",
            ))
        print(f"[+] Created {len(phy_schedule)} entries for PHY Master Timetable")

        # ENG Class (Ms. A.Rexcy - ARY)
        eng_dept = depts["ENG"]
        eng_class = classes["ENG"]
        res = await session.execute(select(TimetableVersion).where(TimetableVersion.department_id == eng_dept.id, TimetableVersion.status == "published"))
        eng_version = res.scalar_one_or_none()
        if not eng_version:
            eng_version = TimetableVersion(
                id=uuid.uuid4(),
                college_id=college.id,
                department_id=eng_dept.id,
                semester_id=semesters[1].id,
                academic_year_id=acad_year.id,
                name="ENG I-A Master Timetable (2026-27)",
                version_number=1,
                status="published",
                published_at=datetime.now(timezone.utc),
            )
            session.add(eng_version)
            await session.flush()

        eng_schedule = [
            (1, 1, "PRW", "ARY"), (2, 1, "PRW", "ARY"), (3, 1, "PRW", "ARY"),
            (4, 1, "PRW", "ARY"), (5, 2, "PRW", "ARY"),
        ]
        await session.execute(delete(TimetableEntry).where(TimetableEntry.version_id == eng_version.id))
        for day, period, scode, fcode in eng_schedule:
            subj = subjects[scode]
            fac = faculties[fcode]
            session.add(TimetableEntry(
                id=uuid.uuid4(),
                version_id=eng_version.id,
                class_id=eng_class.id,
                subject_id=subj.id,
                faculty_id=fac.id,
                room_id=rooms["ENG"].id,
                day_of_week=day,
                period_number=period,
                slot_type="regular",
            ))
        print(f"[+] Created {len(eng_schedule)} entries for ENG Master Timetable")

        await session.commit()

        print("\n" + "=" * 70)
        print("  [OK] All Master Timetables & Derived Staff Timetables Ready!")
        print("  [*] Department: Artificial Intelligence and Data Science (AI&DS)")
        print("  [*] Staff Members & Subjects:")
        print("     - Mrs. K.Pradeepa (KPA)  : Human Value and Ethics (HVE, 4 p/wk)")
        print("     - Ms. M.Bharathi (MBI)   : Total Quality Management (TQM, 5 p/wk)")
        print("     - Mr. E.Sriram Manish (ESR) : IT in Agricultural Sector (ITA, 6 p/wk)")
        print("     - Mr. R.Vijay Anand (RVD): Nano Technology (NT, 6 p/wk)")
        print("     - Ms. A.Rexcy (ARY)      : Project Report Writing (PRW, 5 p/wk)")
        print("=" * 70)

if __name__ == "__main__":
    asyncio.run(seed_and_generate())
