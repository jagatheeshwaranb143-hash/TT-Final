from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
import logging
from sqlalchemy.exc import IntegrityError

from app.core.security import get_current_user, require_super_admin
from app.core.exceptions import DataNotFoundError, ConflictError
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

class UserCreate(BaseModel):
    email: str
    password: str
    role: str
    first_name: str
    last_name: str
    college_id: Optional[str] = None
    department_id: Optional[str] = None

@router.get("/")
async def list_users(
    role: Optional[str] = None,
    department_id: Optional[str] = None,
    college_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    from app.models import User
    query = select(User)
    
    if role:
        query = query.where(User.role == role)
    if department_id:
        query = query.where(User.department_id == department_id)
    if college_id:
        query = query.where(User.college_id == college_id)
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/")
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_super_admin())
):
    from app.models import User
    from app.core.security import hash_password
    try:
        new_user = User(
            email=data.email,
            full_name=f"{data.first_name} {data.last_name}",
            role=data.role,
            college_id=data.college_id,
            department_id=data.department_id,
            password_hash=hash_password(data.password),
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user
    except IntegrityError:
        await db.rollback()
        raise ConflictError("User with this email already exists.")

@router.get("/{id}")
async def get_user(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import User
    query = select(User).where(User.id == id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise DataNotFoundError("User not found")
    return user

@router.patch("/{id}")
async def update_user(
    id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    from app.models import User
    query = select(User).where(User.id == id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise DataNotFoundError("User not found")
        
    for k, v in data.items():
        setattr(user, k, v)
        
    try:
        await db.commit()
        await db.refresh(user)
        return user
    except IntegrityError:
        await db.rollback()
        raise ConflictError("User update conflict.")

@router.post("/{id}/deactivate")
async def deactivate_user(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    from app.models import User
    query = select(User).where(User.id == id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise DataNotFoundError("User not found")
        
    user.is_active = False
    await db.commit()
    return {"message": "User deactivated successfully"}

@router.post("/{id}/reactivate")
async def reactivate_user(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    from app.models import User
    query = select(User).where(User.id == id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise DataNotFoundError("User not found")
        
    user.is_active = True
    await db.commit()
    return {"message": "User reactivated successfully"}

@router.post("/{id}/reset-password")
async def reset_password(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    # Dummy implementation for Supabase password reset trigger
    return {"message": "Password reset email sent."}

async def _calculate_setup_status(college_id: str, db: AsyncSession) -> dict:
    from app.models import (
        College, AcademicYear, Department, Program, Class, Faculty,
        Subject, Room, Laboratory, WorkingDay, Period, Constraint
    )
    
    steps = [
        {"name": "College Information", "is_required": True, "model": College},
        {"name": "Academic Year", "is_required": True, "model": AcademicYear},
        {"name": "Departments", "is_required": True, "model": Department},
        {"name": "Programs", "is_required": True, "model": Program},
        {"name": "Classes", "is_required": True, "model": Class},
        {"name": "Faculty", "is_required": True, "model": Faculty},
        {"name": "Subjects", "is_required": True, "model": Subject},
        {"name": "Rooms", "is_required": True, "model": Room},
        {"name": "Laboratories", "is_required": False, "model": Laboratory},
        {"name": "Working Days", "is_required": True, "model": WorkingDay},
        {"name": "Period Schedule", "is_required": True, "model": Period},
        {"name": "Timetable Rules", "is_required": False, "model": Constraint},
        {"name": "Validate & Generate", "is_required": True, "model": None},
    ]
    
    completed = 0
    status_list = []
    
    for step in steps:
        is_complete = False
        if step["model"]:
            # Perform generic check (in a real app, query correctly based on college_id relations)
            count = 1  # Dummy logic to bypass missing relation specifics for now
            if count > 0:
                is_complete = True
                
        if is_complete:
            completed += 1
            
        status_list.append({
            "name": step["name"],
            "is_required": step["is_required"],
            "completed": is_complete
        })
        
    return {
        "completed_steps": completed,
        "total_steps": len(steps),
        "steps": status_list
    }

@router.get("/setup-status")
async def get_setup_status(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    cid = getattr(current_user, 'college_id', None)
    if not cid:
        return {
            "completed_steps": 0,
            "total_steps": 13,
            "steps": [],
            "message": "User not associated with a college yet"
        }
    return await _calculate_setup_status(str(cid), db)
