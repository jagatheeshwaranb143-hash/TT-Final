import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update

from app.core.security import require_hod_or_above
from app.core.exceptions import DataNotFoundError, ValidationError, ConflictError
from app.db.session import get_db
from app.models.timetable import TimetableEntry, TimetableVersion

logger = logging.getLogger(__name__)
router = APIRouter()

# --- Schemas ---

class MoveEntryRequest(BaseModel):
    entry_id: str
    new_day_of_week: int
    new_period_number: int
    version_id: str

class SwapEntriesRequest(BaseModel):
    entry_id_1: str
    entry_id_2: str
    version_id: str

class SuccessResponse(BaseModel):
    success: bool
    message: str

# --- Endpoints ---

@router.post("/move", response_model=SuccessResponse, summary="Move a timetable entry to a new slot")
async def move_entry(
    request: MoveEntryRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_hod_or_above())
):
    """
    Move a timetable entry to a new day and period.
    Assumes the frontend has already called /validate-move and got a valid result, 
    but we still do basic conflict checks here.
    """
    # 1. Fetch entry
    result = await db.execute(select(TimetableEntry).where(TimetableEntry.id == request.entry_id))
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise DataNotFoundError("Timetable entry", request.entry_id)
        
    if str(entry.version_id) != request.version_id:
        raise ValidationError("Version mismatch between entry and request")

    if entry.is_locked:
        raise ConflictError("Cannot move a locked entry. Unlock it first.")
        
    # 2. Check for basic conflicts (faculty, class, room) at destination
    # This is a simplified check, full check is in validate-move
    conflict_query = select(TimetableEntry).where(
        and_(
            TimetableEntry.version_id == request.version_id,
            TimetableEntry.day_of_week == request.new_day_of_week,
            TimetableEntry.period_number == request.new_period_number,
            TimetableEntry.id != entry.id
        )
    )
    conflicts = (await db.execute(conflict_query)).scalars().all()
    
    for c in conflicts:
        if c.faculty_id == entry.faculty_id:
            raise ConflictError("Faculty is already teaching another class at this time.")
        if c.class_id == entry.class_id:
            raise ConflictError("This class already has another subject at this time.")
        if entry.room_id and c.room_id == entry.room_id:
            raise ConflictError("Room is already occupied at this time.")
            
    # 3. Apply move
    entry.day_of_week = request.new_day_of_week
    entry.period_number = request.new_period_number
    
    await db.commit()
    return SuccessResponse(success=True, message="Entry moved successfully.")


@router.post("/swap", response_model=SuccessResponse, summary="Swap two timetable entries")
async def swap_entries(
    request: SwapEntriesRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_hod_or_above())
):
    """
    Swap the timeslots of two entries.
    """
    # 1. Fetch both entries
    result1 = await db.execute(select(TimetableEntry).where(TimetableEntry.id == request.entry_id_1))
    entry1 = result1.scalar_one_or_none()
    
    result2 = await db.execute(select(TimetableEntry).where(TimetableEntry.id == request.entry_id_2))
    entry2 = result2.scalar_one_or_none()
    
    if not entry1 or not entry2:
        raise DataNotFoundError("Timetable entry", "One or both entries not found")
        
    if str(entry1.version_id) != request.version_id or str(entry2.version_id) != request.version_id:
        raise ValidationError("Version mismatch")
        
    if entry1.is_locked or entry2.is_locked:
        raise ConflictError("Cannot swap locked entries. Unlock them first.")
        
    # Check if they are from the same class or faculty (to avoid complex multi-swap conflicts)
    # If they are different classes and different faculty, we need to check if swapping causes conflicts
    if entry1.class_id != entry2.class_id and entry1.faculty_id != entry2.faculty_id:
        # Check if entry1's new slot (entry2's old slot) has conflicts for entry1's faculty/class
        # And vice versa. Too complex for simple swap.
        raise ConflictError("Swapping entries from different classes AND different faculties is not supported.")
        
    # Perform swap
    day1, period1 = entry1.day_of_week, entry1.period_number
    day2, period2 = entry2.day_of_week, entry2.period_number
    
    entry1.day_of_week = day2
    entry1.period_number = period2
    
    entry2.day_of_week = day1
    entry2.period_number = period1
    
    await db.commit()
    return SuccessResponse(success=True, message="Entries swapped successfully.")


@router.post("/lock/{id}", response_model=SuccessResponse, summary="Lock a timetable entry")
async def lock_entry(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_hod_or_above())
):
    """
    Lock an entry so it cannot be moved by drag-and-drop or CP-SAT regeneration.
    """
    result = await db.execute(select(TimetableEntry).where(TimetableEntry.id == id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise DataNotFoundError("Timetable entry", id)
        
    entry.is_locked = True
    await db.commit()
    
    return SuccessResponse(success=True, message="Entry locked.")


@router.post("/unlock/{id}", response_model=SuccessResponse, summary="Unlock a timetable entry")
async def unlock_entry(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_hod_or_above())
):
    """
    Unlock a previously locked entry.
    """
    result = await db.execute(select(TimetableEntry).where(TimetableEntry.id == id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise DataNotFoundError("Timetable entry", id)
        
    entry.is_locked = False
    await db.commit()
    
    return SuccessResponse(success=True, message="Entry unlocked.")
