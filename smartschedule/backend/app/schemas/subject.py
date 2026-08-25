from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

class SubjectTypeBase(BaseModel):
    name: str
    is_practical: bool = False
    requires_lab: bool = False

class SubjectTypeCreate(SubjectTypeBase):
    pass

class SubjectTypeUpdate(BaseModel):
    name: Optional[str] = None
    is_practical: Optional[bool] = None
    requires_lab: Optional[bool] = None

class SubjectTypeResponse(SubjectTypeBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime

class FacultySubjectBase(BaseModel):
    is_primary: bool = True

class FacultySubjectCreate(FacultySubjectBase):
    faculty_id: UUID
    subject_id: UUID

class FacultySubjectResponse(FacultySubjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    faculty_id: UUID
    subject_id: UUID
    created_at: datetime

class SubjectBase(BaseModel):
    name: str
    code: str
    credits: int = 3
    contact_hours_per_week: int
    preferred_days: Optional[list[int]] = None
    preferred_period_numbers: Optional[list[int]] = None

class SubjectCreate(SubjectBase):
    department_id: UUID
    subject_type_id: UUID

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    credits: Optional[int] = None
    contact_hours_per_week: Optional[int] = None
    preferred_days: Optional[list[int]] = None
    preferred_period_numbers: Optional[list[int]] = None
    subject_type_id: Optional[UUID] = None

class SubjectResponse(SubjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    department_id: UUID
    subject_type_id: UUID
    created_at: datetime
    updated_at: datetime
