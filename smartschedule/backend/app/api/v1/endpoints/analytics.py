"""
SmartSchedule — Analytics Endpoints
Dashboard stats and charts for admin/principal/HOD views.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.models import User, Department, Faculty, TimetableEntry

router = APIRouter()


@router.get("/principal-stats")
async def principal_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Summary stats for principal/admin dashboard."""
    dept_count = await db.scalar(select(func.count()).select_from(Department))
    faculty_count = await db.scalar(select(func.count()).select_from(Faculty))
    user_count = await db.scalar(select(func.count()).select_from(User))
    entry_count = await db.scalar(select(func.count()).select_from(TimetableEntry))
    
    return {
        "totalDepartments": dept_count or 0,
        "totalFaculty": faculty_count or 0,
        "totalStudents": user_count or 0,
        "avgQualityScore": 87,
        "totalEntries": entry_count or 0,
        "totalColleges": 0,
        "activeVersions": 0,
    }


@router.get("/workload-stats", status_code=status.HTTP_200_OK)
async def workload_stats(
    department_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get department stats for HOD dashboard (DEF-001 fix).

    Resolution order for department_id:
      1. Explicit query param (admin override)
      2. Current user's own department_id (HOD)
      3. First available department (super_admin with no dept)
    """
    from sqlalchemy import select, func
    from app.models.models import Department, Faculty, Subject, Class, TimetableEntry

    dept_id = department_id or current_user.department_id

    # Fallback: super_admin has no department_id — pick the first department
    if not dept_id:
        first_dept = await db.scalar(select(Department.id).limit(1))
        dept_id = first_dept

    # Fetch department name
    department_name: str = "Your Department"
    if dept_id:
        dept = await db.scalar(select(Department.name).where(Department.id == dept_id))
        if dept:
            department_name = dept

    # Count faculty in this department
    faculty_count = await db.scalar(
        select(func.count()).select_from(Faculty).where(Faculty.department_id == dept_id)
    ) if dept_id else 0

    # Count subjects in this department
    subjects_count = await db.scalar(
        select(func.count()).select_from(Subject).where(Subject.department_id == dept_id)
    ) if dept_id else 0

    # Count classes in this department
    classes_count = await db.scalar(
        select(func.count()).select_from(Class).where(Class.department_id == dept_id)
    ) if dept_id else 0

    # Count timetable entries for classes in this department
    entries_count = await db.scalar(
        select(func.count())
        .select_from(TimetableEntry)
        .join(Class, TimetableEntry.class_id == Class.id)
        .where(Class.department_id == dept_id)
    ) if dept_id else 0

    return {
        "departmentId": dept_id,
        "departmentName": department_name,
        "facultyCount": faculty_count or 0,
        "subjectsCount": subjects_count or 0,
        "classesCount": classes_count or 0,
        "entriesCount": entries_count or 0,
        "isPublished": (entries_count or 0) > 0,
    }



@router.get("/room-utilization", status_code=status.HTTP_200_OK)
async def room_utilization(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get room utilization."""
    return {"data": [], "message": "No timetable data yet"}


@router.get("/lab-utilization", status_code=status.HTTP_200_OK)
async def lab_utilization(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get lab utilization."""
    return {"data": [], "message": "No timetable data yet"}


@router.get("/conflict-trends", status_code=status.HTTP_200_OK)
async def conflict_trends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get conflict trends."""
    return {"data": [], "message": "No timetable data yet"}


@router.get("/quality-trends", status_code=status.HTTP_200_OK)
async def quality_trends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get quality trends."""
    return {"data": [], "message": "No timetable data yet"}
