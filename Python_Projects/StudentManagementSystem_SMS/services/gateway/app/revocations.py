"""In-memory cache of revoked access-token ids, fed by ``TokenRevoked`` Kafka events.

Access tokens are stateless JWTs, so the Auth service publishes an event on logout and every
gateway instance (each with its *own* consumer group, so it receives every event) keeps the
``jti`` until the token would have expired anyway.  On start-up it replays the topic from the
beginning, which rebuilds the set after a restart.
"""

from __future__ import annotations

import asyncio
import logging
import socket
import time
import uuid

from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError

from app.config import Settings
from sms_common.events import EventEnvelope, EventType, TokenRevokedPayload, Topics

log = logging.getLogger(__name__)


class RevocationCache:
    def __init__(self) -> None:
        self._revoked: dict[str, int] = {}
        self.connected = False

    def add(self, jti: str, exp: int) -> None:
        if exp > time.time():
            self._revoked[jti] = exp

    def is_revoked(self, jti: str) -> bool:
        exp = self._revoked.get(jti)
        if exp is None:
            return False
        if exp <= time.time():  # token expired by itself: forget it
            self._revoked.pop(jti, None)
            return False
        return True

    def __len__(self) -> int:
        return len(self._revoked)


async def listen(settings: Settings, cache: RevocationCache, stop: asyncio.Event) -> None:
    group = f"gateway-{socket.gethostname()}-{uuid.uuid4().hex[:8]}"
    delay = 1.0
    while not stop.is_set():
        consumer = AIOKafkaConsumer(
            Topics.AUTH, bootstrap_servers=settings.kafka_bootstrap_servers, group_id=group,
            enable_auto_commit=False, auto_offset_reset="earliest",
        )
        try:
            await consumer.start()
            cache.connected, delay = True, 1.0
            log.info("revocation listener subscribed (group=%s)", group)
            while not stop.is_set():
                batch = await consumer.getmany(timeout_ms=500)
                for messages in batch.values():
                    for msg in messages:
                        try:
                            env = EventEnvelope.model_validate_json(msg.value)
                            if env.event_type == EventType.TOKEN_REVOKED.value:
                                p = TokenRevokedPayload.model_validate(env.payload)
                                cache.add(p.jti, p.exp)
                        except ValueError:
                            log.warning("ignoring malformed auth event")
        except asyncio.CancelledError:
            raise
        except (KafkaError, OSError) as exc:
            log.warning("revocation listener: %s; retry in %.0fs", exc.__class__.__name__, delay)
        finally:
            cache.connected = False
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
