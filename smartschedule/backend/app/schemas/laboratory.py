from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime, date, time

class LabAvailabilityOverrideBase(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_available: bool = False

class LabAvailabilityOverrideCreate(LabAvailabilityOverrideBase):
    lab_id: UUID

class LabAvailabilityOverrideResponse(LabAvailabilityOverrideBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    lab_id: UUID

class LaboratoryBase(BaseModel):
    name: str
    building: str
    capacity: int
    equipment: Optional[list[str]] = None
    software_list: Optional[list[str]] = None
    available_days: Optional[list[int]] = None
    is_active: bool = True

class LaboratoryCreate(LaboratoryBase):
    department_id: UUID

class LaboratoryUpdate(BaseModel):
    name: Optional[str] = None
    building: Optional[str] = None
    capacity: Optional[int] = None
    equipment: Optional[list[str]] = None
    software_list: Optional[list[str]] = None
    available_days: Optional[list[int]] = None
    is_active: Optional[bool] = None

class LaboratoryResponse(LaboratoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    department_id: UUID
    created_at: datetime
    updated_at: datetime
    overrides: list[LabAvailabilityOverrideResponse] = []
