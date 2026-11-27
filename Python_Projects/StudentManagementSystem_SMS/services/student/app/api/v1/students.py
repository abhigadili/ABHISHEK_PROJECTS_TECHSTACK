from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import aliased

from app.deps import (
    AdminOnly, CurrentUserDep, SelfService, StaffReader, StaffWriter, StudentServiceDep,
    SyncSessionDep,
)
from app.enums import StudentStatus
from app.file_service import StudentFileService  # noqa: F401  (documented dependency)
from app.models import Department, Student
from app.schemas import (
    BulkImport, BulkResult, BulkStatusUpdate, ContactIn, DepartmentStat, InterestsReplace,
    StudentCreate, StudentPatch, StudentRead, StudentReplace, StudentSelfPatch, StudentStats,
    StudentSummary,
)
from sms_common.errors import ForbiddenError
from sms_common.pagination import Page, PageParamsDep

router = APIRouter(prefix="/students", tags=["Students"])


# NOTE: fixed paths (/me, /stats, /bulk...) are declared BEFORE /{student_id} so they win the match.
@router.get("", response_model=Page[StudentSummary], summary="List/search students (paginated)")
async def list_students(
    _: StaffReader, svc: StudentServiceDep, params: PageParamsDep,
    q: Annotated[str | None, Query(description="Name, e-mail or student number")] = None,
    department: Annotated[str | None, Query(description="Department code, e.g. CS")] = None,
    status_: Annotated[StudentStatus | None, Query(alias="status")] = None,
    gender: str | None = None,
    admitted_year: Annotated[int | None, Query(ge=1950, le=2100)] = None,
    min_gpa: Annotated[Decimal | None, Query(ge=0, le=4)] = None,
    max_gpa: Annotated[Decimal | None, Query(ge=0, le=4)] = None,
    has_enrollments: bool | None = None,
) -> Page[StudentSummary]:
    stmt = svc.students.filtered(
        q=q, department=department, status=status_, gender=gender, admitted_year=admitted_year,
        min_gpa=min_gpa, max_gpa=max_gpa, has_enrollments=has_enrollments,
    )
    rows, total = await svc.students.page(stmt, params)
    return Page.build([StudentSummary.model_validate(r) for r in rows], total, params)


@router.post("", response_model=StudentRead, status_code=status.HTTP_201_CREATED,
             summary="Create a student (with profile, contacts, interests)")
async def create_student(body: StudentCreate, _: StaffWriter, svc: StudentServiceDep) -> StudentRead:
    return StudentRead.model_validate(await svc.create(body))


@router.get("/me", response_model=StudentRead, summary="My own student record")
async def my_record(user: SelfService, svc: StudentServiceDep) -> StudentRead:
    return StudentRead.model_validate(await svc.get_for_user(user.id))


@router.patch("/me", response_model=StudentRead, summary="Update my own profile (limited fields)")
async def patch_my_record(body: StudentSelfPatch, user: SelfService, svc: StudentServiceDep) -> StudentRead:
    return StudentRead.model_validate(await svc.self_patch(user, body))


@router.get("/stats", response_model=StudentStats,
            summary="Aggregate report (synchronous endpoint + sync SQLAlchemy session)")
def stats(_: StaffReader, session: SyncSessionDep) -> StudentStats:
    """A plain ``def`` handler: FastAPI runs it in its threadpool so the blocking
    PyMySQL calls never stall the event loop.  Demonstrates aggregation, outer
    join and a correlated subquery."""
    total = session.execute(select(func.count()).select_from(Student)).scalar_one()
    by_status = {s.value: 0 for s in StudentStatus}
    by_status.update({
        (k.value if hasattr(k, "value") else str(k)): c
        for k, c in session.execute(select(Student.status, func.count()).group_by(Student.status))
    })
    dept_rows = session.execute(
        select(Department.name, func.count(Student.id), func.avg(Student.gpa))
        .outerjoin(Student, Student.department_id == Department.id)
        .group_by(Department.id).order_by(func.count(Student.id).desc(), Department.name)
    ).all()
    # correlated subquery: students whose GPA beats their own department's average
    s2 = aliased(Student)
    dept_avg = (
        select(func.avg(s2.gpa)).where(s2.department_id == Student.department_id).correlate(Student)
        .scalar_subquery()
    )
    above = session.execute(
        select(func.count()).select_from(Student).where(Student.gpa.is_not(None), Student.gpa > dept_avg)
    ).scalar_one()
    return StudentStats(
        total=total, by_status=by_status,
        by_department=[DepartmentStat(department=n, students=c, avg_gpa=float(a) if a is not None else None)
                       for n, c, a in dept_rows],
        above_department_average_gpa=above,
        largest_department=dept_rows[0][0] if dept_rows and dept_rows[0][1] else None,
    )


@router.post("/bulk", response_model=list[StudentSummary], status_code=status.HTTP_201_CREATED,
             summary="Bulk import (single transaction, all-or-nothing)")
async def bulk_import(body: BulkImport, _: AdminOnly, svc: StudentServiceDep) -> list[StudentSummary]:
    return [StudentSummary.model_validate(s) for s in await svc.bulk_import(body.students)]


@router.patch("/bulk/status", response_model=BulkResult, summary="Bulk status change (one UPDATE)")
async def bulk_status(body: BulkStatusUpdate, _: AdminOnly, svc: StudentServiceDep) -> BulkResult:
    return BulkResult(affected=await svc.bulk_status(body.ids, body.status))


@router.get("/{student_id}", response_model=StudentRead, summary="Get a student")
async def get_student(student_id: int, user: CurrentUserDep, svc: StudentServiceDep) -> StudentRead:
    student = await svc.get(student_id)
    if not user.is_staff and student.user_id != user.id:
        raise ForbiddenError("You may only view your own student record")
    return StudentRead.model_validate(student)


@router.put("/{student_id}", response_model=StudentRead, summary="Replace a student (full update)")
async def replace_student(student_id: int, body: StudentReplace, _: StaffWriter,
                          svc: StudentServiceDep) -> StudentRead:
    return StudentRead.model_validate(await svc.replace(student_id, body))


@router.patch("/{student_id}", response_model=StudentRead, summary="Partially update a student")
async def patch_student(student_id: int, body: StudentPatch, _: StaffWriter,
                        svc: StudentServiceDep) -> StudentRead:
    return StudentRead.model_validate(await svc.patch(student_id, body))


@router.post("/{student_id}/contacts", response_model=StudentRead, status_code=status.HTTP_201_CREATED,
             summary="Add a contact")
async def add_contact(student_id: int, body: ContactIn, _: StaffWriter, svc: StudentServiceDep) -> StudentRead:
    return StudentRead.model_validate(await svc.add_contact(student_id, body))


@router.delete("/{student_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Remove a contact")
async def remove_contact(student_id: int, contact_id: int, _: StaffWriter, svc: StudentServiceDep) -> Response:
    await svc.remove_contact(student_id, contact_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{student_id}/interests", response_model=StudentRead, summary="Replace interests (many-to-many)")
async def set_interests(student_id: int, body: InterestsReplace, _: StaffWriter,
                        svc: StudentServiceDep) -> StudentRead:
    return StudentRead.model_validate(await svc.set_interests(student_id, body.interests))


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a student")
async def delete_student(student_id: int, _: AdminOnly, svc: StudentServiceDep) -> Response:
    from app.deps import storage

    keys = await svc.delete(student_id)
    for key in keys:  # purge files only after the DB commit succeeded
        await storage.delete(key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
