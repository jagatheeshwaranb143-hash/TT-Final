"""Subjects CRUD."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional, Literal

from app.db.session import get_db
from app.models.models import (
    Subject, SubjectType, Department, Class, ClassSubject, FacultySubject,
    TimetableEntry,
)
from app.core.security import get_current_user, require_hod_or_above

router = APIRouter()


class SubjectCreate(BaseModel):
    name: str
    code: str
    department_id: str
    year: int
    semester: int
    type: Literal["theory", "lab"] = "theory"
    periods_per_week: int = 4
    lab_block_size: int = 2


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None
    type: Optional[Literal["theory", "lab"]] = None
    periods_per_week: Optional[int] = None
    lab_block_size: Optional[int] = None


class SubjectOut(BaseModel):
    id: str
    name: str
    code: str
    department_id: str
    year: Optional[int] = None
    semester: Optional[int] = None
    type: str
    periods_per_week: int
    lab_block_size: int

    model_config = {"from_attributes": True}


@router.get("", response_model=list[SubjectOut])
async def list_subjects(
    department_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Subject)
    if department_id:
        q = q.where(Subject.department_id == department_id)
    result = await db.execute(q.order_by(Subject.name))
    return result.scalars().all()


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
async def create_subject(body: SubjectCreate, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    dept = await db.get(Department, body.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    s = Subject(
        id=str(uuid.uuid4()),
        name=body.name,
        code=body.code.upper(),
        department_id=body.department_id,
        year=body.year,
        semester=body.semester,
        type=SubjectType(body.type),
        periods_per_week=body.periods_per_week,
        lab_block_size=body.lab_block_size if body.type == "lab" else 1,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


@router.get("/{subject_id}", response_model=SubjectOut)
async def get_subject(subject_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    s = await db.get(Subject, subject_id)
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    return s


@router.put("/{subject_id}", response_model=SubjectOut)
async def update_subject(subject_id: str, body: SubjectUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    s = await db.get(Subject, subject_id)
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    old_semester = s.semester
    schedule_changed = any(value is not None for value in (
        body.year, body.semester, body.type, body.periods_per_week, body.lab_block_size,
    ))
    if body.name is not None:
        s.name = body.name
    if body.code is not None:
        s.code = body.code.upper()
    if body.year is not None:
        s.year = body.year
    if body.semester is not None:
        s.semester = body.semester
    if body.type is not None:
        s.type = SubjectType(body.type)
    if body.periods_per_week is not None:
        s.periods_per_week = body.periods_per_week
    if body.lab_block_size is not None:
        s.lab_block_size = body.lab_block_size
    if s.type == SubjectType.lab and s.periods_per_week % max(s.lab_block_size, 1) != 0:
        raise HTTPException(
            status_code=400,
            detail="Lab periods per week must be a multiple of the consecutive block size",
        )
    if schedule_changed:
        affected_parities = {semester % 2 for semester in (old_semester, s.semester) if semester}
        class_ids = select(Class.id).where(
            Class.department_id == s.department_id,
            (Class.semester % 2).in_(affected_parities),
        )
        await db.execute(delete(TimetableEntry).where(TimetableEntry.class_id.in_(class_ids)))
    await db.commit()
    await db.refresh(s)
    return s


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(subject_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    s = await db.get(Subject, subject_id)
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    # Timetable rows require a subject_id, so remove generated slots and all
    # subject assignments before deleting the subject itself. Relying on the
    # ORM relationship would try to set timetable_entries.subject_id to NULL.
    await db.execute(delete(TimetableEntry).where(TimetableEntry.subject_id == subject_id))
    await db.execute(delete(ClassSubject).where(ClassSubject.subject_id == subject_id))
    await db.execute(delete(FacultySubject).where(FacultySubject.subject_id == subject_id))
    await db.execute(delete(Subject).where(Subject.id == subject_id))
    await db.commit()
