from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import NotificationStatus


class AttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    attempted_at: datetime
    success: bool
    error: str | None
    duration_ms: int


class NotificationRead(BaseModel):
    """History view.  Template variables are deliberately not exposed."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    template: str
    recipient_email: EmailStr
    recipient_name: str | None
    subject: str
    status: NotificationStatus
    attempts: int
    max_attempts: int
    last_error: str | None
    source_event_type: str | None
    correlation_id: str | None
    created_at: datetime
    next_attempt_at: datetime
    sent_at: datetime | None


class NotificationDetail(NotificationRead):
    provider_message_id: str | None = None
    attempt_log: list[AttemptRead] = []


class NotificationCreate(BaseModel):
    to_email: EmailStr
    to_name: Annotated[str | None, Field(max_length=130)] = None
    template: str = "generic_notification"
    variables: dict[str, Any] = Field(default_factory=dict)


class PreviewRequest(BaseModel):
    template: str
    variables: dict[str, Any] = Field(default_factory=dict)


class PreviewResponse(BaseModel):
    subject: str
    text: str
    html: str


class TemplateInfo(BaseModel):
    name: str
    description: str
    required_variables: list[str]
    subject: str


class NotificationStats(BaseModel):
    by_status: dict[str, int]
    by_template: dict[str, int]
    total: int
