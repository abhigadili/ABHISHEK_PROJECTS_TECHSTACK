"""Authentication Service entry point."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.api.v1 import api_router
from app.config import get_settings
from app.deps import db, passwords
from app.models import OutboxEvent
from app.services import AuthService
from sms_common.app_factory import create_app
from sms_common.health import build_health_router
from sms_common.kafka import EventProducer
from sms_common.outbox import OutboxRelay, count_pending
from sms_common.workers import BackgroundWorkers

settings = get_settings()
log = logging.getLogger(__name__)

workers = BackgroundWorkers()
producer = EventProducer(settings.kafka_bootstrap_servers, "auth-service")
relay = OutboxRelay(
    outbox_model=OutboxEvent, session_factory=db.async_session_factory,  # type: ignore[arg-type]
    producer=producer, poll_interval=settings.outbox_poll_interval,
    batch_size=settings.outbox_batch_size,
)


def _seed() -> None:
    with db.sync_session() as session:
        AuthService(session, settings, passwords).seed()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("starting %s (env=%s)", settings.service_name, settings.environment)
    await asyncio.to_thread(_seed)  # blocking DB work stays off the event loop
    if settings.kafka_enabled:
        workers.start("outbox-relay", relay.run)
    yield
    log.info("shutting down")
    await workers.stop_all()
    await producer.stop()
    await db.dispose()


app = create_app(
    settings,
    title="SMS - Authentication Service",
    description="Registration, login, JWT access/refresh tokens, OAuth2 password flow with scopes, "
                "password reset, RBAC and user management.",
    lifespan=lifespan,
    tags=[{"name": "Authentication", "description": "Public and self-service auth endpoints"},
          {"name": "Users (admin)"}, {"name": "Roles (admin)"}],
)
app.include_router(
    build_health_router(settings.service_name, {
        "database": db.ping,
        "outbox_relay": lambda: workers.status().get("outbox-relay") == "running" or not settings.kafka_enabled,
        "outbox_pending": lambda: count_pending(db.async_session_factory, OutboxEvent),  # type: ignore[arg-type]
    })
)
app.include_router(api_router, prefix=settings.api_prefix)
