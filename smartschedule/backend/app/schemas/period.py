from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime, time

class PeriodBase(BaseModel):
    number: int
    start_time: time
    end_time: time
    is_break: bool = False
    break_name: Optional[str] = None

class PeriodCreate(PeriodBase):
    configuration_id: UUID

class PeriodUpdate(BaseModel):
    number: Optional[int] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_break: Optional[bool] = None
    break_name: Optional[str] = None

class PeriodResponse(PeriodBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    configuration_id: UUID

class PeriodConfigurationBase(BaseModel):
    name: str
    is_default: bool = False

class PeriodConfigurationCreate(PeriodConfigurationBase):
    college_id: UUID

class PeriodConfigurationUpdate(BaseModel):
    name: Optional[str] = None
    is_default: Optional[bool] = None

class PeriodConfigurationResponse(PeriodConfigurationBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    college_id: UUID
    created_at: datetime
    updated_at: datetime
    periods: list[PeriodResponse] = []

class WorkingDayBase(BaseModel):
    day_of_week: int
    is_working: bool = True

class WorkingDayCreate(WorkingDayBase):
    college_id: UUID

class WorkingDayUpdate(BaseModel):
    day_of_week: Optional[int] = None
    is_working: Optional[bool] = None

class WorkingDayResponse(WorkingDayBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    college_id: UUID
    created_at: datetime
