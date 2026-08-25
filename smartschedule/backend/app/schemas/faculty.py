from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime, time

class FacultyAvailabilityBase(BaseModel):
    day_of_week: int
    start_time: time
    end_time: time
    is_available: bool = True

class FacultyAvailabilityCreate(FacultyAvailabilityBase):
    faculty_id: UUID

class FacultyAvailabilityUpdate(BaseModel):
    day_of_week: Optional[int] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_available: Optional[bool] = None

class FacultyAvailabilityResponse(FacultyAvailabilityBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    faculty_id: UUID

class FacultySubjectAssignment(BaseModel):
    subject_id: UUID
    is_primary: bool = True

class FacultyBase(BaseModel):
    name: str
    code: str
    email: str
    max_hours_per_week: int = 40
    max_hours_per_day: int = 8
    is_active: bool = True

class FacultyCreate(FacultyBase):
    department_id: UUID
    user_id: Optional[UUID] = None

class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    email: Optional[str] = None
    max_hours_per_week: Optional[int] = None
    max_hours_per_day: Optional[int] = None
    is_active: Optional[bool] = None
    user_id: Optional[UUID] = None

class FacultyResponse(FacultyBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    department_id: UUID
    user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    availability: list[FacultyAvailabilityResponse] = []
