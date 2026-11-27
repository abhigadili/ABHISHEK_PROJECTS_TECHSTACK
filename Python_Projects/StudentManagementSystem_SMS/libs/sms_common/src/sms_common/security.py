"""JWT handling + FastAPI security dependencies shared by all services.

Terminology (kept deliberately separate):

* **JWT** is only the *token format* (signed, self-contained claims).
* **OAuth2** is the *protocol*: the password grant at ``/auth/token`` issues
  bearer tokens carrying ``scope``; ``OAuth2PasswordBearer`` + ``SecurityScopes``
  enforce them.
* **RBAC** is the authorisation model: roles (ADMIN/TEACHER/STUDENT) map to a
  set of OAuth2 scopes; routes may require roles and/or scopes.

Services validate tokens statelessly (signature, expiry, issuer, type).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Sequence

import jwt
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from pydantic import BaseModel, Field

from sms_common.config import BaseServiceSettings
from sms_common.context import user_id_var
from sms_common.errors import ForbiddenError, UnauthorizedError


class Role(str, Enum):
    ADMIN = "ADMIN"
    TEACHER = "TEACHER"
    STUDENT = "STUDENT"


SCOPE_DESCRIPTIONS: dict[str, str] = {
    "profile:self": "Read and update my own profile",
    "students:read": "Read student records",
    "students:write": "Create and modify student records",
    "courses:read": "Read courses",
    "courses:write": "Create and modify courses",
    "enrollments:read": "Read enrollments",
    "enrollments:write": "Create, update and cancel enrollments",
    "files:read": "Download files",
    "files:write": "Upload and delete files",
    "notifications:read": "Read notification history",
    "notifications:write": "Queue and retry notifications",
    "users:manage": "Manage users and roles",
}

ROLE_SCOPES: dict[Role, set[str]] = {
    Role.ADMIN: set(SCOPE_DESCRIPTIONS),
    Role.TEACHER: {
        "profile:self", "students:read", "students:write", "courses:read", "courses:write",
        "enrollments:read", "enrollments:write", "files:read", "files:write",
        "notifications:read",
    },
    Role.STUDENT: {
        "profile:self", "courses:read", "enrollments:read", "enrollments:write",
        "files:read", "files:write",
    },
}


def scopes_for_roles(roles: Sequence[str]) -> set[str]:
    out: set[str] = set()
    for r in roles:
        try:
            out |= ROLE_SCOPES[Role(r)]
        except ValueError:
            continue
    return out


class TokenClaims(BaseModel):
    sub: str
    type: str = "access"
    email: str | None = None
    roles: list[str] = Field(default_factory=list)
    scope: str = ""
    jti: str
    iss: str
    iat: int
    exp: int


class CurrentUser(BaseModel):
    """What route handlers receive from the security dependency."""

    id: int
    email: str | None = None
    roles: list[str]
    scopes: list[str]
    jti: str
    exp: int = 0
    token: str = Field(repr=False, exclude=True)  # kept only to forward downstream

    def has_role(self, *roles: Role | str) -> bool:
        wanted = {r.value if isinstance(r, Role) else r for r in roles}
        return bool(wanted & set(self.roles))

    @property
    def is_admin(self) -> bool:
        return Role.ADMIN.value in self.roles

    @property
    def is_staff(self) -> bool:
        """Admin or teacher."""
        return self.has_role(Role.ADMIN, Role.TEACHER)


def create_token(
    settings: BaseServiceSettings,
    *,
    subject: str | int,
    token_type: str,
    ttl: timedelta,
    email: str | None = None,
    roles: Sequence[str] = (),
    scopes: Sequence[str] = (),
    jti: str | None = None,
) -> tuple[str, TokenClaims]:
    now = datetime.now(timezone.utc)
    claims = TokenClaims(
        sub=str(subject),
        type=token_type,
        email=email,
        roles=list(roles),
        scope=" ".join(sorted(scopes)),
        jti=jti or uuid.uuid4().hex,
        iss=settings.jwt_issuer,
        iat=int(now.timestamp()),
        exp=int((now + ttl).timestamp()),
    )
    token = jwt.encode(
        claims.model_dump(exclude_none=True),
        settings.jwt_secret.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )
    return token, claims


def decode_token(
    settings: BaseServiceSettings, token: str, expected_type: str = "access"
) -> TokenClaims:
    """Verify signature, expiry, issuer, required claims and token type."""
    try:
        data: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[settings.jwt_algorithm],  # pin algorithm: blocks alg=none/confusion
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "sub", "jti", "iss"]},
        )
        claims = TokenClaims.model_validate(data)
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Token has expired") from exc
    except (jwt.PyJWTError, ValueError) as exc:
        raise UnauthorizedError("Invalid authentication token") from exc
    if claims.type != expected_type:
        raise UnauthorizedError(f"Wrong token type: expected {expected_type}")
    return claims


class SecurityDeps:
    """Factory binding the security dependencies to one service's settings.

    Usage in a service's ``deps.py``::

        security = SecurityDeps(get_settings, token_url="/api/v1/auth/token")
        CurrentUserDep = Annotated[CurrentUser, Depends(security.current_user)]
        admin_only = Depends(security.require(Role.ADMIN))
    """

    def __init__(
        self,
        get_settings: Callable[[], BaseServiceSettings],
        token_url: str = "/api/v1/auth/token",
        is_revoked: Callable[[str], bool] | None = None,
    ) -> None:
        self._get_settings = get_settings
        self._is_revoked = is_revoked
        self.oauth2_scheme = OAuth2PasswordBearer(
            tokenUrl=token_url,
            scopes=SCOPE_DESCRIPTIONS,
            auto_error=False,
        )
        self.current_user = self._build_current_user()

    def _build_current_user(self) -> Callable[..., CurrentUser]:
        oauth2_scheme = self.oauth2_scheme

        async def current_user(
            security_scopes: SecurityScopes,
            request: Request,
            token: str | None = Depends(oauth2_scheme),
        ) -> CurrentUser:
            if not token:
                raise UnauthorizedError("Not authenticated")
            claims = decode_token(self._get_settings(), token, "access")
            if self._is_revoked and self._is_revoked(claims.jti):
                raise UnauthorizedError("Token has been revoked")
            granted = set(claims.scope.split())
            missing = [s for s in security_scopes.scopes if s not in granted]
            if missing:
                raise ForbiddenError(
                    "Token lacks required scope(s): " + ", ".join(missing),
                    headers={"WWW-Authenticate": f'Bearer scope="{security_scopes.scope_str}"'},
                )
            try:
                uid = int(claims.sub)
            except ValueError as exc:
                raise UnauthorizedError("Invalid subject claim") from exc
            user_id_var.set(str(uid))
            user = CurrentUser(
                id=uid, email=claims.email, roles=claims.roles,
                scopes=sorted(granted), jti=claims.jti, exp=claims.exp, token=token,
            )
            request.state.user = user
            return user

        return current_user

    def require(self, *roles: Role, scopes: Sequence[str] = ()) -> Callable[..., CurrentUser]:
        """Dependency enforcing (any of ``roles``) AND (all ``scopes``)."""
        from fastapi import Security  # local import keeps module import light

        current_user = self.current_user
        allowed = {r.value for r in roles}

        async def dependency(
            user: CurrentUser = Security(current_user, scopes=list(scopes)),
        ) -> CurrentUser:
            if allowed and not (allowed & set(user.roles)):
                raise ForbiddenError(
                    "Requires role: " + " or ".join(sorted(allowed)),
                )
            return user

        return dependency
