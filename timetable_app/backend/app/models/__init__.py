# Import all models so SQLAlchemy can resolve relationships
from app.models.department import Department
from app.models.faculty import Faculty
from app.models.subject import Subject, SubjectType
from app.models.faculty_subject import FacultySubject
from app.models.class_ import Class
from app.models.class_subject import ClassSubject
from app.models.timetable_entry import TimetableEntry

__all__ = [
    "Department", "Faculty", "Subject", "SubjectType",
    "FacultySubject", "Class", "ClassSubject", "TimetableEntry",
]
