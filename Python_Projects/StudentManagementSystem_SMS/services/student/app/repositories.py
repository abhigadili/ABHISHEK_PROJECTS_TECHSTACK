"""Async data access for the Student service (SQLAlchemy 2.x select() style)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Sequence

from sqlalchemy import Select, extract, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.enums import FileKind, StudentStatus
from app.models import ContactInfo, Department, Interest, Student, StudentFile
from sms_common.pagination import PageParams, apply_sort, count_for

# Eager-loading bundles.  Detail view: 1 query for the student (+LEFT JOINs for the
# to-one relations) + 2 IN-queries for the collections = 3 queries total, any size.
DETAIL_OPTIONS = (
    joinedload(Student.department),
    joinedload(Student.profile),
    selectinload(Student.contacts),
    selectinload(Student.interests),
)
LIST_OPTIONS = (joinedload(Student.department),)

SORTABLE: dict[str, Any] = {
    "id": Student.id,
    "student_number": Student.student_number,
    "first_name": Student.first_name,
    "last_name": Student.last_name,
    "email": Student.email,
    "gpa": Student.gpa,
    "admission_date": Student.admission_date,
    "created_at": Student.created_at,
    "enrolled_courses_count": Student.enrolled_courses_count,
}


class StudentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def get(self, student_id: int, *, detail: bool = True, for_update: bool = False) -> Student | None:
        stmt = select(Student).where(Student.id == student_id)
        if detail:
            stmt = stmt.options(*DETAIL_OPTIONS)
        if for_update:
            stmt = stmt.with_for_update()
        # populate_existing: after a commit the identity map may hold stale collections
        stmt = stmt.execution_options(populate_existing=True)
        return (await self.s.execute(stmt)).unique().scalar_one_or_none()

    async def get_by_user_id(self, user_id: int) -> Student | None:
        stmt = select(Student).where(Student.user_id == user_id).options(*DETAIL_OPTIONS)
        return (await self.s.execute(stmt)).unique().scalar_one_or_none()

    async def email_taken(self, email: str, exclude_id: int | None = None) -> bool:
        stmt = select(func.count()).select_from(Student).where(Student.email == email)
        if exclude_id:
            stmt = stmt.where(Student.id != exclude_id)
        return (await self.s.execute(stmt)).scalar_one() > 0

    async def emails_taken(self, emails: Sequence[str]) -> set[str]:
        rows = await self.s.execute(select(Student.email).where(Student.email.in_(emails)))
        return set(rows.scalars())

    def add(self, student: Student) -> None:
        self.s.add(student)

    def add_all(self, students: Sequence[Student]) -> None:
        self.s.add_all(students)

    async def delete(self, student: Student) -> None:
        await self.s.delete(student)
        await self.s.flush()

    def filtered(
        self, *, q: str | None, department: str | None, status: StudentStatus | None,
        gender: str | None, admitted_year: int | None, min_gpa: Decimal | None,
        max_gpa: Decimal | None, has_enrollments: bool | None,
    ) -> Select[tuple[Student]]:
        stmt = select(Student)
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(or_(
                Student.first_name.like(like), Student.last_name.like(like),
                Student.email.like(like), Student.student_number.like(like),
                func.concat(Student.first_name, " ", Student.last_name).like(like),
            ))
        if department:
            stmt = stmt.join(Department, Student.department_id == Department.id).where(
                Department.code == department.upper()
            )
        if status:
            stmt = stmt.where(Student.status == status)
        if gender:
            stmt = stmt.where(Student.gender == gender.upper())
        if admitted_year:
            stmt = stmt.where(extract("year", Student.admission_date) == admitted_year)
        if min_gpa is not None:
            stmt = stmt.where(Student.gpa >= min_gpa)
        if max_gpa is not None:
            stmt = stmt.where(Student.gpa <= max_gpa)
        if has_enrollments is True:
            stmt = stmt.where(Student.enrolled_courses_count > 0)
        elif has_enrollments is False:
            stmt = stmt.where(Student.enrolled_courses_count == 0)
        return stmt

    async def page(self, stmt: Select[tuple[Student]], params: PageParams) -> tuple[list[Student], int]:
        total = await count_for(self.s, stmt)
        stmt = apply_sort(stmt, params, SORTABLE, "id").options(*LIST_OPTIONS)
        stmt = stmt.limit(params.size).offset(params.offset)
        rows = (await self.s.execute(stmt)).unique().scalars().all()
        return list(rows), total

    async def bulk_set_status(self, ids: Sequence[int], status: StudentStatus) -> list[Student]:
        """One UPDATE ... WHERE id IN (...) instead of N entity updates."""
        await self.s.execute(
            update(Student).where(Student.id.in_(ids)).values(status=status)
            .execution_options(synchronize_session=False)
        )
        rows = await self.s.execute(
            select(Student).where(Student.id.in_(ids)).options(*LIST_OPTIONS)
            .execution_options(populate_existing=True)
        )
        return list(rows.unique().scalars())

    async def adjust_enrollment_count(self, student_id: int, delta: int) -> None:
        await self.s.execute(
            update(Student).where(Student.id == student_id)
            .values(enrolled_courses_count=func.greatest(Student.enrolled_courses_count + delta, 0))
        )


class DepartmentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def by_code(self, code: str) -> Department | None:
        return (await self.s.execute(select(Department).where(Department.code == code))).scalar_one_or_none()

    async def by_codes(self, codes: set[str]) -> dict[str, Department]:
        rows = await self.s.execute(select(Department).where(Department.code.in_(codes)))
        return {d.code: d for d in rows.scalars()}

    async def list(self) -> list[Department]:
        return list((await self.s.execute(select(Department).order_by(Department.code))).scalars())

    async def get(self, dept_id: int) -> Department | None:
        return await self.s.get(Department, dept_id)

    def add(self, dept: Department) -> None:
        self.s.add(dept)

    async def delete(self, dept: Department) -> None:
        await self.s.delete(dept)
        await self.s.flush()

    async def student_count(self, dept_id: int) -> int:
        return int((await self.s.execute(
            select(func.count()).select_from(Student).where(Student.department_id == dept_id)
        )).scalar_one())


class InterestRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def get_or_create(self, names: Sequence[str]) -> list[Interest]:
        """Fetch existing interests with a single IN query, create the rest."""
        unique = list(dict.fromkeys(n.strip().lower() for n in names if n.strip()))
        if not unique:
            return []
        existing = {i.name: i for i in (await self.s.execute(
            select(Interest).where(Interest.name.in_(unique)))).scalars()}
        for name in unique:
            if name not in existing:
                interest = Interest(name=name)
                self.s.add(interest)
                existing[name] = interest
        await self.s.flush()
        return [existing[n] for n in unique]


class ContactRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def get(self, student_id: int, contact_id: int) -> ContactInfo | None:
        return (await self.s.execute(select(ContactInfo).where(
            ContactInfo.id == contact_id, ContactInfo.student_id == student_id))).scalar_one_or_none()


class FileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def get(self, student_id: int, file_id: int) -> StudentFile | None:
        return (await self.s.execute(select(StudentFile).where(
            StudentFile.id == file_id, StudentFile.student_id == student_id))).scalar_one_or_none()

    async def list(self, student_id: int, kind: FileKind | None = None) -> list[StudentFile]:
        stmt = select(StudentFile).where(StudentFile.student_id == student_id)
        if kind:
            stmt = stmt.where(StudentFile.kind == kind)
        return list((await self.s.execute(stmt.order_by(StudentFile.id.desc()))).scalars())

    async def keys_for_student(self, student_id: int) -> list[str]:
        return list((await self.s.execute(
            select(StudentFile.stored_key).where(StudentFile.student_id == student_id))).scalars())

    def add(self, f: StudentFile) -> None:
        self.s.add(f)

    async def delete(self, f: StudentFile) -> None:
        await self.s.delete(f)
        await self.s.flush()


def current_year() -> int:
    return date.today().year
