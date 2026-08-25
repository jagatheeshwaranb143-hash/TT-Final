from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

class ProgramBase(BaseModel):
    name: str
    code: str
    duration_years: int

class ProgramCreate(ProgramBase):
    department_id: UUID

class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    duration_years: Optional[int] = None

class ProgramResponse(ProgramBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    department_id: UUID
    created_at: datetime
    updated_at: datetime

class DepartmentBase(BaseModel):
    name: str
    code: str

class DepartmentCreate(DepartmentBase):
    college_id: UUID

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None

class DepartmentResponse(DepartmentBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    college_id: UUID
    created_at: datetime
    updated_at: datetime
    programs: list[ProgramResponse] = []
