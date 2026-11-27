from __future__ import annotations

from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, File, Form, Response, UploadFile, status
from fastapi.responses import StreamingResponse

from app.deps import FileReader, FileServiceDep, FileWriter
from app.models import StudentFile
from app.schemas import FilePatch, FileRead

router = APIRouter(prefix="/students/{student_id}", tags=["Student files"])


def _read(f: StudentFile, student_id: int) -> FileRead:
    out = FileRead.model_validate(f)
    base = f"/api/v1/students/{student_id}"
    out.download_url = f"{base}/profile-picture" if f.kind.value == "PROFILE_PICTURE" else f"{base}/documents/{f.id}"
    return out


def _stream(f: StudentFile, svc: FileServiceDep, inline: bool) -> StreamingResponse:
    disposition = "inline" if inline else "attachment"
    headers = {
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(f.original_name)}",
        "Content-Length": str(f.size_bytes),
        "X-Content-SHA256": f.sha256,
    }
    return StreamingResponse(svc.stream(f), media_type=f.content_type, headers=headers)


@router.put("/profile-picture", response_model=FileRead, summary="Upload/replace the profile picture")
async def upload_picture(student_id: int, user: FileWriter, svc: FileServiceDep,
                         file: Annotated[UploadFile, File(description="JPEG, PNG or WebP, max 2 MB")]) -> FileRead:
    return _read(await svc.upload_picture(student_id, file, user), student_id)


@router.get("/profile-picture", summary="Download the profile picture")
async def get_picture(student_id: int, user: FileReader, svc: FileServiceDep) -> StreamingResponse:
    return _stream(await svc.get_picture(student_id, user), svc, inline=True)


@router.post("/documents", response_model=FileRead, status_code=status.HTTP_201_CREATED,
             summary="Upload a document (PDF, DOCX, TXT, JPEG, PNG; max 5 MB)")
async def upload_document(
    student_id: int, user: FileWriter, svc: FileServiceDep,
    file: Annotated[UploadFile, File()],
    doc_type: Annotated[str | None, Form(max_length=40, pattern=r"^[A-Z0-9_]+$")] = None,
    description: Annotated[str | None, Form(max_length=500)] = None,
) -> FileRead:
    return _read(await svc.upload_document(student_id, file, doc_type, description, user), student_id)


@router.get("/documents", response_model=list[FileRead], summary="List documents (metadata)")
async def list_documents(student_id: int, user: FileReader, svc: FileServiceDep) -> list[FileRead]:
    return [_read(f, student_id) for f in await svc.list_documents(student_id, user)]


@router.get("/documents/{file_id}", summary="Download a document")
async def download_document(student_id: int, file_id: int, user: FileReader,
                            svc: FileServiceDep) -> StreamingResponse:
    return _stream(await svc.get_file(student_id, file_id, user), svc, inline=False)


@router.get("/documents/{file_id}/metadata", response_model=FileRead, summary="Document metadata")
async def document_metadata(student_id: int, file_id: int, user: FileReader, svc: FileServiceDep) -> FileRead:
    return _read(await svc.get_file(student_id, file_id, user), student_id)


@router.patch("/documents/{file_id}", response_model=FileRead, summary="Edit document metadata")
async def patch_document(student_id: int, file_id: int, body: FilePatch, user: FileWriter,
                         svc: FileServiceDep) -> FileRead:
    return _read(await svc.patch_metadata(student_id, file_id, body, user), student_id)


@router.delete("/documents/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a document")
async def delete_document(student_id: int, file_id: int, user: FileWriter, svc: FileServiceDep) -> Response:
    await svc.delete_file(student_id, file_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
