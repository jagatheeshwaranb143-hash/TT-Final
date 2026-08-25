import uuid
from datetime import datetime, time
from sqlalchemy import String, Integer, Boolean, DateTime, Time, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.compat import UUIDType
from app.db.session import Base

class PeriodConfiguration(Base):
    __tablename__ = 'period_configurations'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    college_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    periods: Mapped[list['Period']] = relationship(back_populates='configuration', cascade='all, delete-orphan')

class Period(Base):
    __tablename__ = 'periods'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    configuration_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('period_configurations.id', ondelete='CASCADE'), nullable=False, index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_break: Mapped[bool] = mapped_column(Boolean, default=False)
    break_name: Mapped[str | None] = mapped_column(String(100))
    
    configuration: Mapped['PeriodConfiguration'] = relationship(back_populates='periods')

class WorkingDay(Base):
    __tablename__ = 'working_days'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    college_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False) # 1=Monday, 7=Sunday
    is_working: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
