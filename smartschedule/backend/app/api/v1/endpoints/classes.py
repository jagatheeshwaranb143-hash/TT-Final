"""Classes CRUD + class-subject assignment."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import Class, ClassSubject, Subject, Faculty, Department, TimetableEntry
from app.core.security import get_current_user, require_hod_or_above

router = APIRouter()


# ─── Schemas ───────────────────────────────────────────────
class ClassCreate(BaseModel):
    department_id: str
    year: int
    semester: int
    section: str = "A"


class ClassSubjectAssign(BaseModel):
    subject_id: str
    faculty_id: Optional[str] = None


class ClassSubjectOut(BaseModel):
    id: str
    subject_id: str
    subject_name: str
    subject_code: str
    subject_type: str
    periods_per_week: int
    faculty_id: Optional[str] = None
    faculty_name: Optional[str] = None


class ClassOut(BaseModel):
    id: str
    department_id: str
    department_name: Optional[str] = None
    year: int
    semester: int
    section: str
    subjects: list[ClassSubjectOut] = []

    model_config = {"from_attributes": True}


# ─── Routes ────────────────────────────────────────────────
@router.get("", response_model=list[ClassOut])
async def list_classes(
    department_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Class).options(
        selectinload(Class.department),
        selectinload(Class.class_subjects).selectinload(ClassSubject.subject),
        selectinload(Class.class_subjects).selectinload(ClassSubject.faculty),
    )
    if department_id:
        q = q.where(Class.department_id == department_id)
    result = await db.execute(q.order_by(Class.year, Class.semester, Class.section))
    classes = result.scalars().all()

    out = []
    for c in classes:
        subjs = [
            ClassSubjectOut(
                id=cs.id,
                subject_id=cs.subject_id,
                subject_name=cs.subject.name if cs.subject else "",
                subject_code=cs.subject.code if cs.subject else "",
                subject_type=cs.subject.type.value if cs.subject else "theory",
                periods_per_week=cs.subject.periods_per_week if cs.subject else 0,
                faculty_id=cs.faculty_id,
                faculty_name=cs.faculty.name if cs.faculty else None,
            )
            for cs in c.class_subjects
        ]
        out.append(ClassOut(
            id=c.id,
            department_id=c.department_id,
            department_name=c.department.name if c.department else None,
            year=c.year,
            semester=c.semester,
            section=c.section,
            subjects=subjs,
        ))
    return out


@router.post("", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
async def create_class(body: ClassCreate, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    dept = await db.get(Department, body.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    normalized_section = body.section.upper()
    existing = await db.execute(select(Class.id).where(
        Class.department_id == body.department_id,
        Class.year == body.year,
        Class.semester == body.semester,
        Class.section == normalized_section,
    ))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Year {body.year}, Semester {body.semester}, Section {normalized_section} already exists for {dept.name}.",
        )
    c = Class(
        id=str(uuid.uuid4()),
        department_id=body.department_id,
        year=body.year,
        semester=body.semester,
        section=normalized_section,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return ClassOut(id=c.id, department_id=c.department_id, year=c.year,
                    semester=c.semester, section=c.section, subjects=[])


@router.get("/{class_id}", response_model=ClassOut)
async def get_class(class_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Class).where(Class.id == class_id).options(
            selectinload(Class.department),
            selectinload(Class.class_subjects).selectinload(ClassSubject.subject),
            selectinload(Class.class_subjects).selectinload(ClassSubject.faculty),
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    subjs = [
        ClassSubjectOut(
            id=cs.id,
            subject_id=cs.subject_id,
            subject_name=cs.subject.name if cs.subject else "",
            subject_code=cs.subject.code if cs.subject else "",
            subject_type=cs.subject.type.value if cs.subject else "theory",
            periods_per_week=cs.subject.periods_per_week if cs.subject else 0,
            faculty_id=cs.faculty_id,
            faculty_name=cs.faculty.name if cs.faculty else None,
        )
        for cs in c.class_subjects
    ]
    return ClassOut(
        id=c.id, department_id=c.department_id,
        department_name=c.department.name if c.department else None,
        year=c.year, semester=c.semester, section=c.section, subjects=subjs,
    )


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(class_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    c = await db.get(Class, class_id)
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    # Timetable entries require a class_id. Delete generated periods and class
    # subject assignments before removing the class to avoid NULL foreign keys.
    await db.execute(delete(TimetableEntry).where(TimetableEntry.class_id == class_id))
    await db.execute(delete(ClassSubject).where(ClassSubject.class_id == class_id))
    await db.execute(delete(Class).where(Class.id == class_id))
    await db.commit()


@router.post("/{class_id}/subjects", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
async def assign_subjects_to_class(
    class_id: str,
    body: list[ClassSubjectAssign],
    db: AsyncSession = Depends(get_db),
    _=Depends(require_hod_or_above()),
):
    """Replace all subject-faculty assignments for a class."""
    c = await db.get(Class, class_id)
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    affected_class_ids = select(Class.id).where(
        Class.department_id == c.department_id,
        Class.semester % 2 == c.semester % 2,
    )
    await db.execute(delete(TimetableEntry).where(TimetableEntry.class_id.in_(affected_class_ids)))
    await db.execute(delete(ClassSubject).where(ClassSubject.class_id == class_id))
    for item in body:
        s = await db.get(Subject, item.subject_id)
        if not s:
            continue
        db.add(ClassSubject(
            id=str(uuid.uuid4()),
            class_id=class_id,
            subject_id=item.subject_id,
            faculty_id=item.faculty_id,
        ))
    await db.commit()
    return await get_class(class_id, db)
