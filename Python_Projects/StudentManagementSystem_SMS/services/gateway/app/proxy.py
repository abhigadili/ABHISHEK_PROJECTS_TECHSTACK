"""Streaming reverse proxy with timeouts, bounded retries and error mapping."""

from __future__ import annotations

import asyncio
import logging
import random

import httpx
from fastapi import Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.config import Settings
from app.routing import Route
from sms_common.context import correlation_headers
from sms_common.errors import GatewayTimeoutError, ServiceUnavailableError

log = logging.getLogger(__name__)

HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers",
    "transfer-encoding", "upgrade", "host", "content-length",
}
RESPONSE_STRIP = {"x-request-id", "x-correlation-id", "x-process-time-ms", "x-middleware-trace",
                  "date", "server"}
SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "DELETE"}
RETRY_STATUS = {502, 503, 504}


class Proxy:
    def __init__(self, settings: Settings) -> None:
        self.s = settings
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=settings.proxy_connect_timeout, read=settings.proxy_read_timeout,
                                  write=settings.proxy_read_timeout, pool=settings.proxy_connect_timeout),
            limits=httpx.Limits(max_connections=200, max_keepalive_connections=50),
            follow_redirects=False,
        )

    async def aclose(self) -> None:
        await self.client.aclose()

    def _client_ip(self, request: Request) -> str:
        peer = request.client.host if request.client else "unknown"
        if self.s.trust_forwarded_for and (fwd := request.headers.get("x-forwarded-for")):
            return fwd.split(",")[0].strip()
        return peer

    def _outgoing_headers(self, request: Request) -> dict[str, str]:
        headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_BY_HOP
                   and k.lower() not in ("x-request-id", "x-correlation-id", "x-forwarded-for")}
        headers.update(correlation_headers())  # new request id per hop, same correlation id
        headers["X-Forwarded-For"] = self._client_ip(request)
        headers["X-Forwarded-Proto"] = request.url.scheme
        headers["X-Forwarded-Host"] = request.headers.get("host", "")
        return headers

    async def forward(self, request: Request, route: Route) -> StreamingResponse:
        url = f"{route.base_url}{request.url.path}"
        has_body = int(request.headers.get("content-length", "0") or 0) > 0 or \
            "chunked" in request.headers.get("transfer-encoding", "").lower()
        # Only body-less idempotent requests are safe to retry; a consumed body cannot be replayed
        # and retrying POST/PATCH could duplicate side effects.
        retryable = request.method in SAFE_METHODS and not has_body
        attempts = 1 + (self.s.proxy_max_retries if retryable else 0)
        last_exc: Exception | None = None

        for attempt in range(1, attempts + 1):
            built = self.client.build_request(
                request.method, url, params=request.query_params, headers=self._outgoing_headers(request),
                content=request.stream() if has_body else None,
            )
            try:
                upstream = await self.client.send(built, stream=True)
            except (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout) as exc:
                last_exc = exc
                log.warning("%s connect failed (attempt %d/%d): %s", route.service, attempt, attempts,
                            exc.__class__.__name__)
            except httpx.TimeoutException as exc:
                raise GatewayTimeoutError(f"{route.service} did not respond in time") from exc
            except httpx.TransportError as exc:
                last_exc = exc
                log.warning("%s transport error (attempt %d/%d): %s", route.service, attempt, attempts,
                            exc.__class__.__name__)
            else:
                if upstream.status_code in RETRY_STATUS and attempt < attempts:
                    await upstream.aclose()
                    log.warning("%s -> %s (attempt %d/%d)", route.service, upstream.status_code, attempt, attempts)
                else:
                    # request/correlation ids, timing and trace headers are re-added by the
                    # gateway's own middleware; forwarding the service's copies would duplicate them
                    headers = {k: v for k, v in upstream.headers.items()
                               if k.lower() not in HOP_BY_HOP and k.lower() not in RESPONSE_STRIP}
                    if (cl := upstream.headers.get("content-length")) is not None:
                        headers["content-length"] = cl
                    return StreamingResponse(
                        upstream.aiter_raw(), status_code=upstream.status_code, headers=headers,
                        background=BackgroundTask(upstream.aclose),
                    )
            if attempt < attempts:
                await asyncio.sleep(self.s.http_retry_backoff * (2 ** (attempt - 1)) * (0.5 + random.random()))
        raise ServiceUnavailableError(f"{route.service} is unavailable") from last_exc
