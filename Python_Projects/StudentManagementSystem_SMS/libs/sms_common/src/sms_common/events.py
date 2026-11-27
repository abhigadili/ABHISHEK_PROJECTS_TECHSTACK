"""Event contracts: topic names, event types, the envelope and typed payloads.

These are the *public contract* between services.  Producers and consumers
share only these shapes - never database models.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Topics:
    AUTH = "sms.auth.events"
    STUDENT = "sms.student.events"
    COURSE = "sms.course.events"
    ENROLLMENT = "sms.enrollment.events"
    NOTIFICATION = "sms.notification.requests"

    ALL = (AUTH, STUDENT, COURSE, ENROLLMENT, NOTIFICATION)

    @staticmethod
    def dlq(topic: str) -> str:
        return f"{topic}.dlq"


class EventType(str, Enum):
    USER_REGISTERED = "UserRegistered"
    TOKEN_REVOKED = "TokenRevoked"
    STUDENT_CREATED = "StudentCreated"
    STUDENT_UPDATED = "StudentUpdated"
    STUDENT_DELETED = "StudentDeleted"
    COURSE_CREATED = "CourseCreated"
    COURSE_UPDATED = "CourseUpdated"
    STUDENT_ENROLLED = "StudentEnrolled"
    ENROLLMENT_CANCELLED = "EnrollmentCancelled"
    NOTIFICATION_REQUESTED = "NotificationRequested"


class EventEnvelope(BaseModel):
    """Every Kafka message value is exactly this JSON document."""

    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: str
    correlation_id: str = "-"
    version: int = 1
    payload: dict[str, Any]


# --- typed payloads ---------------------------------------------------------
class UserRegisteredPayload(BaseModel):
    user_id: int
    email: str
    full_name: str
    roles: list[str]


class TokenRevokedPayload(BaseModel):
    jti: str
    exp: int  # unix seconds; consumers may drop the entry after this time


class StudentPayload(BaseModel):
    student_id: int
    student_number: str
    user_id: int | None = None
    first_name: str
    last_name: str
    email: str
    status: str
    department_code: str | None = None


class CoursePayload(BaseModel):
    course_id: int
    code: str
    title: str
    credits: int
    status: str
    capacity: int
    category: str | None = None


class EnrollmentPayload(BaseModel):
    enrollment_id: int
    student_id: int
    student_user_id: int | None = None
    student_name: str
    student_email: str
    course_id: int
    course_code: str
    course_title: str
    status: str
    reason: str | None = None
    actor_user_id: int | None = None


class NotificationRequestedPayload(BaseModel):
    template: str
    to_email: str
    to_name: str | None = None
    variables: dict[str, Any] = Field(default_factory=dict)
