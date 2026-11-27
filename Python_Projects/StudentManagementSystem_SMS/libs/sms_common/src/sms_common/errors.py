"""Custom exception hierarchy and the global handlers that render them.

Every error leaves the API in the same envelope::

    {"error": {"code": "NOT_FOUND", "message": "...", "details": [...],
               "request_id": "...", "correlation_id": "...",
               "timestamp": "...", "path": "/api/v1/..."}}
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, IntegrityError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

from sms_common.context import correlation_id_var, request_id_var

log = logging.getLogger(__name__)

_SENSITIVE_FIELDS = {"password", "new_password", "current_password", "refresh_token", "token"}


class AppError(Exception):
    """Base class: raise a subclass anywhere (services, repositories, deps)."""

    status_code = 500
    code = "INTERNAL_ERROR"
    default_message = "Internal server error"

    def __init__(
        self,
        message: str | None = None,
        *,
        details: list[dict[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.message = message or self.default_message
        self.details = details or []
        self.headers = headers
        super().__init__(self.message)


class BadRequestError(AppError):
    status_code, code, default_message = 400, "BAD_REQUEST", "Bad request"


class UnauthorizedError(AppError):
    status_code, code, default_message = 401, "UNAUTHORIZED", "Authentication required"

    def __init__(self, message: str | None = None, **kw: Any) -> None:
        kw.setdefault("headers", {"WWW-Authenticate": "Bearer"})
        super().__init__(message, **kw)


class ForbiddenError(AppError):
    status_code, code, default_message = 403, "FORBIDDEN", "You do not have permission"


class NotFoundError(AppError):
    status_code, code, default_message = 404, "NOT_FOUND", "Resource not found"


class ConflictError(AppError):
    status_code, code, default_message = 409, "CONFLICT", "Conflict with current state"


class PayloadTooLargeError(AppError):
    status_code, code, default_message = 413, "PAYLOAD_TOO_LARGE", "Payload too large"


class UnsupportedMediaError(AppError):
    status_code, code, default_message = 415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported media type"


class UnprocessableError(AppError):
    status_code, code, default_message = 422, "UNPROCESSABLE_ENTITY", "Unprocessable entity"


class RateLimitedError(AppError):
    status_code, code, default_message = 429, "RATE_LIMITED", "Too many requests"


class ServiceUnavailableError(AppError):
    status_code, code, default_message = 503, "SERVICE_UNAVAILABLE", "Service unavailable"


class GatewayTimeoutError(AppError):
    status_code, code, default_message = 504, "GATEWAY_TIMEOUT", "Upstream service timed out"


class UpstreamError(AppError):
    """A downstream service answered with an unexpected error."""

    status_code, code, default_message = 502, "BAD_GATEWAY", "Upstream service error"


class FileStorageError(AppError):
    status_code, code, default_message = 500, "FILE_STORAGE_ERROR", "File storage failure"


class EmailDeliveryError(Exception):
    """Raised by email backends; handled by the notification retry logic.

    ``permanent=True`` (e.g. recipient refused) skips further retries.
    """

    def __init__(self, message: str, *, permanent: bool = False) -> None:
        super().__init__(message)
        self.permanent = permanent


class EventProcessingError(Exception):
    """Raised by Kafka handlers to force retry / dead-lettering."""


def error_body(
    code: str, message: str, path: str = "", details: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or [],
            "request_id": request_id_var.get(),
            "correlation_id": correlation_id_var.get(),
            "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "path": path,
        }
    }


def error_response(
    status: int,
    code: str,
    message: str,
    path: str = "",
    details: list[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(error_body(code, message, path, details), status_code=status, headers=headers)


_STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "UNPROCESSABLE_ENTITY",
    429: "RATE_LIMITED",
    503: "SERVICE_UNAVAILABLE",
}


async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    level = logging.ERROR if exc.status_code >= 500 else logging.INFO
    log.log(level, "AppError %s: %s", exc.code, exc.message)
    return error_response(
        exc.status_code, exc.code, exc.message, request.url.path, exc.details, exc.headers
    )


async def _http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _STATUS_CODES.get(exc.status_code, f"HTTP_{exc.status_code}")
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return error_response(
        exc.status_code, code, message, request.url.path,
        headers=getattr(exc, "headers", None),
    )


async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", ())]
        field = ".".join(loc)
        item: dict[str, Any] = {"field": field, "message": err.get("msg"), "type": err.get("type")}
        # Never echo submitted secrets back (or into logs).
        if not any(part in _SENSITIVE_FIELDS for part in loc):
            inp = err.get("input")
            if isinstance(inp, (str, int, float, bool)) or inp is None:
                item["input"] = inp
        details.append(item)
    return error_response(
        422, "VALIDATION_ERROR", "Request validation failed", request.url.path, details
    )


async def _integrity_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    log.warning("IntegrityError: %s", getattr(exc.orig, "args", exc.orig))
    return error_response(
        409, "CONFLICT", "The operation violates a uniqueness or reference constraint",
        request.url.path,
    )


async def _db_unavailable_handler(request: Request, exc: DBAPIError) -> JSONResponse:
    log.error("Database error: %s", exc.__class__.__name__, exc_info=exc)
    return error_response(503, "DATABASE_UNAVAILABLE", "Database temporarily unavailable",
                          request.url.path)


async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled exception")
    return error_response(500, "INTERNAL_ERROR", "Internal server error", request.url.path)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _validation_handler)  # type: ignore[arg-type]
    app.add_exception_handler(IntegrityError, _integrity_handler)  # type: ignore[arg-type]
    app.add_exception_handler(OperationalError, _db_unavailable_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _unhandled_handler)
