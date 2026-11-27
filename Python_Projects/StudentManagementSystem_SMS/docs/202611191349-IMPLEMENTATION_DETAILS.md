# Implementation Details

Where every feature lives, which classes/functions implement it, and how it works. Paths are relative to the project root. (`common/` = `libs/sms_common/src/sms_common/`.)

## 1. Layout and layering

```
StudentManagementSystem_SMS/
├── libs/sms_common/            shared library (installed editable: pip install -e libs/sms_common)
├── services/{gateway,auth,student,course,enrollment,notification}/
│     app/main.py               FastAPI app + lifespan (start/stop background tasks, engines)
│     app/config.py             Settings(BaseServiceSettings): db_name, service-specific knobs
│     app/models.py             SQLAlchemy models (own database only)
│     app/schemas.py            Pydantic request/response models (Create / Replace / Patch / Read)
│     app/repositories.py       data access (select/insert/update; no commits, no business rules)
│     app/services.py           business logic + TRANSACTION BOUNDARY + outbox events
│     app/deps.py               dependency-injection wiring (db, security, clients, guards)
│     app/api/v1/*.py           thin APIRouter handlers (validate → call service → serialize)
│     app/consumers.py          Kafka handlers (student, course, enrollment, notification)
│     alembic/                  migrations for this service's database
│     Dockerfile
├── scripts/                    init DB, topics, service manager, verification, doc/Postman generators
├── docker/ docker-compose.yml  containers
├── postman/                    collection + environment + sample upload files
└── docs/                       this documentation
```

Request path: `router (api/v1) → service (business rules, commit) → repository (queries) → ORM models`, with Pydantic schemas at the edges. **Route handlers contain no business logic** and services never import FastAPI's `Request`.

## 2. Shared library (`libs/sms_common`)

| Module | What it provides | Key symbols |
|---|---|---|
| `config.py` | env/`.env` settings, URL builders, path anchoring | `BaseServiceSettings`, `MailSettingsMixin`, `resolve_path`, `project_root` |
| `context.py` | request-scoped ids in `contextvars` | `request_id_var`, `correlation_id_var`, `user_id_var`, `correlation_headers()` |
| `logging.py` | JSON/text structured logs, redaction | `configure_logging`, `ContextFilter`, `JsonFormatter`, `redact` |
| `middleware.py` | pure-ASGI stack | `RequestContextMiddleware`, `AccessLogMiddleware`, `TimingMiddleware`, `SecurityHeadersMiddleware`, `ErrorHandlingMiddleware`, `install_middleware` |
| `errors.py` | exception hierarchy + global handlers + envelope | `AppError` and subclasses, `register_exception_handlers`, `error_body` |
| `security.py` | JWT, roles, scopes, FastAPI security deps | `Role`, `ROLE_SCOPES`, `create_token`, `decode_token`, `SecurityDeps.current_user / require`, `CurrentUser` |
| `db.py` | declarative `Base`, engines, sessions, mixins, advisory lock | `Base`, `TimestampMixin`, `StoredFileMixin`, `Database`, `named_lock` |
| `pagination.py` | page params, generic `Page[T]`, whitelisted sort | `PageParamsDep`, `Page`, `apply_sort`, `count_for` |
| `events.py` | event contract | `Topics`, `EventType`, `EventEnvelope`, payload models |
| `outbox.py` | transactional outbox | `OutboxEventMixin`, `enqueue_event`, `OutboxRelay`, `ProcessedEventMixin` |
| `kafka.py` | async producer/consumer | `EventProducer`, `EventConsumer` (idempotency, retry, DLQ) |
| `http_client.py` | outbound HTTP | `ServiceClient` (async), `SyncServiceClient` |
| `storage.py` | file storage + validation | `FileStorage` (ABC), `LocalFileStorage`, `UploadPolicy`, `sniff_content_type` |
| `workers.py` | background task lifecycle | `BackgroundWorkers` |
| `health.py` | `/health`, `/health/ready` | `build_health_router` |
| `app_factory.py` | uniform `FastAPI(...)` construction | `create_app` |

