import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, JSON, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.compat import UUIDType
from app.db.session import Base

class TimetableConstraint(Base):
    __tablename__ = 'timetable_constraints'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    college_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True)
    constraint_type: Mapped[str] = mapped_column(String(100), nullable=False)
    constraint_value: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    is_hard_constraint: Mapped[bool] = mapped_column(Boolean, default=True)
    weight: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
