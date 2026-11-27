"""Optional OpenID Connect (authorization-code flow) against an external provider.

Disabled unless OIDC_ISSUER / OIDC_CLIENT_ID / OIDC_CLIENT_SECRET are set.
The routes are plain ``def`` handlers and use the *synchronous* HTTPX client
(they run in FastAPI's threadpool) - the project's example of sync HTTP.
"""

from __future__ import annotations

import logging
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Query, Request
from fastapi.responses import RedirectResponse

from app.deps import AuthServiceDep, SettingsDep, client_ip, passwords
from app.models import User
from app.schemas import TokenResponse
from sms_common.errors import AppError, BadRequestError, ConflictError, UnauthorizedError, UpstreamError
from sms_common.http_client import SyncServiceClient
from sms_common.security import Role, create_token, decode_token
from sms_common.timeutil import utcnow

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/oidc", tags=["OpenID Connect (optional)"])


class NotConfigured(AppError):
    status_code, code = 501, "OIDC_NOT_CONFIGURED"
    default_message = "No external OpenID Connect provider is configured"


def _discover(client: SyncServiceClient, issuer: str) -> dict[str, str]:
    resp = client.request("GET", f"{issuer.rstrip('/')}/.well-known/openid-configuration")
    if not resp.is_success:
        raise UpstreamError("OIDC discovery failed")
    return resp.json()


@router.get("/login", summary="Redirect the browser to the identity provider")
def oidc_login(settings: SettingsDep) -> RedirectResponse:
    if not settings.oidc_enabled:
        raise NotConfigured()
    client = SyncServiceClient("oidc-provider", settings.oidc_issuer or "", settings)
    try:
        meta = _discover(client, settings.oidc_issuer or "")
    finally:
        client.close()
    # Stateless CSRF protection: ``state`` is a short-lived signed token.
    state, _ = create_token(settings, subject="oidc", token_type="oidc_state",
                            ttl=timedelta(minutes=10), jti=secrets.token_hex(16))
    query = urlencode({
        "response_type": "code", "client_id": settings.oidc_client_id,
        "redirect_uri": settings.oidc_redirect_uri, "scope": "openid email profile",
        "state": state,
    })
    return RedirectResponse(f"{meta['authorization_endpoint']}?{query}", status_code=302)


@router.get("/callback", response_model=TokenResponse, summary="Provider redirects back here")
def oidc_callback(
    request: Request, settings: SettingsDep, svc: AuthServiceDep,
    code: str = Query(...), state: str = Query(...),
) -> TokenResponse:
    if not settings.oidc_enabled:
        raise NotConfigured()
    decode_token(settings, state, expected_type="oidc_state")  # raises 401 if forged/expired
    client = SyncServiceClient("oidc-provider", settings.oidc_issuer or "", settings)
    try:
        meta = _discover(client, settings.oidc_issuer or "")
        token_resp = client.request("POST", meta["token_endpoint"], data={
            "grant_type": "authorization_code", "code": code,
            "redirect_uri": settings.oidc_redirect_uri, "client_id": settings.oidc_client_id,
            "client_secret": settings.oidc_client_secret.get_secret_value()  # type: ignore[union-attr]
            if settings.oidc_client_secret else "",
        })
        if not token_resp.is_success:
            raise UnauthorizedError("The identity provider rejected the authorization code")
        provider_access = token_resp.json().get("access_token")
        info_resp = client.request("GET", meta["userinfo_endpoint"],
                                   headers={"Authorization": f"Bearer {provider_access}"})
        if not info_resp.is_success:
            raise UpstreamError("Could not read the user profile from the identity provider")
        info = info_resp.json()
    finally:
        client.close()

    subject, email = info.get("sub"), (info.get("email") or "").lower()
    if not subject or not email or info.get("email_verified") is not True:
        raise BadRequestError("The provider did not return a verified e-mail address")

    user = svc.users.get_by_external("oidc", subject)
    if user is None:
        if svc.users.get_by_email(email):
            raise ConflictError("This e-mail is already registered; sign in with your password")
        user = User(
            email=email, full_name=info.get("name") or email.split("@")[0],
            password_hash=passwords.hash(secrets.token_urlsafe(32)),  # unusable local password
            auth_provider="oidc", external_subject=subject, password_changed_at=utcnow(),
        )
        user.roles = svc.roles.get_by_names([Role.STUDENT.value])
        svc.users.add(user)
        svc._emit_registered(user)
        svc.session.commit()
    if not user.is_active:
        raise UnauthorizedError("This account is disabled")
    user.last_login_at = utcnow()
    svc.session.commit()
    log.info("oidc login", extra={"oidc_user": user.id})
    return svc.issue_tokens(user, client_ip=client_ip(request),
                            user_agent=request.headers.get("user-agent"))
