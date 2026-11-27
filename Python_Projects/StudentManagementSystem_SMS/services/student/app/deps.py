from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.file_service import StudentFileService
from app.services import StudentService
from sms_common.config import resolve_path
from sms_common.db import Database
from sms_common.security import CurrentUser, Role, SecurityDeps
from sms_common.storage import FileStorage, LocalFileStorage

settings = get_settings()
# async engine for the request path; a sync engine too, used by the /students/stats report
db = Database(settings, sync=True, use_async=True)
security = SecurityDeps(get_settings, token_url="/api/v1/auth/token")
storage: FileStorage = LocalFileStorage(resolve_path(settings.storage_root) / "student-service")

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(db.session_dependency)]
SyncSessionDep = Annotated[Session, Depends(db.sync_session_dependency)]
CurrentUserDep = Annotated[CurrentUser, Depends(security.current_user)]

# Role/scope guards ---------------------------------------------------------------
StaffReader = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, Role.TEACHER, scopes=["students:read"]))]
StaffWriter = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, Role.TEACHER, scopes=["students:write"]))]
AdminOnly = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, scopes=["students:write"]))]
SelfService = Annotated[CurrentUser, Depends(security.require(scopes=["profile:self"]))]
FileReader = Annotated[CurrentUser, Depends(security.require(scopes=["files:read"]))]
FileWriter = Annotated[CurrentUser, Depends(security.require(scopes=["files:write"]))]


def get_student_service(session: SessionDep) -> StudentService:
    return StudentService(session)


def get_file_service(session: SessionDep) -> StudentFileService:
    return StudentFileService(session, storage)


StudentServiceDep = Annotated[StudentService, Depends(get_student_service)]
FileServiceDep = Annotated[StudentFileService, Depends(get_file_service)]
