from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.enums import CourseStatus, TeacherRole

Code = Annotated[str, Field(min_length=3, max_length=20, pattern=r"^[A-Za-z]{2,6}[- ]?[0-9]{2,4}[A-Za-z]?$")]


class CategoryCreate(BaseModel):
    name: Annotated[str, Field(min_length=2, max_length=80)]
    description: Annotated[str | None, Field(max_length=300)] = None


class CategoryPatch(BaseModel):
    name: Annotated[str | None, Field(min_length=2, max_length=80)] = None
    description: Annotated[str | None, Field(max_length=300)] = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None = None


class TeacherRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    teacher_user_id: int
    teacher_name: str
    teacher_email: str
    role: TeacherRole
    assigned_at: datetime


class TeacherAssign(BaseModel):
    role: TeacherRole = TeacherRole.LEAD


class _CourseBase(BaseModel):
    title: Annotated[str, Field(min_length=3, max_length=150)]
    description: Annotated[str | None, Field(max_length=5000)] = None
    category_id: Annotated[int | None, Field(ge=1)] = None
    credits: Annotated[int, Field(ge=1, le=10)]
    duration_weeks: Annotated[int, Field(ge=1, le=104)]
    capacity: Annotated[int, Field(ge=1, le=1000)] = 30
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        return " ".join(v.split())

    @model_validator(mode="after")
    def _dates(self) -> "_CourseBase":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self


class CourseCreate(_CourseBase):
    code: Code
    status: CourseStatus = CourseStatus.DRAFT

    @field_validator("code")
    @classmethod
    def _code(cls, v: str) -> str:
        return v.upper().replace(" ", "-")


class CourseReplace(_CourseBase):
    """PUT: full replacement of the editable fields (code is immutable)."""

    status: CourseStatus


class CoursePatch(BaseModel):
    title: Annotated[str | None, Field(min_length=3, max_length=150)] = None
    description: Annotated[str | None, Field(max_length=5000)] = None
    category_id: Annotated[int | None, Field(ge=1)] = None
    credits: Annotated[int | None, Field(ge=1, le=10)] = None
    duration_weeks: Annotated[int | None, Field(ge=1, le=104)] = None
    capacity: Annotated[int | None, Field(ge=1, le=1000)] = None
    start_date: date | None = None
    end_date: date | None = None


class AvailabilityUpdate(BaseModel):
    status: CourseStatus


class CourseSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    credits: int
    duration_weeks: int
    status: CourseStatus
    capacity: int
    enrolled_count: int
    available_seats: int
    is_available: bool
    category: CategoryRead | None = None
    start_date: date | None = None
    end_date: date | None = None


class CourseRead(CourseSummary):
    description: str | None = None
    teachers: list[TeacherRead] = []
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime


class FileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
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
