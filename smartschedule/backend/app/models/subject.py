import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, func, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.compat import UUIDType
from app.db.session import Base

class SubjectType(Base):
    __tablename__ = 'subject_types'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_practical: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_lab: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Subject(Base):
    __tablename__ = 'subjects'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    department_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('departments.id', ondelete='CASCADE'), nullable=False, index=True)
    # subject_type_id FK kept for compatibility but nullable now
    subject_type_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('subject_types.id', ondelete='SET NULL'), nullable=True, index=True)
    # Plain-text subject type for simpler API usage: "theory" | "lab" | "practical" | "project"
    subject_type: Mapped[str] = mapped_column(String(50), nullable=False, default='theory')
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, default=3)
    # weekly_periods is the canonical field; contact_hours_per_week is an alias kept for compat
    weekly_periods: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    contact_hours_per_week: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    # Semester number for easy filtering (1–8)
    semester_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Lab / consecutive scheduling flags
    requires_lab: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_consecutive_periods: Mapped[bool] = mapped_column(Boolean, default=False)
    consecutive_count: Mapped[int] = mapped_column(Integer, default=2)
    # Scheduling preferences
    preferred_days: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    restricted_days: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    preferred_period_numbers: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    restricted_period_numbers: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    faculty_assignments: Mapped[list['FacultySubject']] = relationship(back_populates='subject', cascade='all, delete-orphan')


class FacultySubject(Base):
    """Maps which faculty members can teach which subjects (FacultySubject = SubjectAssignment)."""
    __tablename__ = 'faculty_subjects'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    faculty_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('faculty.id', ondelete='CASCADE'), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subject: Mapped['Subject'] = relationship(back_populates='faculty_assignments')
