import uuid
from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Class(Base):
    __tablename__ = "classes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    department_id: Mapped[str] = mapped_column(String(36), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    section: Mapped[str] = mapped_column(String(10), nullable=False, default="A")

    department: Mapped["Department"] = relationship(back_populates="classes")
    class_subjects: Mapped[list["ClassSubject"]] = relationship(back_populates="class_", cascade="all, delete-orphan")
    timetable_entries: Mapped[list["TimetableEntry"]] = relationship(back_populates="class_", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("department_id", "year", "semester", "section", name="uq_class"),
    )
