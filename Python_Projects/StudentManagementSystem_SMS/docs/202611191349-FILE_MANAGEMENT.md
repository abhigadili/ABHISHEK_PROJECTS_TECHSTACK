# File Management

Upload, list, download, edit-metadata and delete for **student profile pictures**, **student documents** and **course documents**. Metadata lives in MySQL; bytes live behind a storage abstraction (local disk today, S3 later).

Code: `libs/sms_common/src/sms_common/storage.py` (abstraction + validation), `services/student/app/{file_service.py, api/v1/files.py}`, `services/course/app/{services.py (files part), api/v1/courses.py (files_router)}`, tables `student_files` / `course_files` (`StoredFileMixin`).

## 1. Endpoints

| Endpoint | Purpose | Limits | Who |
|---|---|---|---|
| `PUT /students/{id}/profile-picture` | upload/replace (old file deleted) | JPEG/PNG/WebP, **2 MB** | the student, ADMIN, TEACHER (`files:write`) |
| `GET /students/{id}/profile-picture` | download inline | | same, `files:read` |
| `POST /students/{id}/documents` (multipart: `file`, `doc_type`, `description`) | upload | PDF, DOCX, TXT, JPEG, PNG, **5 MB** | the student, ADMIN, TEACHER |
| `GET /students/{id}/documents` | list metadata | | same |
| `GET /students/{id}/documents/{fid}` / `…/metadata` | download (attachment) / metadata | | same |
| `PATCH /students/{id}/documents/{fid}` | edit `doc_type`, `description` | | same |
| `DELETE /students/{id}/documents/{fid}` | delete (DB row, then file) | | same |
| `POST /courses/{id}/documents` | upload | + PPTX, **10 MB** | ADMIN, or the TEACHER who created/teaches the course |
| `GET /courses/{id}/documents[/{fid}]` | list / download | | any authenticated user (`files:read`) |
| `PATCH` / `DELETE /courses/{id}/documents/{fid}` | metadata / delete | | as upload |

Metadata response (`FileRead`) — note there is **no storage key and no path**:

```json
{"id": 3, "kind": "DOCUMENT", "doc_type": "TRANSCRIPT", "original_name": "transcript.pdf",
 "content_type": "application/pdf", "size_bytes": 42, "sha256": "0a1b…", "description": "Fall",
 "created_at": "2026-11-19T08:10:11", "download_url": "/api/v1/students/2/documents/3"}
```

## 2. Upload pipeline (`LocalFileStorage.save`)

```
FastAPI UploadFile (spooled by Starlette)
 1. declared Content-Type must be in the endpoint's policy            → 415
 2. file extension must belong to that type                           → 415
 3. read first 64 KiB: empty → 400
 4. SNIFF magic bytes (JPEG FF D8 FF · PNG 89 50 4E 47… · WebP RIFF….WEBP · PDF %PDF- · ZIP PK 03 04 · UTF-8 text)
    sniffed type must equal the declared one (docx/pptx = ZIP refined by extension) → 415
 5. key = "<category>/<uuid4 hex><ext>"  — client file name is NEVER used on disk
 6. stream chunks into "<key>.part"; running size counter aborts at the limit  → 413  (and removes the .part file)
    each chunk written + SHA-256-updated via asyncio.to_thread (blocking work off the event loop)
 7. os.replace(.part → final)  (atomic)
 8. service inserts the metadata row; on DB failure the stored file is deleted (no orphans)
```

Validation facts (all verified by tests/e2e):

* MIME spoofing — an EXE (`MZ…`) declared as `image/png` → 415; PDF bytes declared `image/png` → 415.
* Wrong type for the endpoint (PDF to the picture endpoint) → 415; extension/type mismatch → 415.
* Size is enforced **while streaming**, so a 100 MB upload is rejected after ~limit bytes, not after buffering it all.
* A path-traversal file name (`../../../tmp/evil.png`) is reduced to its basename for *metadata only*; the file is stored under a random name.
* Unit tests: `libs/sms_common/tests/test_storage.py` (random name + round trip, spoofing, type/extension, streaming limit cleanup, empty file, traversal guard).

## 3. Storage layout and safety

```
var/storage/                         (STORAGE_ROOT; /data/storage in containers; bind-mounted to ./var/compose/storage)
├── student-service/students/<student_id>/pictures/<uuid>.png
├── student-service/students/<student_id>/documents/<uuid>.pdf
└── course-service/courses/<course_id>/<uuid>.docx
```

* `_resolve(key)` resolves the final path and requires it to stay under the storage root (`FileStorageError` otherwise) — a defence even if a key were ever attacker-influenced.
* `stored_key` is a unique, internal column; schemas (`FileRead`) simply do not contain it. The e2e suite asserts responses contain neither `stored_key`, `/home/` nor `var/storage`.
* Files are served **only** through the API (never as static files), so every download passes authentication and authorisation.
* Container images run as an unprivileged user; the storage volume is the only writable data path.

## 4. Authorisation

| Operation | Rule | Code |
|---|---|---|
| any student-file operation | ADMIN/TEACHER → any student; STUDENT → only if `students.user_id == token.sub`, else **403** | `StudentFileService._student_for` |
| course upload/patch/delete | ADMIN, or TEACHER who created or is assigned to the course; students → 403 | `CourseService._authorize_modify` |
| course download/list | any authenticated user with `files:read` | |
| anonymous | **401** (gateway and service) | |

Verified: a student cannot list or upload into another student's files (403); a teacher can read any student's files; a student can download a course document but cannot upload one (403); anonymous download → 401.

## 5. Download

`StreamingResponse` over an **async generator** (`LocalFileStorage.open`) that reads 64 KiB chunks in a worker thread, so large files never sit in memory and never block the loop. Headers: `Content-Type` (the verified type), `Content-Length`, `Content-Disposition` (`inline` for pictures, `attachment` for documents, RFC 5987 `filename*=UTF-8''…` encoding of the original name), `X-Content-SHA256` (clients can verify integrity). Verified: downloaded bytes hash identically to the uploaded ones.

Deleting a student/course removes its files from disk **after** the database commit succeeded.

## 6. Extending to S3 (no business-logic change)

`FileStorage` is an ABC with four methods — `save`, `open`, `delete`, `exists`. A cloud implementation is a new class:

```python
class S3FileStorage(FileStorage):
    def __init__(self, bucket: str, client): ...
    async def save(self, category, upload, policy):       # same validation helper, then upload_fileobj with the generated key
    def open(self, key):                                  # async generator over get_object()["Body"].iter_chunks()
    async def delete(self, key): ...
    async def exists(self, key): ...
```

then change **one line** in each service's `deps.py` (`storage: FileStorage = S3FileStorage(...)`, chosen from a `STORAGE_BACKEND` setting). Services, repositories, schemas and routes only depend on the abstraction. For a browser-facing deployment, issue pre-signed GET URLs from `download_url` handlers instead of streaming through the service. *Not implemented here — only local storage exists and is verified.*
