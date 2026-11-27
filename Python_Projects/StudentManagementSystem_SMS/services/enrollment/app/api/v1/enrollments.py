from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.deps import AdminOnly, Reader, ServiceDep, StaffReader, StaffWriter, Writer
from app.models import EnrollmentStatus
from app.schemas import (
    CancelRequest, EnrollmentCreate, EnrollmentDetail, EnrollmentPatch, EnrollmentRead,
    EnrollmentStats, HistoryRead,
)
from sms_common.pagination import Page, PageParamsDep

router = APIRouter(prefix="/enrollments", tags=["Enrollments"])


@router.post("", response_model=EnrollmentRead, status_code=status.HTTP_201_CREATED,
             summary="Enroll a student in a course")
async def enroll(body: EnrollmentCreate, user: Writer, svc: ServiceDep) -> EnrollmentRead:
    """Validates the student (Student service) and the course (Course service) over REST,
    rejects duplicates / full / unavailable courses, then publishes ``StudentEnrolled``."""
    return EnrollmentRead.model_validate(await svc.enroll(body, user))


@router.get("", response_model=Page[EnrollmentRead], summary="List enrollments (staff)")
async def list_enrollments(
    _: StaffReader, svc: ServiceDep, params: PageParamsDep,
    student_id: int | None = None, course_id: int | None = None,
    status_: Annotated[EnrollmentStatus | None, Query(alias="status")] = None,
) -> Page[EnrollmentRead]:
    rows, total = await svc.repo.page(
        svc.repo.filtered(student_id=student_id, course_id=course_id, status=status_), params)
    return Page.build([EnrollmentRead.model_validate(r) for r in rows], total, params)


@router.get("/me", response_model=Page[EnrollmentRead], summary="My enrollments")
async def my_enrollments(user: Reader, svc: ServiceDep, params: PageParamsDep,
                         status_: Annotated[EnrollmentStatus | None, Query(alias="status")] = None
                         ) -> Page[EnrollmentRead]:
    rows, total = await svc.repo.page(svc.repo.filtered(user_id=user.id, status=status_), params)
    return Page.build([EnrollmentRead.model_validate(r) for r in rows], total, params)


@router.get("/stats", response_model=EnrollmentStats, summary="Enrollment statistics (staff)")
async def stats(_: StaffReader, svc: ServiceDep) -> EnrollmentStats:
    return await svc.stats()


@router.get("/students/{student_id}", response_model=Page[EnrollmentRead],
            summary="Enrollments of one student (staff, or the student themself)")
async def by_student(student_id: int, user: Reader, svc: ServiceDep, params: PageParamsDep) -> Page[EnrollmentRead]:
    stmt = svc.repo.filtered(student_id=student_id, user_id=None if user.is_staff else user.id)
    rows, total = await svc.repo.page(stmt, params)
    return Page.build([EnrollmentRead.model_validate(r) for r in rows], total, params)


@router.get("/courses/{course_id}", response_model=Page[EnrollmentRead], summary="Enrollments of one course (staff)")
async def by_course(course_id: int, _: StaffReader, svc: ServiceDep, params: PageParamsDep,
                    status_: Annotated[EnrollmentStatus | None, Query(alias="status")] = None
                    ) -> Page[EnrollmentRead]:
    rows, total = await svc.repo.page(svc.repo.filtered(course_id=course_id, status=status_), params)
    return Page.build([EnrollmentRead.model_validate(r) for r in rows], total, params)


@router.get("/{enrollment_id}", response_model=EnrollmentDetail, summary="Get an enrollment with its history")
async def get_enrollment(enrollment_id: int, user: Reader, svc: ServiceDep) -> EnrollmentDetail:
    return EnrollmentDetail.model_validate(await svc.get(enrollment_id, user, history=True))


@router.get("/{enrollment_id}/history", response_model=list[HistoryRead], summary="Status history")
async def history(enrollment_id: int, user: Reader, svc: ServiceDep) -> list[HistoryRead]:
    e = await svc.get(enrollment_id, user, history=True)
    return [HistoryRead.model_validate(h) for h in e.history]


@router.patch("/{enrollment_id}", response_model=EnrollmentDetail, summary="Update grade / notes / status (staff)")
async def patch_enrollment(enrollment_id: int, body: EnrollmentPatch, user: StaffWriter,
                           svc: ServiceDep) -> EnrollmentDetail:
    return EnrollmentDetail.model_validate(await svc.patch(enrollment_id, body, user))


@router.post("/{enrollment_id}/cancel", response_model=EnrollmentDetail, summary="Cancel an enrollment")
async def cancel(enrollment_id: int, user: Writer, svc: ServiceDep,
                 body: CancelRequest | None = None) -> EnrollmentDetail:
    return EnrollmentDetail.model_validate(await svc.cancel(enrollment_id, user, body.reason if body else None))


@router.delete("/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Hard-delete (admin)")
async def delete_enrollment(enrollment_id: int, user: AdminOnly, svc: ServiceDep) -> Response:
    await svc.delete(enrollment_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
