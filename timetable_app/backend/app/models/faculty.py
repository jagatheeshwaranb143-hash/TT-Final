import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Faculty(Base):
    __tablename__ = "faculty"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    department_id: Mapped[str] = mapped_column(String(36), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)

    department: Mapped["Department"] = relationship(back_populates="faculty")
    faculty_subjects: Mapped[list["FacultySubject"]] = relationship(back_populates="faculty", cascade="all, delete-orphan")
    class_subjects: Mapped[list["ClassSubject"]] = relationship(back_populates="faculty")
    timetable_entries: Mapped[list["TimetableEntry"]] = relationship(back_populates="faculty")
