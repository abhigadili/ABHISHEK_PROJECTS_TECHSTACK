"""Student database schema (StudentManagementStudentDB).

Relationships demonstrated
* One-to-One   : Student <-> StudentProfile (shared primary key, delete-orphan)
* One-to-Many  : Department -> Student ; Student -> ContactInfo ; Student -> StudentFile
* Many-to-Many : Student <-> Interest via ``student_interests`` (composite PK)
Loading strategies are chosen per relationship (see comments) to avoid N+1 queries.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint, Column, Date, Enum, ForeignKey, Index, Integer, Numeric, String, Table, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import ContactType, FileKind, Gender, StudentStatus
from sms_common.db import Base, StoredFileMixin, TimestampMixin
from sms_common.outbox import OutboxEventMixin, ProcessedEventMixin


def _enum(py_enum: type, length: int = 20) -> Enum:
    # VARCHAR + Python-side validation (portable, easy to extend with a migration)
    return Enum(py_enum, native_enum=False, length=length, create_constraint=False,
                values_callable=lambda e: [m.value for m in e])


# Association table with a *composite primary key* (student_id, interest_id)
student_interests = Table(
    "student_interests",
    Base.metadata,
    Column("student_id", ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
    Column("interest_id", ForeignKey("interests.id", ondelete="CASCADE"), primary_key=True),
)


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    # lazy="select" (default): loaded on demand; list queries use joinedload explicitly
    students: Mapped[list["Student"]] = relationship(back_populates="department", lazy="select")


class Interest(Base):
    __tablename__ = "interests"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)


class Student(TimestampMixin, Base):
    __tablename__ = "students"
    __table_args__ = (
        CheckConstraint("gpa IS NULL OR (gpa >= 0 AND gpa <= 4)", name="gpa_range"),
        Index("ix_students_department_status", "department_id", "status"),
        Index("ix_students_name", "last_name", "first_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_number: Mapped[str] = mapped_column(String(24), unique=True, nullable=False)
    user_id: Mapped[int | None] = mapped_column(unique=True)  # id in the Auth service (no FK across DBs)
    first_name: Mapped[str] = mapped_column(String(60), nullable=False)
    last_name: Mapped[str] = mapped_column(String(60), nullable=False)
    email: Mapped[str] = mapped_column(String(190), unique=True, nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[Gender | None] = mapped_column(_enum(Gender))
    status: Mapped[StudentStatus] = mapped_column(
        _enum(StudentStatus), default=StudentStatus.ACTIVE, nullable=False, index=True
    )
    department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id", ondelete="RESTRICT")
    )
    admission_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    gpa: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    enrolled_courses_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    department: Mapped[Department | None] = relationship(back_populates="students", lazy="select")
    # one-to-one: joined (single query via LEFT JOIN) when requested with joinedload()
    profile: Mapped["StudentProfile | None"] = relationship(
        back_populates="student", uselist=False, cascade="all, delete-orphan", lazy="select"
    )
    # one-to-many / many-to-many collections: selectin (one extra IN query, no row explosion)
    contacts: Mapped[list["ContactInfo"]] = relationship(
        back_populates="student", cascade="all, delete-orphan", passive_deletes=True,
        lazy="select", order_by="ContactInfo.id",
    )
    interests: Mapped[list[Interest]] = relationship(
        secondary=student_interests, lazy="select", order_by=Interest.name
    )
    files: Mapped[list["StudentFile"]] = relationship(
        back_populates="student", cascade="all, delete-orphan", passive_deletes=True, lazy="select"
    )

    @property
    def interest_names(self) -> list[str]:
        return [i.name for i in self.interests]

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class StudentProfile(TimestampMixin, Base):
    __tablename__ = "student_profiles"

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), primary_key=True
    )  # PK == FK  => strict one-to-one
    address_line: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(80))
    state: Mapped[str | None] = mapped_column(String(80))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    country: Mapped[str | None] = mapped_column(String(80))
    bio: Mapped[str | None] = mapped_column(Text)

    student: Mapped[Student] = relationship(back_populates="profile")


class ContactInfo(Base):
    __tablename__ = "contact_infos"
    __table_args__ = (
        UniqueConstraint("student_id", "contact_type", "value", name="uq_contact_student_type_value"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contact_type: Mapped[ContactType] = mapped_column(_enum(ContactType), nullable=False)
    value: Mapped[str] = mapped_column(String(190), nullable=False)
    label: Mapped[str | None] = mapped_column(String(60))
    is_primary: Mapped[bool] = mapped_column(default=False, nullable=False)

    student: Mapped[Student] = relationship(back_populates="contacts")


class StudentFile(StoredFileMixin, Base):
    __tablename__ = "student_files"
    __table_args__ = (Index("ix_student_files_student_kind", "student_id", "kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[FileKind] = mapped_column(_enum(FileKind), nullable=False)
    doc_type: Mapped[str | None] = mapped_column(String(40))  # e.g. TRANSCRIPT, ID_CARD

    student: Mapped[Student] = relationship(back_populates="files")


class OutboxEvent(OutboxEventMixin, Base):
    pass


class ProcessedEvent(ProcessedEventMixin, Base):
    pass
