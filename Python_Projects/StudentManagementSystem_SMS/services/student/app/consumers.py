"""Kafka event handlers of the Student service.

The Student service never calls the Enrollment service or reads its database;
it only reacts to the events Enrollment publishes (``sms.enrollment.events``).
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import StudentRepository
from sms_common.events import EnrollmentPayload, EventEnvelope, EventType

log = logging.getLogger(__name__)


async def on_student_enrolled(session: AsyncSession, event: EventEnvelope) -> None:
    p = EnrollmentPayload.model_validate(event.payload)
    await StudentRepository(session).adjust_enrollment_count(p.student_id, +1)
    log.info("enrolled_courses_count +1 for student %s", p.student_id)


async def on_enrollment_cancelled(session: AsyncSession, event: EventEnvelope) -> None:
    p = EnrollmentPayload.model_validate(event.payload)
    await StudentRepository(session).adjust_enrollment_count(p.student_id, -1)
    log.info("enrolled_courses_count -1 for student %s", p.student_id)


HANDLERS = {
    EventType.STUDENT_ENROLLED.value: on_student_enrolled,
    EventType.ENROLLMENT_CANCELLED.value: on_enrollment_cancelled,
}
