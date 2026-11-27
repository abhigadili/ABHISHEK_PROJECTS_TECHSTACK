"""File storage abstraction + upload validation.

Business code depends on :class:`FileStorage` only.  ``LocalFileStorage`` is the
default; an ``S3FileStorage`` implementing the same four methods can replace it
without touching services (see FILE_MANAGEMENT.md).

Security properties:
* the on-disk name is ``<category>/<uuid4hex><ext>`` - the client's file name is
  **never** used as a path and is kept only as metadata;
* every resolved path is checked to stay inside the storage root;
* storage keys are internal: API schemas never expose them or absolute paths;
* uploads are size-limited *while streaming* and content-sniffed (magic bytes),
  not just trusted by their declared MIME type.
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import uuid
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile

from sms_common.errors import (
    BadRequestError,
    FileStorageError,
    NotFoundError,
    PayloadTooLargeError,
    UnsupportedMediaError,
)

CHUNK = 64 * 1024


@dataclass(frozen=True, slots=True)
class StoredObject:
    key: str
    size: int
    sha256: str


@dataclass(frozen=True, slots=True)
class UploadPolicy:
    """Which files a given endpoint accepts."""

    allowed_types: dict[str, tuple[str, ...]]  # MIME type -> allowed extensions
    max_bytes: int


IMAGE_POLICY = UploadPolicy(
    {"image/jpeg": (".jpg", ".jpeg"), "image/png": (".png",), "image/webp": (".webp",)},
    max_bytes=2 * 1024 * 1024,
)
DOCUMENT_POLICY = UploadPolicy(
    {
        "application/pdf": (".pdf",),
        "image/jpeg": (".jpg", ".jpeg"),
        "image/png": (".png",),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (".docx",),
        "text/plain": (".txt",),
    },
    max_bytes=5 * 1024 * 1024,
)
COURSE_DOC_POLICY = UploadPolicy(
    {
        **DOCUMENT_POLICY.allowed_types,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": (".pptx",),
    },
    max_bytes=10 * 1024 * 1024,
)


def sniff_content_type(head: bytes) -> str | None:
    """Detect the real type from magic bytes for the formats we accept."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if head.startswith(b"PK\x03\x04"):
        return "application/zip"  # docx / pptx container; refined by extension
    try:
        head.decode("utf-8")
        if b"\x00" not in head:
            return "text/plain"
    except UnicodeDecodeError:
        pass
    return None


_ZIP_BASED = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


class FileStorage(ABC):
    """Storage contract (the abstraction S3/GCS/Azure would implement)."""

    @abstractmethod
    async def save(self, category: str, upload: UploadFile, policy: UploadPolicy) -> tuple[StoredObject, str]:
        """Validate + persist an upload.  Returns (stored object, verified MIME type)."""

    @abstractmethod
    def open(self, key: str) -> AsyncIterator[bytes]:
        """Stream the object's bytes."""

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    async def exists(self, key: str) -> bool: ...


class LocalFileStorage(FileStorage):
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise FileStorageError("Invalid storage key")  # path traversal guard
        return path

    async def save(self, category: str, upload: UploadFile, policy: UploadPolicy) -> tuple[StoredObject, str]:
        original = os.path.basename(upload.filename or "")
        ext = Path(original).suffix.lower()
        declared = (upload.content_type or "").split(";")[0].strip().lower()
        if declared not in policy.allowed_types:
            raise UnsupportedMediaError(
                f"File type '{declared or 'unknown'}' is not allowed. "
                f"Allowed: {', '.join(sorted(policy.allowed_types))}"
            )
        if ext not in policy.allowed_types[declared]:
            raise UnsupportedMediaError(f"Extension '{ext}' does not match type {declared}")

        head = await upload.read(CHUNK)
        if not head:
            raise BadRequestError("Uploaded file is empty")
        sniffed = sniff_content_type(head)
        if sniffed == "application/zip":
            sniffed = _ZIP_BASED.get(ext, sniffed)
        if sniffed != declared and not (declared == "text/plain" and sniffed == "text/plain"):
            raise UnsupportedMediaError("File content does not match its declared type")

        key = f"{category}/{uuid.uuid4().hex}{ext}"
        path = self._resolve(key)
        tmp = path.with_suffix(path.suffix + ".part")
        path.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        size = 0
        try:
            with open(tmp, "wb") as fh:
                chunk = head
                while chunk:
                    size += len(chunk)
                    if size > policy.max_bytes:
                        raise PayloadTooLargeError(
                            f"File exceeds the {policy.max_bytes // 1024} KB limit"
                        )
                    # hashing + disk writes are blocking: keep them off the event loop
                    await asyncio.to_thread(_write_and_hash, fh, digest, chunk)
                    chunk = await upload.read(CHUNK)
            os.replace(tmp, path)
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
        return StoredObject(key=key, size=size, sha256=digest.hexdigest()), declared

    async def open(self, key: str) -> AsyncIterator[bytes]:  # type: ignore[override]
        path = self._resolve(key)
        if not path.is_file():
            raise NotFoundError("Stored file is missing")
        with open(path, "rb") as fh:
            while True:
                chunk = await asyncio.to_thread(fh.read, CHUNK)
                if not chunk:
                    break
                yield chunk

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._resolve(key).unlink, True)

    async def exists(self, key: str) -> bool:
        return await asyncio.to_thread(self._resolve(key).is_file)


def _write_and_hash(fh, digest, chunk: bytes) -> None:  # type: ignore[no-untyped-def]
    fh.write(chunk)
    digest.update(chunk)
