from pydantic import BaseModel
from typing import Optional


class DepartmentBase(BaseModel):
    name: str
    code: str


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None


class DepartmentOut(DepartmentBase):
    id: str
    model_config = {"from_attributes": True}


# ── Faculty ──────────────────────────────────────────────────────────────────

class FacultyBase(BaseModel):
    name: str
    department_id: str


class FacultyCreate(FacultyBase):
    subject_ids: list[str] = []   # FacultySubject rows to create


class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[str] = None
    subject_ids: Optional[list[str]] = None


class FacultyOut(FacultyBase):
    id: str
    subject_ids: list[str] = []
    department_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Subject ───────────────────────────────────────────────────────────────────

class SubjectBase(BaseModel):
    name: str
    code: str
    department_id: str
    type: str = "theory"         # "theory" | "lab"
    periods_per_week: int = 4


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    department_id: Optional[str] = None
    type: Optional[str] = None
    periods_per_week: Optional[int] = None


class SubjectOut(SubjectBase):
    id: str
    department_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Class ─────────────────────────────────────────────────────────────────────

class ClassBase(BaseModel):
    department_id: str
    year: int
    semester: int
    section: str = "A"


class ClassCreate(ClassBase):
    pass


class ClassUpdate(BaseModel):
    department_id: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None
    section: Optional[str] = None


class ClassOut(ClassBase):
    id: str
    department_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ── ClassSubject ──────────────────────────────────────────────────────────────

class ClassSubjectBase(BaseModel):
    class_id: str
    subject_id: str
    faculty_id: str


class ClassSubjectCreate(ClassSubjectBase):
    pass


class ClassSubjectOut(ClassSubjectBase):
    id: str
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_type: Optional[str] = None
    periods_per_week: Optional[int] = None
    faculty_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Timetable ─────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    class_ids: list[str]          # generate for one or more classes


class TimetableEntryOut(BaseModel):
    id: str
    class_id: str
    subject_id: str
    faculty_id: str
    day: int
    period: int
    is_locked: bool
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_type: Optional[str] = None
    faculty_name: Optional[str] = None
    class_label: Optional[str] = None
    model_config = {"from_attributes": True}


class TimetableEntryUpdate(BaseModel):
    subject_id: Optional[str] = None
    faculty_id: Optional[str] = None
    day: Optional[int] = None
    period: Optional[int] = None
    is_locked: Optional[bool] = None


class GenerateResponse(BaseModel):
    status: str          # "OPTIMAL" | "FEASIBLE" | "INFEASIBLE"
    message: str
    entries_created: int


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
