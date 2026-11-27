"""Notification Service entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.api.v1 import api_router
from app.config import get_settings
from app.consumers import HANDLERS
from app.deps import backend, db, dispatcher
from app.models import ProcessedEvent
from sms_common.app_factory import create_app
from sms_common.events import Topics
from sms_common.health import build_health_router
from sms_common.kafka import EventConsumer, EventProducer
from sms_common.workers import BackgroundWorkers

settings = get_settings()
log = logging.getLogger(__name__)

workers = BackgroundWorkers()
dlq_producer = EventProducer(settings.kafka_bootstrap_servers, "notification-service-dlq")
consumer = EventConsumer(
    bootstrap_servers=settings.kafka_bootstrap_servers,
    topics=[Topics.NOTIFICATION, Topics.STUDENT, Topics.ENROLLMENT],
    group_id="notification-service", handlers=HANDLERS,
    session_factory=db.async_session_factory,  # type: ignore[arg-type]
    processed_model=ProcessedEvent, dlq_producer=dlq_producer,
    max_attempts=settings.kafka_consumer_max_attempts, retry_backoff=settings.kafka_consumer_retry_backoff,
    after_commit=dispatcher.wake,  # new work committed => send immediately
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("starting %s (email backend=%s)", settings.service_name, backend.name)
    workers.start("email-dispatcher", dispatcher.run)
    if settings.kafka_enabled:
        workers.start("event-consumer", consumer.run)
    yield
    await workers.stop_all()
    await dlq_producer.stop()
    await db.dispose()


app = create_app(
    settings, title="SMS - Notification Service", lifespan=lifespan,
    description="Consumes Kafka events and sends templated HTML/text e-mails asynchronously with "
                "retry/back-off, delivery tracking and a notification history.",
    tags=[{"name": "Notifications"}],
)
async def backend_check() -> str:
    return f"{backend.name}:{'ok' if await backend.healthy() else 'unreachable'}"


app.include_router(build_health_router(settings.service_name, {
    "database": db.ping,
    "kafka_consumer": lambda: consumer.connected or not settings.kafka_enabled,
    "email_backend": backend_check,
    "dispatcher": lambda: workers.status().get("email-dispatcher") == "running",
}))
app.include_router(api_router, prefix=settings.api_prefix)
