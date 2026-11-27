from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import EnrollmentStatus

Grade = Annotated[str, Field(pattern=r"^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|F|P)$")]


class EnrollmentCreate(BaseModel):
    course_id: Annotated[int, Field(ge=1)]
    student_id: Annotated[int | None, Field(ge=1, description="Omit when a STUDENT enrolls themselves")] = None
    notes: Annotated[str | None, Field(max_length=1000)] = None


class EnrollmentPatch(BaseModel):
    """Staff-only: record a grade, add notes or mark completed / re-open."""

    grade: Grade | None = None
    notes: Annotated[str | None, Field(max_length=1000)] = None
    status: Literal["ENROLLED", "COMPLETED"] | None = None

    @model_validator(mode="after")
    def _non_empty(self) -> "EnrollmentPatch":
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        return self


class CancelRequest(BaseModel):
    reason: Annotated[str | None, Field(max_length=300)] = None


class HistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    from_status: str | None
    to_status: str
    changed_by: int | None
    note: str | None
    changed_at: datetime


class EnrollmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    student_number: str
    student_name: str
    student_email: str
    course_id: int
    course_code: str
    course_title: str
    course_credits: int
    status: EnrollmentStatus
    grade: str | None = None
    notes: str | None = None
    enrolled_at: datetime
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None


class EnrollmentDetail(EnrollmentRead):
    history: list[HistoryRead] = []


class CourseEnrollmentStat(BaseModel):
    course_id: int
    course_code: str
    active: int
    completed: int
    cancelled: int


class EnrollmentStats(BaseModel):
    total: int
    by_status: dict[str, int]
    by_course: list[CourseEnrollmentStat]
    students_with_multiple_active: int
