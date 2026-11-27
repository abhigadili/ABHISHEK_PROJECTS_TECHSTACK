from __future__ import annotations

from datetime import date
from typing import Any, Sequence

from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.enums import CourseStatus
from app.models import Category, Course, CourseFile, CourseTeacher
from sms_common.pagination import PageParams, apply_sort, count_for

DETAIL = (joinedload(Course.category), selectinload(Course.teachers))
LIST = (joinedload(Course.category),)

SORTABLE: dict[str, Any] = {
    "id": Course.id, "code": Course.code, "title": Course.title, "credits": Course.credits,
    "duration_weeks": Course.duration_weeks, "capacity": Course.capacity,
    "enrolled_count": Course.enrolled_count, "start_date": Course.start_date,
    "created_at": Course.created_at,
}


class CourseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def get(self, course_id: int, *, detail: bool = True) -> Course | None:
        stmt = select(Course).where(Course.id == course_id)
        if detail:
            stmt = stmt.options(*DETAIL)
        stmt = stmt.execution_options(populate_existing=True)  # never serve stale post-commit state
        return (await self.s.execute(stmt)).unique().scalar_one_or_none()

    async def code_taken(self, code: str) -> bool:
        return (await self.s.execute(select(func.count()).select_from(Course).where(Course.code == code))).scalar_one() > 0

    def add(self, course: Course) -> None:
        self.s.add(course)

    async def delete(self, course: Course) -> None:
        await self.s.delete(course)
        await self.s.flush()

    def filtered(
        self, *, q: str | None, category_id: int | None, status: CourseStatus | None,
        teacher_id: int | None, min_credits: int | None, max_credits: int | None,
        available_only: bool, starts_after: date | None,
    ) -> Select[tuple[Course]]:
        stmt = select(Course)
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(or_(Course.code.like(like), Course.title.like(like), Course.description.like(like)))
        if category_id:
            stmt = stmt.where(Course.category_id == category_id)
        if status:
            stmt = stmt.where(Course.status == status)
        if teacher_id:  # correlated EXISTS, avoids duplicate rows a JOIN would create
            stmt = stmt.where(select(CourseTeacher.course_id).where(
                CourseTeacher.course_id == Course.id, CourseTeacher.teacher_user_id == teacher_id).exists())
        if min_credits:
            stmt = stmt.where(Course.credits >= min_credits)
        if max_credits:
            stmt = stmt.where(Course.credits <= max_credits)
        if available_only:
            stmt = stmt.where(Course.status == CourseStatus.OPEN, Course.enrolled_count < Course.capacity,
                              or_(Course.end_date.is_(None), Course.end_date >= date.today()))
        if starts_after:
            stmt = stmt.where(Course.start_date >= starts_after)
        return stmt

    async def page(self, stmt: Select[tuple[Course]], params: PageParams) -> tuple[list[Course], int]:
        total = await count_for(self.s, stmt)
        stmt = apply_sort(stmt, params, SORTABLE, "id").options(*LIST).limit(params.size).offset(params.offset)
        return list((await self.s.execute(stmt)).unique().scalars().all()), total

    async def adjust_enrolled(self, course_id: int, delta: int) -> None:
        await self.s.execute(update(Course).where(Course.id == course_id).values(
            enrolled_count=func.greatest(Course.enrolled_count + delta, 0)))

    async def is_teacher_of(self, course_id: int, user_id: int) -> bool:
        return (await self.s.execute(select(func.count()).select_from(CourseTeacher).where(
            CourseTeacher.course_id == course_id, CourseTeacher.teacher_user_id == user_id))).scalar_one() > 0

    async def teacher(self, course_id: int, user_id: int) -> CourseTeacher | None:
        return await self.s.get(CourseTeacher, (course_id, user_id))  # composite-key lookup


class CategoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def list(self) -> Sequence[Category]:
        return (await self.s.execute(select(Category).order_by(Category.name))).scalars().all()

    async def get(self, cat_id: int) -> Category | None:
        return await self.s.get(Category, cat_id)

    async def by_name(self, name: str) -> Category | None:
        return (await self.s.execute(select(Category).where(Category.name == name))).scalar_one_or_none()

    async def course_count(self, cat_id: int) -> int:
        return int((await self.s.execute(
            select(func.count()).select_from(Course).where(Course.category_id == cat_id))).scalar_one())

    def add(self, c: Category) -> None:
        self.s.add(c)

    async def delete(self, c: Category) -> None:
        await self.s.delete(c)
        await self.s.flush()

    async def list_with_counts(self) -> list[tuple[Category, int]]:
        stmt = (select(Category, func.count(Course.id)).outerjoin(Course, Course.category_id == Category.id)
                .group_by(Category.id).order_by(Category.name))
        return [(c, int(n)) for c, n in (await self.s.execute(stmt)).all()]


class FileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def get(self, course_id: int, file_id: int) -> CourseFile | None:
        return (await self.s.execute(select(CourseFile).where(
            CourseFile.id == file_id, CourseFile.course_id == course_id))).scalar_one_or_none()

    async def list(self, course_id: int) -> list[CourseFile]:
        return list((await self.s.execute(select(CourseFile).where(
            CourseFile.course_id == course_id).order_by(CourseFile.id.desc()))).scalars())

    async def keys_for_course(self, course_id: int) -> list[str]:
        return list((await self.s.execute(
            select(CourseFile.stored_key).where(CourseFile.course_id == course_id))).scalars())

    def add(self, f: CourseFile) -> None:
        self.s.add(f)

    async def delete(self, f: CourseFile) -> None:
        await self.s.delete(f)
        await self.s.flush()
