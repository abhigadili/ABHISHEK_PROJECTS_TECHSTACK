"""Business logic for students (async).  The service owns the transaction boundary."""

from __future__ import annotations

import logging
import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import StudentStatus
from app.models import ContactInfo, Department, OutboxEvent, Student, StudentProfile
from app.repositories import (
    ContactRepository, DepartmentRepository, InterestRepository, StudentRepository,
)
from app.schemas import (
    ContactIn, DepartmentCreate, StudentCreate, StudentPatch, StudentReplace, StudentSelfPatch,
)
from sms_common.errors import ConflictError, NotFoundError, UnprocessableError
from sms_common.events import EventType, StudentPayload, Topics
from sms_common.outbox import enqueue_event
from sms_common.security import CurrentUser

log = logging.getLogger(__name__)
SOURCE = "student-service"


class StudentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.students = StudentRepository(session)
        self.departments = DepartmentRepository(session)
        self.interests = InterestRepository(session)
        self.contacts = ContactRepository(session)

    # ------------------------------------------------------------------ events
    def _emit(self, student: Student, event_type: EventType, department_code: str | None = None) -> None:
        code = department_code
        if code is None and student.department_id is not None:
            code = student.department.code if student.department else None
        enqueue_event(
            self.session, OutboxEvent, topic=Topics.STUDENT, event_type=event_type.value,
            payload=StudentPayload(
                student_id=student.id, student_number=student.student_number, user_id=student.user_id,
                first_name=student.first_name, last_name=student.last_name, email=student.email,
                status=student.status.value, department_code=code,
            ).model_dump(), source=SOURCE, key=str(student.id),
        )

    # ------------------------------------------------------------------ helpers
    async def _department(self, code: str | None) -> Department | None:
        if not code:
            return None
        dept = await self.departments.by_code(code)
        if dept is None:
            raise UnprocessableError(f"Unknown department code '{code}'")
        return dept

    async def _build(self, data: StudentCreate, dept: Department | None) -> Student:
        student = Student(
            student_number=f"TMP-{uuid.uuid4().hex[:16]}",  # replaced right after the id is known
            user_id=data.user_id, first_name=data.first_name, last_name=data.last_name,
            email=data.email, date_of_birth=data.date_of_birth, gender=data.gender,
            status=data.status, gpa=data.gpa, admission_date=data.admission_date or date.today(),
            department=dept,
        )
        if data.profile:
            student.profile = StudentProfile(**data.profile.model_dump())
        student.contacts = [ContactInfo(**c.model_dump()) for c in data.contacts]
        student.interests = await self.interests.get_or_create(data.interests)
        return student

    @staticmethod
    def _assign_number(student: Student) -> None:
        student.student_number = f"STU{student.admission_date.year}{student.id:06d}"

    # ------------------------------------------------------------------ queries
    async def get(self, student_id: int) -> Student:
        student = await self.students.get(student_id)
        if student is None:
            raise NotFoundError(f"Student {student_id} not found")
        return student

    async def get_for_user(self, user_id: int) -> Student:
        student = await self.students.get_by_user_id(user_id)
        if student is None:
            raise NotFoundError("No student record is linked to your account")
        return student

    # ----------------------------------------------------------------- commands
    async def create(self, data: StudentCreate) -> Student:
        if await self.students.email_taken(data.email):
            raise ConflictError(f"A student with e-mail {data.email} already exists")
        dept = await self._department(data.department_code)
        student = await self._build(data, dept)
        self.students.add(student)
        await self.session.flush()
        self._assign_number(student)
        self._emit(student, EventType.STUDENT_CREATED, dept.code if dept else None)
        await self.session.commit()
        return await self.get(student.id)

    async def replace(self, student_id: int, data: StudentReplace) -> Student:
        student = await self.get(student_id)
        if await self.students.email_taken(data.email, exclude_id=student_id):
            raise ConflictError(f"A student with e-mail {data.email} already exists")
        dept = await self._department(data.department_code)
        for field in ("first_name", "last_name", "email", "date_of_birth", "gender", "status",
                      "gpa", "admission_date"):
            setattr(student, field, getattr(data, field))
        student.department = dept
        await self.session.flush()
        self._emit(student, EventType.STUDENT_UPDATED, dept.code if dept else None)
        await self.session.commit()
        return await self.get(student_id)

    async def patch(self, student_id: int, data: StudentPatch) -> Student:
        student = await self.get(student_id)
        changes = data.model_dump(exclude_unset=True)
        profile_changes = changes.pop("profile", None)
        dept_code_given = "department_code" in changes
        dept_code = changes.pop("department_code", None)
        if "email" in changes and await self.students.email_taken(changes["email"], exclude_id=student_id):
            raise ConflictError(f"A student with e-mail {changes['email']} already exists")
        for k, v in changes.items():
            setattr(student, k, v)
        if dept_code_given:
            student.department = await self._department(dept_code)
        if profile_changes is not None:
            self._merge_profile(student, profile_changes)
        await self.session.flush()
        self._emit(student, EventType.STUDENT_UPDATED)
        await self.session.commit()
        return await self.get(student_id)

    async def self_patch(self, user: CurrentUser, data: StudentSelfPatch) -> Student:
        student = await self.get_for_user(user.id)
        changes = data.model_dump(exclude_unset=True)
        profile_changes = changes.pop("profile", None)
        for k, v in changes.items():
            setattr(student, k, v)
        if profile_changes is not None:
            self._merge_profile(student, profile_changes)
        await self.session.flush()
        self._emit(student, EventType.STUDENT_UPDATED)
        await self.session.commit()
        return await self.get(student.id)

    @staticmethod
    def _merge_profile(student: Student, changes: dict) -> None:
        if student.profile is None:
            student.profile = StudentProfile(**changes)
        else:
            for k, v in changes.items():
                setattr(student.profile, k, v)

    async def delete(self, student_id: int) -> list[str]:
        """Deletes the student; returns stored-file keys so the caller can purge them."""
        student = await self.get(student_id)
        from app.repositories import FileRepository  # local: avoids a module-level cycle

        keys = await FileRepository(self.session).keys_for_student(student_id)
        self._emit(student, EventType.STUDENT_DELETED)  # snapshot before the row disappears
        await self.students.delete(student)
        await self.session.commit()
        return keys

    # -------------------------------------------------------- nested resources
    async def add_contact(self, student_id: int, data: ContactIn) -> Student:
        student = await self.get(student_id)
        if any(c.contact_type == data.contact_type and c.value == data.value for c in student.contacts):
            raise ConflictError("This contact already exists")
        if data.is_primary:
            for c in student.contacts:
                if c.contact_type == data.contact_type:
                    c.is_primary = False
        student.contacts.append(ContactInfo(**data.model_dump()))
        await self.session.commit()
        return await self.get(student_id)

    async def remove_contact(self, student_id: int, contact_id: int) -> None:
        contact = await self.contacts.get(student_id, contact_id)
        if contact is None:
            raise NotFoundError(f"Contact {contact_id} not found for student {student_id}")
        await self.session.delete(contact)
        await self.session.commit()

    async def set_interests(self, student_id: int, names: list[str]) -> Student:
        student = await self.get(student_id)
        student.interests = await self.interests.get_or_create(names)
        await self.session.commit()
        return await self.get(student_id)

    # -------------------------------------------------------------------- bulk
    async def bulk_import(self, items: list[StudentCreate]) -> list[Student]:
        emails = [i.email for i in items]
        if len(set(emails)) != len(emails):
            raise UnprocessableError("Duplicate e-mail addresses inside the import batch")
        taken = await self.students.emails_taken(emails)
        if taken:
            raise ConflictError("E-mail(s) already registered: " + ", ".join(sorted(taken)[:5]))
        codes = {i.department_code for i in items if i.department_code}
        depts = await self.departments.by_codes(codes) if codes else {}
        unknown = codes - set(depts)
        if unknown:
            raise UnprocessableError("Unknown department code(s): " + ", ".join(sorted(unknown)))
        students = [await self._build(i, depts.get(i.department_code or "")) for i in items]
        self.students.add_all(students)
        await self.session.flush()  # single transaction: all-or-nothing
        for s in students:
            self._assign_number(s)
            self._emit(s, EventType.STUDENT_CREATED, s.department.code if s.department else None)
        await self.session.commit()
        return students

    async def bulk_status(self, ids: list[int], status: StudentStatus) -> int:
        updated = await self.students.bulk_set_status(sorted(set(ids)), status)
        for s in updated:
            self._emit(s, EventType.STUDENT_UPDATED)
        await self.session.commit()
        return len(updated)

    # -------------------------------------------------------------- departments
    async def create_department(self, data: DepartmentCreate) -> Department:
        if await self.departments.by_code(data.code):
            raise ConflictError(f"Department {data.code} already exists")
        dept = Department(code=data.code, name=data.name)
        self.departments.add(dept)
        await self.session.commit()
        return dept

    async def delete_department(self, dept_id: int) -> None:
        dept = await self.departments.get(dept_id)
        if dept is None:
            raise NotFoundError(f"Department {dept_id} not found")
        if await self.departments.student_count(dept_id):
            raise ConflictError("Department still has students; reassign them first")
        await self.departments.delete(dept)
        await self.session.commit()
