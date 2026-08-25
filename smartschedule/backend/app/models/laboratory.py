import uuid
from datetime import datetime, date, time
from sqlalchemy import String, Integer, Boolean, DateTime, Date, Time, func, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.compat import UUIDType
from app.db.session import Base

class Laboratory(Base):
    __tablename__ = 'laboratories'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    department_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('departments.id', ondelete='CASCADE'), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    building: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    equipment: Mapped[list[str] | None] = mapped_column(JSON)
    software_list: Mapped[list[str] | None] = mapped_column(JSON)
    available_days: Mapped[list[int] | None] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    overrides: Mapped[list['LabAvailabilityOverride']] = relationship(back_populates='lab', cascade='all, delete-orphan')

class LabAvailabilityOverride(Base):
    __tablename__ = 'lab_availability_overrides'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    lab_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('laboratories.id', ondelete='CASCADE'), nullable=False, index=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    is_available: Mapped[bool] = mapped_column(Boolean, default=False)
    
    lab: Mapped['Laboratory'] = relationship(back_populates='overrides')

class LabFacultyEligibility(Base):
    __tablename__ = 'lab_faculty_eligibility'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    lab_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('laboratories.id', ondelete='CASCADE'), nullable=False, index=True)
    faculty_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('faculty.id', ondelete='CASCADE'), nullable=False, index=True)
    can_supervise: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
