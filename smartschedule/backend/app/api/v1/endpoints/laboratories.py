from fastapi import APIRouter, Depends, Query
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
import logging
from sqlalchemy.exc import IntegrityError

from app.core.security import get_current_user, require_hod_or_above
from app.core.exceptions import DataNotFoundError, ConflictError, DependencyError
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

class LaboratoryCreate(BaseModel):
    college_id: Optional[str] = None
    name: str
    building: Optional[str] = "Campus Lab Wing"
    capacity: int = 30
    batch_capacity: Optional[int] = None
    equipment: Optional[Any] = []
    software_list: Optional[Any] = []
    department_id: Optional[str] = None
    supports_multiple_batches: bool = False
    requires_consecutive_periods: bool = True
    consecutive_count: int = 2
    available_days: list[int] = [1,2,3,4,5]

class FacultyEligibilityCreate(BaseModel):
    faculty_id: str

@router.get("")
@router.get("/")
async def list_laboratories(
    department_id: Optional[str] = None,
    capacity: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Laboratory
    query = select(Laboratory).where(Laboratory.college_id == current_user["college_id"])
    
    if department_id: query = query.where(Laboratory.department_id == department_id)
    if capacity is not None: query = query.where(Laboratory.capacity >= capacity)
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("")
@router.post("/")
async def create_laboratory(
    data: LaboratoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Laboratory
    try:
        payload = data.model_dump()
        if not payload.get("college_id"):
            payload["college_id"] = current_user.get("college_id")
        if isinstance(payload.get("equipment"), str):
            payload["equipment"] = [payload["equipment"]]
        if isinstance(payload.get("software_list"), str):
            payload["software_list"] = [payload["software_list"]]
        new_lab = Laboratory(**payload)
        db.add(new_lab)
        await db.commit()
        await db.refresh(new_lab)
        return new_lab
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Laboratory creation conflict (possibly duplicate name in building).")

@router.get("/{id}")
async def get_laboratory(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Laboratory, LaboratoryFacultyEligibility
    query = select(Laboratory).where(Laboratory.id == id, Laboratory.college_id == current_user["college_id"])
    result = await db.execute(query)
    lab = result.scalar_one_or_none()
    
    if not lab:
        raise DataNotFoundError("Laboratory not found")
        
    fe_query = select(LaboratoryFacultyEligibility).where(LaboratoryFacultyEligibility.laboratory_id == id)
    fe_res = await db.execute(fe_query)
    eligible_faculty = fe_res.scalars().all()
    
    return {
        **{c.name: getattr(lab, c.name) for c in lab.__table__.columns},
        "eligible_faculty": eligible_faculty
    }

@router.patch("/{id}")
async def update_laboratory(
    id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Laboratory
    query = select(Laboratory).where(Laboratory.id == id, Laboratory.college_id == current_user["college_id"])
    result = await db.execute(query)
    lab = result.scalar_one_or_none()
    
    if not lab:
        raise DataNotFoundError("Laboratory not found")
        
    for k, v in data.items():
        setattr(lab, k, v)
        
    try:
        await db.commit()
        await db.refresh(lab)
        return lab
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Laboratory update conflict.")

@router.delete("/{id}")
async def delete_laboratory(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Laboratory, TimetableEntry
    query = select(Laboratory).where(Laboratory.id == id, Laboratory.college_id == current_user["college_id"])
    result = await db.execute(query)
    lab = result.scalar_one_or_none()
    
    if not lab:
        raise DataNotFoundError("Laboratory not found")
        
    tt_query = select(func.count(TimetableEntry.id)).where(TimetableEntry.laboratory_id == id)
    tt_count = await db.execute(tt_query)
    if tt_count.scalar() > 0:
        raise DependencyError("Cannot delete laboratory: Timetable entries exist.")
        
    await db.delete(lab)
    await db.commit()
    return {"message": "Laboratory deleted successfully"}

@router.post("/{id}/faculty-eligibility")
async def add_faculty_eligibility(
    id: str,
    data: FacultyEligibilityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import LaboratoryFacultyEligibility
    try:
        new_fe = LaboratoryFacultyEligibility(laboratory_id=id, faculty_id=data.faculty_id)
        db.add(new_fe)
        await db.commit()
        await db.refresh(new_fe)
        return new_fe
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Eligibility conflict (already added).")

@router.delete("/{id}/faculty-eligibility/{faculty_id}")
async def remove_faculty_eligibility(
    id: str,
    faculty_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import LaboratoryFacultyEligibility
    query = select(LaboratoryFacultyEligibility).where(
        LaboratoryFacultyEligibility.laboratory_id == id,
        LaboratoryFacultyEligibility.faculty_id == faculty_id
    )
    result = await db.execute(query)
    fe = result.scalar_one_or_none()
    
    if not fe:
        raise DataNotFoundError("Eligibility not found")
        
    await db.delete(fe)
    await db.commit()
    return {"message": "Faculty eligibility removed"}

@router.get("/{id}/schedule")
async def get_laboratory_schedule(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import TimetableEntry
    query = select(TimetableEntry).where(TimetableEntry.laboratory_id == id)
    result = await db.execute(query)
    return result.scalars().all()
