import uuid
from sqlalchemy import String, Integer, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
import enum


class SubjectType(str, enum.Enum):
    theory = "theory"
    lab = "lab"


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    department_id: Mapped[str] = mapped_column(String(36), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[SubjectType] = mapped_column(SAEnum(SubjectType), nullable=False, default=SubjectType.theory)
    periods_per_week: Mapped[int] = mapped_column(Integer, nullable=False, default=4)

    department: Mapped["Department"] = relationship(back_populates="subjects")
    faculty_subjects: Mapped[list["FacultySubject"]] = relationship(back_populates="subject", cascade="all, delete-orphan")
    class_subjects: Mapped[list["ClassSubject"]] = relationship(back_populates="subject", cascade="all, delete-orphan")
    timetable_entries: Mapped[list["TimetableEntry"]] = relationship(back_populates="subject")
