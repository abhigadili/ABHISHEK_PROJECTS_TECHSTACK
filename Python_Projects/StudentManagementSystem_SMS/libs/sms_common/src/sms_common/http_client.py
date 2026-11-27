"""Outbound HTTP between services (HTTPX): pooling, timeouts, retries, correlation.

* ``ServiceClient``     - async (``httpx.AsyncClient``), used inside async endpoints.
* ``SyncServiceClient`` - blocking (``httpx.Client``), for ``def`` endpoints that
  FastAPI runs in its threadpool (e.g. the OIDC callback in the auth service).

Retry policy: only idempotent methods (GET/HEAD/PUT/DELETE/OPTIONS) are retried,
on connection errors, timeouts and 502/503/504, with exponential backoff.
POST/PATCH are never retried automatically - a retry could duplicate the effect.
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any

import httpx

from sms_common.config import BaseServiceSettings
from sms_common.context import correlation_headers
from sms_common.errors import (
    AppError,
    ConflictError,
    ForbiddenError,
    GatewayTimeoutError,
    NotFoundError,
    ServiceUnavailableError,
    UnauthorizedError,
    UpstreamError,
)

log = logging.getLogger(__name__)

IDEMPOTENT = {"GET", "HEAD", "PUT", "DELETE", "OPTIONS"}
RETRY_STATUS = {502, 503, 504}


def _map_error(service: str, resp: httpx.Response) -> AppError:
    try:
        err = resp.json().get("error", {})
        message = err.get("message") or resp.text[:200]
    except Exception:
        message = resp.text[:200]
    mapping: dict[int, type[AppError]] = {
        401: UnauthorizedError, 403: ForbiddenError, 404: NotFoundError, 409: ConflictError,
    }
    cls = mapping.get(resp.status_code)
    if cls:
        return cls(f"{service}: {message}")
    return UpstreamError(f"{service} returned {resp.status_code}: {message}")


def _headers(token: str | None, extra: dict[str, str] | None) -> dict[str, str]:
    headers = correlation_headers()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    headers.update(extra or {})
    return headers


class ServiceClient:
    def __init__(self, name: str, base_url: str, settings: BaseServiceSettings) -> None:
        self.name = name
        self.max_retries = settings.http_max_retries
        self.backoff = settings.http_retry_backoff
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(
                connect=settings.http_connect_timeout,
                read=settings.http_read_timeout,
                write=settings.http_read_timeout,
                pool=settings.http_connect_timeout,
            ),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def request(
        self,
        method: str,
        path: str,
        *,
        token: str | None = None,
        json: Any = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        method = method.upper()
        attempts = 1 + (self.max_retries if method in IDEMPOTENT else 0)
        last_exc: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                resp = await self._client.request(
                    method, path, json=json, params=params, headers=_headers(token, headers)
                )
                if resp.status_code in RETRY_STATUS and attempt < attempts:
                    log.warning("%s %s -> %s (attempt %d/%d)", self.name, path, resp.status_code,
                                attempt, attempts)
                else:
                    return resp
            except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout,
                    httpx.RemoteProtocolError, httpx.PoolTimeout) as exc:
                last_exc = exc
                log.warning("%s %s failed: %s (attempt %d/%d)", self.name, path,
                            exc.__class__.__name__, attempt, attempts)
            if attempt < attempts:
                await asyncio.sleep(self.backoff * (2 ** (attempt - 1)) * (0.5 + random.random()))
        if isinstance(last_exc, (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.PoolTimeout)):
            raise GatewayTimeoutError(f"{self.name} did not respond in time") from last_exc
        raise ServiceUnavailableError(f"{self.name} is unavailable") from last_exc

    async def get_json(self, path: str, *, token: str | None = None,
                       params: dict[str, Any] | None = None) -> Any:
        resp = await self.request("GET", path, token=token, params=params)
        if resp.is_success:
            return resp.json()
        raise _map_error(self.name, resp)


class SyncServiceClient:
    """Blocking twin of :class:`ServiceClient` (same retry rules)."""

    def __init__(self, name: str, base_url: str, settings: BaseServiceSettings) -> None:
        self.name = name
        self.max_retries = settings.http_max_retries
        self.backoff = settings.http_retry_backoff
        self._client = httpx.Client(
            base_url=base_url,
            timeout=httpx.Timeout(settings.http_read_timeout, connect=settings.http_connect_timeout),
        )

    def close(self) -> None:
        self._client.close()

    def request(self, method: str, url: str, *, token: str | None = None, **kwargs: Any) -> httpx.Response:
        method = method.upper()
        attempts = 1 + (self.max_retries if method in IDEMPOTENT else 0)
        last_exc: Exception | None = None
        headers = _headers(token, kwargs.pop("headers", None))
        for attempt in range(1, attempts + 1):
            try:
                resp = self._client.request(method, url, headers=headers, **kwargs)
                if resp.status_code in RETRY_STATUS and attempt < attempts:
                    pass
                else:
                    return resp
            except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as exc:
                last_exc = exc
            if attempt < attempts:
                time.sleep(self.backoff * (2 ** (attempt - 1)))
        if isinstance(last_exc, httpx.TimeoutException):
            raise GatewayTimeoutError(f"{self.name} did not respond in time") from last_exc
        raise ServiceUnavailableError(f"{self.name} is unavailable") from last_exc
