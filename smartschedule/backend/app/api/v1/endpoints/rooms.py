from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct
from pydantic import BaseModel
from datetime import date
import logging
from sqlalchemy.exc import IntegrityError

from app.core.security import get_current_user, require_hod_or_above
from app.core.exceptions import DataNotFoundError, ConflictError, DependencyError
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

class RoomCreate(BaseModel):
    college_id: Optional[str] = None
    building: Optional[str] = "Main Campus"
    room_number: Optional[str] = None
    name: Optional[str] = None
    display_name: Optional[str] = None
    room_type_id: Optional[str] = None
    capacity: int = 60
    department_id: Optional[str] = None
    has_projector: bool = False
    has_ac: bool = False
    available_days: list[int] = [1,2,3,4,5]  # Mon-Fri default
    notes: Optional[str] = None

class RoomAvailabilityOverrideCreate(BaseModel):
    date: date
    is_available: bool = False
    reason: Optional[str] = None

@router.get("")
@router.get("/")
async def list_rooms(
    building: Optional[str] = None,
    room_type_id: Optional[str] = None,
    capacity_min: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Room
    query = select(Room).where(Room.college_id == current_user["college_id"])
    
    if building: query = query.where(Room.building == building)
    if room_type_id: query = query.where(Room.room_type_id == room_type_id)
    if capacity_min is not None: query = query.where(Room.capacity >= capacity_min)
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("")
@router.post("/")
async def create_room(
    data: RoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Room
    try:
        payload = data.model_dump()
        if not payload.get("college_id"):
            payload["college_id"] = current_user.get("college_id")
        if not payload.get("room_number"):
            payload["room_number"] = payload.get("name") or "R-101"
        payload.pop("name", None)
        new_room = Room(**payload)
        db.add(new_room)
        await db.commit()
        await db.refresh(new_room)
        return new_room
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Room creation conflict (possibly duplicate building+room_number).")

@router.get("/{id}")
async def get_room(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Room, RoomAvailabilityOverride
    query = select(Room).where(Room.id == id, Room.college_id == current_user["college_id"])
    result = await db.execute(query)
    room = result.scalar_one_or_none()
    
    if not room:
        raise DataNotFoundError("Room not found")
        
    ov_query = select(RoomAvailabilityOverride).where(RoomAvailabilityOverride.room_id == id)
    ov_res = await db.execute(ov_query)
    overrides = ov_res.scalars().all()
    
    return {
        **{c.name: getattr(room, c.name) for c in room.__table__.columns},
        "overrides": overrides
    }

@router.patch("/{id}")
async def update_room(
    id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Room
    query = select(Room).where(Room.id == id, Room.college_id == current_user["college_id"])
    result = await db.execute(query)
    room = result.scalar_one_or_none()
    
    if not room:
        raise DataNotFoundError("Room not found")
        
    for k, v in data.items():
        setattr(room, k, v)
        
    try:
        await db.commit()
        await db.refresh(room)
        return room
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Room update conflict.")

@router.delete("/{id}")
async def delete_room(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import Room, TimetableEntry
    query = select(Room).where(Room.id == id, Room.college_id == current_user["college_id"])
    result = await db.execute(query)
    room = result.scalar_one_or_none()
    
    if not room:
        raise DataNotFoundError("Room not found")
        
    tt_query = select(func.count(TimetableEntry.id)).where(TimetableEntry.room_id == id)
    tt_count = await db.execute(tt_query)
    if tt_count.scalar() > 0:
        raise DependencyError("Cannot delete room: Timetable entries exist.")
        
    await db.delete(room)
    await db.commit()
    return {"message": "Room deleted successfully"}

@router.get("/{id}/schedule")
async def get_room_schedule(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import TimetableEntry
    query = select(TimetableEntry).where(TimetableEntry.room_id == id)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/{id}/availability-override")
async def add_availability_override(
    id: str,
    data: RoomAvailabilityOverrideCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import RoomAvailabilityOverride
    try:
        new_ov = RoomAvailabilityOverride(room_id=id, **data.model_dump())
        db.add(new_ov)
        await db.commit()
        await db.refresh(new_ov)
        return new_ov
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Override conflict.")

@router.delete("/{id}/availability-override/{oid}")
async def remove_availability_override(
    id: str,
    oid: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import RoomAvailabilityOverride
    query = select(RoomAvailabilityOverride).where(RoomAvailabilityOverride.id == oid, RoomAvailabilityOverride.room_id == id)
    result = await db.execute(query)
    ov = result.scalar_one_or_none()
    if not ov:
        raise DataNotFoundError("Override not found")
        
    await db.delete(ov)
    await db.commit()
    return {"message": "Override removed"}

@router.get("/types")
async def list_room_types(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import RoomType
    query = select(RoomType)
    try:
        result = await db.execute(query)
        return result.scalars().all()
    except Exception:
        return []

class RoomTypeCreate(BaseModel):
    name: str

@router.post("/types")
async def create_room_type(
    data: RoomTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_hod_or_above())
):
    from app.models import RoomType
    try:
        rt = RoomType(name=data.name)
        db.add(rt)
        await db.commit()
        await db.refresh(rt)
        return rt
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Room type already exists")

@router.get("/buildings")
async def list_buildings(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models import Room
    query = select(Room.building).where(Room.college_id == current_user["college_id"]).distinct()
    result = await db.execute(query)
    return result.scalars().all()
