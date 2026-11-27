"""Liveness / readiness endpoints shared by all services."""

from __future__ import annotations

import inspect
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

Check = Callable[[], Awaitable[Any] | Any]


def build_health_router(service: str, checks: dict[str, Check]) -> APIRouter:
    router = APIRouter(tags=["Health"])

    @router.get("/health", summary="Liveness probe")
    async def liveness() -> dict[str, str]:
        return {"status": "UP", "service": service}

    @router.get("/health/ready", summary="Readiness probe (checks dependencies)")
    async def readiness() -> JSONResponse:
        results: dict[str, Any] = {}
        ok = True
        for name, check in checks.items():
            try:
                value = check()
                if inspect.isawaitable(value):
                    value = await value
                results[name] = value
                if value is False:
                    ok = False
            except Exception as exc:  # a failing check means "not ready"
                results[name] = f"error: {exc.__class__.__name__}"
                ok = False
        return JSONResponse(
            {"status": "UP" if ok else "DOWN", "service": service, "checks": results},
            status_code=200 if ok else 503,
        )

    return router
