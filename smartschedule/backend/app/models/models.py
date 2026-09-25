"""
Timetable Generator — Clean Data Models
Department, Faculty, Subject, FacultySubject, Class, ClassSubject, TimetableEntry, User
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, ForeignKey,
    Enum as SAEnum, DateTime, UniqueConstraint, text, Text
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def _uuid():
    return str(uuid.uuid4())


class Department(Base):
    __tablename__ = "departments"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String(150), nullable=False)
    code = Column(String(20), nullable=False, unique=True)
    department_type = Column(String(20), nullable=False, default="department", server_default="department")

    faculty = relationship("Faculty", back_populates="department", cascade="all, delete-orphan")
    subjects = relationship("Subject", back_populates="department", cascade="all, delete-orphan")
    classes = relationship("Class", back_populates="department", cascade="all, delete-orphan")


class Faculty(Base):
    __tablename__ = "faculty"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String(150), nullable=False)
    photo_url = Column(Text, nullable=True)
    department_id = Column(String, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    can_teach_all_classes = Column(Boolean, default=False, nullable=False)

    department = relationship("Department", back_populates="faculty")
    faculty_subjects = relationship("FacultySubject", back_populates="faculty", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="faculty")
    class_subjects = relationship("ClassSubject", back_populates="faculty")


class SubjectType(str, enum.Enum):
    theory = "theory"
    lab = "lab"


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String(150), nullable=False)
    code = Column(String(30), nullable=False)
    department_id = Column(String, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=True)
    semester = Column(Integer, nullable=True)
    type = Column(SAEnum(SubjectType), nullable=False, default=SubjectType.theory)
    periods_per_week = Column(Integer, nullable=False, default=4)
    # For lab subjects: how many consecutive periods per block (default 2)
    lab_block_size = Column(Integer, nullable=False, default=2)

    department = relationship("Department", back_populates="subjects")
    faculty_subjects = relationship("FacultySubject", back_populates="subject", cascade="all, delete-orphan")
    class_subjects = relationship("ClassSubject", back_populates="subject", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="subject")


class FacultySubject(Base):
    """Maps which faculty can teach which subject."""
    __tablename__ = "faculty_subjects"
    __table_args__ = (UniqueConstraint("faculty_id", "subject_id", name="uq_faculty_subject"),)

    id = Column(String, primary_key=True, default=_uuid)
    faculty_id = Column(String, ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)

    faculty = relationship("Faculty", back_populates="faculty_subjects")
    subject = relationship("Subject", back_populates="faculty_subjects")


class Class(Base):
    """A class section, e.g. CSE Year-2 Sem-3 Section-A."""
    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("department_id", "year", "semester", "section", name="uq_class"),)

    id = Column(String, primary_key=True, default=_uuid)
    department_id = Column(String, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    semester = Column(Integer, nullable=False)
    section = Column(String(10), nullable=False, default="A")

    department = relationship("Department", back_populates="classes")
    class_subjects = relationship("ClassSubject", back_populates="class_", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="class_")


class ClassSubject(Base):
    """Which subject + faculty assignment a given class needs."""
    __tablename__ = "class_subjects"
    __table_args__ = (UniqueConstraint("class_id", "subject_id", name="uq_class_subject"),)

    id = Column(String, primary_key=True, default=_uuid)
    class_id = Column(String, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    faculty_id = Column(String, ForeignKey("faculty.id", ondelete="SET NULL"), nullable=True)

    class_ = relationship("Class", back_populates="class_subjects")
    subject = relationship("Subject", back_populates="class_subjects")
    faculty = relationship("Faculty", back_populates="class_subjects")


class TimetableEntry(Base):
    """A single timetable slot: class X teaches subject Y with faculty Z on day D period P."""
    __tablename__ = "timetable_entries"
    __table_args__ = (
        UniqueConstraint("class_id", "day", "period", name="uq_class_slot"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    class_id = Column(String, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    faculty_id = Column(String, ForeignKey("faculty.id", ondelete="SET NULL"), nullable=True)
    day = Column(Integer, nullable=False)      # 0=Mon … 5=Sat
    period = Column(Integer, nullable=False)  # 1–7
    is_locked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    class_ = relationship("Class", back_populates="timetable_entries")
    subject = relationship("Subject", back_populates="timetable_entries")
    faculty = relationship("Faculty", back_populates="timetable_entries")


class User(Base):
    """Application user used by the active timetable API."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String(255), nullable=False, unique=True)
    full_name = Column(String(150), nullable=False, default="Administrator")
    role = Column(String(20), nullable=False, default="super_admin")
    college_id = Column(String(36), nullable=True)
    department_id = Column(String(36), nullable=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class WorkspaceSettings(Base):
    """Persisted workspace and timetable preferences for the active API."""
    __tablename__ = "workspace_settings"

    id = Column(String, primary_key=True, default="default")
    settings_json = Column(Text, nullable=False, default="{}")
    updated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"), onupdate=datetime.utcnow)


class ScheduleVersion(Base):
    """Snapshot and approval state for a generated active-model timetable."""
    __tablename__ = "schedule_versions"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String(150), nullable=False)
    department_id = Column(String, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    semester_cycle = Column(String(10), nullable=False)
    status = Column(String(30), nullable=False, default="generated")
    snapshot_json = Column(Text, nullable=False, default="[]")
    notes = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"), onupdate=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, default=_uuid)
    actor_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(150), nullable=False)
    action = Column(String(80), nullable=False)
    target = Column(String(200), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class UserNotification(Base):
    __tablename__ = "user_notifications"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(180), nullable=False)
    message = Column(Text, nullable=False)
    reference_path = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
