from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import logging
from sqlalchemy.exc import IntegrityError

from app.core.security import get_current_user, require_hod_or_above
from app.core.exceptions import DataNotFoundError, ConflictError
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

class ConstraintCreate(BaseModel):
    college_id: str
    department_id: Optional[str] = None
    constraint_type: str  # 'hard' or 'soft'
    constraint_key: str   # e.g. 'max_consecutive_teaching_periods'
    constraint_value: dict  # JSON value
    weight: float = 1.0
    is_hard: bool = False
    description: Optional[str] = None

@router.get("/")
async def list_constraints(
    department_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Constraint
    query = select(Constraint).where(Constraint.college_id == current_user["college_id"])
    
    if department_id:
        query = query.where((Constraint.department_id == department_id) | (Constraint.department_id == None))
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/")
async def create_constraint(
    data: ConstraintCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Constraint
    try:
        new_const = Constraint(**data.model_dump())
        db.add(new_const)
        await db.commit()
        await db.refresh(new_const)
        return new_const
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Constraint creation conflict.")

@router.patch("/{id}")
async def update_constraint(
    id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Constraint
    query = select(Constraint).where(Constraint.id == id, Constraint.college_id == current_user["college_id"])
    result = await db.execute(query)
    const = result.scalar_one_or_none()
    
    if not const:
        raise DataNotFoundError("Constraint not found")
        
    for k, v in data.items():
        setattr(const, k, v)
        
    try:
        await db.commit()
        await db.refresh(const)
        return const
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Constraint update conflict.")

@router.delete("/{id}")
async def delete_constraint(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Constraint
    query = select(Constraint).where(Constraint.id == id, Constraint.college_id == current_user["college_id"])
    result = await db.execute(query)
    const = result.scalar_one_or_none()
    
    if not const:
        raise DataNotFoundError("Constraint not found")
        
    await db.delete(const)
    await db.commit()
    return {"message": "Constraint deleted successfully"}

@router.get("/defaults")
async def get_default_constraints(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    return [
        {
            "constraint_key": "max_consecutive_teaching_periods",
            "constraint_value": {"max": 3},
            "weight": 1.0,
            "is_hard": True,
            "description": "Maximum consecutive periods a faculty can teach"
        },
        {
            "constraint_key": "min_lunch_break_duration",
            "constraint_value": {"min_minutes": 45},
            "weight": 0.8,
            "is_hard": False,
            "description": "Minimum duration for lunch break"
        }
    ]

@router.post("/reset-defaults")
async def reset_constraints_to_default(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Constraint
    from sqlalchemy import delete
    
    # Delete all constraints for this college
    await db.execute(delete(Constraint).where(Constraint.college_id == current_user["college_id"]))
    
    defaults = await get_default_constraints(db, current_user)
    for d in defaults:
        c = Constraint(
            college_id=current_user["college_id"],
            constraint_type="hard" if d["is_hard"] else "soft",
            **d
        )
        db.add(c)
        
    await db.commit()
    return {"message": "Constraints reset to defaults."}
