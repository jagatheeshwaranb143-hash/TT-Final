import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.compat import UUIDType
from app.db.session import Base

class Class(Base):
    __tablename__ = 'classes'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    # Core FK relationships
    program_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('programs.id', ondelete='CASCADE'), nullable=True, index=True)
    semester_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('semesters.id', ondelete='CASCADE'), nullable=True, index=True)
    academic_year_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('academic_years.id', ondelete='SET NULL'), nullable=True, index=True)
    # Direct department_id for simpler querying (denormalized from program)
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('departments.id', ondelete='CASCADE'), nullable=True, index=True)
    # Class descriptor fields
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    section: Mapped[str] = mapped_column(String(20), nullable=False, default='A')
    year_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 1 | 2 | 3 | 4
    student_count: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    # Alias: strength == student_count (kept for endpoint compat)
    strength: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    batches: Mapped[list['Batch']] = relationship(back_populates='class_', cascade='all, delete-orphan')

class Batch(Base):
    __tablename__ = 'batches'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('classes.id', ondelete='CASCADE'), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    student_count: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    class_: Mapped['Class'] = relationship(back_populates='batches')
