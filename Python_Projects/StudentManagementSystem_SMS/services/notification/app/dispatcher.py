"""Asynchronous e-mail dispatcher with retry + exponential back-off.

Life-cycle of a row:  PENDING -> SENDING -> SENT
                                     \\-> FAILED (retry later) -> ... -> DEAD

* ``FOR UPDATE SKIP LOCKED`` lets several instances share the queue safely.
* Rows stuck in SENDING (instance crashed) are reclaimed after a timeout.
* Up to ``notification_concurrency`` mails are sent in parallel (``asyncio.gather`` + semaphore).
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.email_backends import EmailBackend, build_message
from app.models import Notification, NotificationAttempt, NotificationStatus
from app.templates import TemplateError_, TemplateRenderer
from sms_common.errors import EmailDeliveryError
from sms_common.timeutil import utcnow

log = logging.getLogger(__name__)


class NotificationDispatcher:
    def __init__(self, *, session_factory: async_sessionmaker[AsyncSession], backend: EmailBackend,
                 renderer: TemplateRenderer, settings: Settings) -> None:
        self.session_factory = session_factory
        self.backend = backend
        self.renderer = renderer
        self.s = settings
        self._wake = asyncio.Event()
        self._sem = asyncio.Semaphore(settings.notification_concurrency)
        self.sent = 0
        self.failed = 0

    def wake(self) -> None:
        self._wake.set()

    async def run(self, stop: asyncio.Event) -> None:
        log.info("notification dispatcher started (backend=%s)", self.backend.name)
        while not stop.is_set():
            try:
                handled = await self.dispatch_once()
                if handled:
                    continue  # more may be due
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("dispatcher cycle failed")
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=self.s.notification_poll_interval)
            except asyncio.TimeoutError:
                pass
            self._wake.clear()
        log.info("notification dispatcher stopped")

    async def dispatch_once(self, batch: int = 20) -> int:
        ids = await self._claim(batch)
        if ids:
            await asyncio.gather(*(self._send_one(i) for i in ids))
        return len(ids)

    async def _claim(self, batch: int) -> list[int]:
        now = utcnow()
        stuck_before = now - timedelta(seconds=self.s.notification_stuck_after_seconds)
        async with self.session_factory() as session:
            rows = (await session.execute(
                select(Notification).where(or_(
                    (Notification.status.in_([NotificationStatus.PENDING, NotificationStatus.FAILED]))
                    & (Notification.next_attempt_at <= now),
                    (Notification.status == NotificationStatus.SENDING) & (Notification.updated_at < stuck_before),
                )).order_by(Notification.id).limit(batch).with_for_update(skip_locked=True)
            )).scalars().all()
            for n in rows:
                n.status = NotificationStatus.SENDING
            await session.commit()
            return [n.id for n in rows]

    async def _send_one(self, notification_id: int) -> None:
        async with self._sem, self.session_factory() as session:
            n = await session.get(Notification, notification_id)
            if n is None:
                return
            started = time.perf_counter()
            error: str | None = None
            permanent = False
            message_id: str | None = None
            try:
                subject, text, html = self.renderer.render(n.template, n.variables)
                msg = build_message(sender=self.s.email_from, to_email=n.recipient_email,
                                    to_name=n.recipient_name, subject=subject, text=text, html=html,
                                    correlation_id=n.correlation_id)
                message_id = await self.backend.send(msg)
            except TemplateError_ as exc:
                error, permanent = str(exc), True
            except EmailDeliveryError as exc:
                error, permanent = str(exc), exc.permanent
            except Exception as exc:  # never let one bad mail kill the batch
                error = f"{exc.__class__.__name__}: {exc}"
                log.exception("unexpected error sending notification %s", notification_id)
            elapsed = int((time.perf_counter() - started) * 1000)

            n.attempts += 1
            # explicit INSERT (not ``n.attempt_log.append``): touching the relationship would
            # lazy-load it, which is not allowed inside an async session
            session.add(NotificationAttempt(notification_id=n.id, success=error is None,
                                            error=error and error[:500], duration_ms=elapsed))
            if error is None:
                n.status, n.sent_at, n.last_error = NotificationStatus.SENT, utcnow(), None
                n.provider_message_id = (message_id or "")[:200] or None
                n.variables = {}  # scrub: the reset link/token must not stay in the database
                self.sent += 1
                log.info("notification %s sent to %s (%s)", n.id, n.recipient_email, n.template)
            else:
                self.failed += 1
                n.last_error = error[:500]
                if permanent or n.attempts >= n.max_attempts:
                    n.status = NotificationStatus.DEAD
                    log.error("notification %s DEAD after %d attempt(s): %s", n.id, n.attempts, error)
                else:
                    delay = self.s.notification_retry_base_seconds * (2 ** (n.attempts - 1))
                    n.status = NotificationStatus.FAILED
                    n.next_attempt_at = utcnow() + timedelta(seconds=delay)
                    log.warning("notification %s failed (attempt %d/%d), retry in %.0fs: %s",
                                n.id, n.attempts, n.max_attempts, delay, error)
            await session.commit()
