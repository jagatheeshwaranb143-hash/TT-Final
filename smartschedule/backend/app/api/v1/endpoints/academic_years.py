from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import date
import logging
from sqlalchemy.exc import IntegrityError

from app.core.security import get_current_user, require_hod_or_above
from app.core.exceptions import DataNotFoundError, ConflictError, DependencyError
from app.db.session import get_db

# We assume standard models are in app.models
# Lazy imports of models inside functions if needed to prevent circular imports

router = APIRouter()
logger = logging.getLogger(__name__)

class AcademicYearCreate(BaseModel):
    name: str  # e.g. '2024-25'
    start_date: date
    end_date: date
    is_current: bool = False

class SemesterCreate(BaseModel):
    name: str  # e.g. 'Odd Semester'
    number: int
    start_date: date
    end_date: date
    status: str = 'active'

@router.get("/")
async def list_academic_years(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import AcademicYear
    college_id = current_user.get("college_id")
    if not college_id:
        return []
    
    query = select(AcademicYear).where(AcademicYear.college_id == college_id).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/")
async def create_academic_year(
    data: AcademicYearCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import AcademicYear
    try:
        new_year = AcademicYear(
            college_id=current_user["college_id"],
            **data.model_dump()
        )
        db.add(new_year)
        await db.commit()
        await db.refresh(new_year)
        return new_year
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Academic year with this name may already exist.")

@router.get("/{id}")
async def get_academic_year(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import AcademicYear
    query = select(AcademicYear).where(AcademicYear.id == id, AcademicYear.college_id == current_user["college_id"])
    result = await db.execute(query)
    year = result.scalar_one_or_none()
    if not year:
        raise DataNotFoundError("Academic year not found")
    return year

@router.patch("/{id}")
async def update_academic_year(
    id: str,
    data: dict, # Ideally a Pydantic model for partial update
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import AcademicYear
    query = select(AcademicYear).where(AcademicYear.id == id, AcademicYear.college_id == current_user["college_id"])
    result = await db.execute(query)
    year = result.scalar_one_or_none()
    if not year:
        raise DataNotFoundError("Academic year not found")
    
    for k, v in data.items():
        setattr(year, k, v)
        
    try:
        await db.commit()
        await db.refresh(year)
        return year
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Update failed due to a conflict.")

@router.delete("/{id}")
async def delete_academic_year(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import AcademicYear, Semester
    
    query = select(AcademicYear).where(AcademicYear.id == id, AcademicYear.college_id == current_user["college_id"])
    result = await db.execute(query)
    year = result.scalar_one_or_none()
    if not year:
        raise DataNotFoundError("Academic year not found")
        
    sem_query = select(func.count(Semester.id)).where(Semester.academic_year_id == id)
    sem_count = await db.execute(sem_query)
    if sem_count.scalar() > 0:
        raise DependencyError("Cannot delete academic year: It contains semesters.")
        
    await db.delete(year)
    await db.commit()
    return {"message": "Academic year deleted successfully"}

@router.post("/{id}/set-current")
async def set_current_academic_year(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import AcademicYear
    from sqlalchemy import update
    
    # First, mark all others as not current
    await db.execute(
        update(AcademicYear)
        .where(AcademicYear.college_id == current_user["college_id"])
        .values(is_current=False)
    )
    
    # Then mark the given one as current
    query = select(AcademicYear).where(AcademicYear.id == id, AcademicYear.college_id == current_user["college_id"])
    result = await db.execute(query)
    year = result.scalar_one_or_none()
    
    if not year:
        raise DataNotFoundError("Academic year not found")
        
    year.is_current = True
    await db.commit()
    await db.refresh(year)
    return year

@router.get("/{id}/semesters")
async def list_semesters(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Semester
    query = select(Semester).where(Semester.academic_year_id == id)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/{id}/semesters")
async def create_semester(
    id: str,
    data: SemesterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Semester
    try:
        new_semester = Semester(
            academic_year_id=id,
            **data.model_dump()
        )
        db.add(new_semester)
        await db.commit()
        await db.refresh(new_semester)
        return new_semester
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Semester conflict error.")

@router.patch("/{year_id}/semesters/{sem_id}")
async def update_semester(
    year_id: str,
    sem_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Semester
    query = select(Semester).where(Semester.id == sem_id, Semester.academic_year_id == year_id)
    result = await db.execute(query)
    semester = result.scalar_one_or_none()
    
    if not semester:
        raise DataNotFoundError("Semester not found")
        
    for k, v in data.items():
        setattr(semester, k, v)
        
    try:
        await db.commit()
        await db.refresh(semester)
        return semester
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Semester update conflict.")

@router.delete("/{year_id}/semesters/{sem_id}")
async def delete_semester(
    year_id: str,
    sem_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Semester, Class
    query = select(Semester).where(Semester.id == sem_id, Semester.academic_year_id == year_id)
    result = await db.execute(query)
    semester = result.scalar_one_or_none()
    
    if not semester:
        raise DataNotFoundError("Semester not found")
        
    class_query = select(func.count(Class.id)).where(Class.semester_id == sem_id)
    class_count = await db.execute(class_query)
    if class_count.scalar() > 0:
        raise DependencyError("Cannot delete semester: Classes exist in this semester.")
        
    await db.delete(semester)
    await db.commit()
    return {"message": "Semester deleted successfully"}
