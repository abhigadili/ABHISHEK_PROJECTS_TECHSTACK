"""Enrollment service Kafka handlers.

Reacts to Student / Course events so its local snapshots stay fresh and so that
deleting a student cancels their enrollments - without ever touching the other
services' databases.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EnrollmentStatus
from app.repositories import EnrollmentRepository
from app.services import emit
from sms_common.events import CoursePayload, EventEnvelope, EventType, StudentPayload
from sms_common.timeutil import utcnow

log = logging.getLogger(__name__)


async def on_student_updated(session: AsyncSession, event: EventEnvelope) -> None:
    p = StudentPayload.model_validate(event.payload)
    await EnrollmentRepository(session).refresh_student_snapshot(
        p.student_id, student_name=f"{p.first_name} {p.last_name}", student_email=p.email,
        student_number=p.student_number, student_user_id=p.user_id)


async def on_student_deleted(session: AsyncSession, event: EventEnvelope) -> None:
    p = StudentPayload.model_validate(event.payload)
    repo = EnrollmentRepository(session)
    rows = await repo.active_for_student(p.student_id)
    for e in rows:
        repo.add_history(e, e.status.value, "CANCELLED", None, "student deleted")
        e.status = EnrollmentStatus.CANCELLED
        e.cancelled_at, e.cancel_reason = utcnow(), "student deleted"
        await session.flush()
        emit(session, e, EventType.ENROLLMENT_CANCELLED, "student deleted")
    log.info("student %s deleted: cancelled %d enrollment(s)", p.student_id, len(rows))


async def on_course_updated(session: AsyncSession, event: EventEnvelope) -> None:
    p = CoursePayload.model_validate(event.payload)
    await EnrollmentRepository(session).refresh_course_snapshot(
        p.course_id, course_code=p.code, course_title=p.title, course_credits=p.credits)


HANDLERS = {
    EventType.STUDENT_UPDATED.value: on_student_updated,
    EventType.STUDENT_DELETED.value: on_student_deleted,
    EventType.COURSE_UPDATED.value: on_course_updated,
}
