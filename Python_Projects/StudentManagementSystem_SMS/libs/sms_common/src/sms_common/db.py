"""Database plumbing: declarative base, engines, session factories.

Transaction policy
------------------
Repositories only ``add``/``flush``/``execute``.  The **service layer** owns the
transaction boundary and calls ``commit()`` once per business operation, so a
domain change and its outbox event are always committed (or rolled back)
together.  The session dependency only guarantees ``rollback`` on error and
``close`` afterwards.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, MetaData, String, create_engine, func, text
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from sms_common.config import BaseServiceSettings

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Declarative base with deterministic constraint names (Alembic-friendly)."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


# Every pooled connection runs in UTC so NOW()/server defaults agree with the
# naive-UTC datetimes the application writes, whatever the MySQL server's zone is.
_UTC_INIT = {"init_command": "SET time_zone = '+00:00'"}


def build_async_engine(settings: BaseServiceSettings) -> AsyncEngine:
    return create_async_engine(
        settings.async_database_url(),
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_recycle=settings.db_pool_recycle,
        pool_pre_ping=True,
        echo=settings.db_echo,
        connect_args=_UTC_INIT,
    )


def build_sync_engine(settings: BaseServiceSettings) -> Engine:
    return create_engine(
        settings.sync_database_url(),
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_recycle=settings.db_pool_recycle,
        pool_pre_ping=True,
        echo=settings.db_echo,
        connect_args=_UTC_INIT,
    )


class Database:
    """Owns the engines for one service.  Created in the app lifespan.

    ``async_session`` is an async context manager for background jobs
    (outbox relay, Kafka consumers); ``session_dependency`` /
    ``sync_session_dependency`` are the FastAPI dependencies.
    """

    def __init__(self, settings: BaseServiceSettings, *, sync: bool = False, use_async: bool = True):
        self.settings = settings
        self.async_engine: AsyncEngine | None = build_async_engine(settings) if use_async else None
        self.sync_engine: Engine | None = build_sync_engine(settings) if sync else None
        self.async_session_factory: async_sessionmaker[AsyncSession] | None = (
            async_sessionmaker(self.async_engine, expire_on_commit=False)
            if self.async_engine
            else None
        )
        self.sync_session_factory: sessionmaker[Session] | None = (
            sessionmaker(self.sync_engine, expire_on_commit=False) if self.sync_engine else None
        )

    # -- async ---------------------------------------------------------------
    async def session_dependency(self) -> AsyncIterator[AsyncSession]:
        assert self.async_session_factory is not None
        async with self.async_session_factory() as session:
            try:
                yield session
            except BaseException:
                await session.rollback()
                raise

    @asynccontextmanager
    async def async_session(self) -> AsyncIterator[AsyncSession]:
        assert self.async_session_factory is not None
        async with self.async_session_factory() as session:
            try:
                yield session
            except BaseException:
                await session.rollback()
                raise

    # -- sync ----------------------------------------------------------------
    def sync_session_dependency(self) -> Iterator[Session]:
        assert self.sync_session_factory is not None
        with self.sync_session_factory() as session:
            try:
                yield session
            except BaseException:
                session.rollback()
                raise

    @contextmanager
    def sync_session(self) -> Iterator[Session]:
        assert self.sync_session_factory is not None
        with self.sync_session_factory() as session:
            try:
                yield session
            except BaseException:
                session.rollback()
                raise

    # -- health / shutdown ---------------------------------------------------
    async def ping(self) -> bool:
        try:
            if self.async_engine is not None:
                async with self.async_engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
            elif self.sync_engine is not None:
                import asyncio

                def _ping() -> None:
                    with self.sync_engine.connect() as conn:  # type: ignore[union-attr]
                        conn.execute(text("SELECT 1"))

                await asyncio.to_thread(_ping)
            return True
        except Exception:
            return False

    async def dispose(self) -> None:
        if self.async_engine is not None:
            await self.async_engine.dispose()
        if self.sync_engine is not None:
            self.sync_engine.dispose()


class StoredFileMixin:
    """Columns every file-metadata table shares (Student and Course services).

    ``stored_key`` is an *internal* storage key; it is never serialised.
    """

    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    uploaded_by: Mapped[int | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


@asynccontextmanager
async def named_lock(engine: AsyncEngine, name: str, timeout: int = 5) -> AsyncIterator[None]:
    """Cross-process mutual exclusion via MySQL ``GET_LOCK`` (async context manager).

    The lock lives on a *dedicated* connection that is held for the whole block, so it
    covers check + insert + commit performed on the caller's own session/connection.
    """
    from sms_common.errors import ServiceUnavailableError

    async with engine.connect() as conn:
        got = (await conn.execute(text("SELECT GET_LOCK(:n, :t)"), {"n": name, "t": timeout})).scalar()
        if got != 1:
            raise ServiceUnavailableError("Resource is busy, please retry")
        try:
            yield
        finally:
            await conn.execute(text("SELECT RELEASE_LOCK(:n)"), {"n": name})
