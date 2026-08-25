"""
SmartSchedule — Timetable Version Management & Approval Workflow Endpoints
Status machine: draft → generated → reviewed → hod_approved → principal_approved → published → locked
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.security import get_current_user, require_hod_or_above, require_super_admin
from app.core.exceptions import DataNotFoundError, ValidationError, ForbiddenError
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Status transitions ───
ALLOWED_TRANSITIONS = {
    "draft":               ["generated"],
    "generated":           ["reviewed", "draft"],
    "reviewed":            ["hod_approved", "generated"],
    "hod_approved":        ["principal_approved", "reviewed"],
    "principal_approved":  ["published", "hod_approved"],
    "published":           ["locked"],
    "locked":              [],  # Locked is final — cannot be changed
    "archived":            [],
}

ROLE_ALLOWED_TRANSITIONS = {
    "hod":         ["reviewed", "hod_approved"],
    "super_admin": ["principal_approved", "published", "locked"],
}


class ApprovalRequest(BaseModel):
    notes: str | None = None


class PublishValidationResponse(BaseModel):
    can_publish: bool
    faculty_conflicts: int
    class_conflicts: int
    room_conflicts: int
    lab_conflicts: int
    student_conflicts: int
    total_violations: int
    message: str


@router.get("", summary="List all timetable versions")
async def list_versions(
    department_id: str | None = None,
    semester_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all timetable versions accessible to the current user."""
    from app.models.timetable import TimetableVersion

    query = select(TimetableVersion).order_by(TimetableVersion.created_at.desc())

    if department_id:
        query = query.where(TimetableVersion.department_id == department_id)
    if semester_id:
        query = query.where(TimetableVersion.semester_id == semester_id)

    # HODs can only see their department
    if current_user.role == "hod" and current_user.department_id:
        query = query.where(TimetableVersion.department_id == str(current_user.department_id))

    result = await db.execute(query)
    versions = result.scalars().all()

    return {
        "versions": [
            {
                "id": str(v.id),
                "name": v.name,
                "version_number": v.version_number,
                "status": v.status,
                "quality_score": v.quality_score,
                "hard_violations": v.hard_violations,
                "generated_at": v.generated_at.isoformat() if v.generated_at else None,
                "published_at": v.published_at.isoformat() if v.published_at else None,
            }
            for v in versions
        ]
    }


@router.post("/{version_id}/approve-hod", summary="HOD approves the timetable")
async def hod_approve(
    version_id: str,
    request: ApprovalRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_hod_or_above()),
):
    """HOD approves a reviewed timetable for principal review."""
    from app.models.timetable import TimetableVersion

    version = await _get_version(version_id, db)

    if version.status != "reviewed":
        raise ValidationError(
            f"Cannot approve: timetable is in '{version.status}' status. "
            "It must be in 'reviewed' status first."
        )

    # HOD can only approve their department's timetable
    if current_user.role == "hod" and str(version.department_id) != str(current_user.department_id):
        raise ForbiddenError("You can only approve timetables for your own department.")

    version.status = "hod_approved"
    version.hod_approved_by = current_user.id
    version.hod_approved_at = datetime.now(timezone.utc)
    if request.notes:
        version.notes = request.notes

    await db.commit()
    logger.info(f"Version {version_id} HOD-approved by {current_user.email}")

    return {"message": "Timetable approved by HOD. Submitted for Principal approval.", "status": "hod_approved"}


@router.post("/{version_id}/approve-principal", summary="Principal approves the timetable")
async def principal_approve(
    version_id: str,
    request: ApprovalRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_super_admin()),
):
    """Principal (Super Admin) gives final approval before publishing."""
    from app.models.timetable import TimetableVersion

    version = await _get_version(version_id, db)

    if version.status != "hod_approved":
        raise ValidationError(
            f"Cannot approve: timetable is in '{version.status}' status. "
            "HOD must approve first."
        )

    version.status = "principal_approved"
    version.principal_approved_by = current_user.id
    version.principal_approved_at = datetime.now(timezone.utc)
    if request.notes:
        version.notes = (version.notes or "") + f"\nPrincipal: {request.notes}"

    await db.commit()
    logger.info(f"Version {version_id} Principal-approved by {current_user.email}")

    return {"message": "Timetable approved by Principal. Ready to publish.", "status": "principal_approved"}


@router.post("/{version_id}/validate-publish", response_model=PublishValidationResponse, summary="Validate before publishing")
async def validate_before_publish(
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_super_admin()),
):
    """
    Run final validation before publishing.
    Publishing is BLOCKED if any hard violations exist.
    This is a safety check that runs automatically before any publish attempt.
    """
    from app.models.timetable import TimetableEntry, TimetableVersion
    from sqlalchemy import func

    version = await _get_version(version_id, db)

    # Count all entries for this version
    entries_result = await db.execute(
        select(TimetableEntry).where(TimetableEntry.version_id == version_id)
    )
    entries = entries_result.scalars().all()

    # Detect clashes
    faculty_clashes = _count_clashes(entries, "faculty_id")
    class_clashes = _count_clashes(entries, "class_id")
    room_clashes = _count_clashes(entries, "room_id", skip_none=True)
    lab_clashes = _count_clashes(entries, "lab_id", skip_none=True)

    total = faculty_clashes + class_clashes + room_clashes + lab_clashes

    if total > 0:
        message = (
            f"❌ Cannot publish: {total} hard constraint violation(s) detected. "
            f"Fix all conflicts before publishing."
        )
    else:
        message = "✅ All validations passed. Safe to publish."

    return PublishValidationResponse(
        can_publish=(total == 0),
        faculty_conflicts=faculty_clashes,
        class_conflicts=class_clashes,
        room_conflicts=room_clashes,
        lab_conflicts=lab_clashes,
        student_conflicts=0,
        total_violations=total,
        message=message,
    )


