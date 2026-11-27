"""Structured logging with automatic request/correlation/user context.

Every record carries: timestamp, level, service, request_id, correlation_id,
user_id, logger, message (+ ``extra`` fields and exception text).
A redaction filter masks bearer tokens, JWTs and ``password=...`` pairs so a
careless ``log.info(f"...{token}")`` cannot leak credentials.
"""

from __future__ import annotations

import json
import logging
import re
import sys
from datetime import datetime, timezone

from sms_common.context import correlation_id_var, request_id_var, user_id_var

_JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}")
_BEARER_RE = re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]+")
_SECRET_KV_RE = re.compile(
    r"""(?ix)
    ((?:password|passwd|pwd|secret|token|refresh_token|access_token|authorization)
     ["']?\s*[:=]\s*["']?)
    ([^\s,"'&}]+)
    """
)
_STANDARD_ATTRS = set(vars(logging.LogRecord("", 0, "", 0, "", (), None))) | {
    "message",
    "asctime",
    "service",
    "request_id",
    "correlation_id",
    "user_id",
}


def redact(text: str) -> str:
    text = _JWT_RE.sub("[REDACTED_JWT]", text)
    text = _BEARER_RE.sub(r"\1[REDACTED]", text)
    return _SECRET_KV_RE.sub(r"\1[REDACTED]", text)


class ContextFilter(logging.Filter):
    """Injects service name + contextvars; redacts the message."""

    def __init__(self, service_name: str) -> None:
        super().__init__()
        self.service_name = service_name

    def filter(self, record: logging.LogRecord) -> bool:
        record.service = self.service_name
        record.request_id = request_id_var.get()
        record.correlation_id = correlation_id_var.get()
        record.user_id = user_id_var.get()
        # Resolve %-args now so redaction sees the final text.
        record.msg = redact(record.getMessage())
        record.args = ()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(
                timespec="milliseconds"
            ),
            "level": record.levelname,
            "service": getattr(record, "service", "-"),
            "request_id": getattr(record, "request_id", "-"),
            "correlation_id": getattr(record, "correlation_id", "-"),
            "user_id": getattr(record, "user_id", "-"),
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _STANDARD_ATTRS and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["error"] = redact(self.formatException(record.exc_info))
        return json.dumps(payload, default=str)


TEXT_FORMAT = (
    "%(asctime)s %(levelname)-7s [%(service)s] rid=%(request_id).8s cid=%(correlation_id).8s "
    "uid=%(user_id)s %(name)s: %(message)s"
)


def configure_logging(service_name: str, level: str = "INFO", fmt: str = "json") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(ContextFilter(service_name))
    handler.setFormatter(JsonFormatter() if fmt == "json" else logging.Formatter(TEXT_FORMAT))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    # uvicorn's own loggers would otherwise print unstructured lines.
    for name in ("uvicorn", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.handlers[:] = []
        lg.propagate = True
    # Access logging is done by our own middleware (with correlation ids).
    logging.getLogger("uvicorn.access").disabled = True
    for noisy in ("aiokafka", "kafka", "aiosmtplib", "httpx", "httpcore", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
