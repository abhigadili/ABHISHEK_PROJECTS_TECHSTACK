"""Kafka handlers: turn domain events into queued notifications (DB only; sending is async)."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Notification
from app.templates import TemplateError_, TemplateRenderer
from sms_common.context import correlation_id_var
from sms_common.events import (
    EnrollmentPayload, EventEnvelope, EventType, NotificationRequestedPayload, StudentPayload,
)

log = logging.getLogger(__name__)
renderer = TemplateRenderer()


def _queue(session: AsyncSession, event: EventEnvelope, *, template: str, to_email: str,
           to_name: str | None, variables: dict[str, Any]) -> None:
    try:
        spec = renderer.validate(template, variables)
        subject, _, _ = renderer.render(template, variables)
    except TemplateError_ as exc:
        # Poison message: raising makes the consumer retry, then dead-letter it.
        raise ValueError(str(exc)) from exc
    session.add(Notification(
        event_id=event.event_id, template=spec.name, recipient_email=to_email, recipient_name=to_name,
        subject=subject, variables=variables, max_attempts=get_settings().notification_max_attempts,
        source_event_type=event.event_type, correlation_id=correlation_id_var.get(),
    ))


async def on_notification_requested(session: AsyncSession, event: EventEnvelope) -> None:
    p = NotificationRequestedPayload.model_validate(event.payload)
    variables = dict(p.variables)
    variables.setdefault("name", p.to_name or p.to_email)
    _queue(session, event, template=p.template, to_email=p.to_email, to_name=p.to_name, variables=variables)


async def on_student_created(session: AsyncSession, event: EventEnvelope) -> None:
    p = StudentPayload.model_validate(event.payload)
    name = f"{p.first_name} {p.last_name}"
    _queue(session, event, template="student_registered", to_email=p.email, to_name=name,
           variables={"name": name, "student_number": p.student_number,
                      "department_code": p.department_code})


async def on_student_enrolled(session: AsyncSession, event: EventEnvelope) -> None:
    p = EnrollmentPayload.model_validate(event.payload)
    _queue(session, event, template="enrollment_confirmation", to_email=p.student_email,
           to_name=p.student_name, variables={"name": p.student_name, "course_code": p.course_code,
                                              "course_title": p.course_title})


async def on_enrollment_cancelled(session: AsyncSession, event: EventEnvelope) -> None:
    p = EnrollmentPayload.model_validate(event.payload)
    _queue(session, event, template="enrollment_cancelled", to_email=p.student_email,
           to_name=p.student_name, variables={"name": p.student_name, "course_code": p.course_code,
                                              "course_title": p.course_title, "reason": p.reason})


HANDLERS = {
    EventType.NOTIFICATION_REQUESTED.value: on_notification_requested,
    EventType.STUDENT_CREATED.value: on_student_created,
    EventType.STUDENT_ENROLLED.value: on_student_enrolled,
    EventType.ENROLLMENT_CANCELLED.value: on_enrollment_cancelled,
}