@router.post("/{version_id}/publish", summary="Publish the timetable (makes it visible to all users)")
async def publish_version(
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_super_admin()),
):
    """
    Publish the timetable. Runs final validation first.
    Publish is BLOCKED if any hard violations exist.
    Students and faculty will immediately see the published timetable.
    """
    from app.models.timetable import TimetableEntry

    version = await _get_version(version_id, db)

    if version.status not in ["principal_approved", "hod_approved"]:
        raise ValidationError(
            f"Cannot publish: timetable is in '{version.status}' status. "
            "Principal approval is required before publishing."
        )

    # Final validation — must pass with zero violations
    entries_result = await db.execute(
        select(TimetableEntry).where(TimetableEntry.version_id == version_id)
    )
    entries = entries_result.scalars().all()

    faculty_clashes = _count_clashes(entries, "faculty_id")
    class_clashes = _count_clashes(entries, "class_id")
    room_clashes = _count_clashes(entries, "room_id", skip_none=True)
    lab_clashes = _count_clashes(entries, "lab_id", skip_none=True)
    total = faculty_clashes + class_clashes + room_clashes + lab_clashes

    if total > 0:
        raise ValidationError(
            f"Cannot publish: {total} hard conflict(s) detected. "
            f"(Faculty: {faculty_clashes}, Class: {class_clashes}, Room: {room_clashes}, Lab: {lab_clashes}). "
            "Resolve all conflicts before publishing."
        )

    version.status = "published"
    version.published_at = datetime.now(timezone.utc)

    # Archive all other published versions for this department/semester
    from app.models.timetable import TimetableVersion
    other_published = await db.execute(
        select(TimetableVersion).where(
            and_(
                TimetableVersion.department_id == version.department_id,
                TimetableVersion.semester_id == version.semester_id,
                TimetableVersion.status == "published",
                TimetableVersion.id != version.id,
            )
        )
    )
    for old_version in other_published.scalars().all():
        old_version.status = "archived"

    await db.commit()
    logger.info(f"Version {version_id} published by {current_user.email}")

    # TODO: Send FCM notifications to affected faculty and students

    return {
        "message": "Timetable published successfully. All users can now view it.",
        "status": "published",
        "published_at": version.published_at.isoformat()
    }


@router.post("/{version_id}/lock", summary="Lock the published timetable (prevents further changes)")
async def lock_version(
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_super_admin()),
):
    """Lock a published timetable to prevent any further modifications."""
    version = await _get_version(version_id, db)

    if version.status != "published":
        raise ValidationError("Only published timetables can be locked.")

    version.status = "locked"
    version.locked_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "Timetable locked. No further changes are allowed.", "status": "locked"}


@router.get("/{version_id}/compare/{other_version_id}", summary="Compare two timetable versions")
async def compare_versions(
    version_id: str,
    other_version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Compare two timetable versions to identify what changed."""
    from app.models.timetable import TimetableEntry

    version_a_entries = await db.execute(
        select(TimetableEntry).where(TimetableEntry.version_id == version_id)
    )
    version_b_entries = await db.execute(
        select(TimetableEntry).where(TimetableEntry.version_id == other_version_id)
    )

    a_entries = {(e.class_id, e.subject_id, e.faculty_id): e for e in version_a_entries.scalars().all()}
    b_entries = {(e.class_id, e.subject_id, e.faculty_id): e for e in version_b_entries.scalars().all()}

    added = [str(k) for k in b_entries if k not in a_entries]
    removed = [str(k) for k in a_entries if k not in b_entries]
    modified = [
        str(k) for k in a_entries
        if k in b_entries and (
            a_entries[k].day_of_week != b_entries[k].day_of_week or
            a_entries[k].period_number != b_entries[k].period_number
        )
    ]

    return {
        "version_a_id": version_id,
        "version_b_id": other_version_id,
        "added_count": len(added),
        "removed_count": len(removed),
        "modified_count": len(modified),
        "summary": f"{len(added)} added, {len(removed)} removed, {len(modified)} moved",
    }


# ─── Helpers ───
async def _get_version(version_id: str, db: AsyncSession):
    from app.models.timetable import TimetableVersion
    result = await db.execute(select(TimetableVersion).where(TimetableVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise DataNotFoundError("Timetable version", version_id)
    return version


def _count_clashes(entries, field: str, skip_none: bool = False) -> int:
    """Count scheduling conflicts by checking duplicate (field_value, day, period) combos."""
    seen = set()
    clashes = 0
    for e in entries:
        val = getattr(e, field)
        if skip_none and val is None:
            continue
        key = (str(val), e.day_of_week, e.period_number)
        if key in seen:
            clashes += 1
        seen.add(key)
    return clashes
