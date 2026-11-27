"""Student file management: profile pictures and documents."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import FileKind
from app.models import Student, StudentFile
from app.repositories import FileRepository, StudentRepository
from app.schemas import FilePatch
from sms_common.errors import ForbiddenError, NotFoundError
from sms_common.security import CurrentUser
from sms_common.storage import DOCUMENT_POLICY, IMAGE_POLICY, FileStorage

log = logging.getLogger(__name__)


class StudentFileService:
    def __init__(self, session: AsyncSession, storage: FileStorage) -> None:
        self.session = session
        self.storage = storage
        self.files = FileRepository(session)
        self.students = StudentRepository(session)

    async def _student_for(self, student_id: int, actor: CurrentUser) -> Student:
        student = await self.students.get(student_id, detail=False)
        if student is None:
            raise NotFoundError(f"Student {student_id} not found")
        # Authorisation: staff may touch any student's files; a student only their own.
        if not actor.is_staff and student.user_id != actor.id:
            raise ForbiddenError("You may only access your own files")
        return student

    async def upload_picture(self, student_id: int, upload: UploadFile, actor: CurrentUser) -> StudentFile:
        await self._student_for(student_id, actor)
        stored, ctype = await self.storage.save(f"students/{student_id}/pictures", upload, IMAGE_POLICY)
        old = await self.files.list(student_id, FileKind.PROFILE_PICTURE)
        old_keys = [o.stored_key for o in old]
        try:
            for o in old:
                await self.files.delete(o)
            record = StudentFile(
                student_id=student_id, kind=FileKind.PROFILE_PICTURE, original_name=_safe_name(upload),
                stored_key=stored.key, content_type=ctype, size_bytes=stored.size,
                sha256=stored.sha256, uploaded_by=actor.id,
            )
            self.files.add(record)
            await self.session.commit()
            await self.session.refresh(record)  # load server-generated created_at
        except BaseException:
            await self.session.rollback()
            await self.storage.delete(stored.key)  # don't leave an orphan on disk
            raise
        for key in old_keys:
            await self.storage.delete(key)
        return record

    async def upload_document(self, student_id: int, upload: UploadFile, doc_type: str | None,
                              description: str | None, actor: CurrentUser) -> StudentFile:
        await self._student_for(student_id, actor)
        stored, ctype = await self.storage.save(f"students/{student_id}/documents", upload, DOCUMENT_POLICY)
        try:
            record = StudentFile(
                student_id=student_id, kind=FileKind.DOCUMENT, doc_type=doc_type,
                description=description, original_name=_safe_name(upload), stored_key=stored.key,
                content_type=ctype, size_bytes=stored.size, sha256=stored.sha256, uploaded_by=actor.id,
            )
            self.files.add(record)
            await self.session.commit()
            await self.session.refresh(record)  # load server-generated created_at
        except BaseException:
            await self.session.rollback()
            await self.storage.delete(stored.key)
            raise
        return record

    async def list_documents(self, student_id: int, actor: CurrentUser) -> list[StudentFile]:
        await self._student_for(student_id, actor)
        return await self.files.list(student_id, FileKind.DOCUMENT)

    async def get_file(self, student_id: int, file_id: int, actor: CurrentUser) -> StudentFile:
        await self._student_for(student_id, actor)
        f = await self.files.get(student_id, file_id)
        if f is None:
            raise NotFoundError(f"File {file_id} not found")
        return f

    async def get_picture(self, student_id: int, actor: CurrentUser) -> StudentFile:
        await self._student_for(student_id, actor)
        pics = await self.files.list(student_id, FileKind.PROFILE_PICTURE)
        if not pics:
            raise NotFoundError("Student has no profile picture")
        return pics[0]

    async def patch_metadata(self, student_id: int, file_id: int, data: FilePatch,
                             actor: CurrentUser) -> StudentFile:
        f = await self.get_file(student_id, file_id, actor)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(f, k, v)
        await self.session.commit()
        return f

    async def delete_file(self, student_id: int, file_id: int, actor: CurrentUser) -> None:
        f = await self.get_file(student_id, file_id, actor)
        key = f.stored_key
        await self.files.delete(f)
        await self.session.commit()
        await self.storage.delete(key)

    def stream(self, f: StudentFile) -> AsyncIterator[bytes]:
        return self.storage.open(f.stored_key)


def _safe_name(upload: UploadFile) -> str:
    import os

    return (os.path.basename(upload.filename or "file") or "file")[:255]
