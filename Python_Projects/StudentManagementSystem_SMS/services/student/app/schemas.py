"""Pydantic schemas: separate Create / Replace (PUT) / Patch / Read models.

SQLAlchemy models are never returned directly; ``from_attributes`` maps them.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.enums import ContactType, FileKind, Gender, StudentStatus

Name = Annotated[str, Field(min_length=1, max_length=60)]
Gpa = Annotated[Decimal, Field(ge=0, le=4, max_digits=3, decimal_places=2)]


def _clean(v: str) -> str:
    return " ".join(v.split())


# ----------------------------------------------------------------- departments
class DepartmentCreate(BaseModel):
    code: Annotated[str, Field(min_length=2, max_length=10, pattern=r"^[A-Za-z0-9]+$")]
    name: Annotated[str, Field(min_length=2, max_length=100)]

    @field_validator("code")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()


class DepartmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str


# --------------------------------------------------------------------- profile
class ProfileIn(BaseModel):
    address_line: Annotated[str | None, Field(max_length=200)] = None
    city: Annotated[str | None, Field(max_length=80)] = None
    state: Annotated[str | None, Field(max_length=80)] = None
    postal_code: Annotated[str | None, Field(max_length=20)] = None
    country: Annotated[str | None, Field(max_length=80)] = None
    bio: Annotated[str | None, Field(max_length=2000)] = None


class ProfileRead(ProfileIn):
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------- contacts
class ContactIn(BaseModel):
    contact_type: ContactType
    value: Annotated[str, Field(min_length=3, max_length=190)]
    label: Annotated[str | None, Field(max_length=60)] = None
    is_primary: bool = False

    @model_validator(mode="after")
    def _check_value(self) -> "ContactIn":
        if self.contact_type is ContactType.ALTERNATE_EMAIL and "@" not in self.value:
            raise ValueError("ALTERNATE_EMAIL contact must be an e-mail address")
        if self.contact_type in (ContactType.PHONE, ContactType.EMERGENCY):
            digits = [c for c in self.value if c.isdigit()]
            if len(digits) < 7 or any(not (c.isdigit() or c in "+-() .") for c in self.value):
                raise ValueError("Phone numbers need at least 7 digits (and only + - ( ) . space)")
        return self


class ContactRead(ContactIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


# --------------------------------------------------------------------- student
class _StudentBase(BaseModel):
    first_name: Name
    last_name: Name
    email: EmailStr
    date_of_birth: date | None = None
    gender: Gender | None = None
    department_code: Annotated[str | None, Field(max_length=10)] = None
    gpa: Gpa | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def _names(cls, v: str) -> str:
        v = _clean(v)
        if not all(ch.isalpha() or ch in " -'." for ch in v):
            raise ValueError("Names may contain letters, spaces, hyphens, apostrophes and dots only")
        return v

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()

    @field_validator("date_of_birth")
    @classmethod
    def _dob(cls, v: date | None) -> date | None:
        if v is not None:
            age = (date.today() - v).days / 365.25
            if v >= date.today() or age > 120:
                raise ValueError("date_of_birth must be in the past and plausible")
        return v

    @field_validator("department_code")
    @classmethod
    def _dept(cls, v: str | None) -> str | None:
        return v.upper() if v else v


class StudentCreate(_StudentBase):
    status: StudentStatus = StudentStatus.ACTIVE
    user_id: Annotated[int | None, Field(ge=1, description="Auth-service user id to link")] = None
    admission_date: date | None = None
    profile: ProfileIn | None = None
    contacts: Annotated[list[ContactIn], Field(max_length=10)] = []
    interests: Annotated[list[Annotated[str, Field(min_length=2, max_length=60)]], Field(max_length=15)] = []

    @model_validator(mode="after")
    def _one_primary_per_type(self) -> "StudentCreate":
        seen: set[ContactType] = set()
        for c in self.contacts:
            if c.is_primary:
                if c.contact_type in seen:
                    raise ValueError(f"Only one primary {c.contact_type.value} contact is allowed")
                seen.add(c.contact_type)
        return self


class StudentReplace(_StudentBase):
    """PUT body: every core field is supplied (omitted optional ones are cleared)."""

    status: StudentStatus
    admission_date: date


class StudentPatch(BaseModel):
    """PATCH body: only supplied fields change."""

    first_name: Name | None = None
    last_name: Name | None = None
    email: EmailStr | None = None
    date_of_birth: date | None = None
    gender: Gender | None = None
    status: StudentStatus | None = None
    department_code: Annotated[str | None, Field(max_length=10)] = None
    gpa: Gpa | None = None
    profile: ProfileIn | None = None

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str | None) -> str | None:
        return v.lower() if v else v

    @field_validator("department_code")
    @classmethod
    def _dept(cls, v: str | None) -> str | None:
        return v.upper() if v else v


class StudentSelfPatch(BaseModel):
    """What a STUDENT may change about themselves (no status/GPA/department/e-mail)."""

    first_name: Name | None = None
    last_name: Name | None = None
    date_of_birth: date | None = None
    profile: ProfileIn | None = None


class StudentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_number: str
    first_name: str
    last_name: str
    email: EmailStr
    status: StudentStatus
    department: DepartmentRead | None = None
    gpa: Decimal | None = None
    enrolled_courses_count: int = 0


class StudentRead(StudentSummary):
    user_id: int | None = None
    date_of_birth: date | None = None
    gender: Gender | None = None
    admission_date: date
    profile: ProfileRead | None = None
    contacts: list[ContactRead] = []
    interests: list[str] = Field(default=[], validation_alias="interest_names")
    created_at: datetime
    updated_at: datetime


class InterestsReplace(BaseModel):
    interests: Annotated[list[Annotated[str, Field(min_length=2, max_length=60)]], Field(max_length=15)]


class BulkImport(BaseModel):
    students: Annotated[list[StudentCreate], Field(min_length=1, max_length=500)]


class BulkStatusUpdate(BaseModel):
    ids: Annotated[list[int], Field(min_length=1, max_length=1000)]
    status: StudentStatus


class BulkResult(BaseModel):
    affected: int


# ----------------------------------------------------------------------- files
class FileRead(BaseModel):
    """File metadata.  Deliberately has no storage key / filesystem path."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: FileKind
    doc_type: str | None = None
    original_name: str
    content_type: str
    size_bytes: int
    sha256: str
    description: str | None = None
    created_at: datetime
    download_url: str | None = None


class FilePatch(BaseModel):
    doc_type: Annotated[str | None, Field(max_length=40, pattern=r"^[A-Z0-9_]+$")] = None
    description: Annotated[str | None, Field(max_length=500)] = None


# ----------------------------------------------------------------------- stats
class DepartmentStat(BaseModel):
    department: str
    students: int
    avg_gpa: float | None


class StudentStats(BaseModel):
    total: int
    by_status: dict[str, int]
    by_department: list[DepartmentStat]
    above_department_average_gpa: int
    largest_department: str | None
