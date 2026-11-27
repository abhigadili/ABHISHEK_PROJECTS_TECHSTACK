from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.services import CourseService
from sms_common.config import resolve_path
from sms_common.db import Database
from sms_common.http_client import ServiceClient
from sms_common.security import CurrentUser, Role, SecurityDeps
from sms_common.storage import FileStorage, LocalFileStorage

settings = get_settings()
db = Database(settings)
security = SecurityDeps(get_settings, token_url="/api/v1/auth/token")
storage: FileStorage = LocalFileStorage(resolve_path(settings.storage_root) / "course-service")
# One pooled HTTPX client for the whole process (closed in the lifespan).
auth_client = ServiceClient("auth-service", settings.auth_service_url, settings)

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(db.session_dependency)]
CurrentUserDep = Annotated[CurrentUser, Depends(security.current_user)]
CourseReader = Annotated[CurrentUser, Depends(security.require(scopes=["courses:read"]))]
CourseWriter = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, Role.TEACHER, scopes=["courses:write"]))]
AdminOnly = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, scopes=["courses:write"]))]
FileReader = Annotated[CurrentUser, Depends(security.require(scopes=["files:read"]))]
FileWriter = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, Role.TEACHER, scopes=["files:write"]))]


def get_course_service(session: SessionDep) -> CourseService:
    return CourseService(session, auth_client, storage)


CourseServiceDep = Annotated[CourseService, Depends(get_course_service)]
