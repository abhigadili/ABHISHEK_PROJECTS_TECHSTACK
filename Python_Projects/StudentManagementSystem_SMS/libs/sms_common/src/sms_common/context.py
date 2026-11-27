"""Request-scoped context shared by logging, HTTP clients and middleware.

``contextvars`` give every asyncio task (and every threadpool call started via
``anyio``/``asyncio.to_thread``) its own copy of these values, so concurrent
requests never see each other's IDs.
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="-")
user_id_var: ContextVar[str] = ContextVar("user_id", default="-")

REQUEST_ID_HEADER = "X-Request-ID"
CORRELATION_ID_HEADER = "X-Correlation-ID"


def new_id() -> str:
    return uuid.uuid4().hex


def get_request_id() -> str:
    return request_id_var.get()


def get_correlation_id() -> str:
    return correlation_id_var.get()


def get_user_id() -> str:
    return user_id_var.get()


def correlation_headers() -> dict[str, str]:
    """Headers that propagate the current correlation id to a downstream call.

    A *new* request id is minted per hop (it identifies one HTTP exchange)
    while the correlation id is kept for the whole business transaction.
    """
    cid = correlation_id_var.get()
    return {
        CORRELATION_ID_HEADER: cid if cid != "-" else new_id(),
        REQUEST_ID_HEADER: new_id(),
    }