## 3. Feature → service → implementation

### Authentication service (`services/auth/app`)

| Feature | Implementation |
|---|---|
| Registration | `api/v1/auth.py::register` → `services.AuthService.register` (STUDENT role, outbox `UserRegistered` + `NotificationRequested`) |
| Login (JSON / OAuth2 form) | `auth.login`, `auth.oauth2_token` (`OAuth2PasswordRequestForm`) → `AuthService.authenticate` + `issue_tokens` |
| Account lock-out | `AuthService.authenticate` (`failed_login_count`, `locked_until`; commit before raising) |
| Access/refresh JWT | `common/security.py::create_token`; refresh rows in `models.RefreshToken` |
| Refresh rotation + reuse detection | `AuthService.refresh`, `TokenRepository.revoke_all_for_user` (bulk UPDATE) |
| Logout + revocation event | `AuthService.logout` → outbox `TokenRevoked` |
| Password hashing/policy | `passwords.PasswordService` (Argon2id), `validate_password_strength`, `schemas._StrongPasswordMixin` |
| Change / forgot / reset password | `AuthService.change_password`, `forgot_password`, `reset_password`, `models.PasswordResetToken` (SHA-256 only) |
| RBAC + user/role management | `api/v1/users.py`, `roles.py`; `AuthService.create_user/update_user/set_roles/delete_user`, `_guard_last_admin` |
| Seed roles + bootstrap admin | `AuthService.seed` (called in `main.lifespan` via `asyncio.to_thread`) |
| Optional OIDC | `api/v1/oidc.py` (sync HTTPX client, signed `state`) |
| Sync sessions | `deps.py::db = Database(..., sync=True)`; all handlers are `def` |

### Student service (`services/student/app`)

| Feature | Implementation |
|---|---|
| Create/read/PUT/PATCH/delete | `api/v1/students.py` → `services.StudentService.create/get/replace/patch/delete` |
| Profile (1-1), contacts (1-N), interests (N-M) | `models.StudentProfile/ContactInfo/Interest/student_interests`; `StudentService._build/_merge_profile/add_contact/set_interests` |
| Search, filter, sort, paginate | `StudentRepository.filtered/page`, `pagination.apply_sort` |
| Student number | `StudentService._assign_number` (`STU<admission year><id:06d>` after the id is known) |
| Self-service | `GET/PATCH /students/me`, `StudentSelfPatch` |
| Bulk import / bulk status | `StudentService.bulk_import` (one transaction), `StudentRepository.bulk_set_status` (single UPDATE) |
| Statistics report (sync) | `api/v1/students.py::stats` (`def` + `SyncSessionDep`; GROUP BY, outer join, correlated subquery) |
| Departments | `api/v1/departments.py`, `StudentService.create_department/delete_department` |
| Files | `file_service.StudentFileService`, `api/v1/files.py` |
| Events published | `StudentService._emit` (created/updated/deleted via outbox) |
| Events consumed | `consumers.py` (`StudentEnrolled/EnrollmentCancelled` → `adjust_enrollment_count`) |

### Course service (`services/course/app`)

| Feature | Implementation |
|---|---|
| Course CRUD, availability | `api/v1/courses.py` → `CourseService.create/replace/patch/set_availability/delete`; `Course.available_seats`, `Course.is_available` |
| Categories | `api/v1/categories.py`, `CourseService.create_category/patch_category/delete_category` |
| Credits, duration, capacity rules | Pydantic constraints in `schemas.py` + DB `CheckConstraint`s; capacity cannot drop below enrolled count |
| Teachers (association object) | `models.CourseTeacher`; `CourseService.assign_teacher` → **REST call to Auth** (`ServiceClient.get_json`) |
| Teacher-only-own-course rule | `CourseService._authorize_modify` |
| Search/filter | `CourseRepository.filtered` (incl. correlated `EXISTS` for teacher) |
| Course documents | `CourseService.upload_document/...`, `api/v1/courses.py::files_router` |
| Events | publishes `CourseCreated/Updated`; consumes enrollment events (`consumers.py` → `adjust_enrolled`) |

