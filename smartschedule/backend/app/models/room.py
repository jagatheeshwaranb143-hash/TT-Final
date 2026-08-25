import uuid
from datetime import datetime, date, time
from sqlalchemy import String, Integer, Boolean, DateTime, Date, Time, func, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.compat import UUIDType
from app.db.session import Base

class RoomType(Base):
    __tablename__ = 'room_types'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Room(Base):
    __tablename__ = 'rooms'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey('departments.id', ondelete='SET NULL'), nullable=True, index=True)
    room_type_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('room_types.id', ondelete='RESTRICT'), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    building: Mapped[str] = mapped_column(String(100), nullable=False)
    floor: Mapped[str | None] = mapped_column(String(50))
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    overrides: Mapped[list['RoomAvailabilityOverride']] = relationship(back_populates='room', cascade='all, delete-orphan')

class RoomAvailabilityOverride(Base):
    __tablename__ = 'room_availability_overrides'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    room_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('rooms.id', ondelete='CASCADE'), nullable=False, index=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    available_days: Mapped[list[int] | None] = mapped_column(JSON)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    is_available: Mapped[bool] = mapped_column(Boolean, default=False)
    
    room: Mapped['Room'] = relationship(back_populates='overrides')
