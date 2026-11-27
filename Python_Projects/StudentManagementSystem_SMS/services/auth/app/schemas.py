"""Pydantic request/response schemas (separate Create / Update / Read models)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.passwords import validate_password_strength
from sms_common.security import Role

Password = Annotated[str, Field(min_length=1, max_length=128, repr=False)]


class _StrongPasswordMixin(BaseModel):
    @field_validator("password", "new_password", check_fields=False)
    @classmethod
    def _strong(cls, v: str) -> str:
        return validate_password_strength(v)


class RegisterRequest(_StrongPasswordMixin):
    email: EmailStr
    full_name: Annotated[str, Field(min_length=2, max_length=120)]
    password: Password

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()

    @field_validator("full_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        return " ".join(v.split())


class LoginRequest(BaseModel):
    email: EmailStr
    password: Password

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds")
    scope: str = ""


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class ChangePasswordRequest(_StrongPasswordMixin):
    current_password: Password
    new_password: Password

    @model_validator(mode="after")
    def _different(self) -> "ChangePasswordRequest":
        if self.current_password == self.new_password:
            raise ValueError("new_password must differ from current_password")
        return self


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(_StrongPasswordMixin):
    token: Annotated[str, Field(min_length=20, max_length=200)]
    new_password: Password


class MessageResponse(BaseModel):
    message: str


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    scopes: list[str] = []
    user_count: int = 0


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    auth_provider: str
    roles: list[str] = Field(validation_alias="role_names")
    last_login_at: datetime | None = None
    created_at: datetime


class UserCreate(_StrongPasswordMixin):
    email: EmailStr
    full_name: Annotated[str, Field(min_length=2, max_length=120)]
    password: Password
    roles: Annotated[list[Role], Field(min_length=1)] = [Role.STUDENT]

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()


class UserUpdate(BaseModel):
    """PATCH semantics: only the supplied fields change."""

    full_name: Annotated[str | None, Field(min_length=2, max_length=120)] = None
    is_active: bool | None = None


class RoleAssignment(BaseModel):
    roles: Annotated[list[Role], Field(min_length=1)]

    @field_validator("roles")
    @classmethod
    def _unique(cls, v: list[Role]) -> list[Role]:
        return list(dict.fromkeys(v))
