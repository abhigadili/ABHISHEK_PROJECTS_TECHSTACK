from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.deps import AdminOnly, CurrentUserDep, StudentServiceDep
from app.schemas import DepartmentCreate, DepartmentRead

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("", response_model=list[DepartmentRead], summary="List departments")
async def list_departments(_: CurrentUserDep, svc: StudentServiceDep) -> list[DepartmentRead]:
    return [DepartmentRead.model_validate(d) for d in await svc.departments.list()]


@router.post("", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED,
             summary="Create a department")
async def create_department(body: DepartmentCreate, _: AdminOnly, svc: StudentServiceDep) -> DepartmentRead:
    return DepartmentRead.model_validate(await svc.create_department(body))


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an empty department")
async def delete_department(dept_id: int, _: AdminOnly, svc: StudentServiceDep) -> Response:
    await svc.delete_department(dept_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