### Enrollment service (`services/enrollment/app`)

| Feature | Implementation |
|---|---|
| Enroll with validation | `EnrollmentService.enroll`: `asyncio.gather(student GET, course GET)` → rules → `named_lock` → duplicate/capacity checks → insert + history + outbox → commit → `repo.reload` |
| Duplicate prevention | `uq_enrollment_student_course` + explicit check; cancelled rows are re-activated (history `CANCELLED → ENROLLED`) |
| Capacity race protection | `common/db.py::named_lock` (MySQL `GET_LOCK`) around count+insert |
| Cancel / complete / grade | `cancel`, `patch` (`EnrollmentPatch`: grade pattern, status transitions) |
| Per-student / per-course / mine | `api/v1/enrollments.py` (`/students/{id}`, `/courses/{id}`, `/me`) with ownership via `student_user_id` |
| Status history | `models.EnrollmentStatusHistory`, `EnrollmentRepository.add_history` |
| Statistics | `EnrollmentRepository.status_counts/per_course/students_with_multiple_active` |
| Snapshots kept fresh | `consumers.py::on_student_updated/on_course_updated` (bulk UPDATE) |
| Student deleted → cancel enrollments | `consumers.py::on_student_deleted` (+ `EnrollmentCancelled` events) |

### Notification service (`services/notification/app`)

| Feature | Implementation |
|---|---|
| Event → notification | `consumers.py::_queue` + `HANDLERS` |
| Templates | `templates.py::TemplateRenderer/REGISTRY`, `templates/email/*.j2` |
| Backends | `email_backends.py::SmtpBackend/FileBackend/ConsoleBackend/build_backend/build_message` |
| Async delivery, retry/back-off, DEAD | `dispatcher.py::NotificationDispatcher` (`_claim`, `_send_one`, `run`) |
| History/attempts | `models.Notification/NotificationAttempt`, `api/v1/notifications.py` |
| Queue API (202), retry, preview | `queue_notification` (BackgroundTasks), `retry`, `preview` |

### API Gateway (`services/gateway/app`)

| Feature | Implementation |
|---|---|
| Routing table | `routing.py::build_routes/resolve` (prefix → service URL from settings) |
| Streaming proxy, timeouts, retry, error mapping | `proxy.py::Proxy.forward` |
| Centralised JWT validation, public paths | `main.py::authenticate`, `PUBLIC`, `PUBLIC_PREFIXES` |
| Revocation cache | `revocations.py::RevocationCache/listen` (Kafka consumer in the lifespan) |
| Rate limiting (3 policies) | `ratelimit.py` (`Limiter`, `ip_key`, `user_or_ip_key`, `rate_limit_handler`), decorators `login_route/auth_routes/api_routes` in `main.py` |
| Aggregated health, merged OpenAPI/Swagger/ReDoc | `main.py::services_health`, `merged_openapi`, `swagger_ui`, `redoc` (concurrent fetch with `asyncio.gather`; schema names namespaced per service) |
| Correlation ids / forwarding headers | `proxy._outgoing_headers` (`X-Forwarded-*`, new `X-Request-ID`, same `X-Correlation-ID`) |

## 4. How the important mechanisms work

### 4.1 Transaction boundary + outbox in a service method

```python
# services/enrollment/app/services.py (abridged)
async with named_lock(self.db.async_engine, f"sms:enroll:course:{course['id']}"):
    existing = await self.repo.find(student["id"], course["id"])      # SELECT … FOR UPDATE
    if existing and existing.status is not EnrollmentStatus.CANCELLED:
        raise ConflictError("Student is already enrolled …")          # → 409
    if await self.repo.active_count(course["id"]) >= course["capacity"]:
        raise ConflictError(f"Course {course['code']} is full")
    enrollment = Enrollment(...); self.repo.add(enrollment)
    self.repo.add_history(enrollment, None, "ENROLLED", user.id, "enrolled")
    await self.session.flush()
    emit(self.session, enrollment, EventType.STUDENT_ENROLLED, actor=user.id)   # INSERT outbox_events
    await self.session.commit()                                       # data + event commit together
return await self.repo.reload(enrollment.id)
```

