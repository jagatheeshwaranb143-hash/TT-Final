from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

class BatchBase(BaseModel):
    name: str
    student_count: int

class BatchCreate(BatchBase):
    class_id: UUID

class BatchUpdate(BaseModel):
    name: Optional[str] = None
    student_count: Optional[int] = None

class BatchResponse(BatchBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    class_id: UUID
    created_at: datetime

class ClassBase(BaseModel):
    name: str
    section: str
    student_count: int

class ClassCreate(ClassBase):
    program_id: UUID
    semester_id: UUID

class ClassUpdate(BaseModel):
    name: Optional[str] = None
    section: Optional[str] = None
    student_count: Optional[int] = None

class ClassResponse(ClassBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    program_id: UUID
    semester_id: UUID
    created_at: datetime
    updated_at: datetime
    batches: list[BatchResponse] = []
