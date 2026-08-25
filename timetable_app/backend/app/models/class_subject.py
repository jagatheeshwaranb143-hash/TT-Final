import uuid
from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class ClassSubject(Base):
    __tablename__ = "class_subjects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    class_id: Mapped[str] = mapped_column(String(36), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(36), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    faculty_id: Mapped[str] = mapped_column(String(36), ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True)

    class_: Mapped["Class"] = relationship(back_populates="class_subjects")
    subject: Mapped["Subject"] = relationship(back_populates="class_subjects")
    faculty: Mapped["Faculty"] = relationship(back_populates="class_subjects")

    __table_args__ = (
        UniqueConstraint("class_id", "subject_id", name="uq_class_subject"),
    )
