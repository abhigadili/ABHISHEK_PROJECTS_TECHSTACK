from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Enrollment, EnrollmentStatus, OutboxEvent
from app.repositories import EnrollmentRepository
from app.schemas import EnrollmentCreate, EnrollmentPatch, EnrollmentStats, CourseEnrollmentStat
from sms_common.db import Database, named_lock
from sms_common.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from sms_common.events import EnrollmentPayload, EventType, Topics
from sms_common.http_client import ServiceClient
from sms_common.outbox import enqueue_event
from sms_common.security import CurrentUser
from sms_common.timeutil import utcnow

log = logging.getLogger(__name__)
SOURCE = "enrollment-service"


def build_payload(e: Enrollment, reason: str | None = None, actor: int | None = None) -> dict[str, Any]:
    return EnrollmentPayload(
        enrollment_id=e.id, student_id=e.student_id, student_user_id=e.student_user_id,
        student_name=e.student_name, student_email=e.student_email, course_id=e.course_id,
        course_code=e.course_code, course_title=e.course_title, status=e.status.value,
        reason=reason, actor_user_id=actor,
    ).model_dump()


def emit(session: AsyncSession, e: Enrollment, event_type: EventType,
         reason: str | None = None, actor: int | None = None) -> None:
    enqueue_event(session, OutboxEvent, topic=Topics.ENROLLMENT, event_type=event_type.value,
                  payload=build_payload(e, reason, actor), source=SOURCE, key=str(e.course_id))


