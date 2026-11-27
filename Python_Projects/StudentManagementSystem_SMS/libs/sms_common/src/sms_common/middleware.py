"""Pure-ASGI middleware stack.

Pure ASGI (instead of ``BaseHTTPMiddleware``) keeps streaming responses
streaming, preserves ``contextvars`` and avoids extra task hops.

Execution order (outermost -> innermost), configured in ``install_middleware``::

    request  -> RequestContext -> AccessLog -> Timing -> SecurityHeaders
             -> CORS -> ErrorHandling -> [service extras e.g. SlowAPI] -> router
    response <- (same chain in reverse)

* RequestContext is outermost so *every* later log line (even from CORS or the
  error handler) already carries request/correlation ids.
* AccessLog wraps Timing so the duration it logs includes everything inside.
* ErrorHandling is *inside* CORS so even a 500 produced by it gets CORS headers.
* In non-production the chain is observable: ``X-Middleware-Trace`` lists the
  order in which middleware saw the response (innermost first).
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from sms_common.config import BaseServiceSettings
from sms_common.context import (
    CORRELATION_ID_HEADER,
    REQUEST_ID_HEADER,
    correlation_id_var,
    new_id,
    request_id_var,
    user_id_var,
)
from sms_common.errors import error_body

log = logging.getLogger("sms.access")

_TRACE_KEY = "sms.trace"


def _header(scope: Scope, name: str) -> str | None:
    wanted = name.lower().encode()
    for k, v in scope.get("headers", []):
        if k == wanted:
            return v.decode("latin-1")
    return None


def _trace_in(scope: Scope, name: str) -> None:
    scope.setdefault(_TRACE_KEY, {"in": [], "out": []})["in"].append(name)


def _trace_out(scope: Scope, name: str) -> None:
    scope.setdefault(_TRACE_KEY, {"in": [], "out": []})["out"].append(name)


def get_trace(scope: Scope) -> dict[str, list[str]]:
    return scope.get(_TRACE_KEY, {"in": [], "out": []})


class _Base:
    name = "base"

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    def _wrap_send(self, scope: Scope, send: Send, on_start: Any = None) -> Send:
        async def wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                _trace_out(scope, self.name)
                if on_start:
                    on_start(message)
            await send(message)

        return wrapper


class RequestContextMiddleware(_Base):
    """Accept/generate X-Request-ID and X-Correlation-ID; echo them back."""

    name = "RequestContext"

    def __init__(self, app: ASGIApp, expose_trace: bool = False) -> None:
        super().__init__(app)
        self.expose_trace = expose_trace

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        rid = _header(scope, REQUEST_ID_HEADER) or new_id()
        cid = _header(scope, CORRELATION_ID_HEADER) or rid
        tokens = (
            request_id_var.set(rid),
            correlation_id_var.set(cid),
            user_id_var.set("-"),
        )
        _trace_in(scope, self.name)

        def on_start(message: Message) -> None:
            headers = message.setdefault("headers", [])
            headers.append((REQUEST_ID_HEADER.lower().encode(), rid.encode()))
            headers.append((CORRELATION_ID_HEADER.lower().encode(), cid.encode()))
            if self.expose_trace:
                order = get_trace(scope)["out"]
                headers.append((b"x-middleware-trace", ",".join(order).encode()))

        try:
            await self.app(scope, receive, self._wrap_send(scope, send, on_start))
        finally:
            request_id_var.reset(tokens[0])
            correlation_id_var.reset(tokens[1])
            user_id_var.reset(tokens[2])


class AccessLogMiddleware(_Base):
    """One structured log line per request (never logs headers or bodies)."""

    name = "AccessLog"

    def __init__(self, app: ASGIApp, quiet_paths: tuple[str, ...] = ("/health",)) -> None:
        super().__init__(app)
        self.quiet_paths = quiet_paths

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        _trace_in(scope, self.name)
        start = time.perf_counter()
        status = {"code": 500}
        quiet = scope["path"].startswith(self.quiet_paths)
        if not quiet:
            log.info("request started %s %s", scope["method"], scope["path"])

        def on_start(message: Message) -> None:
            status["code"] = message["status"]

        try:
            await self.app(scope, receive, self._wrap_send(scope, send, on_start))
        finally:
            if not quiet:
                client = scope.get("client")
                log.info(
                    "request finished %s %s -> %s",
                    scope["method"],
                    scope["path"],
                    status["code"],
                    extra={
                        "http_method": scope["method"],
                        "http_path": scope["path"],
                        "http_status": status["code"],
                        "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                        "client_ip": client[0] if client else None,
                    },
                )


class TimingMiddleware(_Base):
    """Adds ``X-Process-Time-ms`` (time spent inside the layers below it)."""

    name = "Timing"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        _trace_in(scope, self.name)
        start = time.perf_counter()

        def on_start(message: Message) -> None:
            elapsed = (time.perf_counter() - start) * 1000
            message.setdefault("headers", []).append(
                (b"x-process-time-ms", f"{elapsed:.2f}".encode())
            )

        await self.app(scope, receive, self._wrap_send(scope, send, on_start))


class SecurityHeadersMiddleware(_Base):
    """Defensive HTTP headers; relaxed CSP for the interactive docs pages."""

    name = "SecurityHeaders"
    DOC_PATHS = ("/docs", "/redoc", "/openapi.json")

    def __init__(self, app: ASGIApp, hsts: bool = False) -> None:
        super().__init__(app)
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        _trace_in(scope, self.name)
        is_doc = scope["path"].startswith(self.DOC_PATHS)

        def on_start(message: Message) -> None:
            h = message.setdefault("headers", [])
            existing = {k for k, _ in h}
            add = {
                b"x-content-type-options": b"nosniff",
                b"x-frame-options": b"DENY",
                b"referrer-policy": b"no-referrer",
                b"cache-control": b"no-store",
                b"permissions-policy": b"geolocation=(), camera=(), microphone=()",
            }
            if not is_doc:
                add[b"content-security-policy"] = b"default-src 'none'; frame-ancestors 'none'"
            if self.hsts:
                add[b"strict-transport-security"] = b"max-age=31536000; includeSubDomains"
            for k, v in add.items():
                if k not in existing:
                    h.append((k, v))

        await self.app(scope, receive, self._wrap_send(scope, send, on_start))


class ErrorHandlingMiddleware(_Base):
    """Last line of defence: converts anything that escaped the exception
    handlers into the standard JSON 500 (and logs it with full context)."""

    name = "ErrorHandling"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        _trace_in(scope, self.name)
        started = {"v": False}

        async def tracking_send(message: Message) -> None:
            if message["type"] == "http.response.start":
                started["v"] = True
                _trace_out(scope, self.name)
            await send(message)

        try:
            await self.app(scope, receive, tracking_send)
        except Exception:
            log.exception("Unhandled error escaped to ErrorHandlingMiddleware")
            if started["v"]:
                raise
            body = json.dumps(
                error_body("INTERNAL_ERROR", "Internal server error", scope.get("path", ""))
            ).encode()
            await tracking_send(
                {
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(body)).encode()),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": body})


def install_middleware(app: FastAPI, settings: BaseServiceSettings) -> None:
    """Add the standard stack.  Starlette applies ``add_middleware`` calls in
    reverse (last added = outermost), so we add innermost first."""
    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", REQUEST_ID_HEADER, CORRELATION_ID_HEADER],
        expose_headers=[REQUEST_ID_HEADER, CORRELATION_ID_HEADER, "X-Process-Time-ms",
                        "Retry-After", "Content-Disposition"],
    )
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)
    app.add_middleware(TimingMiddleware)
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(RequestContextMiddleware, expose_trace=not settings.is_production)
