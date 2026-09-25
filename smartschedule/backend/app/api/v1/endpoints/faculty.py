"""Faculty CRUD + subject assignment."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, field_validator
from typing import Optional

from app.db.session import get_db
from app.models.models import Faculty, FacultySubject, Subject, Department
from app.core.security import get_current_user, require_hod_or_above

router = APIRouter()


# ─── Schemas ───────────────────────────────────────────────
class FacultyCreate(BaseModel):
    name: str
    department_id: str
    can_teach_all_classes: bool = False
    photo_url: Optional[str] = None

    @field_validator("photo_url")
    @classmethod
    def validate_photo(cls, value: Optional[str]):
        if value and (not value.startswith("data:image/") or len(value) > 3_000_000):
            raise ValueError("Photo must be a supported image smaller than 2 MB")
        return value


class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    can_teach_all_classes: Optional[bool] = None
    photo_url: Optional[str] = None

    @field_validator("photo_url")
    @classmethod
    def validate_photo(cls, value: Optional[str]):
        if value and (not value.startswith("data:image/") or len(value) > 3_000_000):
            raise ValueError("Photo must be a supported image smaller than 2 MB")
        return value


class SubjectBrief(BaseModel):
    id: str
    name: str
    code: str
    type: str
    periods_per_week: int

    model_config = {"from_attributes": True}


class DeptBrief(BaseModel):
    id: str
    name: str
    code: str

    model_config = {"from_attributes": True}


class FacultyOut(BaseModel):
    id: str
    name: str
    photo_url: Optional[str] = None
    department_id: str
    can_teach_all_classes: bool
    department: Optional[DeptBrief] = None
    subjects: list[SubjectBrief] = []

    model_config = {"from_attributes": True}


class AssignSubjectsBody(BaseModel):
    subject_ids: list[str]


# ─── Routes ────────────────────────────────────────────────
@router.get("", response_model=list[FacultyOut])
async def list_faculty(
    department_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Faculty).options(
        selectinload(Faculty.department),
        selectinload(Faculty.faculty_subjects).selectinload(FacultySubject.subject),
    )
    if department_id:
        q = q.where(Faculty.department_id == department_id)
    result = await db.execute(q.order_by(Faculty.name))
    faculty_list = result.scalars().all()

    out = []
    for f in faculty_list:
        subjects = [fs.subject for fs in f.faculty_subjects if fs.subject]
        out.append(FacultyOut(
            id=f.id,
            name=f.name,
            photo_url=f.photo_url,
            department_id=f.department_id,
            can_teach_all_classes=f.can_teach_all_classes,
            department=DeptBrief.model_validate(f.department) if f.department else None,
            subjects=[SubjectBrief.model_validate(s) for s in subjects],
        ))
    return out


@router.post("", response_model=FacultyOut, status_code=status.HTTP_201_CREATED)
async def create_faculty(body: FacultyCreate, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    dept = await db.get(Department, body.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    f = Faculty(id=str(uuid.uuid4()), name=body.name, photo_url=body.photo_url, department_id=body.department_id,
                can_teach_all_classes=body.can_teach_all_classes)
    db.add(f)
    await db.commit()
    await db.refresh(f)
    return FacultyOut(id=f.id, name=f.name, photo_url=f.photo_url, department_id=f.department_id,
                      can_teach_all_classes=f.can_teach_all_classes, subjects=[])


@router.get("/{faculty_id}", response_model=FacultyOut)
async def get_faculty(faculty_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Faculty)
        .where(Faculty.id == faculty_id)
        .options(
            selectinload(Faculty.department),
            selectinload(Faculty.faculty_subjects).selectinload(FacultySubject.subject),
        )
    )
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    subjects = [fs.subject for fs in f.faculty_subjects if fs.subject]
    return FacultyOut(
        id=f.id, name=f.name, photo_url=f.photo_url, department_id=f.department_id,
        can_teach_all_classes=f.can_teach_all_classes,
        department=DeptBrief.model_validate(f.department) if f.department else None,
        subjects=[SubjectBrief.model_validate(s) for s in subjects],
    )


@router.put("/{faculty_id}", response_model=FacultyOut)
async def update_faculty(faculty_id: str, body: FacultyUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    f = await db.get(Faculty, faculty_id)
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    if body.name is not None:
        f.name = body.name
    if body.can_teach_all_classes is not None:
        f.can_teach_all_classes = body.can_teach_all_classes
    if "photo_url" in body.model_fields_set:
        f.photo_url = body.photo_url
    await db.commit()
    await db.refresh(f)
    return FacultyOut(id=f.id, name=f.name, photo_url=f.photo_url, department_id=f.department_id,
                      can_teach_all_classes=f.can_teach_all_classes, subjects=[])


@router.delete("/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faculty(faculty_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    f = await db.get(Faculty, faculty_id)
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    await db.delete(f)
    await db.commit()


@router.put("/{faculty_id}/subjects", response_model=FacultyOut)
async def assign_subjects(faculty_id: str, body: AssignSubjectsBody, db: AsyncSession = Depends(get_db), _=Depends(require_hod_or_above())):
    """Replace a faculty member's subject assignments."""
    f = await db.get(Faculty, faculty_id)
    if not f:
        raise HTTPException(status_code=404, detail="Faculty not found")
    # Delete existing
    await db.execute(delete(FacultySubject).where(FacultySubject.faculty_id == faculty_id))
    # Add new
    for sid in body.subject_ids:
        subj = await db.get(Subject, sid)
        if subj:
            db.add(FacultySubject(id=str(uuid.uuid4()), faculty_id=faculty_id, subject_id=sid))
    await db.commit()

    result = await db.execute(
        select(Faculty).where(Faculty.id == faculty_id)
        .options(selectinload(Faculty.faculty_subjects).selectinload(FacultySubject.subject))
    )
    f = result.scalar_one()
    subjects = [fs.subject for fs in f.faculty_subjects if fs.subject]
    return FacultyOut(id=f.id, name=f.name, photo_url=f.photo_url, department_id=f.department_id,
                      can_teach_all_classes=f.can_teach_all_classes,
                      subjects=[SubjectBrief.model_validate(s) for s in subjects])
