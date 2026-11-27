from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.services import EnrollmentService
from sms_common.db import Database
from sms_common.http_client import ServiceClient
from sms_common.security import CurrentUser, Role, SecurityDeps

settings = get_settings()
db = Database(settings)
security = SecurityDeps(get_settings, token_url="/api/v1/auth/token")
# Synchronous (request/response) collaborators, each with its own pooled HTTPX client.
student_client = ServiceClient("student-service", settings.student_service_url, settings)
course_client = ServiceClient("course-service", settings.course_service_url, settings)

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(db.session_dependency)]
CurrentUserDep = Annotated[CurrentUser, Depends(security.current_user)]
Reader = Annotated[CurrentUser, Depends(security.require(scopes=["enrollments:read"]))]
Writer = Annotated[CurrentUser, Depends(security.require(scopes=["enrollments:write"]))]
StaffReader = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, Role.TEACHER, scopes=["enrollments:read"]))]
StaffWriter = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, Role.TEACHER, scopes=["enrollments:write"]))]
AdminOnly = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, scopes=["enrollments:write"]))]


def get_service(session: SessionDep) -> EnrollmentService:
    return EnrollmentService(session, db, student_client, course_client)


ServiceDep = Annotated[EnrollmentService, Depends(get_service)]
