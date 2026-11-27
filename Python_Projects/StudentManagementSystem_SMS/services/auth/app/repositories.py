"""Data-access layer (sync SQLAlchemy 2.x).  No business rules, no commits."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.orm import Session

from app.models import PasswordResetToken, RefreshToken, Role, User, user_roles


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.s = session

    def get(self, user_id: int) -> User | None:
        return self.s.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        return self.s.execute(select(User).where(User.email == email)).scalar_one_or_none()

    def get_by_external(self, provider: str, subject: str) -> User | None:
        return self.s.execute(
            select(User).where(User.auth_provider == provider, User.external_subject == subject)
        ).scalar_one_or_none()

    def add(self, user: User) -> User:
        self.s.add(user)
        self.s.flush()
        return user

    def delete(self, user: User) -> None:
        self.s.delete(user)
        self.s.flush()

    def count(self) -> int:
        return int(self.s.execute(select(func.count()).select_from(User)).scalar_one())

    def count_active_admins(self, excluding: int | None = None) -> int:
        stmt = (
            select(func.count(func.distinct(User.id)))
            .join(user_roles, user_roles.c.user_id == User.id)
            .join(Role, Role.id == user_roles.c.role_id)
            .where(Role.name == "ADMIN", User.is_active.is_(True))
        )
        if excluding is not None:
            stmt = stmt.where(User.id != excluding)
        return int(self.s.execute(stmt).scalar_one())

    def search(
        self, *, q: str | None, role: str | None, is_active: bool | None
    ) -> Select[tuple[User]]:
        stmt = select(User)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(User.email.like(like), User.full_name.like(like)))
        if role:
            stmt = stmt.where(User.roles.any(Role.name == role))
        if is_active is not None:
            stmt = stmt.where(User.is_active.is_(is_active))
        return stmt


class RoleRepository:
    def __init__(self, session: Session) -> None:
        self.s = session

    def get_by_names(self, names: list[str]) -> list[Role]:
        return list(self.s.execute(select(Role).where(Role.name.in_(names))).scalars())

    def get_by_name(self, name: str) -> Role | None:
        return self.s.execute(select(Role).where(Role.name == name)).scalar_one_or_none()

    def list_with_user_counts(self) -> list[tuple[Role, int]]:
        """Aggregation + outer join: users per role in a single query."""
        stmt = (
            select(Role, func.count(user_roles.c.user_id))
            .outerjoin(user_roles, user_roles.c.role_id == Role.id)
            .group_by(Role.id)
            .order_by(Role.id)
        )
        return [(r, int(c)) for r, c in self.s.execute(stmt).all()]


class TokenRepository:
    def __init__(self, session: Session) -> None:
        self.s = session

    def add_refresh(self, token: RefreshToken) -> None:
        self.s.add(token)
        self.s.flush()

    def get_refresh(self, jti: str) -> RefreshToken | None:
        return self.s.execute(
            select(RefreshToken).where(RefreshToken.jti == jti).with_for_update()
        ).scalar_one_or_none()

    def revoke_all_for_user(self, user_id: int, now: datetime) -> int:
        """Bulk UPDATE (one statement, no row loading)."""
        result = self.s.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        return result.rowcount or 0

    def add_reset(self, token: PasswordResetToken) -> None:
        self.s.add(token)
        self.s.flush()

    def get_reset(self, token_hash: str) -> PasswordResetToken | None:
        return self.s.execute(
            select(PasswordResetToken)
            .where(PasswordResetToken.token_hash == token_hash)
            .with_for_update()
        ).scalar_one_or_none()

    def invalidate_open_resets(self, user_id: int, now: datetime) -> None:
        self.s.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
            .values(used_at=now)
        )
