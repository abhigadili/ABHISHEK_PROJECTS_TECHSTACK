"""Student Service entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.api.v1 import api_router
from app.config import get_settings
from app.consumers import HANDLERS
from app.deps import db
from app.models import OutboxEvent, ProcessedEvent
from sms_common.app_factory import create_app
from sms_common.events import Topics
from sms_common.health import build_health_router
from sms_common.kafka import EventConsumer, EventProducer
from sms_common.outbox import OutboxRelay, count_pending
from sms_common.workers import BackgroundWorkers

settings = get_settings()
log = logging.getLogger(__name__)

workers = BackgroundWorkers()
producer = EventProducer(settings.kafka_bootstrap_servers, "student-service")
relay = OutboxRelay(
    outbox_model=OutboxEvent, session_factory=db.async_session_factory,  # type: ignore[arg-type]
    producer=producer, poll_interval=settings.outbox_poll_interval, batch_size=settings.outbox_batch_size,
)
consumer = EventConsumer(
    bootstrap_servers=settings.kafka_bootstrap_servers, topics=[Topics.ENROLLMENT],
    group_id="student-service", handlers=HANDLERS, session_factory=db.async_session_factory,  # type: ignore[arg-type]
    processed_model=ProcessedEvent, dlq_producer=producer,
    max_attempts=settings.kafka_consumer_max_attempts, retry_backoff=settings.kafka_consumer_retry_backoff,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("starting %s", settings.service_name)
    if settings.kafka_enabled:
        workers.start("outbox-relay", relay.run)
        workers.start("enrollment-events-consumer", consumer.run)
    yield
    await workers.stop_all()
    await producer.stop()
    await db.dispose()


app = create_app(
    settings, title="SMS - Student Service", lifespan=lifespan,
    description="Student CRUD, profiles, contacts, interests, search/filter/sort/pagination, "
                "reports, bulk operations and file management (profile picture, documents).",
    tags=[{"name": "Students"}, {"name": "Departments"}, {"name": "Student files"}],
)
app.include_router(build_health_router(settings.service_name, {
    "database": db.ping,
    "outbox_relay": lambda: workers.status().get("outbox-relay") == "running" or not settings.kafka_enabled,
    "kafka_consumer": lambda: consumer.connected or not settings.kafka_enabled,
    "outbox_pending": lambda: count_pending(db.async_session_factory, OutboxEvent),  # type: ignore[arg-type]
}))
app.include_router(api_router, prefix=settings.api_prefix)
