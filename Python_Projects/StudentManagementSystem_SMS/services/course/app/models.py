"""Course database schema (StudentManagementCourseDB).

* One-to-Many   : Category -> Course ; Course -> CourseFile
* Many-to-Many  : Course <-> Teacher through the *association object* ``CourseTeacher``
                  (composite PK + extra columns; teachers live in the Auth service, so
                  ``teacher_user_id`` is a plain integer with a name/e-mail snapshot)
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import CourseStatus, TeacherRole
from sms_common.db import Base, StoredFileMixin, TimestampMixin
from sms_common.outbox import OutboxEventMixin, ProcessedEventMixin


def _enum(py_enum: type, length: int = 20) -> Enum:
    return Enum(py_enum, native_enum=False, length=length, create_constraint=False,
                values_callable=lambda e: [m.value for m in e])


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(300))

    courses: Mapped[list["Course"]] = relationship(back_populates="category", lazy="select")


class Course(TimestampMixin, Base):
    __tablename__ = "courses"
    __table_args__ = (
        CheckConstraint("credits BETWEEN 1 AND 10", name="credits_range"),
        CheckConstraint("duration_weeks BETWEEN 1 AND 104", name="duration_range"),
        CheckConstraint("capacity BETWEEN 1 AND 1000", name="capacity_range"),
        CheckConstraint("enrolled_count >= 0", name="enrolled_non_negative"),
        CheckConstraint("end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
                        name="dates_ordered"),
        Index("ix_courses_category_status", "category_id", "status"),
        Index("ix_courses_title", "title"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    enrolled_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[CourseStatus] = mapped_column(
        _enum(CourseStatus), default=CourseStatus.DRAFT, nullable=False, index=True
    )
    start_date: Mapped[date | None] = mapped_column()
    end_date: Mapped[date | None] = mapped_column()
    created_by: Mapped[int | None] = mapped_column()  # auth user id

    category: Mapped[Category | None] = relationship(back_populates="courses", lazy="select")
    teachers: Mapped[list["CourseTeacher"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", passive_deletes=True,
        lazy="select", order_by="CourseTeacher.assigned_at",
    )
    files: Mapped[list["CourseFile"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", passive_deletes=True, lazy="select"
    )

    @property
    def available_seats(self) -> int:
        return max(self.capacity - self.enrolled_count, 0)

    @property
    def is_available(self) -> bool:
        """Open, not full and not past its end date."""
        if self.status is not CourseStatus.OPEN or self.available_seats == 0:
            return False
        return self.end_date is None or self.end_date >= date.today()


class CourseTeacher(Base):
    """Association object: which teacher teaches which course, and in what role."""

    __tablename__ = "course_teachers"

    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True
    )
    teacher_user_id: Mapped[int] = mapped_column(primary_key=True)  # composite primary key
    teacher_name: Mapped[str] = mapped_column(String(120), nullable=False)
    teacher_email: Mapped[str] = mapped_column(String(190), nullable=False)
    role: Mapped[TeacherRole] = mapped_column(_enum(TeacherRole), default=TeacherRole.LEAD, nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    course: Mapped[Course] = relationship(back_populates="teachers")

    __table_args__ = (Index("ix_course_teachers_teacher", "teacher_user_id"),)


class CourseFile(StoredFileMixin, Base):
    __tablename__ = "course_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doc_type: Mapped[str | None] = mapped_column(String(40))  # SYLLABUS, SLIDES, ...

    course: Mapped[Course] = relationship(back_populates="files")


class OutboxEvent(OutboxEventMixin, Base):
    pass


class ProcessedEvent(ProcessedEventMixin, Base):
    pass
