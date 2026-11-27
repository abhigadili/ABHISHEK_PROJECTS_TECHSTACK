"""Pagination, sorting and a tiny generic helper for async list queries."""

from __future__ import annotations

from typing import Annotated, Any, Generic, Literal, Mapping, Sequence, TypeVar

from fastapi import Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class PageParams(BaseModel):
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)
    sort: str | None = None
    order: Literal["asc", "desc"] = "asc"

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


def page_params(
    page: Annotated[int, Query(ge=1, description="1-based page number")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
    sort: Annotated[str | None, Query(description="Field to sort by")] = None,
    order: Annotated[Literal["asc", "desc"], Query(description="Sort direction")] = "asc",
) -> PageParams:
    return PageParams(page=page, size=size, sort=sort, order=order)


PageParamsDep = Annotated[PageParams, Depends(page_params)]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(cls, items: Sequence[T], total: int, params: PageParams) -> "Page[T]":
        pages = (total + params.size - 1) // params.size if total else 0
        return cls(items=list(items), total=total, page=params.page, size=params.size, pages=pages)


def apply_sort(
    stmt: Select[Any], params: PageParams, allowed: Mapping[str, Any], default: str
) -> Select[Any]:
    """Whitelist-based ORDER BY (never interpolates user input into SQL)."""
    from sms_common.errors import BadRequestError

    key = params.sort or default
    column = allowed.get(key)
    if column is None:
        raise BadRequestError(f"Cannot sort by '{key}'. Allowed: {', '.join(sorted(allowed))}")
    ordering = column.desc() if params.order == "desc" else column.asc()
    # Stable secondary key so pagination never skips/duplicates rows.
    pk_tiebreak = allowed.get("id")
    return stmt.order_by(ordering, pk_tiebreak.asc()) if pk_tiebreak is not None and column is not pk_tiebreak else stmt.order_by(ordering)


async def count_for(session: AsyncSession, stmt: Select[Any]) -> int:
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    return int((await session.execute(count_stmt)).scalar_one())
