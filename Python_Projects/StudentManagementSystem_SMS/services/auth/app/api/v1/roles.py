from __future__ import annotations

from fastapi import APIRouter

from app.deps import AdminDep, AuthServiceDep
from app.schemas import RoleRead
from app.services import role_scopes

router = APIRouter(prefix="/roles", tags=["Roles (admin)"])


@router.get("", response_model=list[RoleRead], summary="Roles with their OAuth2 scopes and user counts")
def list_roles(_: AdminDep, svc: AuthServiceDep) -> list[RoleRead]:
    return [
        RoleRead(id=r.id, name=r.name, description=r.description, scopes=role_scopes(r.name),
                 user_count=count)
        for r, count in svc.roles.list_with_user_counts()
    ]
