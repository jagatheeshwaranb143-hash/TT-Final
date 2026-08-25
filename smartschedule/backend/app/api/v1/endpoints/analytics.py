"""
SmartSchedule — Analytics Endpoints
Dashboard stats and charts for admin/principal/HOD views.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User

router = APIRouter()


@router.get("/principal-stats")
async def principal_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Summary stats for principal/admin dashboard."""
    from app.models import Department, Faculty, College, TimetableVersion
    
    dept_count = await db.scalar(select(func.count()).select_from(Department))
    faculty_count = await db.scalar(select(func.count()).select_from(Faculty))
    user_count = await db.scalar(select(func.count()).select_from(User))
    college_count = await db.scalar(select(func.count()).select_from(College))
    
    return {
        "totalDepartments": dept_count or 0,
        "totalFaculty": faculty_count or 0,
        "totalStudents": user_count or 0,
        "avgQualityScore": 87,
        "totalColleges": college_count or 0,
        "activeVersions": 0,
    }


@router.get("/workload-stats", status_code=status.HTTP_200_OK)
async def workload_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get faculty workload stats."""
    return {"data": [], "message": "No timetable data yet"}


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

