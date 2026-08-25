"""
init_simple.py — Drop all tables, recreate, seed admin user and starter college data.
Run: python init_simple.py
"""
import asyncio
import uuid
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.db.session import Base
from app.models.models import (
    Department, Faculty, Subject, SubjectType,
    FacultySubject, Class, ClassSubject, TimetableEntry, User
)
from app.core.security import hash_password

DATABASE_URL = "sqlite+aiosqlite:///./smartschedule.db"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init():
    reset = "--reset" in sys.argv
    if reset:
        print("[1/3] Resetting existing tables...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    else:
        print("[1/3] Preserving existing tables...")

    print("[2/3] Creating all tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("[3/3] Seeding admin user & starter college data...")
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        if not reset:
            existing = (await db.execute(select(User).limit(1))).scalar_one_or_none()
            if existing:
                print("[DONE] Existing database detected; seed data was preserved.")
                return

        # Admin user
        admin = User(
            id=str(uuid.uuid4()),
            email="admin@smartschedule.dev",
            full_name="Timetable Coordinator",
            role="super_admin",
            password_hash=hash_password("admin123"),
            is_active=True,
        )
        db.add(admin)

        # Department 1: CSE
        dept_cse = Department(id=str(uuid.uuid4()), name="Computer Science & Engineering", code="CSE")
        # Department 2: AI&DS
        dept_aids = Department(id=str(uuid.uuid4()), name="Artificial Intelligence & Data Science", code="AI&DS")
        db.add_all([dept_cse, dept_aids])
        await db.flush()

        # Faculty in CSE
        f_kpa = Faculty(id=str(uuid.uuid4()), name="Mrs. K. Pradeepa", department_id=dept_cse.id, can_teach_all_classes=True)
        f_mbi = Faculty(id=str(uuid.uuid4()), name="Ms. M. Bharathi", department_id=dept_cse.id, can_teach_all_classes=False)
        f_esr = Faculty(id=str(uuid.uuid4()), name="Mr. E. Sankar", department_id=dept_cse.id, can_teach_all_classes=False)
        f_rvd = Faculty(id=str(uuid.uuid4()), name="Dr. R. Vadivel", department_id=dept_cse.id, can_teach_all_classes=False)
        
        # Faculty in AI&DS
        f_ary = Faculty(id=str(uuid.uuid4()), name="Dr. A. Ramya", department_id=dept_aids.id, can_teach_all_classes=False)
        f_pkt = Faculty(id=str(uuid.uuid4()), name="Mr. P. Karthik", department_id=dept_aids.id, can_teach_all_classes=True)
        db.add_all([f_kpa, f_mbi, f_esr, f_rvd, f_ary, f_pkt])
        await db.flush()

        # Subjects in CSE
        s_ds = Subject(id=str(uuid.uuid4()), name="Data Structures & Algorithms", code="CS3301", department_id=dept_cse.id, type=SubjectType.theory, periods_per_week=5)
        s_dbms = Subject(id=str(uuid.uuid4()), name="Database Management Systems", code="CS3302", department_id=dept_cse.id, type=SubjectType.theory, periods_per_week=5)
        s_os = Subject(id=str(uuid.uuid4()), name="Operating Systems", code="CS3303", department_id=dept_cse.id, type=SubjectType.theory, periods_per_week=5)
        s_cn = Subject(id=str(uuid.uuid4()), name="Computer Networks", code="CS3304", department_id=dept_cse.id, type=SubjectType.theory, periods_per_week=5)
        s_dslab = Subject(id=str(uuid.uuid4()), name="Data Structures Laboratory", code="CS3311", department_id=dept_cse.id, type=SubjectType.lab, periods_per_week=4, lab_block_size=2)
        s_dbmslab = Subject(id=str(uuid.uuid4()), name="DBMS Laboratory", code="CS3312", department_id=dept_cse.id, type=SubjectType.lab, periods_per_week=4, lab_block_size=2)

        # Subjects in AI&DS
        s_ml = Subject(id=str(uuid.uuid4()), name="Machine Learning Fundamentals", code="AD3401", department_id=dept_aids.id, type=SubjectType.theory, periods_per_week=5)
        s_mllab = Subject(id=str(uuid.uuid4()), name="Machine Learning Lab", code="AD3411", department_id=dept_aids.id, type=SubjectType.lab, periods_per_week=4, lab_block_size=2)

        db.add_all([s_ds, s_dbms, s_os, s_cn, s_dslab, s_dbmslab, s_ml, s_mllab])
        await db.flush()

        # Map faculty to subjects (FacultySubject)
        fs_list = [
            FacultySubject(id=str(uuid.uuid4()), faculty_id=f_kpa.id, subject_id=s_ds.id),
            FacultySubject(id=str(uuid.uuid4()), faculty_id=f_kpa.id, subject_id=s_dslab.id),
            FacultySubject(id=str(uuid.uuid4()), faculty_id=f_mbi.id, subject_id=s_dbms.id),
            FacultySubject(id=str(uuid.uuid4()), faculty_id=f_mbi.id, subject_id=s_dbmslab.id),
            FacultySubject(id=str(uuid.uuid4()), faculty_id=f_esr.id, subject_id=s_os.id),
            FacultySubject(id=str(uuid.uuid4()), faculty_id=f_rvd.id, subject_id=s_cn.id),
            FacultySubject(id=str(uuid.uuid4()), faculty_id=f_ary.id, subject_id=s_ml.id),
            FacultySubject(id=str(uuid.uuid4()), faculty_id=f_pkt.id, subject_id=s_mllab.id),
        ]
        db.add_all(fs_list)
        await db.flush()

        # Create Classes
        cls_cse_a = Class(id=str(uuid.uuid4()), department_id=dept_cse.id, year=2, semester=3, section="A")
        cls_cse_b = Class(id=str(uuid.uuid4()), department_id=dept_cse.id, year=2, semester=3, section="B")
        db.add_all([cls_cse_a, cls_cse_b])
        await db.flush()

        # Map ClassSubjects
        cs_list = [
            # CSE Sec A
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_a.id, subject_id=s_ds.id, faculty_id=f_kpa.id),
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_a.id, subject_id=s_dbms.id, faculty_id=f_mbi.id),
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_a.id, subject_id=s_os.id, faculty_id=f_esr.id),
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_a.id, subject_id=s_cn.id, faculty_id=f_rvd.id),
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_a.id, subject_id=s_dslab.id, faculty_id=f_kpa.id),
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_a.id, subject_id=s_dbmslab.id, faculty_id=f_mbi.id),
            # CSE Sec B
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_b.id, subject_id=s_ds.id, faculty_id=f_kpa.id),
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_b.id, subject_id=s_dbms.id, faculty_id=f_mbi.id),
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_b.id, subject_id=s_os.id, faculty_id=f_esr.id),
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_b.id, subject_id=s_cn.id, faculty_id=f_rvd.id),
            ClassSubject(id=str(uuid.uuid4()), class_id=cls_cse_b.id, subject_id=s_dslab.id, faculty_id=f_kpa.id),
        ]
        db.add_all(cs_list)
        await db.commit()

    print("[DONE] Database initialized and seeded successfully!")
    print("Credentials: admin@smartschedule.dev / admin123")


if __name__ == "__main__":
    asyncio.run(init())