### 4.2 Lifespan, background tasks, graceful shutdown

Each `main.py` has an `@asynccontextmanager lifespan`: startup creates tasks through `BackgroundWorkers.start(name, factory)` (outbox relay, Kafka consumer, notification dispatcher, gateway revocation listener); shutdown sets a shared `asyncio.Event`, waits up to 5 s for graceful exit, cancels stragglers, stops the producer, closes HTTPX clients and disposes engines. `/health/ready` reports task status.

### 4.3 Dependency injection chain (student example)

`Depends(db.session_dependency)` → `AsyncSession` → `get_student_service(session)` → `StudentService` → handler. Security: `Depends(security.require(Role.ADMIN, Role.TEACHER, scopes=["students:write"]))` → validates JWT → `CurrentUser`. Guards are `Annotated` aliases in `deps.py` (`StaffWriter`, `AdminOnly`, `FileReader`, …) so routes stay declarative.

### 4.4 Sync vs async — the decisions actually made

| Place | Choice | Reason |
|---|---|---|
| Auth endpoints | `def` + sync SQLAlchemy | Argon2 is CPU-heavy; FastAPI runs `def` handlers in a threadpool, so the loop is never blocked |
| `GET /students/stats` | `def` + sync session | a blocking report query demonstrating the threadpool path next to async CRUD |
| OIDC callback | `def` + `SyncServiceClient` | sync HTTP in a sync handler |
| All other handlers | `async def` + async SQLAlchemy + `ServiceClient` | I/O-bound: many in-flight requests per process |
| File hashing/writing | `asyncio.to_thread` inside async code | blocking disk/CPU work kept off the event loop |
| Enrollment validation | `asyncio.gather` | two independent REST calls in parallel |
| Gateway health/OpenAPI merge | `asyncio.gather` | concurrent fan-out to 5 services |
| Notification sending | `gather` + `Semaphore(5)` | bounded concurrent SMTP |
| Background loops | `asyncio.create_task` via `BackgroundWorkers` | relay, consumers, dispatcher |
| `POST /notifications` | `BackgroundTasks.add_task(dispatcher.wake)` | run after the 202 response is sent |

Rule applied throughout: never call a blocking function directly inside `async def`.

## 5. Operational scripts

| Script | Purpose |
|---|---|
| `scripts/init_databases.py` | create the 5 databases (idempotent) |
| `scripts/create_topics.py`, `scripts/kafka_up.sh` | topics + DLQs; local single-node KRaft broker in Docker |
| `scripts/svc.sh start|stop|restart|status [svc…]` | run services with uvicorn (PID files in `var/run`, logs in `var/logs`) |
| `scripts/run_tests.sh` | 38 unit tests |
| `scripts/e2e_verify.py [--docker]` | 199 end-to-end checks through the gateway |
| `scripts/verify_rate_limit.py`, `verify_email.py`, `verify_oidc.py` | focused verification (throw-away instances / mock servers) |
| `scripts/generate_postman.py`, `run_postman_collection.py` | build and replay the Postman collection |
| `scripts/gen_docs_data.py` | regenerate DB schema / API reference / samples from the live system |
| `scripts/fix_downgrade.py` | MySQL-safe Alembic downgrades |

## 6. Known limits (honest list)

* Single Kafka broker (RF 1); in-memory rate-limit counters; HS256 shared secret; OIDC verified only against a mock provider; local-disk storage only; SMTP verified against a local server only; no front-end (reset links point at `FRONTEND_URL`, token is posted to the API); `kafka-ui` and `mailpit` Compose profiles not started during verification.
* Consumer replay on a *new* consumer group re-processes history — safe because handlers are idempotent, but it means a brand-new `notification-service` group would re-send e-mails for historical events (the unique `event_id` prevents duplicates only within one database).
