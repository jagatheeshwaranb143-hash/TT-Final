import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import types
from app.db.session import Base

# Use String for UUID in SQLite, native UUID for Postgres
class UUIDType(types.TypeDecorator):
    impl = types.String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return uuid.UUID(value)

class User(Base):
    __tablename__ = 'users'
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    college_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    department_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    employee_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __getitem__(self, item: str):
        val = getattr(self, item, None)
        return str(val) if isinstance(val, uuid.UUID) else val

    def get(self, item: str, default=None):
        val = getattr(self, item, default)
        return str(val) if isinstance(val, uuid.UUID) else (val if val is not None else default)

