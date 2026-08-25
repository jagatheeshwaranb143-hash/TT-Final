import uuid
from datetime import datetime, time
from sqlalchemy import String, Integer, Boolean, DateTime, Time, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.compat import UUIDType
from app.db.session import Base

class Faculty(Base):
    __tablename__ = 'faculty'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    department_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('departments.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    designation: Mapped[str | None] = mapped_column(String(100), default="Assistant Professor", nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    max_hours_per_week: Mapped[int] = mapped_column(Integer, default=18)
    max_hours_per_day: Mapped[int] = mapped_column(Integer, default=4)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def initials(self) -> str:
        return self.code

    @property
    def max_weekly_periods(self) -> int:
        """Alias for max_hours_per_week — used by workload endpoint."""
        return self.max_hours_per_week

    availability: Mapped[list['FacultyAvailability']] = relationship(back_populates='faculty', cascade='all, delete-orphan')


class FacultyAvailability(Base):
    __tablename__ = 'faculty_availability'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    faculty_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('faculty.id', ondelete='CASCADE'), nullable=False, index=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 1=Monday, 7=Sunday
    period_number: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-indexed period slot
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    faculty: Mapped['Faculty'] = relationship(back_populates='availability')
