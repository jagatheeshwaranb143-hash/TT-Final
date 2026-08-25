# Re-export everything from the single models file
from app.models.models import (
    Base,
    Department,
    Faculty,
    Subject,
    SubjectType,
    FacultySubject,
    Class,
    ClassSubject,
    TimetableEntry,
    User,
)

__all__ = [
    "Base",
    "Department",
    "Faculty",
    "Subject",
    "SubjectType",
    "FacultySubject",
    "Class",
    "ClassSubject",
    "TimetableEntry",
    "User",
]
