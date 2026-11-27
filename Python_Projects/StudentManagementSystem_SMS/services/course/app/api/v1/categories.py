from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.deps import AdminOnly, CourseReader, CourseServiceDep
from app.schemas import CategoryCreate, CategoryPatch, CategoryRead

router = APIRouter(prefix="/categories", tags=["Course categories"])


@router.get("", response_model=list[CategoryRead], summary="List categories")
async def list_categories(_: CourseReader, svc: CourseServiceDep) -> list[CategoryRead]:
    return [CategoryRead.model_validate(c) for c in await svc.categories.list()]


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED, summary="Create a category")
async def create_category(body: CategoryCreate, _: AdminOnly, svc: CourseServiceDep) -> CategoryRead:
    return CategoryRead.model_validate(await svc.create_category(body))


@router.patch("/{cat_id}", response_model=CategoryRead, summary="Update a category")
async def patch_category(cat_id: int, body: CategoryPatch, _: AdminOnly, svc: CourseServiceDep) -> CategoryRead:
    return CategoryRead.model_validate(await svc.patch_category(cat_id, body))


@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an empty category")
async def delete_category(cat_id: int, _: AdminOnly, svc: CourseServiceDep) -> Response:
    await svc.delete_category(cat_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
