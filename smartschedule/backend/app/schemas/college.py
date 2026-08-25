from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime, date

class SemesterBase(BaseModel):
    name: str
    number: int
    start_date: date
    end_date: date
    status: str = 'active'

class SemesterCreate(SemesterBase):
    academic_year_id: UUID

class SemesterUpdate(BaseModel):
    name: Optional[str] = None
    number: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None

class SemesterResponse(SemesterBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    academic_year_id: UUID
    created_at: datetime


class AcademicYearBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_current: bool = False
    status: str = 'active'

class AcademicYearCreate(AcademicYearBase):
    college_id: UUID

class AcademicYearUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None
    status: Optional[str] = None

class AcademicYearResponse(AcademicYearBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    college_id: UUID
    created_at: datetime
    semesters: list[SemesterResponse] = []


class CollegeBase(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    logo_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None

class CollegeCreate(CollegeBase):
    pass

class CollegeUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None

class CollegeResponse(CollegeBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime
