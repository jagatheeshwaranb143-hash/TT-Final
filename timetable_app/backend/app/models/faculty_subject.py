import uuid
from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class FacultySubject(Base):
    __tablename__ = "faculty_subjects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    faculty_id: Mapped[str] = mapped_column(String(36), ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(36), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)

    faculty: Mapped["Faculty"] = relationship(back_populates="faculty_subjects")
    subject: Mapped["Subject"] = relationship(back_populates="faculty_subjects")

    __table_args__ = (
        UniqueConstraint("faculty_id", "subject_id", name="uq_faculty_subject"),
    )
