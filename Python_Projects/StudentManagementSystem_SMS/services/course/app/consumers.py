"""Course service Kafka handlers: keep ``enrolled_count`` in sync from enrollment events."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import CourseRepository
from sms_common.events import EnrollmentPayload, EventEnvelope, EventType

log = logging.getLogger(__name__)


async def on_student_enrolled(session: AsyncSession, event: EventEnvelope) -> None:
    p = EnrollmentPayload.model_validate(event.payload)
    await CourseRepository(session).adjust_enrolled(p.course_id, +1)


async def on_enrollment_cancelled(session: AsyncSession, event: EventEnvelope) -> None:
    p = EnrollmentPayload.model_validate(event.payload)
    await CourseRepository(session).adjust_enrolled(p.course_id, -1)


HANDLERS = {
    EventType.STUDENT_ENROLLED.value: on_student_enrolled,
    EventType.ENROLLMENT_CANCELLED.value: on_enrollment_cancelled,
}
