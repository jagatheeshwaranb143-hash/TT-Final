from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.report_service import ReportService
from app.core.security import get_current_user

router = APIRouter()

@router.get("/class/{class_id}", summary="Download Class Timetable Report")
async def class_report(
    class_id: str,
    format: str = Query("excel", regex="^(pdf|excel|csv)$"),
    version_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Download class timetable in Excel format."""
    service = ReportService(db)
    
    if format == "excel":
        file_bytes = await service.generate_class_timetable_excel(class_id, version_id)
        return Response(
            content=file_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="class_{class_id}_timetable.xlsx"'}
        )
    return {"message": f"Format {format} not yet implemented"}


@router.get("/faculty/{faculty_id}", summary="Download Faculty Timetable Report")
async def faculty_report(
    faculty_id: str,
    format: str = Query("excel", regex="^(pdf|excel|csv)$"),
    version_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Download faculty timetable. (Reuses class logic under the hood in a complete impl)"""
    # Placeholder: currently report_service only has generate_class_timetable_excel and workload
    return {"message": "Faculty individual timetable report export coming soon."}


@router.get("/workload", summary="Download Faculty Workload Report")
async def workload_report(
    format: str = Query("excel", regex="^(pdf|excel|csv)$"),
    department_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Download faculty workload analytics in Excel format."""
    service = ReportService(db)
    
    if format == "excel":
        file_bytes = await service.generate_faculty_workload_excel(department_id)
        return Response(
            content=file_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="faculty_workload_report.xlsx"'}
        )
    return {"message": f"Format {format} not yet implemented"}


@router.get("/utilization", summary="Download Room Utilization Report")
async def utilization_report(
    format: str = Query("excel", regex="^(pdf|excel|csv)$"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Download room utilization report."""
    return {"message": "Room utilization export coming soon."}