class EnrollmentService:
    def __init__(self, session: AsyncSession, db: Database, students: ServiceClient,
                 courses: ServiceClient) -> None:
        self.session = session
        self.db = db
        self.students = students
        self.courses = courses
        self.repo = EnrollmentRepository(session)

    # ------------------------------------------------------------------ queries
    async def get(self, enrollment_id: int, user: CurrentUser, *, history: bool = False) -> Enrollment:
        e = await self.repo.get(enrollment_id, history=history)
        if e is None:
            raise NotFoundError(f"Enrollment {enrollment_id} not found")
        self._authorize_view(e, user)
        return e

    @staticmethod
    def _authorize_view(e: Enrollment, user: CurrentUser) -> None:
        if not user.is_staff and e.student_user_id != user.id:
            raise ForbiddenError("You may only access your own enrollments")

    # ----------------------------------------------------------------- commands
    async def enroll(self, data: EnrollmentCreate, user: CurrentUser) -> Enrollment:
        # 1) Validate student + course through the other services *concurrently* (REST).
        if user.is_staff:
            if data.student_id is None:
                raise BadRequestError("student_id is required when enrolling on behalf of a student")
            student_path = f"/api/v1/students/{data.student_id}"
        else:
            if data.student_id is not None:
                pass  # verified below: it must resolve to the caller's own record
            student_path = "/api/v1/students/me"
        student, course = await asyncio.gather(
            self.students.get_json(student_path, token=user.token),
            self.courses.get_json(f"/api/v1/courses/{data.course_id}", token=user.token),
        )
        if not user.is_staff and data.student_id not in (None, student["id"]):
            raise ForbiddenError("Students may only enroll themselves")
        if student["status"] != "ACTIVE":
            raise ConflictError(f"Student is {student['status']} and cannot enroll")
        if not course["is_available"]:
            raise ConflictError(f"Course {course['code']} is not available "
                                f"(status={course['status']}, free seats={course['available_seats']})")

        # 2) Serialise concurrent enrollments for the same course: capacity check + insert
        #    happen under a MySQL named lock so two requests cannot both take the last seat.
        async with named_lock(self.db.async_engine, f"sms:enroll:course:{course['id']}"):  # type: ignore[arg-type]
            existing = await self.repo.find(student["id"], course["id"])
            if existing and existing.status is not EnrollmentStatus.CANCELLED:
                raise ConflictError(f"Student is already {existing.status.value.lower()} in {course['code']}")
            if await self.repo.active_count(course["id"]) >= course["capacity"]:
                raise ConflictError(f"Course {course['code']} is full")
            now = utcnow()
            if existing:  # re-enrolment after cancellation reuses the row (unique constraint)
                prev = existing.status.value
                enrollment = existing
                enrollment.status = EnrollmentStatus.ENROLLED
                enrollment.cancelled_at, enrollment.cancel_reason, enrollment.enrolled_at = None, None, now
                enrollment.grade = None
                self.repo.add_history(enrollment, prev, "ENROLLED", user.id, "re-enrolled")
            else:
                enrollment = Enrollment(student_id=student["id"], course_id=course["id"])
                self.repo.add(enrollment)
                self.repo.add_history(enrollment, None, "ENROLLED", user.id, "enrolled")
            enrollment.student_user_id = student.get("user_id")
            enrollment.student_number = student["student_number"]
            enrollment.student_name = f"{student['first_name']} {student['last_name']}"
            enrollment.student_email = student["email"]
            enrollment.course_code, enrollment.course_title = course["code"], course["title"]
            enrollment.course_credits = course["credits"]
            enrollment.notes = data.notes or enrollment.notes
            await self.session.flush()
            emit(self.session, enrollment, EventType.STUDENT_ENROLLED, actor=user.id)
            await self.session.commit()
        return await self.repo.reload(enrollment.id)

    async def cancel(self, enrollment_id: int, user: CurrentUser, reason: str | None) -> Enrollment:
        e = await self.get(enrollment_id, user, history=True)
        if e.status is not EnrollmentStatus.ENROLLED:
            raise ConflictError(f"Only ENROLLED enrollments can be cancelled (current: {e.status.value})")
        self._mark_cancelled(e, reason or "cancelled by user", user.id)
        emit(self.session, e, EventType.ENROLLMENT_CANCELLED, e.cancel_reason, user.id)
        await self.session.commit()
        return await self.repo.reload(enrollment_id)

    def _mark_cancelled(self, e: Enrollment, reason: str, by: int | None) -> None:
        self.repo.add_history(e, e.status.value, "CANCELLED", by, reason)
        e.status = EnrollmentStatus.CANCELLED
        e.cancelled_at = utcnow()
        e.cancel_reason = reason

    async def patch(self, enrollment_id: int, data: EnrollmentPatch, user: CurrentUser) -> Enrollment:
        e = await self.get(enrollment_id, user, history=True)
        if e.status is EnrollmentStatus.CANCELLED:
            raise ConflictError("A cancelled enrollment cannot be modified; enroll again instead")
        changes = data.model_dump(exclude_unset=True)
        new_status = changes.pop("status", None)
        for k, v in changes.items():
            setattr(e, k, v)
        if new_status and new_status != e.status.value:
            if new_status == "COMPLETED" and not e.grade:
                raise UnprocessableError("A grade is required to complete an enrollment")
            self.repo.add_history(e, e.status.value, new_status, user.id)
            e.status = EnrollmentStatus(new_status)
            e.completed_at = utcnow() if new_status == "COMPLETED" else None
        await self.session.commit()
        return await self.repo.reload(enrollment_id)

    async def delete(self, enrollment_id: int, user: CurrentUser) -> None:
        e = await self.get(enrollment_id, user)
        if e.status is EnrollmentStatus.ENROLLED:  # free the seat everywhere before removing the row
            e.status = EnrollmentStatus.CANCELLED
            emit(self.session, e, EventType.ENROLLMENT_CANCELLED, "enrollment deleted", user.id)
        await self.repo.delete(e)
        await self.session.commit()

    # ---------------------------------------------------------------- reporting
    async def stats(self) -> EnrollmentStats:
        by_status = await self.repo.status_counts()
        courses = await self.repo.per_course()
        return EnrollmentStats(
            total=sum(by_status.values()), by_status=by_status,
            by_course=[CourseEnrollmentStat(course_id=c, course_code=code, active=a, completed=d, cancelled=x)
                       for c, code, a, d, x in courses],
            students_with_multiple_active=await self.repo.students_with_multiple_active(),
        )
