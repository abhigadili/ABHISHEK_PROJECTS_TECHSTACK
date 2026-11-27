"""Notification database schema (StudentManagementNotificationDB).

* One-to-Many: Notification -> NotificationAttempt (delivery log, cascade delete)
``event_id`` is UNIQUE: a redelivered Kafka event can never create a second e-mail.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sms_common.db import Base, TimestampMixin
from sms_common.outbox import ProcessedEventMixin


class NotificationStatus(str, PyEnum):
    PENDING = "PENDING"    # waiting for (first) delivery
    SENDING = "SENDING"    # claimed by a dispatcher
    SENT = "SENT"
    FAILED = "FAILED"      # transient failure, will be retried
    DEAD = "DEAD"          # permanent failure / retries exhausted


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_due", "status", "next_attempt_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[str | None] = mapped_column(String(36), unique=True)
    template: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    recipient_email: Mapped[str] = mapped_column(String(190), nullable=False, index=True)
    recipient_name: Mapped[str | None] = mapped_column(String(130))
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    # Template variables.  May contain a reset link, so it is scrubbed once the mail is SENT.
    variables: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, native_enum=False, length=10, create_constraint=False,
             values_callable=lambda e: [m.value for m in e]),
        default=NotificationStatus.PENDING, nullable=False,
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500))
    provider_message_id: Mapped[str | None] = mapped_column(String(200))
    source_event_type: Mapped[str | None] = mapped_column(String(80))
    correlation_id: Mapped[str | None] = mapped_column(String(64))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)

    attempt_log: Mapped[list["NotificationAttempt"]] = relationship(
        back_populates="notification", cascade="all, delete-orphan", passive_deletes=True,
        lazy="select", order_by="NotificationAttempt.id",
    )


class NotificationAttempt(Base):
    __tablename__ = "notification_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    notification_id: Mapped[int] = mapped_column(
        ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attempted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error: Mapped[str | None] = mapped_column(String(500))
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    notification: Mapped[Notification] = relationship(back_populates="attempt_log")


class ProcessedEvent(ProcessedEventMixin, Base):
    pass
