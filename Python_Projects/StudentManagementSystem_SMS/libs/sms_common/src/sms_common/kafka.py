"""Async Kafka producer and consumer (aiokafka) with retry, DLQ and idempotency.

Consumer processing contract for each message::

    parse JSON/envelope  --fails--> DLQ (poison message, no point retrying)
    BEGIN tx
      INSERT processed_events(event_id, group)   <- duplicate? => skip (idempotent)
      handler(session, envelope)                 <- business change, same tx
    COMMIT                                       <- ledger + business data atomic
    commit Kafka offset

If the handler raises, the transaction rolls back (ledger row too) and the
message is retried in-process with exponential backoff.  After
``max_attempts`` the original message is published to ``<topic>.dlq`` with
error headers and the offset is committed so the partition keeps flowing.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.errors import KafkaError
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from sms_common.context import correlation_id_var, request_id_var
from sms_common.events import EventEnvelope, Topics

log = logging.getLogger(__name__)

Handler = Callable[[AsyncSession, EventEnvelope], Awaitable[None]]


class EventProducer:
    """Thin wrapper: idempotent producer, acks=all, JSON values, async context manager."""

    def __init__(self, bootstrap_servers: str, client_id: str) -> None:
        self._bootstrap = bootstrap_servers
        self._client_id = client_id
        self._producer: AIOKafkaProducer | None = None
        self.started = False

    def _make(self) -> AIOKafkaProducer:
        return AIOKafkaProducer(
            bootstrap_servers=self._bootstrap,
            client_id=self._client_id,
            acks="all",
            enable_idempotence=True,
            linger_ms=5,
            request_timeout_ms=10000,
        )

    async def start(self) -> None:
        """(Re)build and start; safe to call again after a failed attempt."""
        if self.started:
            return
        producer = self._make()
        try:
            await producer.start()
        except BaseException:
            try:
                await producer.stop()
            except Exception:
                pass
            raise
        self._producer = producer
        self.started = True

    async def stop(self) -> None:
        if self.started and self._producer is not None:
            await self._producer.stop()
            self.started = False

    async def __aenter__(self) -> "EventProducer":
        await self.start()
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.stop()

    async def send_raw(
        self,
        topic: str,
        body: str | bytes,
        *,
        key: str | None = None,
        event_id: str | None = None,
        event_type: str | None = None,
        extra_headers: list[tuple[str, bytes]] | None = None,
    ) -> None:
        headers: list[tuple[str, bytes]] = []
        if event_id:
            headers.append(("event_id", event_id.encode()))
        if event_type:
            headers.append(("event_type", event_type.encode()))
        headers.extend(extra_headers or [])
        value = body.encode() if isinstance(body, str) else body
        if not self.started or self._producer is None:
            await self.start()
        assert self._producer is not None
        await self._producer.send_and_wait(
            topic, value=value, key=key.encode() if key else None, headers=headers
        )

    async def send_event(self, topic: str, envelope: EventEnvelope, key: str | None = None) -> None:
        await self.send_raw(topic, envelope.model_dump_json(), key=key,
                            event_id=envelope.event_id, event_type=envelope.event_type)


class EventConsumer:
    def __init__(
        self,
        *,
        bootstrap_servers: str,
        topics: list[str],
        group_id: str,
        handlers: dict[str, Handler],
        session_factory: async_sessionmaker[AsyncSession],
        processed_model: Any,
        dlq_producer: EventProducer | None = None,
        max_attempts: int = 3,
        retry_backoff: float = 0.5,
        after_commit: Callable[[], None] | None = None,
        use_ledger: bool = True,
    ) -> None:
        self.bootstrap_servers = bootstrap_servers
        self.topics = topics
        self.group_id = group_id
        self.handlers = handlers
        self.session_factory = session_factory
        self.processed_model = processed_model
        self.dlq_producer = dlq_producer
        self.max_attempts = max_attempts
        self.retry_backoff = retry_backoff
        self.after_commit = after_commit
        self.use_ledger = use_ledger
        self.connected = False
        self.stats = {"processed": 0, "duplicates": 0, "retried": 0, "dead_lettered": 0, "ignored": 0}

    async def run(self, stop: asyncio.Event) -> None:
        """Run until ``stop`` is set; survives broker outages by reconnecting."""
        delay = 1.0
        while not stop.is_set():
            consumer = AIOKafkaConsumer(
                *self.topics,
                bootstrap_servers=self.bootstrap_servers,
                group_id=self.group_id,
                client_id=f"{self.group_id}-consumer",
                enable_auto_commit=False,  # we commit after the DB commit
                auto_offset_reset="earliest",
                max_poll_interval_ms=300000,
                session_timeout_ms=15000,
            )
            try:
                await consumer.start()
                self.connected = True
                delay = 1.0
                log.info("consumer %s subscribed to %s", self.group_id, self.topics)
                await self._loop(consumer, stop)
            except asyncio.CancelledError:
                raise
            except (KafkaError, OSError) as exc:
                log.warning("consumer %s Kafka error: %s; reconnecting in %.0fs",
                            self.group_id, exc.__class__.__name__, delay)
            except Exception:
                log.exception("consumer %s crashed; restarting in %.0fs", self.group_id, delay)
            finally:
                self.connected = False
                try:
                    await consumer.stop()
                except Exception:
                    pass
            if not stop.is_set():
                try:
                    await asyncio.wait_for(stop.wait(), timeout=delay)
                except asyncio.TimeoutError:
                    pass
                delay = min(delay * 2, 15.0)

    async def _loop(self, consumer: AIOKafkaConsumer, stop: asyncio.Event) -> None:
        while not stop.is_set():
            batch = await consumer.getmany(timeout_ms=500, max_records=50)
            for _tp, messages in batch.items():
                for msg in messages:
                    await self._handle_message(msg)
                    await consumer.commit()

    # -- single message ------------------------------------------------------
    async def _handle_message(self, msg: Any) -> None:
        try:
            envelope = EventEnvelope.model_validate_json(msg.value)
        except (ValidationError, ValueError) as exc:
            await self._dead_letter(msg, f"Malformed event: {exc.__class__.__name__}", attempts=0)
            return

        handler = self.handlers.get(envelope.event_type)
        if handler is None:
            self.stats["ignored"] += 1
            return

        tok_c = correlation_id_var.set(envelope.correlation_id)
        tok_r = request_id_var.set(envelope.event_id[:12])
        try:
            last_error: Exception | None = None
            for attempt in range(1, self.max_attempts + 1):
                try:
                    outcome = await self._process(handler, envelope)
                    self.stats["duplicates" if outcome == "duplicate" else "processed"] += 1
                    if outcome == "duplicate":
                        log.info("duplicate event %s skipped (idempotent)", envelope.event_id)
                    elif self.after_commit:
                        self.after_commit()
                    return
                except Exception as exc:
                    last_error = exc
                    self.stats["retried"] += 1
                    log.warning(
                        "event %s (%s) failed attempt %d/%d: %s",
                        envelope.event_id, envelope.event_type, attempt, self.max_attempts, exc,
                    )
                    if attempt < self.max_attempts:
                        await asyncio.sleep(self.retry_backoff * (2 ** (attempt - 1)))
            await self._dead_letter(
                msg, f"{last_error.__class__.__name__}: {last_error}", self.max_attempts
            )
        finally:
            correlation_id_var.reset(tok_c)
            request_id_var.reset(tok_r)

    async def _process(self, handler: Handler, envelope: EventEnvelope) -> str:
        async with self.session_factory() as session:
            try:
                if self.use_ledger:
                    session.add(
                        self.processed_model(
                            event_id=envelope.event_id,
                            consumer_group=self.group_id,
                            event_type=envelope.event_type,
                        )
                    )
                    try:
                        await session.flush()
                    except IntegrityError:
                        await session.rollback()
                        return "duplicate"
                await handler(session, envelope)
                await session.commit()
                return "processed"
            except BaseException:
                await session.rollback()
                raise

    async def _dead_letter(self, msg: Any, reason: str, attempts: int) -> None:
        self.stats["dead_lettered"] += 1
        topic = Topics.dlq(msg.topic)
        log.error("dead-lettering message from %s[%s]@%s -> %s: %s",
                  msg.topic, msg.partition, msg.offset, topic, reason)
        if self.dlq_producer is None:
            return
        try:
            await self.dlq_producer.send_raw(
                topic,
                msg.value,
                key=msg.key.decode() if msg.key else None,
                extra_headers=[
                    ("dlq_reason", reason[:500].encode()),
                    ("dlq_source_topic", msg.topic.encode()),
                    ("dlq_source_partition", str(msg.partition).encode()),
                    ("dlq_source_offset", str(msg.offset).encode()),
                    ("dlq_consumer_group", self.group_id.encode()),
                    ("dlq_attempts", str(attempts).encode()),
                ],
            )
        except Exception:
            log.exception("failed to publish to DLQ %s", topic)
            raise


def decode_json(raw: bytes | None) -> dict[str, Any] | None:
    if raw is None:
        return None
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None
