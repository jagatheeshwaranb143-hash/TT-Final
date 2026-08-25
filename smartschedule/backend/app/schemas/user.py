from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from typing import Optional, Any
from uuid import UUID
from datetime import datetime

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str
    college_id: Optional[str] = None
    department_id: Optional[str] = None
    employee_id: Optional[str] = None
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    college_id: Optional[str] = None
    department_id: Optional[str] = None
    employee_id: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: Any  # UUID object or str — both work
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

