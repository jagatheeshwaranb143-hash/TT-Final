"""Departments CRUD + inline faculty listing."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import Department, Faculty, Subject
from app.core.security import get_current_user

router = APIRouter()


# ─── Schemas ───────────────────────────────────────────────
class DeptCreate(BaseModel):
    name: str
    code: str


class DeptOut(BaseModel):
    id: str
    name: str
    code: str

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
async def create_department(body: DeptCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    existing = await db.execute(select(Department).where(Department.code == body.code.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Department code '{body.code}' already exists")
    dept = Department(id=str(uuid.uuid4()), name=body.name, code=body.code.upper())
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
        faculty=faculty_list,
        subjects=[SubjectBrief.model_validate(s) for s in dept.subjects],
    )


@router.put("/{dept_id}", response_model=DeptOut)
async def update_department(dept_id: str, body: DeptCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.name = body.name
    dept.code = body.code.upper()
    await db.commit()
    await db.refresh(dept)
    return dept


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(dept_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    await db.delete(dept)
    await db.commit()
