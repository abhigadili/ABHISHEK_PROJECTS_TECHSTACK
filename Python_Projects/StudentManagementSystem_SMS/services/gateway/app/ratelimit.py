"""Rate limiting with SlowAPI (``limits`` library underneath, in-memory fixed window).

Three policies, all configurable through environment variables:

* ``login``   - credential-checking endpoints, **per IP**   (brute-force protection)
* ``auth``    - every other /auth/* endpoint, **per IP**
* ``general`` - everything else, **per authenticated user** (falls back to IP when anonymous)

A multi-instance deployment would point ``storage_uri`` at Redis so counters are shared.
"""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse

from app.config import get_settings
from sms_common.errors import error_response
from sms_common.security import decode_token

settings = get_settings()


def client_ip(request: Request) -> str:
    if settings.trust_forwarded_for and (fwd := request.headers.get("x-forwarded-for")):
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def ip_key(request: Request) -> str:
    return f"ip:{client_ip(request)}"


def user_or_ip_key(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            claims = decode_token(settings, auth[7:].strip())
            return f"user:{claims.sub}"
        except Exception:  # invalid token => treat as anonymous (auth layer rejects it separately)
            pass
    return ip_key(request)


limiter = Limiter(key_func=ip_key, headers_enabled=True, storage_uri="memory://", strategy="fixed-window")


def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    retry_after = 60
    try:
        retry_after = int(exc.limit.limit.get_expiry())
    except Exception:
        pass
    return error_response(  # type: ignore[return-value]
        429, "RATE_LIMITED", f"Rate limit exceeded ({exc.detail}). Retry in {retry_after}s",
        request.url.path, headers={"Retry-After": str(retry_after)},
    )
