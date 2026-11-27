# 27 - Implementation Change Log

Chronological record (append-only). Date of all phases: **2026-11-10**. Common to every phase: the four existing databases were only **added to** (`dn_*` tables); no existing table, row or database was dropped, renamed or modified.

## Phase 1 - Solution setup, MySQL, EF migrations, CRUD (Student, Course, Notification, Enrollment data layer)
- **Features:** solution + 11 projects, BuildingBlocks (Common, EventContracts, Messaging, Observability), Student/Course/Notification/Enrollment services with entities, Fluent API, repositories, DTOs, paging/sorting, validation, JSON error handling.
- **Files created:** `StudentManagement.sln`, `Directory.Build.props`, `BuildingBlocks/**`, `Services/*/**` (incl. `Data/Migrations/*`), see `01`-`06`.
- **Files modified:** none (new project); during the phase: `BuildingBlocks/Common/Paging/Paging.cs` (`OrderByName` returns `IOrderedQueryable`), `Services/StudentService/Dtos/*` (validation attributes moved to record constructor parameters), `Services/StudentService/Services/AuthService.cs` (registration transaction wrapped in the EF execution strategy), `Services/CourseService/Repositories/CourseRepository.cs` (capacity change -> raw SQL).
- **Databases/tables:** StudentDB (9 `dn_*` + history), CourseDB (3 + history), NotificationDB (2 + history), EnrollmentDB (3 + history).
- **Packages:** EF Core 8.0.10 (+Design), Pomelo 8.0.2, Identity EF 8.0.10, JwtBearer 8.0.10, Redis cache 8.0.10, Swashbuckle 6.8.1, RabbitMQ.Client 6.8.1, Serilog.AspNetCore 8.0.3, OpenTelemetry 1.9.x.
- **Config:** per-service `appsettings.json`.
- **Verified:** each migration scripted and checked for DROP (0); services started against the real DBs; curl checks (create/duplicate/validation/cache/roles/refresh), 20 parallel seat reservations for 4 seats -> 4 x 200 / 16 x 409.
- **Issues fixed in phase:** records validation attribute target; Identity transaction vs retrying strategy; CHECK constraint column names (an empty `dn_course_categories` created by the failed migration was dropped before regenerating); seat capacity SET order; Pomelo `char(36)` mapping.

## Phase 2 - API Gateway (YARP)
- **Created:** `ApiGateway/*`. **Modified:** `BuildingBlocks/Common/Web/CorrelationIdMiddleware.cs`, `ApiGateway/Program.cs` (health JSON writer).
- **Verified live:** 401 without/with bad token, public docs, all four route groups, correlation id echo, Swagger UI, **503 JSON** when Course Service was stopped.

## Phase 3 - Synchronous communication / Phase 4 - RabbitMQ / Phase 5 - Saga, outbox, idempotency
- **Created:** `Services/EnrollmentService/{Clients,Saga,Outbox,EventHandlers,Commands,Queries}`, `BuildingBlocks/Messaging/RabbitMq.cs`, `Notification Consumers/Processing`. Tables: `dn_saga_instances`, `dn_outbox_messages`, `dn_enrollments` (generated `ActiveKey`), `dn_inbox_messages`, `dn_notifications`.
- **Packages:** Microsoft.Extensions.Http.Resilience 8.10.0.
- **Verified live:** low-availability events consumed (4), poison message -> 3 retries -> DLQ, duplicate message ignored, first enrolment 201 Confirmed, whole `scripts/e2e.py`.
- **Issue fixed:** `ClientRegistration` extracted from `Program.cs` so tests use the production pipeline.

## Phase 6 - Security / Phase 7 - Redis, CQRS, resilience, concurrency
- Implemented within phases 1-5 (Identity/JWT in Student Service; Redis in Student/Course; CQRS and resilience in Enrollment). Verified by e2e role checks, refresh rotation, cache keys in Redis, 15 concurrent enrolments for 4 seats -> exactly 4 confirmed.

## Phase 8 - Observability
- **Created:** `Monitoring/**`, `Observability` block, `/metrics`, `/health/*`. **Modified:** `docker-compose.yml`, `scripts/start-local.sh` (OTLP endpoint default).
- **Verified:** Jaeger lists all five services and one `POST /api/enrollments` trace spans gateway, enrollment, student, course (+ RabbitMQ consumer span in the notification service for the low-availability event); Prometheus (host-network, loopback-bound) scraped 5/5 targets and answered request-count, p95 and outbox queries; Grafana datasource and dashboard provisioned (API).
- **Known:** OpenTelemetry OTLP exporter 1.9.0 has advisory NU1902.

## Phase 9 - Docker
- **Created:** `Docker/Dockerfile`, `Docker/healthcheck.sh`, `.dockerignore`, `docker-compose.yml`, `.env.example`. **Modified:** compose (YARP destination variables, healthcheck).
- **Verified:** infrastructure containers run and are used by every test; `docker compose --profile apps build` produced the five images (`sms-dn/*:1.0.0`, 228-233 MB); the gateway image started, reports `healthy` and runs as user `app`.
- **Not verified:** application containers against the host MySQL (listens on loopback only; making it reachable changes local service exposure and was not done).

## Phase 10 - Tests, Kubernetes
- **Created:** `Tests/UnitTests/**` (84 tests), `Tests/IntegrationTests/**` (37 tests), `scripts/e2e.py`, `scripts/failure-scenarios.py`, `Kubernetes/*` (12 files).
- **Incident:** first Student API integration run used the real StudentDB (configuration override timing); created user `locky` + its student profile, removed by exact key; fixed by environment-variable overrides + a guard assertion. Other test fixes: duplicate dictionary key, Redis hash type, expired-token helper, cache JSON enum strings.
- **Kubernetes:** YAML parsed; **not applied**.

## Final test record (2026-11-10)
| Suite | Command | Result |
|---|---|---|
| Unit | `dotnet test Tests/UnitTests` | **84 passed, 0 failed** |
| Integration (Testcontainers MySQL 8 / RabbitMQ / Redis) | `dotnet test Tests/IntegrationTests` | **37 passed, 0 failed** (1 m 21 s) |
| End-to-end through the gateway | `python3 scripts/e2e.py` | **ALL CHECKS PASSED** (49 checks) |
| Failure scenarios | `python3 scripts/failure-scenarios.py` | **ALL SCENARIOS PASSED** (9 checks) |

## Known issues / pending
- Application containers not run against host MySQL; Kubernetes not applied; development default credentials in `appsettings.json`; NU1902 advisory; no real e-mail; unbounded saga recovery attempts; outbox rows never purged.
