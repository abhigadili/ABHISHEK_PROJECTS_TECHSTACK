from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.deps import Reader, SessionDep, Writer, dispatcher, renderer
from app.models import Notification, NotificationStatus
from app.schemas import (
    NotificationCreate, NotificationDetail, NotificationRead, NotificationStats, PreviewRequest,
    PreviewResponse, TemplateInfo,
)
from app.templates import REGISTRY, TemplateError_
from sms_common.errors import ConflictError, NotFoundError, UnprocessableError
from sms_common.pagination import Page, PageParamsDep, apply_sort, count_for

router = APIRouter(prefix="/notifications", tags=["Notifications"])

_SORT = {"id": Notification.id, "created_at": Notification.created_at, "status": Notification.status,
         "recipient_email": Notification.recipient_email, "template": Notification.template}


@router.get("", response_model=Page[NotificationRead], summary="Notification history")
async def list_notifications(
    _: Reader, session: SessionDep, params: PageParamsDep,
    status_: Annotated[NotificationStatus | None, Query(alias="status")] = None,
    template: str | None = None,
    recipient: Annotated[str | None, Query(description="Partial e-mail match")] = None,
) -> Page[NotificationRead]:
    stmt = select(Notification)
    if status_:
        stmt = stmt.where(Notification.status == status_)
    if template:
        stmt = stmt.where(Notification.template == template)
    if recipient:
        stmt = stmt.where(Notification.recipient_email.like(f"%{recipient}%"))
    total = await count_for(session, stmt)
    stmt = apply_sort(stmt, params, _SORT, "id").limit(params.size).offset(params.offset)
    rows = (await session.execute(stmt)).scalars().all()
    return Page.build([NotificationRead.model_validate(r) for r in rows], total, params)


@router.get("/templates", response_model=list[TemplateInfo], summary="Available e-mail templates")
async def templates(_: Reader) -> list[TemplateInfo]:
    return [TemplateInfo(name=s.name, description=s.description, required_variables=list(s.required),
                         subject=s.subject) for s in REGISTRY.values()]


@router.get("/stats", response_model=NotificationStats, summary="Counts by status and template")
async def stats(_: Reader, session: SessionDep) -> NotificationStats:
    by_status = {s.value: 0 for s in NotificationStatus}
    for k, n in await session.execute(select(Notification.status, func.count()).group_by(Notification.status)):
        by_status[k.value] = n
    by_template = dict((await session.execute(
        select(Notification.template, func.count()).group_by(Notification.template))).all())
    return NotificationStats(by_status=by_status, by_template=by_template, total=sum(by_status.values()))


@router.post("/preview", response_model=PreviewResponse, summary="Render a template without sending")
async def preview(body: PreviewRequest, _: Writer) -> PreviewResponse:
    try:
        subject, text, html = renderer.render(body.template, body.variables)
    except TemplateError_ as exc:
        raise UnprocessableError(str(exc)) from exc
    return PreviewResponse(subject=subject, text=text, html=html)


@router.post("", response_model=NotificationRead, status_code=status.HTTP_202_ACCEPTED,
             summary="Queue an e-mail (202 Accepted: delivery happens asynchronously)")
async def queue_notification(body: NotificationCreate, _: Writer, session: SessionDep,
                             background: BackgroundTasks) -> NotificationRead:
    variables = dict(body.variables)
    variables.setdefault("name", body.to_name or body.to_email)
    try:
        subject, _text, _html = renderer.render(body.template, variables)
    except TemplateError_ as exc:
        raise UnprocessableError(str(exc)) from exc
    n = Notification(template=body.template, recipient_email=body.to_email, recipient_name=body.to_name,
                     subject=subject, variables=variables, source_event_type="ApiRequest",
                     max_attempts=get_settings().notification_max_attempts)
    session.add(n)
    await session.commit()
    await session.refresh(n)
    background.add_task(dispatcher.wake)  # BackgroundTasks: runs after the response is sent
    return NotificationRead.model_validate(n)


@router.get("/{notification_id}", response_model=NotificationDetail, summary="One notification with its delivery attempts")
async def get_notification(notification_id: int, _: Reader, session: SessionDep) -> NotificationDetail:
    n = (await session.execute(select(Notification).where(Notification.id == notification_id)
                               .options(selectinload(Notification.attempt_log)))).scalar_one_or_none()
    if n is None:
        raise NotFoundError(f"Notification {notification_id} not found")
    return NotificationDetail.model_validate(n)


@router.post("/{notification_id}/retry", response_model=NotificationRead, status_code=status.HTTP_202_ACCEPTED,
             summary="Re-queue a FAILED or DEAD notification")
async def retry(notification_id: int, _: Writer, session: SessionDep, background: BackgroundTasks) -> NotificationRead:
    n = await session.get(Notification, notification_id)
    if n is None:
        raise NotFoundError(f"Notification {notification_id} not found")
    if n.status not in (NotificationStatus.FAILED, NotificationStatus.DEAD):
        raise ConflictError(f"Only FAILED or DEAD notifications can be retried (current: {n.status.value})")
    if not n.variables and n.template not in ("generic_notification",) and n.status is NotificationStatus.SENT:
        raise ConflictError("Variables were scrubbed after delivery")
    from sms_common.timeutil import utcnow

    n.status, n.attempts, n.next_attempt_at, n.last_error = NotificationStatus.PENDING, 0, utcnow(), None
    await session.commit()
    await session.refresh(n)
    background.add_task(dispatcher.wake)
    return NotificationRead.model_validate(n)
