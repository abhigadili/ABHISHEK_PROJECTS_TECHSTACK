import io

import pytest
from fastapi import UploadFile
from starlette.datastructures import Headers

from sms_common.errors import BadRequestError, PayloadTooLargeError, UnsupportedMediaError
from sms_common.storage import IMAGE_POLICY, LocalFileStorage, UploadPolicy

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def upload(name: str, data: bytes, ctype: str) -> UploadFile:
    return UploadFile(io.BytesIO(data), filename=name, headers=Headers({"content-type": ctype}))


@pytest.fixture
def storage(tmp_path):
    return LocalFileStorage(tmp_path)


async def test_saves_with_random_name_and_roundtrips(storage, tmp_path):
    obj, ctype = await storage.save("students/1", upload("../../evil.png", PNG, "image/png"), IMAGE_POLICY)
    assert ctype == "image/png" and obj.key.startswith("students/1/") and "evil" not in obj.key
    assert (tmp_path / obj.key).is_file()
    assert b"".join([c async for c in storage.open(obj.key)]) == PNG
    await storage.delete(obj.key)
    assert not await storage.exists(obj.key)


async def test_rejects_spoofed_content(storage):
    with pytest.raises(UnsupportedMediaError):
        await storage.save("x", upload("a.png", b"MZ\x90 exe", "image/png"), IMAGE_POLICY)


async def test_rejects_wrong_declared_type_and_extension(storage):
    with pytest.raises(UnsupportedMediaError):
        await storage.save("x", upload("a.png", PNG, "application/pdf"), IMAGE_POLICY)
    with pytest.raises(UnsupportedMediaError):
        await storage.save("x", upload("a.exe", PNG, "image/png"), IMAGE_POLICY)


async def test_size_limit_enforced_while_streaming_and_cleans_up(storage, tmp_path):
    policy = UploadPolicy({"image/png": (".png",)}, max_bytes=100)
    with pytest.raises(PayloadTooLargeError):
        await storage.save("x", upload("a.png", PNG + b"0" * 500, "image/png"), policy)
    assert not list(tmp_path.rglob("*.part")) and not list(tmp_path.rglob("*.png"))


async def test_empty_file_rejected(storage):
    with pytest.raises(BadRequestError):
        await storage.save("x", upload("a.png", b"", "image/png"), IMAGE_POLICY)


def test_path_traversal_guard(storage):
    from sms_common.errors import FileStorageError

    with pytest.raises(FileStorageError):
        storage._resolve("../../etc/passwd")
