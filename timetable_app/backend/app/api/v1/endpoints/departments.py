from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.department import Department
from app.schemas.schemas import DepartmentCreate, DepartmentUpdate, DepartmentOut

router = APIRouter()


@router.get("/", response_model=list[DepartmentOut])
async def list_departments(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Department).order_by(Department.name))
    return result.scalars().all()


@router.post("/", response_model=DepartmentOut, status_code=201)
async def create_department(body: DepartmentCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    dept = Department(name=body.name, code=body.code.upper())
    db.add(dept)
    await db.flush()
    return dept


@router.get("/{dept_id}", response_model=DepartmentOut)
async def get_department(dept_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    dept = await db.get(Department, dept_id)
    if not dept:
        raise HTTPException(404, "Department not found")
    return dept


@router.put("/{dept_id}", response_model=DepartmentOut)
async def update_department(dept_id: str, body: DepartmentUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    dept = await db.get(Department, dept_id)
    if not dept:
        raise HTTPException(404, "Department not found")
    if body.name is not None:
        dept.name = body.name
    if body.code is not None:
        dept.code = body.code.upper()
    return dept


@router.delete("/{dept_id}", status_code=204)
async def delete_department(dept_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    dept = await db.get(Department, dept_id)
    if not dept:
        raise HTTPException(404, "Department not found")
    await db.delete(dept)
