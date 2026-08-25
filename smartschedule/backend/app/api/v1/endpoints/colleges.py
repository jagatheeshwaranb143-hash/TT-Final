from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.models.college import College
from app.schemas.college import CollegeResponse, CollegeCreate, CollegeUpdate
from app.core.security import require_super_admin, get_current_user

router = APIRouter()

@router.get("/", response_model=List[CollegeResponse])
async def get_colleges(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    result = await db.execute(select(College))
    return result.scalars().all()

@router.post("/", response_model=CollegeResponse, status_code=status.HTTP_201_CREATED)
async def create_college(
    college_in: CollegeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_super_admin())
):
    new_college = College(**college_in.model_dump())
    db.add(new_college)
    await db.commit()
    await db.refresh(new_college)
    return new_college

@router.get("/{id}", response_model=CollegeResponse)
async def get_college(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    college = await db.get(College, id)
    if not college:
        raise HTTPException(status_code=404, detail="College not found")
    return college
