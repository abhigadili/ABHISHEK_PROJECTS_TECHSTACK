"""Dependency-injection wiring for the Auth service."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.passwords import PasswordService
from app.services import AuthService
from sms_common.db import Database
from sms_common.security import CurrentUser, Role, SecurityDeps

# Engines are created lazily (no connection until first use); the lifespan disposes them.
db = Database(get_settings(), sync=True, use_async=True)
passwords = PasswordService()
security = SecurityDeps(get_settings, token_url="/api/v1/auth/token")

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[Session, Depends(db.sync_session_dependency)]
CurrentUserDep = Annotated[CurrentUser, Depends(security.current_user)]
AdminDep = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, scopes=["users:manage"]))]


def get_auth_service(session: SessionDep, settings: SettingsDep) -> AuthService:
    return AuthService(session, settings, passwords)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def client_ip(request: Request) -> str | None:
    """First hop from X-Forwarded-For (set by our gateway) or the socket peer."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:45]
    return request.client.host if request.client else None
