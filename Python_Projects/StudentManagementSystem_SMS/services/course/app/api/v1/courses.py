from __future__ import annotations

from datetime import date
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, File, Form, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse

from app.deps import (
    AdminOnly, CourseReader, CourseServiceDep, CourseWriter, FileReader, FileWriter, storage,
)
from app.enums import CourseStatus
from app.models import CourseFile
from app.schemas import (
    AvailabilityUpdate, CourseCreate, CoursePatch, CourseRead, CourseReplace, CourseSummary,
    FilePatch, FileRead, TeacherAssign,
)
from sms_common.pagination import Page, PageParamsDep

router = APIRouter(prefix="/courses", tags=["Courses"])
files_router = APIRouter(prefix="/courses/{course_id}", tags=["Course files"])


@router.get("", response_model=Page[CourseSummary], summary="List/search courses")
async def list_courses(
    _: CourseReader, svc: CourseServiceDep, params: PageParamsDep,
    q: Annotated[str | None, Query(description="Code, title or description")] = None,
    category_id: int | None = None,
    status_: Annotated[CourseStatus | None, Query(alias="status")] = None,
    teacher_id: int | None = None,
    min_credits: Annotated[int | None, Query(ge=1, le=10)] = None,
    max_credits: Annotated[int | None, Query(ge=1, le=10)] = None,
    available_only: Annotated[bool, Query(description="Only OPEN courses with free seats")] = False,
    starts_after: date | None = None,
) -> Page[CourseSummary]:
    stmt = svc.courses.filtered(
        q=q, category_id=category_id, status=status_, teacher_id=teacher_id, min_credits=min_credits,
        max_credits=max_credits, available_only=available_only, starts_after=starts_after)
    rows, total = await svc.courses.page(stmt, params)
    return Page.build([CourseSummary.model_validate(r) for r in rows], total, params)


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED, summary="Create a course")
async def create_course(body: CourseCreate, user: CourseWriter, svc: CourseServiceDep) -> CourseRead:
    return CourseRead.model_validate(await svc.create(body, user))


@router.get("/{course_id}", response_model=CourseRead,
            summary="Get a course (includes availability: used by the Enrollment service)")
async def get_course(course_id: int, _: CourseReader, svc: CourseServiceDep) -> CourseRead:
    return CourseRead.model_validate(await svc.get(course_id))


@router.put("/{course_id}", response_model=CourseRead, summary="Replace a course")
async def replace_course(course_id: int, body: CourseReplace, user: CourseWriter, svc: CourseServiceDep) -> CourseRead:
    return CourseRead.model_validate(await svc.replace(course_id, body, user))


@router.patch("/{course_id}", response_model=CourseRead, summary="Partially update a course")
async def patch_course(course_id: int, body: CoursePatch, user: CourseWriter, svc: CourseServiceDep) -> CourseRead:
    return CourseRead.model_validate(await svc.patch(course_id, body, user))


@router.patch("/{course_id}/availability", response_model=CourseRead,
              summary="Open / close / archive a course")
async def set_availability(course_id: int, body: AvailabilityUpdate, user: CourseWriter,
                           svc: CourseServiceDep) -> CourseRead:
    return CourseRead.model_validate(await svc.set_availability(course_id, body.status, user))


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a course (no enrollments)")
async def delete_course(course_id: int, _: AdminOnly, svc: CourseServiceDep) -> Response:
    for key in await svc.delete(course_id):
        await storage.delete(key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{course_id}/teachers/{teacher_id}", response_model=CourseRead,
            summary="Assign a teacher (validated via the Auth service, REST)")
async def assign_teacher(course_id: int, teacher_id: int, admin: AdminOnly, svc: CourseServiceDep,
                         body: TeacherAssign | None = None) -> CourseRead:
    return CourseRead.model_validate(
        await svc.assign_teacher(course_id, teacher_id, (body or TeacherAssign()).role, admin))


@router.delete("/{course_id}/teachers/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Unassign a teacher")
async def unassign_teacher(course_id: int, teacher_id: int, _: AdminOnly, svc: CourseServiceDep) -> Response:
    await svc.unassign_teacher(course_id, teacher_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------ files
def _read(f: CourseFile, course_id: int) -> FileRead:
    out = FileRead.model_validate(f)
    out.download_url = f"/api/v1/courses/{course_id}/documents/{f.id}"
    return out


@files_router.post("/documents", response_model=FileRead, status_code=status.HTTP_201_CREATED,
                   summary="Upload a course document (PDF, DOCX, PPTX, TXT, JPEG, PNG; max 10 MB)")
async def upload_document(
    course_id: int, user: FileWriter, svc: CourseServiceDep, file: Annotated[UploadFile, File()],
    doc_type: Annotated[str | None, Form(max_length=40, pattern=r"^[A-Z0-9_]+$")] = None,
    description: Annotated[str | None, Form(max_length=500)] = None,
) -> FileRead:
    return _read(await svc.upload_document(course_id, file, doc_type, description, user), course_id)


@files_router.get("/documents", response_model=list[FileRead], summary="List course documents")
async def list_documents(course_id: int, _: FileReader, svc: CourseServiceDep) -> list[FileRead]:
    return [_read(f, course_id) for f in await svc.list_documents(course_id)]


@files_router.get("/documents/{file_id}", summary="Download a course document")
async def download_document(course_id: int, file_id: int, _: FileReader, svc: CourseServiceDep) -> StreamingResponse:
    f = await svc.get_document(course_id, file_id)
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(f.original_name)}",
               "Content-Length": str(f.size_bytes), "X-Content-SHA256": f.sha256}
    return StreamingResponse(svc.stream(f), media_type=f.content_type, headers=headers)


@files_router.patch("/documents/{file_id}", response_model=FileRead, summary="Edit document metadata")
async def patch_document(course_id: int, file_id: int, body: FilePatch, user: FileWriter,
                         svc: CourseServiceDep) -> FileRead:
    return _read(await svc.patch_document(course_id, file_id, body, user), course_id)


@files_router.delete("/documents/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a document")
async def delete_document(course_id: int, file_id: int, user: FileWriter, svc: CourseServiceDep) -> Response:
    await svc.delete_document(course_id, file_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
