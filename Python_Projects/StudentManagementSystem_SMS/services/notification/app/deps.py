from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.dispatcher import NotificationDispatcher
from app.email_backends import build_backend
from app.templates import TemplateRenderer
from sms_common.db import Database
from sms_common.security import CurrentUser, Role, SecurityDeps

settings = get_settings()
db = Database(settings)
security = SecurityDeps(get_settings, token_url="/api/v1/auth/token")
renderer = TemplateRenderer()
backend = build_backend(settings)
dispatcher = NotificationDispatcher(session_factory=db.async_session_factory,  # type: ignore[arg-type]
                                    backend=backend, renderer=renderer, settings=settings)

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(db.session_dependency)]
Reader = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, Role.TEACHER, scopes=["notifications:read"]))]
Writer = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, scopes=["notifications:write"]))]
