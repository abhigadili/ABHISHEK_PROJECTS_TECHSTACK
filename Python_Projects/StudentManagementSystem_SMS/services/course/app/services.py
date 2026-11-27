from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import CourseStatus, TeacherRole
from app.models import Category, Course, CourseFile, CourseTeacher, OutboxEvent
from app.repositories import CategoryRepository, CourseRepository, FileRepository
from app.schemas import (
    CategoryCreate, CategoryPatch, CourseCreate, CoursePatch, CourseReplace, FilePatch,
)
from sms_common.errors import (
    BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnprocessableError,
)
from sms_common.events import CoursePayload, EventType, Topics
from sms_common.http_client import ServiceClient
from sms_common.outbox import enqueue_event
from sms_common.security import CurrentUser, Role
from sms_common.storage import COURSE_DOC_POLICY, FileStorage

log = logging.getLogger(__name__)
SOURCE = "course-service"


class CourseService:
    def __init__(self, session: AsyncSession, auth_client: ServiceClient, storage: FileStorage) -> None:
        self.session = session
        self.auth = auth_client
        self.storage = storage
        self.courses = CourseRepository(session)
        self.categories = CategoryRepository(session)
        self.files = FileRepository(session)

    # ------------------------------------------------------------------ helpers
    def _emit(self, course: Course, event_type: EventType) -> None:
        enqueue_event(
            self.session, OutboxEvent, topic=Topics.COURSE, event_type=event_type.value,
            payload=CoursePayload(
                course_id=course.id, code=course.code, title=course.title, credits=course.credits,
                status=course.status.value, capacity=course.capacity,
                category=course.category.name if course.category else None,
            ).model_dump(), source=SOURCE, key=str(course.id),
        )

    async def _check_category(self, category_id: int | None) -> None:
        if category_id is not None and await self.categories.get(category_id) is None:
            raise UnprocessableError(f"Category {category_id} does not exist")

    async def _authorize_modify(self, course: Course, user: CurrentUser) -> None:
        """ADMIN: always.  TEACHER: only courses they created or teach."""
        if user.is_admin:
            return
        if course.created_by == user.id or await self.courses.is_teacher_of(course.id, user.id):
            return
        raise ForbiddenError("Teachers may only modify courses they created or teach")

    # ------------------------------------------------------------------- courses
    async def get(self, course_id: int) -> Course:
        course = await self.courses.get(course_id)
        if course is None:
            raise NotFoundError(f"Course {course_id} not found")
        return course

    async def create(self, data: CourseCreate, user: CurrentUser) -> Course:
        if await self.courses.code_taken(data.code):
            raise ConflictError(f"Course code {data.code} already exists")
        await self._check_category(data.category_id)
        course = Course(**data.model_dump(), created_by=user.id)
        self.courses.add(course)
        await self.session.flush()
        self._emit(await self.get(course.id), EventType.COURSE_CREATED)
        await self.session.commit()
        return await self.get(course.id)

    async def replace(self, course_id: int, data: CourseReplace, user: CurrentUser) -> Course:
        course = await self.get(course_id)
        await self._authorize_modify(course, user)
        await self._check_category(data.category_id)
        if data.capacity < course.enrolled_count:
            raise ConflictError(f"Capacity cannot drop below the {course.enrolled_count} enrolled students")
        for k, v in data.model_dump().items():
            setattr(course, k, v)
        await self.session.flush()
        await self.session.refresh(course, ["category"])
        self._emit(course, EventType.COURSE_UPDATED)
        await self.session.commit()
        return await self.get(course_id)

    async def patch(self, course_id: int, data: CoursePatch, user: CurrentUser) -> Course:
        course = await self.get(course_id)
        await self._authorize_modify(course, user)
        changes = data.model_dump(exclude_unset=True)
        if "category_id" in changes:
            await self._check_category(changes["category_id"])
        if "capacity" in changes and changes["capacity"] < course.enrolled_count:
            raise ConflictError(f"Capacity cannot drop below the {course.enrolled_count} enrolled students")
        start = changes.get("start_date", course.start_date)
        end = changes.get("end_date", course.end_date)
        if start and end and end < start:
            raise UnprocessableError("end_date must not be before start_date")
        for k, v in changes.items():
            setattr(course, k, v)
        await self.session.flush()
        await self.session.refresh(course, ["category"])
        self._emit(course, EventType.COURSE_UPDATED)
        await self.session.commit()
        return await self.get(course_id)

    async def set_availability(self, course_id: int, status: CourseStatus, user: CurrentUser) -> Course:
        course = await self.get(course_id)
        await self._authorize_modify(course, user)
        course.status = status
        await self.session.flush()
        self._emit(course, EventType.COURSE_UPDATED)
        await self.session.commit()
        return await self.get(course_id)

    async def delete(self, course_id: int) -> list[str]:
        course = await self.get(course_id)
        if course.enrolled_count > 0:
            raise ConflictError(f"Course has {course.enrolled_count} enrolled students; archive it instead")
        keys = await self.files.keys_for_course(course_id)
        await self.courses.delete(course)
        await self.session.commit()
        return keys

    # ---------------------------------------------------------------- categories
    async def create_category(self, data: CategoryCreate) -> Category:
        if await self.categories.by_name(data.name):
            raise ConflictError(f"Category '{data.name}' already exists")
        cat = Category(**data.model_dump())
        self.categories.add(cat)
        await self.session.commit()
        return cat

    async def patch_category(self, cat_id: int, data: CategoryPatch) -> Category:
        cat = await self.categories.get(cat_id)
        if cat is None:
            raise NotFoundError(f"Category {cat_id} not found")
        changes = data.model_dump(exclude_unset=True)
        if "name" in changes and changes["name"] != cat.name and await self.categories.by_name(changes["name"]):
            raise ConflictError(f"Category '{changes['name']}' already exists")
        for k, v in changes.items():
            setattr(cat, k, v)
        await self.session.commit()
        return cat

    async def delete_category(self, cat_id: int) -> None:
        cat = await self.categories.get(cat_id)
        if cat is None:
            raise NotFoundError(f"Category {cat_id} not found")
        if await self.categories.course_count(cat_id):
            raise ConflictError("Category still contains courses")
        await self.categories.delete(cat)
        await self.session.commit()

    # ------------------------------------------------------------------ teachers
    async def assign_teacher(self, course_id: int, teacher_id: int, role: TeacherRole,
                             admin: CurrentUser) -> Course:
        """Synchronous REST call to the Auth service to validate the teacher."""
        course = await self.get(course_id)
        info = await self.auth.get_json(f"/api/v1/users/{teacher_id}", token=admin.token)
        if "TEACHER" not in info.get("roles", []):
            raise UnprocessableError(f"User {teacher_id} does not have the TEACHER role")
        if not info.get("is_active", False):
            raise UnprocessableError(f"User {teacher_id} is deactivated")
        link = await self.courses.teacher(course_id, teacher_id)
        if link is None:
            course.teachers.append(CourseTeacher(
                teacher_user_id=teacher_id, teacher_name=info["full_name"],
                teacher_email=info["email"], role=role))
        else:
            link.role, link.teacher_name, link.teacher_email = role, info["full_name"], info["email"]
        await self.session.commit()
        return await self.get(course_id)

    async def unassign_teacher(self, course_id: int, teacher_id: int) -> None:
        link = await self.courses.teacher(course_id, teacher_id)
        if link is None:
            raise NotFoundError(f"Teacher {teacher_id} is not assigned to course {course_id}")
        await self.session.delete(link)
        await self.session.commit()

    # --------------------------------------------------------------------- files
    async def upload_document(self, course_id: int, upload: UploadFile, doc_type: str | None,
                              description: str | None, user: CurrentUser) -> CourseFile:
        course = await self.get(course_id)
        await self._authorize_modify(course, user)
        stored, ctype = await self.storage.save(f"courses/{course_id}", upload, COURSE_DOC_POLICY)
        try:
            rec = CourseFile(
                course_id=course_id, doc_type=doc_type, description=description,
                original_name=(os.path.basename(upload.filename or "file") or "file")[:255],
                stored_key=stored.key, content_type=ctype, size_bytes=stored.size,
                sha256=stored.sha256, uploaded_by=user.id)
            self.files.add(rec)
            await self.session.commit()
            await self.session.refresh(rec)  # load server-generated created_at
        except BaseException:
            await self.session.rollback()
            await self.storage.delete(stored.key)
            raise
        return rec

    async def list_documents(self, course_id: int) -> list[CourseFile]:
        await self.get(course_id)
        return await self.files.list(course_id)

    async def get_document(self, course_id: int, file_id: int) -> CourseFile:
        f = await self.files.get(course_id, file_id)
        if f is None:
            raise NotFoundError(f"File {file_id} not found")
        return f

    async def patch_document(self, course_id: int, file_id: int, data: FilePatch, user: CurrentUser) -> CourseFile:
        course = await self.get(course_id)
        await self._authorize_modify(course, user)
        f = await self.get_document(course_id, file_id)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(f, k, v)
        await self.session.commit()
        return f

    async def delete_document(self, course_id: int, file_id: int, user: CurrentUser) -> None:
        course = await self.get(course_id)
        await self._authorize_modify(course, user)
        f = await self.get_document(course_id, file_id)
        key = f.stored_key
        await self.files.delete(f)
        await self.session.commit()
        await self.storage.delete(key)

    def stream(self, f: CourseFile) -> AsyncIterator[bytes]:
        return self.storage.open(f.stored_key)


__all__ = ["CourseService", "BadRequestError", "Role"]
