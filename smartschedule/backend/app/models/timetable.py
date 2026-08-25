import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, func, ForeignKey, UniqueConstraint, Numeric, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import JSON as JSONB
from app.db.compat import UUIDType
from app.db.session import Base

class TimetableVersion(Base):
    __tablename__ = 'timetable_versions'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    college_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True)
    department_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('departments.id', ondelete='CASCADE'), nullable=False, index=True)
    semester_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('semesters.id', ondelete='CASCADE'), nullable=False, index=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('academic_years.id', ondelete='CASCADE'), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default='draft') # draft, generated, reviewed, hod_approved, principal_approved, published, locked, archived
    quality_score: Mapped[float | None] = mapped_column(Numeric(5,2), nullable=True)
    hard_violations: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    soft_score: Mapped[float | None] = mapped_column(Numeric(5,2), nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generated_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    generation_params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    hod_approved_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    hod_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    principal_approved_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    principal_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    entries: Mapped[list['TimetableEntry']] = relationship(back_populates='version', cascade='all, delete-orphan')

    __table_args__ = (
        UniqueConstraint('department_id', 'semester_id', 'version_number', name='uq_version_dept_sem_num'),
    )

class TimetableEntry(Base):
    __tablename__ = 'timetable_entries'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    version_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('timetable_versions.id', ondelete='CASCADE'), nullable=False, index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('classes.id', ondelete='CASCADE'), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False, index=True)
    faculty_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('faculty.id', ondelete='SET NULL'), nullable=True, index=True)
    room_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('rooms.id', ondelete='SET NULL'), nullable=True)
    lab_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('laboratories.id', ondelete='SET NULL'), nullable=True)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('batches.id', ondelete='SET NULL'), nullable=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    period_number: Mapped[int] = mapped_column(Integer, nullable=False)
    slot_type: Mapped[str] = mapped_column(String(50), default='regular')  # regular, shared, library, break, unassigned
    unassigned_initials: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    version: Mapped['TimetableVersion'] = relationship(back_populates='entries')
