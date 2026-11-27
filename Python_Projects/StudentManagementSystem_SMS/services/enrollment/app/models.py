"""Enrollment database schema (StudentManagementEnrollmentDB).

``student_id`` / ``course_id`` reference rows in *other services' databases*, so they are
plain integers (no cross-database foreign keys).  The name/e-mail/title columns are
**snapshots** captured at enrollment time and refreshed by Kafka events, which lets
notifications and listings work without calling the other services.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sms_common.db import Base, TimestampMixin
from sms_common.outbox import OutboxEventMixin, ProcessedEventMixin


class EnrollmentStatus(str, PyEnum):
    ENROLLED = "ENROLLED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


def _enum(py_enum: type, length: int = 20) -> Enum:
    return Enum(py_enum, native_enum=False, length=length, create_constraint=False,
                values_callable=lambda e: [m.value for m in e])


class Enrollment(TimestampMixin, Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        # the database-level guarantee behind "prevent duplicate enrollments"
        UniqueConstraint("student_id", "course_id", name="uq_enrollment_student_course"),
        Index("ix_enrollments_course_status", "course_id", "status"),
        Index("ix_enrollments_student_status", "student_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(nullable=False)
    course_id: Mapped[int] = mapped_column(nullable=False)
    student_user_id: Mapped[int | None] = mapped_column(index=True)
    student_number: Mapped[str] = mapped_column(String(24), nullable=False)
    student_name: Mapped[str] = mapped_column(String(130), nullable=False)
    student_email: Mapped[str] = mapped_column(String(190), nullable=False)
    course_code: Mapped[str] = mapped_column(String(20), nullable=False)
    course_title: Mapped[str] = mapped_column(String(150), nullable=False)
    course_credits: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[EnrollmentStatus] = mapped_column(
        _enum(EnrollmentStatus), default=EnrollmentStatus.ENROLLED, nullable=False
    )
    grade: Mapped[str | None] = mapped_column(String(3))
    notes: Mapped[str | None] = mapped_column(Text)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    cancel_reason: Mapped[str | None] = mapped_column(String(300))

    history: Mapped[list["EnrollmentStatusHistory"]] = relationship(
        back_populates="enrollment", cascade="all, delete-orphan", passive_deletes=True,
        lazy="select", order_by="EnrollmentStatusHistory.id",
    )


class EnrollmentStatusHistory(Base):
    __tablename__ = "enrollment_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by: Mapped[int | None] = mapped_column()  # auth user id (None = system/event)
    note: Mapped[str | None] = mapped_column(String(300))
    changed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    enrollment: Mapped[Enrollment] = relationship(back_populates="history")


class OutboxEvent(OutboxEventMixin, Base):
    pass


class ProcessedEvent(ProcessedEventMixin, Base):
    pass
