from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime, date, time

class RoomTypeBase(BaseModel):
    name: str

class RoomTypeCreate(RoomTypeBase):
    pass

class RoomTypeResponse(RoomTypeBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime

class RoomAvailabilityOverrideBase(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    available_days: Optional[list[int]] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_available: bool = False

class RoomAvailabilityOverrideCreate(RoomAvailabilityOverrideBase):
    room_id: UUID

class RoomAvailabilityOverrideResponse(RoomAvailabilityOverrideBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    room_id: UUID

class RoomBase(BaseModel):
    name: str
    building: str
    floor: Optional[str] = None
    capacity: int
    is_active: bool = True

class RoomCreate(RoomBase):
    department_id: Optional[UUID] = None
    room_type_id: UUID

class RoomUpdate(BaseModel):
    name: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None
    department_id: Optional[UUID] = None
    room_type_id: Optional[UUID] = None

class RoomResponse(RoomBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    department_id: Optional[UUID]
    room_type_id: UUID
    created_at: datetime
    updated_at: datetime
    overrides: list[RoomAvailabilityOverrideResponse] = []
