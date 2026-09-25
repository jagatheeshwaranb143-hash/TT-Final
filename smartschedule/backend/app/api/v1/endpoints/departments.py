"""Departments CRUD + inline faculty listing."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select, update
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Literal, Optional

from app.db.session import get_db
from app.models.models import (
    Class, ClassSubject, Department, Faculty, FacultySubject, ScheduleVersion,
    Subject, TimetableEntry, User,
)
from app.core.security import get_current_user, require_super_admin

router = APIRouter()


# ─── Schemas ───────────────────────────────────────────────
class DeptCreate(BaseModel):
    name: str
    code: str
    department_type: Literal["department", "lab"] = "department"


class DeptOut(BaseModel):
    id: str
    name: str
    code: str
    department_type: Literal["department", "lab"] = "department"

    model_config = {"from_attributes": True}


class SubjectBrief(BaseModel):
    id: str
    name: str
    code: str
    type: str
    periods_per_week: int
    lab_block_size: int

    model_config = {"from_attributes": True}


class FacultyBrief(BaseModel):
    id: str
    name: str
    can_teach_all_classes: bool
    subjects: list[SubjectBrief] = []

    model_config = {"from_attributes": True}


class DeptDetail(DeptOut):
    faculty: list[FacultyBrief] = []
    subjects: list[SubjectBrief] = []


# ─── Routes ────────────────────────────────────────────────
@router.get("", response_model=list[DeptOut])
async def list_departments(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Department).order_by(Department.name))
    return result.scalars().all()


@router.post("", response_model=DeptOut, status_code=status.HTTP_201_CREATED)
async def create_department(body: DeptCreate, db: AsyncSession = Depends(get_db), _=Depends(require_super_admin())):
    existing = await db.execute(select(Department).where(Department.code == body.code.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Department code '{body.code}' already exists")
    dept = Department(id=str(uuid.uuid4()), name=body.name, code=body.code.upper(), department_type=body.department_type)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


@router.get("/{dept_id}", response_model=DeptDetail)
async def get_department(dept_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Department)
        .where(Department.id == dept_id)
        .options(
            selectinload(Department.faculty).selectinload(Faculty.faculty_subjects).selectinload(
                __import__('app.models.models', fromlist=['FacultySubject']).FacultySubject.subject
            ),
            selectinload(Department.subjects),
        )
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    # Build faculty list with subjects
    faculty_list = []
    for f in dept.faculty:
        subjects = [fs.subject for fs in f.faculty_subjects if fs.subject and fs.subject.department_id == dept_id]
        faculty_list.append(FacultyBrief(
            id=f.id,
            name=f.name,
            can_teach_all_classes=f.can_teach_all_classes,
            subjects=[SubjectBrief.model_validate(s) for s in subjects],
        ))

    return DeptDetail(
        id=dept.id,
        name=dept.name,
        code=dept.code,
        department_type=dept.department_type,
        faculty=faculty_list,
        subjects=[SubjectBrief.model_validate(s) for s in dept.subjects],
    )


@router.put("/{dept_id}", response_model=DeptOut)
async def update_department(dept_id: str, body: DeptCreate, db: AsyncSession = Depends(get_db), _=Depends(require_super_admin())):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.name = body.name
    dept.code = body.code.upper()
    dept.department_type = body.department_type
    await db.commit()
    await db.refresh(dept)
    return dept


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(dept_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_super_admin())):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    class_ids = list((await db.execute(
        select(Class.id).where(Class.department_id == dept_id)
    )).scalars().all())
    subject_ids = list((await db.execute(
        select(Subject.id).where(Subject.department_id == dept_id)
    )).scalars().all())
    faculty_ids = list((await db.execute(
        select(Faculty.id).where(Faculty.department_id == dept_id)
    )).scalars().all())

    # Delete owned schedule data first. SQLAlchemy otherwise tries to set the
    # non-null timetable class/subject foreign keys to NULL during cascading.
    if class_ids:
        await db.execute(delete(TimetableEntry).where(TimetableEntry.class_id.in_(class_ids)))
        await db.execute(delete(ClassSubject).where(ClassSubject.class_id.in_(class_ids)))
    if subject_ids:
        await db.execute(delete(TimetableEntry).where(TimetableEntry.subject_id.in_(subject_ids)))
        await db.execute(delete(ClassSubject).where(ClassSubject.subject_id.in_(subject_ids)))
        await db.execute(delete(FacultySubject).where(FacultySubject.subject_id.in_(subject_ids)))
    if faculty_ids:
        # Faculty may teach classes in another department. Preserve those
        # classes and timetable periods, but mark their faculty as unassigned.
        await db.execute(update(TimetableEntry).where(
            TimetableEntry.faculty_id.in_(faculty_ids)
        ).values(faculty_id=None))
        await db.execute(update(ClassSubject).where(
            ClassSubject.faculty_id.in_(faculty_ids)
        ).values(faculty_id=None))
        await db.execute(delete(FacultySubject).where(FacultySubject.faculty_id.in_(faculty_ids)))

    await db.execute(update(User).where(User.department_id == dept_id).values(department_id=None))
    await db.execute(delete(ScheduleVersion).where(ScheduleVersion.department_id == dept_id))
    await db.execute(delete(Class).where(Class.department_id == dept_id))
    await db.execute(delete(Subject).where(Subject.department_id == dept_id))
    await db.execute(delete(Faculty).where(Faculty.department_id == dept_id))
    await db.execute(delete(Department).where(Department.id == dept_id))
    await db.commit()
