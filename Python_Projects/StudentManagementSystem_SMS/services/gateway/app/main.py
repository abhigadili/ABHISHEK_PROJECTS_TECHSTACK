"""API Gateway: single entry point (auth validation, rate limiting, routing, merged API docs)."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import httpx
from fastapi import FastAPI, Request
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import JSONResponse, Response, StreamingResponse
from slowapi.errors import RateLimitExceeded

from app import revocations
from app.config import get_settings
from app.proxy import Proxy
from app.ratelimit import limiter, rate_limit_handler, user_or_ip_key, ip_key
from app.routing import build_routes, resolve, service_urls
from sms_common.app_factory import create_app
from sms_common.context import user_id_var
from sms_common.errors import NotFoundError, UnauthorizedError
from sms_common.health import build_health_router
from sms_common.security import decode_token
from sms_common.workers import BackgroundWorkers

settings = get_settings()
log = logging.getLogger(__name__)

routes = build_routes(settings)
proxy = Proxy(settings)
cache = revocations.RevocationCache()
workers = BackgroundWorkers()
P = settings.api_prefix

# Endpoints reachable without a token (everything else needs a valid, non-revoked access token).
PUBLIC = {
    ("POST", f"{P}/auth/register"), ("POST", f"{P}/auth/login"), ("POST", f"{P}/auth/token"),
    ("POST", f"{P}/auth/refresh"), ("POST", f"{P}/auth/forgot-password"),
    ("POST", f"{P}/auth/reset-password"),
}
PUBLIC_PREFIXES = (f"{P}/auth/oidc/",)
LOGIN_PATHS = {f"{P}/auth/login", f"{P}/auth/token"}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("starting %s; routes=%s", settings.service_name, [r.prefix for r in routes])
    if settings.kafka_enabled:
        workers.start("revocation-listener", lambda stop: revocations.listen(settings, cache, stop))
    yield
    await workers.stop_all()
    await proxy.aclose()


app = create_app(
    settings, title="SMS - API Gateway", lifespan=lifespan, builtin_docs=False,
    description="Single entry point for the Student Management System. Validates JWTs, enforces rate "
                "limits, adds correlation ids and forwards to the microservices. The Swagger UI here "
                "shows the merged API of every service.",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)  # type: ignore[arg-type]


# ----------------------------------------------------------------------------- auth
def authenticate(request: Request) -> None:
    """Centralised authentication: signature, expiry, issuer, type and revocation.

    Authorisation (roles/scopes/ownership) stays in the services - the gateway does not
    duplicate it, it only rejects obviously unauthenticated traffic early.
    """
    path, method = request.url.path, request.method
    if (method, path) in PUBLIC or path.startswith(PUBLIC_PREFIXES):
        return
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer ") or not header[7:].strip():
        raise UnauthorizedError("Not authenticated")
    claims = decode_token(settings, header[7:].strip(), "access")
    if cache.is_revoked(claims.jti):
        raise UnauthorizedError("Token has been revoked")
    user_id_var.set(claims.sub)


async def _forward(request: Request) -> StreamingResponse:
    route = resolve(routes, request.url.path)
    if route is None:
        raise NotFoundError(f"No route for {request.url.path}")
    authenticate(request)
    return await proxy.forward(request, route)


METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]


# Order matters: the most specific policy is registered first.
@app.api_route(f"{P}/auth/login", methods=["POST"], include_in_schema=False)
@app.api_route(f"{P}/auth/token", methods=["POST"], include_in_schema=False)
@limiter.limit(lambda: settings.rate_limit_login, key_func=ip_key)
async def login_route(request: Request) -> StreamingResponse:
    return await _forward(request)


@app.api_route(P + "/auth/{path:path}", methods=METHODS, include_in_schema=False)
@limiter.limit(lambda: settings.rate_limit_auth, key_func=ip_key)
async def auth_routes(request: Request, path: str) -> StreamingResponse:
    return await _forward(request)


@app.api_route(P + "/{path:path}", methods=METHODS, include_in_schema=False)
@limiter.limit(lambda: settings.rate_limit_default, key_func=user_or_ip_key)
async def api_routes(request: Request, path: str) -> StreamingResponse:
    return await _forward(request)


# --------------------------------------------------------------- health + merged docs
async def _fetch(client: httpx.AsyncClient, name: str, base: str, path: str) -> tuple[str, int | None, Any]:
    try:
        r = await client.get(f"{base}{path}")
        return name, r.status_code, r.json()
    except Exception:
        return name, None, None


@app.get("/health/services", tags=["Health"], summary="Aggregated health of all downstream services")
async def services_health() -> JSONResponse:
    async with httpx.AsyncClient(timeout=3.0) as client:
        results = await asyncio.gather(  # concurrent fan-out
            *(_fetch(client, n, u.rstrip("/"), "/health/ready") for n, u in service_urls(settings).items()))
    services = {n: {"status": (body or {}).get("status", "UNREACHABLE"), "http": code}
                for n, code, body in results}
    ok = all(v["status"] == "UP" for v in services.values())
    return JSONResponse({"status": "UP" if ok else "DEGRADED", "services": services},
                        status_code=200 if ok else 503)


app.include_router(build_health_router(settings.service_name, {
    "revocation_listener": lambda: cache.connected or not settings.kafka_enabled,
    "revoked_tokens_cached": lambda: len(cache),
}))

_spec_cache: dict[str, Any] = {"at": 0.0, "spec": None}


@app.get("/openapi.json", include_in_schema=False)
async def merged_openapi() -> JSONResponse:
    """Merge every service's OpenAPI document so Swagger UI at the gateway covers all APIs."""
    if _spec_cache["spec"] and time.time() - _spec_cache["at"] < 60:
        return JSONResponse(_spec_cache["spec"])
    async with httpx.AsyncClient(timeout=4.0) as client:
        results = await asyncio.gather(
            *(_fetch(client, n, u.rstrip("/"), "/openapi.json") for n, u in service_urls(settings).items()))
    merged: dict[str, Any] = {
        "openapi": "3.1.0",
        "info": {"title": "Student Management System API (via gateway)", "version": "1.0.0",
                 "description": app.description},
        "paths": {}, "components": {"schemas": {}, "securitySchemes": {}}, "tags": [],
    }
    for name, code, spec in results:
        if code != 200 or not spec:
            continue
        prefix = name.split("-")[0].capitalize()
        # schema names can collide between services (FileRead...): namespace them per service
        text = json.dumps(spec).replace('"#/components/schemas/', f'"#/components/schemas/{prefix}.')
        spec = json.loads(text)
        for path, item in spec.get("paths", {}).items():
            if path.startswith("/health"):
                continue
            merged["paths"][path] = item
        for k, v in spec.get("components", {}).get("schemas", {}).items():
            merged["components"]["schemas"][f"{prefix}.{k}"] = v
        merged["components"]["securitySchemes"].update(spec.get("components", {}).get("securitySchemes", {}))
        for t in spec.get("tags", []):
            if t not in merged["tags"]:
                merged["tags"].append(t)
    _spec_cache.update(at=time.time(), spec=merged)
    return JSONResponse(merged)


@app.get("/docs", include_in_schema=False)
async def swagger_ui() -> Response:
    return get_swagger_ui_html(openapi_url="/openapi.json", title="SMS API Gateway - Swagger UI",
                               swagger_ui_parameters={"persistAuthorization": True})


@app.get("/redoc", include_in_schema=False)
async def redoc() -> Response:
    return get_redoc_html(openapi_url="/openapi.json", title="SMS API Gateway - ReDoc")
