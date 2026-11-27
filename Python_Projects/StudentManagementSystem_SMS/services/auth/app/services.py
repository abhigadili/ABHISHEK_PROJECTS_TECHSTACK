"""Business logic of the Auth service (sync; FastAPI runs ``def`` routes in a threadpool).

Why sync here?  Argon2 hashing is deliberately CPU-heavy (~50-100 ms).  A
plain ``def`` endpoint is executed in FastAPI's threadpool, so it never blocks
the event loop, and the PyMySQL session stays simple.  (The other services use
async sessions because they are I/O-bound.)
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import timedelta

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import OutboxEvent, PasswordResetToken, RefreshToken, Role, User
from app.passwords import PasswordService
from app.repositories import RoleRepository, TokenRepository, UserRepository
from app.schemas import TokenResponse, UserCreate, UserUpdate
from sms_common.errors import (
    BadRequestError, ConflictError, ForbiddenError, NotFoundError, RateLimitedError,
    UnauthorizedError,
)
from sms_common.events import EventType, NotificationRequestedPayload, Topics, TokenRevokedPayload, UserRegisteredPayload
from sms_common.outbox import enqueue_event
from sms_common.security import (
    ROLE_SCOPES, SCOPE_DESCRIPTIONS, CurrentUser, Role as RoleEnum, create_token, decode_token,
    scopes_for_roles,
)
from sms_common.timeutil import utcnow

log = logging.getLogger(__name__)
SOURCE = "auth-service"

ROLE_DESCRIPTIONS = {
    "ADMIN": "Full access to every resource and user management",
    "TEACHER": "Manage students, courses and enrollments",
    "STUDENT": "Self-service access to own profile, courses and enrollments",
}


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AuthService:
    def __init__(self, session: Session, settings: Settings, passwords: PasswordService) -> None:
        self.session = session
        self.settings = settings
        self.passwords = passwords
        self.users = UserRepository(session)
        self.roles = RoleRepository(session)
        self.tokens = TokenRepository(session)

    # ----------------------------------------------------------- registration
    def register(self, email: str, full_name: str, password: str) -> User:
        if self.users.get_by_email(email):
            raise ConflictError("An account with this email already exists")
        user = User(
            email=email, full_name=full_name, password_hash=self.passwords.hash(password),
            password_changed_at=utcnow(),
        )
        user.roles = self.roles.get_by_names([RoleEnum.STUDENT.value])
        self.users.add(user)
        self._emit_registered(user)
        self.session.commit()
        return user

    def _emit_registered(self, user: User) -> None:
        enqueue_event(
            self.session, OutboxEvent, topic=Topics.AUTH, event_type=EventType.USER_REGISTERED.value,
            payload=UserRegisteredPayload(
                user_id=user.id, email=user.email, full_name=user.full_name, roles=user.role_names
            ).model_dump(), source=SOURCE, key=str(user.id),
        )
        self._notify(user.email, user.full_name, "user_registered", {"name": user.full_name,
                     "email": user.email}, key=str(user.id))

    def _notify(self, to_email: str, to_name: str | None, template: str,
                variables: dict[str, object], key: str | None = None) -> None:
        enqueue_event(
            self.session, OutboxEvent, topic=Topics.NOTIFICATION,
            event_type=EventType.NOTIFICATION_REQUESTED.value,
            payload=NotificationRequestedPayload(
                template=template, to_email=to_email, to_name=to_name, variables=variables
            ).model_dump(), source=SOURCE, key=key,
        )

    # ------------------------------------------------------------------ login
    def authenticate(self, email: str, password: str) -> User:
        user = self.users.get_by_email(email)
        now = utcnow()
        if user is None or user.auth_provider != "local":
            self.passwords.burn_time(password)  # constant-ish time for unknown accounts
            raise UnauthorizedError("Invalid email or password")
        if user.locked_until and user.locked_until > now:
            wait = int((user.locked_until - now).total_seconds()) + 1
            raise RateLimitedError(
                f"Account temporarily locked after too many failed attempts. Retry in {wait}s",
                headers={"Retry-After": str(wait)},
            )
        if not self.passwords.verify(user.password_hash, password):
            user.failed_login_count += 1
            if user.failed_login_count >= self.settings.max_failed_logins:
                user.locked_until = now + timedelta(minutes=self.settings.lockout_minutes)
                user.failed_login_count = 0
                log.warning("account locked after repeated failures", extra={"locked_user": user.id})
            self.session.commit()  # persist the counter even though we raise
            raise UnauthorizedError("Invalid email or password")
        if not user.is_active:
            raise ForbiddenError("This account is disabled")
        user.failed_login_count = 0
        user.locked_until = None
        user.last_login_at = now
        if self.passwords.needs_rehash(user.password_hash):
            user.password_hash = self.passwords.hash(password)
        self.session.commit()
        return user

    # ----------------------------------------------------------------- tokens
    def issue_tokens(
        self, user: User, requested_scopes: list[str] | None = None, *,
        client_ip: str | None = None, user_agent: str | None = None,
    ) -> TokenResponse:
        allowed = scopes_for_roles(user.role_names)
        if requested_scopes:
            unknown = [s for s in requested_scopes if s not in SCOPE_DESCRIPTIONS]
            if unknown:
                raise BadRequestError("invalid_scope: " + ", ".join(unknown))
            granted = sorted(set(requested_scopes) & allowed)
            if not granted:
                raise ForbiddenError("None of the requested scopes is permitted for your roles")
        else:
            granted = sorted(allowed)
        s = self.settings
        access, claims = create_token(
            s, subject=user.id, token_type="access", ttl=timedelta(minutes=s.access_token_ttl_minutes),
            email=user.email, roles=user.role_names, scopes=granted,
        )
        refresh, rclaims = create_token(
            s, subject=user.id, token_type="refresh", ttl=timedelta(days=s.refresh_token_ttl_days),
            scopes=granted,
        )
        self.tokens.add_refresh(RefreshToken(
            jti=rclaims.jti, user_id=user.id, scope=" ".join(granted),
            expires_at=utcnow() + timedelta(days=s.refresh_token_ttl_days),
            client_ip=client_ip, user_agent=(user_agent or "")[:200] or None,
        ))
        self.session.commit()
        return TokenResponse(access_token=access, refresh_token=refresh,
                             expires_in=s.access_token_ttl_minutes * 60, scope=" ".join(granted))

    def refresh(self, refresh_token: str, *, client_ip: str | None = None,
                user_agent: str | None = None) -> TokenResponse:
        claims = decode_token(self.settings, refresh_token, expected_type="refresh")
        record = self.tokens.get_refresh(claims.jti)
        now = utcnow()
        if record is None:
            raise UnauthorizedError("Unknown refresh token")
        if record.revoked_at is not None:
            # A rotated/revoked token came back => likely stolen. Kill the whole family.
            self.tokens.revoke_all_for_user(record.user_id, now)
            self.session.commit()
            log.warning("refresh token reuse detected", extra={"reuse_user": record.user_id})
            raise UnauthorizedError("Refresh token has been revoked")
        if record.expires_at <= now:
            raise UnauthorizedError("Refresh token has expired")
        user = self.users.get(record.user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("Account is not available")
        scopes = record.scope.split() or None
        response = self.issue_tokens(user, scopes, client_ip=client_ip, user_agent=user_agent)
        new_claims = decode_token(self.settings, response.refresh_token, "refresh")
        record.revoked_at = now
        record.replaced_by_jti = new_claims.jti
        self.session.commit()
        return response

    def logout(self, user: CurrentUser, refresh_token: str | None) -> None:
        now = utcnow()
        if refresh_token:
            try:
                rc = decode_token(self.settings, refresh_token, "refresh")
            except UnauthorizedError:
                rc = None
            if rc and int(rc.sub) == user.id:
                rec = self.tokens.get_refresh(rc.jti)
                if rec and rec.revoked_at is None:
                    rec.revoked_at = now
        else:
            self.tokens.revoke_all_for_user(user.id, now)
        # Access tokens are stateless: publish a revocation event so the gateway
        # rejects this token immediately instead of at natural expiry.
        enqueue_event(
            self.session, OutboxEvent, topic=Topics.AUTH, event_type=EventType.TOKEN_REVOKED.value,
            payload=TokenRevokedPayload(jti=user.jti, exp=user.exp).model_dump(),
            source=SOURCE, key=str(user.id),
        )
        self.session.commit()

    # -------------------------------------------------------------- passwords
    def change_password(self, user_id: int, current: str, new: str) -> None:
        user = self._require(user_id)
        if user.auth_provider != "local":
            raise BadRequestError("Password is managed by the external identity provider")
        if not self.passwords.verify(user.password_hash, current):
            raise UnauthorizedError("Current password is incorrect")
        self._set_password(user, new)
        self.session.commit()

    def _set_password(self, user: User, new: str) -> None:
        now = utcnow()
        user.password_hash = self.passwords.hash(new)
        user.password_changed_at = now
        user.failed_login_count = 0
        user.locked_until = None
        self.tokens.revoke_all_for_user(user.id, now)  # force re-login everywhere
        self._notify(user.email, user.full_name, "password_changed", {"name": user.full_name},
                     key=str(user.id))

    def forgot_password(self, email: str) -> None:
        """Always returns normally: never reveal whether the email exists."""
        user = self.users.get_by_email(email)
        if user is None or not user.is_active or user.auth_provider != "local":
            self.passwords.burn_time("x")
            return
        now = utcnow()
        self.tokens.invalidate_open_resets(user.id, now)
        raw = secrets.token_urlsafe(32)
        self.tokens.add_reset(PasswordResetToken(
            user_id=user.id, token_hash=_hash_token(raw),
            expires_at=now + timedelta(minutes=self.settings.password_reset_ttl_minutes),
        ))
        link = f"{self.settings.frontend_url.rstrip('/')}/reset-password?token={raw}"
        self._notify(user.email, user.full_name, "password_reset", {
            "name": user.full_name, "reset_link": link, "token": raw,
            "expires_minutes": self.settings.password_reset_ttl_minutes,
        }, key=str(user.id))
        self.session.commit()

    def reset_password(self, token: str, new_password: str) -> None:
        record = self.tokens.get_reset(_hash_token(token))
        now = utcnow()
        if record is None or record.used_at is not None or record.expires_at <= now:
            raise BadRequestError("Reset token is invalid or has expired")
        user = self._require(record.user_id)
        record.used_at = now
        self._set_password(user, new_password)
        self.session.commit()

    # ------------------------------------------------------------ user admin
    def _require(self, user_id: int) -> User:
        user = self.users.get(user_id)
        if user is None:
            raise NotFoundError(f"User {user_id} not found")
        return user

    def get_user(self, user_id: int) -> User:
        return self._require(user_id)

    def create_user(self, data: UserCreate) -> User:
        if self.users.get_by_email(data.email):
            raise ConflictError("An account with this email already exists")
        user = User(email=data.email, full_name=data.full_name,
                    password_hash=self.passwords.hash(data.password), password_changed_at=utcnow())
        user.roles = self.roles.get_by_names([r.value for r in data.roles])
        self.users.add(user)
        self._emit_registered(user)
        self.session.commit()
        return user

    def update_user(self, user_id: int, data: UserUpdate) -> User:
        user = self._require(user_id)
        changes = data.model_dump(exclude_unset=True)
        if changes.get("is_active") is False and user.is_active:
            self._guard_last_admin(user)
            self.tokens.revoke_all_for_user(user.id, utcnow())
        for k, v in changes.items():
            setattr(user, k, v)
        self.session.commit()
        return user

    def set_roles(self, user_id: int, roles: list[str]) -> User:
        user = self._require(user_id)
        if "ADMIN" not in roles and "ADMIN" in user.role_names:
            self._guard_last_admin(user)
        user.roles = self.roles.get_by_names(roles)
        self.tokens.revoke_all_for_user(user.id, utcnow())  # old tokens carry old roles
        self.session.commit()
        return user

    def delete_user(self, user_id: int, actor: CurrentUser) -> None:
        user = self._require(user_id)
        if user.id == actor.id:
            raise ConflictError("You cannot delete your own account")
        self._guard_last_admin(user)
        self.users.delete(user)
        self.session.commit()

    def _guard_last_admin(self, user: User) -> None:
        if "ADMIN" in user.role_names and self.users.count_active_admins(excluding=user.id) == 0:
            raise ConflictError("Cannot remove or disable the last active administrator")

    # ---------------------------------------------------------------- startup
    def seed(self) -> None:
        """Idempotent: roles always, bootstrap admin only on an empty database."""
        existing = {r.name for r in self.roles.get_by_names([r.value for r in RoleEnum])}
        for role in RoleEnum:
            if role.value not in existing:
                self.session.add(Role(name=role.value, description=ROLE_DESCRIPTIONS[role.value]))
        self.session.flush()
        s = self.settings
        if self.users.count() == 0 and s.bootstrap_admin_email and s.bootstrap_admin_password:
            admin = User(
                email=s.bootstrap_admin_email.lower(), full_name=s.bootstrap_admin_name,
                password_hash=self.passwords.hash(s.bootstrap_admin_password.get_secret_value()),
                password_changed_at=utcnow(),
            )
            admin.roles = self.roles.get_by_names(["ADMIN"])
            self.users.add(admin)
            log.info("bootstrap administrator created: %s", admin.email)
        self.session.commit()


def role_scopes(name: str) -> list[str]:
    try:
        return sorted(ROLE_SCOPES[RoleEnum(name)])
    except ValueError:
        return []
