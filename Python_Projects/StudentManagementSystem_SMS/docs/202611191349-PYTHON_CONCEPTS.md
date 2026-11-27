# Python, FastAPI, SQLAlchemy & Async Concepts Demonstrated

Each concept names the real file and symbol where you can read it in context. Excerpts are copied from the code base. Paths are relative to the project root; `common/` = `libs/sms_common/src/sms_common/`.

## 1. Core Python

| Concept | Where | Why it is used there |
|---|---|---|
| Classes, constructors, encapsulation | `auth/app/passwords.py::PasswordService` | hides Argon2 behind `hash/verify/needs_rehash/burn_time`; the dummy hash is an internal detail set in `__init__` |
| **Abstraction + ABC** | `common/storage.py::FileStorage(ABC)` with `@abstractmethod save/open/delete/exists`; `notification/app/email_backends.py::EmailBackend(ABC)` | business code depends on the contract, not on disk/S3 or SMTP/file |
| **Inheritance** | `common/errors.py` — `AppError` → `NotFoundError`, `ConflictError`, … (`UnauthorizedError.__init__` extends the parent's); `LocalFileStorage(FileStorage)`; ORM models inherit `Base` + mixins (`class Student(TimestampMixin, Base)`) | one base handler renders every subclass |
| **Polymorphism** | `build_backend()` returns `SmtpBackend | FileBackend | ConsoleBackend`; the dispatcher just calls `backend.send(msg)` | swap behaviour by configuration |
| Multiple inheritance / mixins | `OutboxEventMixin`, `ProcessedEventMixin`, `StoredFileMixin`, `TimestampMixin`; `Settings(BaseServiceSettings, MailSettingsMixin)` in notification | share columns/settings across services |
| **Decorators** | `@lru_cache` (`get_settings`), `@asynccontextmanager` (lifespan, `named_lock`), `@router.get(...)`, `@limiter.limit(...)` on gateway proxy routes, `@field_validator`, `@model_validator`, `@property` (`Course.is_available`), `@abstractmethod`, `@declared_attr.directive` (outbox indexes) | cross-cutting behaviour without touching function bodies |
| Custom higher-order function / closure | `common/security.py::SecurityDeps.require()` returns an inner `dependency` closing over `allowed` roles and `scopes`; `_wrap_send` in `middleware.py` | build guards/wrappers from parameters |
| **Generators** | `LocalFileStorage.open` is an **async generator** (`yield chunk`); `Database.session_dependency` / `sync_session_dependency` are generator dependencies (`yield session` … cleanup) | stream large files; guarantee rollback/close |
| **Iterators** | `async for … in storage.open(key)` (consumed by `StreamingResponse`); `async for chunk in upload` style reading in `save`; `rows.scalars()` / `.unique()` result iterators | lazy, memory-bounded processing |
| **Context managers** | `named_lock` (async, `GET_LOCK`/`RELEASE_LOCK`), `Database.async_session()` / `sync_session()`, `async with EventProducer(...)`, `async with self._sem, self.session_factory() as session` | resources are released even on error |
| **Async context managers** | `async with engine.connect()`, `async with session_factory()`, `async with httpx.AsyncClient()` | |
| Exception handling | `common/errors.py` hierarchy + `register_exception_handlers`; `try/except/else/finally` in `dispatcher._send_one`, `kafka.EventConsumer._handle_message`, `LocalFileStorage.save` (`except BaseException: tmp.unlink(); raise`) | map failures to HTTP/DLQ/retry decisions |
| Type hints (PEP 484/604/585) | everywhere: `str | None`, `list[int]`, `dict[str, Any]`, `Annotated[...]`, `Callable[..., CurrentUser]`, generics (`Page[T]`, `Handler = Callable[[AsyncSession, EventEnvelope], Awaitable[None]]`) | readable contracts; Pydantic/FastAPI also *use* them at runtime |
| **Dataclasses** | `common/storage.py::StoredObject`, `UploadPolicy` (`frozen=True, slots=True`); `gateway/app/routing.py::Route`; `notification/app/templates.py::TemplateSpec` | small immutable value objects |
| **Enumerations** | `Role`, `EventType`, `StudentStatus`, `CourseStatus`, `EnrollmentStatus`, `NotificationStatus` (`class X(str, Enum)`) | JSON-friendly, validated by Pydantic and SQLAlchemy |
| Collections | `dict` registries (`REGISTRY`, `HANDLERS`, `ROLE_SCOPES`), `set` operations (`requested & allowed` scopes, `{...} - set(...)`), `defaultdict`, `dict.fromkeys` for ordered de-duplication | |
| **Comprehensions** | `[StudentSummary.model_validate(r) for r in rows]`, `{s.value: 0 for s in StudentStatus}`, set/dict comprehensions in `gateway/main.py` | |
| Lambda | `@limiter.limit(lambda: settings.rate_limit_login, key_func=ip_key)` (limit read at request time), `lambda: producer.started …` health checks, `sorted(..., key=lambda x: …)` | tiny callbacks |
| Modules and packages | `libs/sms_common` (installable package with `pyproject.toml`, `src/` layout), per-service `app` packages with `api/v1` sub-packages | |
| Dependency management | `requirements.txt` (direct deps) → `requirements.lock` (`uv pip compile`, pinned for Docker); `pyproject.toml` for the library | |
| Virtual environments | `uv venv --python 3.12 .venv`; `scripts/svc.sh` runs `.venv/bin/uvicorn` | |
| `contextvars` | `common/context.py` (`request_id_var`, `correlation_id_var`, `user_id_var`) | per-request state that is safe across `await` and threadpool hops |
| `functools`, `pathlib`, `secrets`, `hashlib`, `uuid`, `dataclasses`, `email` stdlib | token generation (`secrets.token_urlsafe`), SHA-256 of reset tokens/files, `uuid4().hex` file names, `email.message.EmailMessage` | |
| PEP 8 | consistent naming/imports/line width; verified by reading, no linter gate is configured | |

### Excerpt: ABC + polymorphism (`notification/app/email_backends.py`)

```python
class EmailBackend(ABC):
    name = "abstract"
    @abstractmethod
    async def send(self, message: EmailMessage) -> str: ...

class FileBackend(EmailBackend):
    async def send(self, message):
        path = self.dir / f"{stamp}-{uuid.uuid4().hex[:8]}.eml"
        await asyncio.to_thread(path.write_bytes, bytes(message))   # blocking I/O off the loop
        return str(message["Message-ID"])

def build_backend(s: Settings) -> EmailBackend:      # factory
    kind = s.email_backend.lower()
    return SmtpBackend(s) if kind == "smtp" else ConsoleBackend() if kind == "console" else FileBackend(s.email_file_dir)
```

### Excerpt: async generator + iterator protocol (`common/storage.py`)

```python
async def open(self, key: str) -> AsyncIterator[bytes]:
    path = self._resolve(key)
    with open(path, "rb") as fh:
        while True:
            chunk = await asyncio.to_thread(fh.read, CHUNK)   # 64 KiB at a time, off the event loop
            if not chunk:
                break
            yield chunk
# consumed by:  StreamingResponse(svc.stream(f), media_type=f.content_type, headers=headers)
```

## 2. FastAPI

| Feature | Where |
|---|---|
| App initialisation | `common/app_factory.py::create_app` (`FastAPI(title, description, lifespan, openapi_tags, swagger_ui_parameters)`) |
| **Lifespan** (startup/shutdown) | every `main.py` — `@asynccontextmanager async def lifespan(app)`; gateway: revocation listener; services: relay/consumers/dispatcher; shutdown: `workers.stop_all()`, `producer.stop()`, `db.dispose()` |
| `APIRouter`, prefixes, tags, nested routing | `api/v1/*.py` (`APIRouter(prefix="/students", tags=["Students"])`), `api/v1/__init__.py` aggregates, `main.py` mounts at `settings.api_prefix`; nested: `/students/{student_id}/documents` |
| Versioned routes | `/api/v1` prefix from `API_PREFIX` |
| Path / query / body / header / form / file parameters | `student_id: int`, `Query(...)`, Pydantic bodies, `Authorization` via the OAuth2 scheme, `Form(...)` + `UploadFile`/`File(...)` in `student/app/api/v1/files.py`, `OAuth2PasswordRequestForm` |
| `response_model`, status codes | `@router.post("", response_model=StudentRead, status_code=201)`; `Response(status_code=204)` for deletes; `202` on queued work |
| **Dependency injection** (`Depends`) | `deps.py` of each service: `SessionDep`, `get_student_service`, `PageParamsDep` (`common/pagination.py::page_params`), `SettingsDep` |
| **Security dependencies** | `OAuth2PasswordBearer(scopes=…)`, `SecurityScopes`, `Security(current_user, scopes=[…])`, `SecurityDeps.require(roles, scopes)` |
| Middleware, **custom middleware** | `common/middleware.py` (5 ASGI classes) + `CORSMiddleware`; the gateway's rate limiter is SlowAPI applied as route decorators + a 429 exception handler (not an ASGI middleware class); order documented in the module docstring |
| **Exception handlers** | `register_exception_handlers`: `AppError`, `StarletteHTTPException`, `RequestValidationError`, `IntegrityError`→409, `OperationalError`→503, `Exception`→500; `HTTPException` is handled (FastAPI raises it for 404/405) |
| **BackgroundTasks** | `notification/api/v1/notifications.py::queue_notification` (`background.add_task(dispatcher.wake)` after the 202) |
| CORS | `install_middleware` — explicit origins/methods/headers, exposed headers |
| Request validation / response serialisation | Pydantic on both sides; `response_model` filters out anything not in the schema |
| OpenAPI customisation | tags + descriptions per service; gateway `merged_openapi` builds one document (schema names namespaced); `swagger_ui_parameters={"persistAuthorization": True}`; scopes appear in the *Authorize* dialog |
| Swagger UI / ReDoc | `/docs`, `/redoc` on every service and (merged) on the gateway |
| Streaming responses | `StreamingResponse` for downloads and for the gateway proxy |
| Sync + async endpoints side by side | Auth (`def`), `/students/stats` (`def`), everything else `async def` |

## 3. Pydantic v2

| Feature | Where |
|---|---|
| `BaseModel`, `Field(min_length, max_length, ge, le, pattern)` | all `schemas.py` |
| Optional / required / defaults | `str | None = None`, `Annotated[int, Field(ge=1)]` |
| Nested models, list fields | `StudentCreate(profile: ProfileIn | None, contacts: list[ContactIn], interests: list[str])`, `StudentRead.department` |
| Enum validation | `status: StudentStatus`, `roles: list[Role]` |
| **Field validators** | `_StudentBase._names` (letters/space/hyphen only), `_dob` (past, plausible), `RegisterRequest._lower`, `_strong` (password policy via `field_validator("password","new_password")`) |
| **Model validators** | `ChangePasswordRequest._different`, `_CourseBase._dates` (end ≥ start), `StudentCreate._one_primary_per_type`, `ContactIn._check_value`, `EnrollmentPatch._non_empty` |
| Separate Create / Replace / Patch / Read schemas | `StudentCreate`, `StudentReplace` (PUT), `StudentPatch` (PATCH), `StudentSelfPatch`, `StudentSummary`, `StudentRead` |
| Serialization/deserialization | `model_dump(exclude_unset=True)` for PATCH, `model_dump_json()` for events, `model_validate_json()` for Kafka messages |
| ORM integration | `model_config = ConfigDict(from_attributes=True)` on Read models; `validation_alias="interest_names"` / `"role_names"` read model **properties** |
| Settings | `pydantic-settings` (`BaseServiceSettings`, `SecretStr`, `computed_field`) |
| Generics | `Page[T]` (`common/pagination.py`) |

SQLAlchemy models are **never** returned directly — handlers always convert through a Read schema.

## 4. SQLAlchemy 2.x

See DATABASE.md §3 for the full table. Index of where to look: declarative models (`*/models.py`), composite keys (`user_roles`, `course_teachers`), relationships + `back_populates` + cascades, lazy/joined/selectin loading (`student/app/repositories.py`), joins/aggregations/subqueries (`student/api/v1/students.py::stats`, `enrollment/repositories.py`), bulk operations (`bulk_import`, `bulk_set_status`), transactions (`services.py`: `flush()` → `commit()` / `rollback()`), async + sync sessions (`common/db.py::Database`), pooling, `with_for_update(skip_locked=True)`.

## 5. Asyncio and concurrency

| Concept | Where |
|---|---|
| `async def` / `await` | all async handlers, repositories, Kafka and HTTP calls |
| `asyncio.gather` (concurrent operations) | `EnrollmentService.enroll` (student + course lookups), `gateway/main.py::services_health` and `merged_openapi`, `NotificationDispatcher.dispatch_once`, `BackgroundWorkers.stop_all`; used in the tests to fire 8 concurrent enrollments |
| Tasks and task management | `BackgroundWorkers.start()` → `asyncio.create_task(name=…)`, done-callbacks log crashes, `stop_all()` = set event → `asyncio.wait(timeout)` → cancel stragglers |
| `asyncio.Event` | shared `stop` signal; `OutboxRelay.wake()` / `NotificationDispatcher.wake()` interrupt the idle sleep (`asyncio.wait_for(event.wait(), timeout)`) |
| `asyncio.Semaphore` | bound parallel e-mail sends |
| `asyncio.to_thread` | file writes/hash, `AuthService.seed` at start-up, `FileBackend.send` |
| Async generators / context managers | `LocalFileStorage.open`, `named_lock`, `Database.async_session`, `EventProducer.__aenter__/__aexit__` |
| Async HTTP | `httpx.AsyncClient` in `ServiceClient` and the gateway `Proxy` (streaming `send(stream=True)`) |
| Async Kafka | `AIOKafkaProducer/Consumer` in `common/kafka.py` |
| Async DB | `create_async_engine`, `AsyncSession`, `aiomysql` |
| Sync-in-async done right | blocking calls only via threadpool: `def` handlers, `to_thread`, `run_in_executor` equivalents; never inline |
| Cancellation & shutdown | `except asyncio.CancelledError: raise` in loops so tasks stop promptly |

### When to use which (the practical guide)

* **`async def`** whenever the handler spends its time *waiting* (DB, HTTP, Kafka, SMTP): one process serves hundreds of concurrent requests.
* **`def`** for CPU-heavy or blocking-library work (password hashing, a blocking SDK): FastAPI runs it in a threadpool. The Auth service is the example.
* **Never** put a blocking call (`time.sleep`, `requests.get`, `hashlib` on big data, sync DB) inside `async def`; if you must, wrap it in `asyncio.to_thread`.
* Use `gather` for *independent* awaits; a `Semaphore` to cap them.

## 6. A concept tour in one request

`PUT /api/v1/students/{id}/profile-picture` touches: route + `UploadFile` (FastAPI) → `FileWriter` security dependency (scope check, DI) → `StudentFileService` (service layer) → `LocalFileStorage.save` (ABC implementation, content sniffing, async streaming with `to_thread`, dataclass `UploadPolicy`) → SQLAlchemy `StudentFile` (mixin, relationships, commit/rollback with file cleanup) → `FileRead` (Pydantic, no path leakage) → middleware stack (context ids, access log, timing, security headers) → error envelope on failure.

Suggested reading order for a newcomer: `common/errors.py` → `common/security.py` → `student/app/{models,schemas,repositories,services}.py` → `student/app/api/v1/students.py` → `common/outbox.py` + `common/kafka.py` → `enrollment/app/services.py` → `gateway/app/main.py`.
