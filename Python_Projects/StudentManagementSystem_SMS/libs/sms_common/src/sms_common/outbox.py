"""Transactional Outbox.

Problem: ``db.commit()`` and ``kafka.send()`` cannot be one atomic operation.
Writing to the DB then Kafka can lose the event (crash in between); the reverse
can publish an event for data that was rolled back.

Solution: the service inserts an ``outbox_events`` row **in the same DB
transaction** as the business change.  A background ``OutboxRelay`` reads
PENDING rows (``FOR UPDATE SKIP LOCKED`` so several instances can run) and
publishes them, then marks them SENT.  Delivery is therefore *at-least-once*;
consumers deduplicate with ``processed_events`` (see ``kafka.py``).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import BigInteger, DateTime, Index, Integer, String, Text, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import Mapped, Session, declared_attr, mapped_column

from sms_common.context import correlation_id_var
from sms_common.events import EventEnvelope
from sms_common.kafka import EventProducer

log = logging.getLogger(__name__)

STATUS_PENDING = "PENDING"
STATUS_SENT = "SENT"


class OutboxEventMixin:
    """Columns of the outbox table; each service subclasses it with ``Base``."""

    __tablename__ = "outbox_events"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    topic: Mapped[str] = mapped_column(String(120), nullable=False)
    message_key: Mapped[str | None] = mapped_column(String(120))
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)  # serialized EventEnvelope JSON
    status: Mapped[str] = mapped_column(String(10), default=STATUS_PENDING, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)

    @declared_attr.directive
    def __table_args__(cls) -> tuple[Any, ...]:  # noqa: N805
        return (Index("ix_outbox_events_status_id", "status", "id"),)


def enqueue_event(
    session: Session | AsyncSession,
    outbox_model: type[OutboxEventMixin],
    *,
    topic: str,
    event_type: str,
    payload: dict[str, Any],
    source: str,
    key: str | None = None,
) -> EventEnvelope:
    """Add an outbox row to the *current* transaction (no commit here!)."""
    envelope = EventEnvelope(
        event_type=event_type,
        source=source,
        correlation_id=correlation_id_var.get(),
        payload=payload,
    )
    session.add(
        outbox_model(  # type: ignore[call-arg]
            event_id=envelope.event_id,
            topic=topic,
            message_key=key,
            event_type=event_type,
            body=envelope.model_dump_json(),
        )
    )
    return envelope


class OutboxRelay:
    """Background task that drains the outbox into Kafka (async DB access)."""

    def __init__(
        self,
        *,
        outbox_model: type[OutboxEventMixin],
        session_factory: async_sessionmaker[AsyncSession],
        producer: EventProducer,
        poll_interval: float = 0.5,
        batch_size: int = 100,
        retention_hours: int = 24,
    ) -> None:
        self.model = outbox_model
        self.session_factory = session_factory
        self.producer = producer
        self.poll_interval = poll_interval
        self.batch_size = batch_size
        self.retention = timedelta(hours=retention_hours)
        self._wake = asyncio.Event()
        self._last_purge = datetime.now(timezone.utc)
        self.published = 0

    def wake(self) -> None:
        """Skip the sleep: new work was just committed."""
        self._wake.set()

    async def run(self, stop: asyncio.Event) -> None:
        log.info("outbox relay started (%s)", self.model.__tablename__)
        backoff = self.poll_interval
        while not stop.is_set():
            try:
                sent = await self.drain_once()
                await self._maybe_purge()
                backoff = self.poll_interval
                if sent == self.batch_size:
                    continue  # more work waiting
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # DB or Kafka unavailable: back off and retry
                backoff = min(backoff * 2, 10.0)
                log.warning("outbox relay error (%s); retrying in %.1fs", exc.__class__.__name__, backoff)
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=backoff)
            except asyncio.TimeoutError:
                pass
            self._wake.clear()
        log.info("outbox relay stopped")

    async def drain_once(self) -> int:
        m = self.model
        sent = 0
        async with self.session_factory() as session:
            rows = (
                await session.execute(
                    select(m)  # type: ignore[arg-type]
                    .where(m.status == STATUS_PENDING)  # type: ignore[attr-defined]
                    .order_by(m.id)  # type: ignore[attr-defined]
                    .limit(self.batch_size)
                    .with_for_update(skip_locked=True)
                )
            ).scalars().all()
            for row in rows:
                try:
                    await self.producer.send_raw(row.topic, row.body, key=row.message_key,
                                                 event_id=row.event_id, event_type=row.event_type)
                except Exception as exc:
                    row.attempts += 1
                    row.last_error = f"{exc.__class__.__name__}: {exc}"[:500]
                    await session.commit()
                    raise  # stop the batch to preserve ordering
                row.status = STATUS_SENT
                row.sent_at = datetime.now(timezone.utc).replace(tzinfo=None)
                row.attempts += 1
                sent += 1
            await session.commit()
        self.published += sent
        if sent:
            log.info("outbox published %d event(s)", sent)
        return sent

    async def _maybe_purge(self) -> None:
        now = datetime.now(timezone.utc)
        if now - self._last_purge < timedelta(minutes=10):
            return
        self._last_purge = now
        cutoff = (now - self.retention).replace(tzinfo=None)
        m = self.model
        async with self.session_factory() as session:
            await session.execute(
                delete(m).where(m.status == STATUS_SENT, m.sent_at < cutoff)  # type: ignore[attr-defined]
            )
            await session.commit()


class ProcessedEventMixin:
    """Idempotency ledger: one row per (event, consumer group)."""

    __tablename__ = "processed_events"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    consumer_group: Mapped[str] = mapped_column(String(100), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


async def count_pending(session_factory: async_sessionmaker[AsyncSession], model: Any) -> int:
    async with session_factory() as session:
        return int(
            (await session.execute(
                select(func.count()).select_from(model).where(model.status == STATUS_PENDING)
            )).scalar_one()
        )


__all__ = [
    "OutboxEventMixin", "ProcessedEventMixin", "OutboxRelay", "enqueue_event",
    "count_pending",
]
