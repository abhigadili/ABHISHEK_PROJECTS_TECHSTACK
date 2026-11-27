from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import func, select

from app.deps import AdminDep, AuthServiceDep, SessionDep
from app.models import User
from app.schemas import RoleAssignment, UserCreate, UserRead, UserUpdate
from sms_common.pagination import Page, PageParamsDep, apply_sort

router = APIRouter(prefix="/users", tags=["Users (admin)"])

_SORTABLE = {"id": User.id, "email": User.email, "full_name": User.full_name,
             "created_at": User.created_at}


@router.get("", response_model=Page[UserRead], summary="List/search users")
def list_users(
    _: AdminDep, session: SessionDep, svc: AuthServiceDep, params: PageParamsDep,
    q: Annotated[str | None, Query(description="Search e-mail or name")] = None,
    role: Annotated[str | None, Query(description="ADMIN | TEACHER | STUDENT")] = None,
    is_active: bool | None = None,
) -> Page[UserRead]:
    stmt = svc.users.search(q=q, role=role.upper() if role else None, is_active=is_active)
    total = session.execute(select(func.count()).select_from(stmt.order_by(None).subquery())).scalar_one()
    stmt = apply_sort(stmt, params, _SORTABLE, "id").limit(params.size).offset(params.offset)
    items = [UserRead.model_validate(u) for u in session.scalars(stmt).unique()]
    return Page.build(items, int(total), params)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED,
             summary="Create a user with explicit roles")
def create_user(body: UserCreate, _: AdminDep, svc: AuthServiceDep) -> UserRead:
    return UserRead.model_validate(svc.create_user(body))


@router.get("/{user_id}", response_model=UserRead, summary="Get a user")
def get_user(user_id: int, _: AdminDep, svc: AuthServiceDep) -> UserRead:
    return UserRead.model_validate(svc.get_user(user_id))


@router.patch("/{user_id}", response_model=UserRead, summary="Update name / activation")
def update_user(user_id: int, body: UserUpdate, _: AdminDep, svc: AuthServiceDep) -> UserRead:
    return UserRead.model_validate(svc.update_user(user_id, body))


@router.put("/{user_id}/roles", response_model=UserRead, summary="Replace the user's roles")
def set_roles(user_id: int, body: RoleAssignment, _: AdminDep, svc: AuthServiceDep) -> UserRead:
    return UserRead.model_validate(svc.set_roles(user_id, [r.value for r in body.roles]))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a user")
def delete_user(user_id: int, admin: AdminDep, svc: AuthServiceDep) -> Response:
    svc.delete_user(user_id, admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
