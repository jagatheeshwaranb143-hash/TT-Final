import uuid
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)

    faculty: Mapped[list["Faculty"]] = relationship(back_populates="department", cascade="all, delete-orphan")
    subjects: Mapped[list["Subject"]] = relationship(back_populates="department", cascade="all, delete-orphan")
    classes: Mapped[list["Class"]] = relationship(back_populates="department", cascade="all, delete-orphan")
