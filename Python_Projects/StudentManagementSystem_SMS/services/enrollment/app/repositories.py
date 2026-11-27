from __future__ import annotations

from typing import Any, Sequence

from sqlalchemy import Select, case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Enrollment, EnrollmentStatus, EnrollmentStatusHistory
from sms_common.pagination import PageParams, apply_sort, count_for

SORTABLE: dict[str, Any] = {
    "id": Enrollment.id, "enrolled_at": Enrollment.enrolled_at, "student_name": Enrollment.student_name,
    "course_code": Enrollment.course_code, "status": Enrollment.status, "grade": Enrollment.grade,
}


class EnrollmentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def get(self, enrollment_id: int, *, history: bool = False) -> Enrollment | None:
        stmt = select(Enrollment).where(Enrollment.id == enrollment_id)
        if history:
            stmt = stmt.options(selectinload(Enrollment.history))
        return (await self.s.execute(stmt)).scalar_one_or_none()

    async def reload(self, enrollment_id: int) -> Enrollment:
        """Re-read after commit so server-generated columns and history are loaded
        (lazy loading is impossible once serialisation happens outside the greenlet)."""
        self.s.expire_all()  # drop stale state (incl. new history rows with server defaults)
        stmt = select(Enrollment).where(Enrollment.id == enrollment_id).options(selectinload(Enrollment.history))
        return (await self.s.execute(stmt)).scalar_one()

    async def find(self, student_id: int, course_id: int) -> Enrollment | None:
        return (await self.s.execute(select(Enrollment).where(
            Enrollment.student_id == student_id, Enrollment.course_id == course_id
        ).options(selectinload(Enrollment.history)).with_for_update())).scalar_one_or_none()

    async def active_count(self, course_id: int) -> int:
        return int((await self.s.execute(select(func.count()).select_from(Enrollment).where(
            Enrollment.course_id == course_id, Enrollment.status == EnrollmentStatus.ENROLLED))).scalar_one())

    def add(self, e: Enrollment) -> None:
        self.s.add(e)

    async def delete(self, e: Enrollment) -> None:
        await self.s.delete(e)
        await self.s.flush()

    def add_history(self, e: Enrollment, from_status: str | None, to_status: str,
                    by: int | None, note: str | None = None) -> None:
        e.history.append(EnrollmentStatusHistory(
            from_status=from_status, to_status=to_status, changed_by=by, note=note))

    def filtered(self, *, student_id: int | None = None, course_id: int | None = None,
                 status: EnrollmentStatus | None = None, user_id: int | None = None) -> Select[tuple[Enrollment]]:
        stmt = select(Enrollment)
        if student_id:
            stmt = stmt.where(Enrollment.student_id == student_id)
        if course_id:
            stmt = stmt.where(Enrollment.course_id == course_id)
        if status:
            stmt = stmt.where(Enrollment.status == status)
        if user_id:
            stmt = stmt.where(Enrollment.student_user_id == user_id)
        return stmt

    async def page(self, stmt: Select[tuple[Enrollment]], params: PageParams) -> tuple[list[Enrollment], int]:
        total = await count_for(self.s, stmt)
        stmt = apply_sort(stmt, params, SORTABLE, "id").limit(params.size).offset(params.offset)
        return list((await self.s.execute(stmt)).scalars().all()), total

    async def active_for_student(self, student_id: int) -> Sequence[Enrollment]:
        return (await self.s.execute(select(Enrollment).where(
            Enrollment.student_id == student_id, Enrollment.status == EnrollmentStatus.ENROLLED)
            .options(selectinload(Enrollment.history)).with_for_update())).scalars().all()

    async def refresh_student_snapshot(self, student_id: int, **values: Any) -> None:
        await self.s.execute(update(Enrollment).where(Enrollment.student_id == student_id).values(**values))

    async def refresh_course_snapshot(self, course_id: int, **values: Any) -> None:
        await self.s.execute(update(Enrollment).where(Enrollment.course_id == course_id).values(**values))

    # ----------------------------------------------------------- reporting
    async def status_counts(self) -> dict[str, int]:
        rows = await self.s.execute(select(Enrollment.status, func.count()).group_by(Enrollment.status))
        out = {s.value: 0 for s in EnrollmentStatus}
        out.update({k.value: n for k, n in rows})
        return out

    async def per_course(self, limit: int = 10) -> list[tuple[int, str, int, int, int]]:
        """Conditional aggregation: one pass, three counters per course."""
        def cnt(st: EnrollmentStatus):  # noqa: ANN202
            return func.sum(case((Enrollment.status == st, 1), else_=0))
        stmt = (select(Enrollment.course_id, func.max(Enrollment.course_code),
                       cnt(EnrollmentStatus.ENROLLED), cnt(EnrollmentStatus.COMPLETED),
                       cnt(EnrollmentStatus.CANCELLED))
                .group_by(Enrollment.course_id).order_by(cnt(EnrollmentStatus.ENROLLED).desc()).limit(limit))
        return [(c, code, int(a or 0), int(d or 0), int(x or 0)) for c, code, a, d, x in (await self.s.execute(stmt))]

    async def students_with_multiple_active(self) -> int:
        """Subquery in FROM: students holding more than one active enrollment."""
        sub = (select(Enrollment.student_id).where(Enrollment.status == EnrollmentStatus.ENROLLED)
               .group_by(Enrollment.student_id).having(func.count() > 1).subquery())
        return int((await self.s.execute(select(func.count()).select_from(sub))).scalar_one())
