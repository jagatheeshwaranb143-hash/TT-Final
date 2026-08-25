import uuid
from sqlalchemy import String, Integer, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    class_id: Mapped[str] = mapped_column(String(36), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(36), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    faculty_id: Mapped[str] = mapped_column(String(36), ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True)
    day: Mapped[int] = mapped_column(Integer, nullable=False)      # 0=Mon … 4=Fri
    period: Mapped[int] = mapped_column(Integer, nullable=False)   # 1-7
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)

    class_: Mapped["Class"] = relationship(back_populates="timetable_entries")
    subject: Mapped["Subject"] = relationship(back_populates="timetable_entries")
    faculty: Mapped["Faculty"] = relationship(back_populates="timetable_entries")

    __table_args__ = (
        UniqueConstraint("class_id", "day", "period", name="uq_class_slot"),
    )
