# Student Management Microservices – Process Report, Execution Flow and File Guide

Project location: `~/Documents/Java_Projects/StudentManagement` · Date of build: 2026-11-10
Stack: Java 21 · Spring Boot 3.4.5 · Spring Cloud 2024.0.1 · MySQL 8 (existing) · Kafka · Redis · Docker · Kubernetes

This document has three parts:
1. **What was done** – the whole process of the previous request, step by step.
2. **How it runs** – start order, request flow, event flow, with step-by-step diagrams.
3. **What every file does** – grouped by folder, with "where it starts / what comes next".

---

# PART 1 – What was done (process, in order)

## 1.1 The request
The prompt asked for a complete Student Management System with four independent Spring Boot microservices (Student, Course, Enrollment, Notification), using the four **existing** MySQL databases (StudentDB, CourseDB, EnrollmentDB, NotificationDB), plus: API gateway, Eureka, Feign + Kafka communication, saga, outbox/inbox, idempotency, CQRS, Redis, JWT security, Resilience4j, logging/tracing/monitoring, Docker, Kubernetes, tests, README and 30 documentation files.

## 1.2 Step-by-step build log

| # | Step | What happened | Result |
|---|---|---|---|
| 1 | Read prompt, check machine | Java 21, Maven 3.8.6, Docker 28 present; MySQL on 127.0.0.1:3306; no Kafka/Redis | Plan set |
| 2 | Inspect databases (read-only) | Found existing tables with data (`Students`, `Courses`, `Enrollments`, `Notifications`…) | Decision: add **new `sms_*` tables** with Flyway, never touch old ones |
| 3 | Ask two blocking questions | Project directory; MySQL credentials | Directory `~/Documents/Java_Projects/StudentManagement`; user supplied the DB login |
| 4 | Parent POM + shared modules | `event-contracts` (Kafka event records), `common-web` (JWT, filters, errors, OpenAPI, Kafka health) | Built, installed |
| 5 | Eureka server | Service registry on 8761 | Built |
| 6 | Student Service | CRUD, search, status, eligibility, Redis cache, **auth** (register/login/refresh/JWT/BCrypt) | Live-tested: CRUD, RBAC, refresh rotation, cache |
| 7 | Infra containers | Kafka, Redis, Jaeger via `docker compose` | Running |
| 8 | Course Service | Courses, categories, atomic seat reserve/release, Redis, low-availability Kafka event | 50 parallel reservations on 10 seats → exactly 10 OK / 40 conflict |
| 9 | Notification Service | Kafka consumers, inbox, dispatcher with retry, e-mail simulation | Consumed 6 earlier events → 6 notifications SENT |
| 10 | Enrollment Service | Feign clients + Resilience4j, saga, outbox, CQRS handlers, duplicate guards | First live run exposed test-data collision & a retry bug → fixed |
| 11 | API Gateway | Routes, JWT edge filter, CORS, correlation id, circuit-breaker fallback, Swagger aggregation | End-to-end script: 43/43 checks pass |
| 12 | Observability | Jaeger trace across 4 services, Prometheus metrics, Grafana dashboard, JSON logs | Verified live |
| 13 | Unit tests | 82 tests (JUnit 5 + Mockito) | Pass |
| 14 | Integration tests | 36 tests with Testcontainers (MySQL, Kafka, Redis) | Found & fixed: FK cascade (V2 migration), dead-letter topic name |
| 15 | Docker & Kubernetes | 6 Dockerfiles, full compose, 13 K8s manifests | Images built; app stack under Compose **not run** (MySQL only listens on localhost; exposing it was blocked) |
| 16 | Documentation | `README.md` + `Documentation/00–29`, path-accuracy check (441 paths) | All exist |
| 17 | Final verification | `mvn clean verify` (BUILD SUCCESS), E2E again, stop everything | Done |

## 1.3 Key design decisions
1. **New tables, old data untouched** – `sms_students`, `sms_courses`, `sms_enrollments`, … created by Flyway (`baseline-on-migrate`); Hibernate only *validates*.
2. **Authentication inside Student Service** – no fifth service; all services verify the same HMAC JWT.
3. **Saga + outbox** – no distributed transaction; events written with the business change, published later by a poller.
4. **Seats protected inside MySQL** – atomic conditional `UPDATE` + `CHECK` constraint + reservation table.
5. **Everything retry-safe** – idempotency keys and unique constraints at every hop.

## 1.4 Final results
- `mvn clean verify`: **82 unit + 36 integration tests, 0 failures.**
- `scripts/e2e.py`: **43 of 43** checks pass through the gateway.
- Not done: Compose *application* containers (needs a decision on letting containers reach host MySQL), Kubernetes apply (no cluster).

---

# PART 2 – How it runs (execution and architecture flow)

## 2.1 Components and ports

| Component | Port | Talks to |
|---|---|---|
| API Gateway | 8080 | Eureka, all four services |
| Eureka Server | 8761 | everyone registers here |
| Student Service | 8081 | StudentDB, Redis |
| Course Service | 8082 | CourseDB, Redis, Kafka |
| Enrollment Service | 8083 | EnrollmentDB, Kafka, Student + Course (Feign) |
| Notification Service | 8084 | NotificationDB, Kafka |
| Kafka / Redis / Jaeger | 9092 / 6379 / 16686 | infrastructure |
| Prometheus / Grafana | 9090 / 3001 | monitoring |

## 2.2 Where to start – exact start order

```
STEP 1  docker compose up -d kafka redis jaeger     (infrastructure first)
STEP 2  mvn -DskipTests package                      (build all jars)
STEP 3  scripts/start-local.sh  does, in this order:
          3a  Eureka server (8761)          – must be first; others register here
          3b  Student, Course, Enrollment, Notification (8081–8084)
                 each: connect MySQL → Flyway migrates → Hibernate validates →
                       register in Eureka → (Course/Enrollment/Notification) connect Kafka
          3c  API Gateway (8080)            – last; it discovers the services via Eureka
STEP 4  python3 scripts/e2e.py                       (runs 43 checks through the gateway)
STEP 5  scripts/stop-local.sh                        (stop by port)
```
Why this order: Eureka must exist before registration; Kafka/Redis before the services that use them; the gateway last so its routes already resolve.

## 2.3 What happens inside one service at startup
```
java -jar service.jar
  → Spring Boot reads application.yml (env vars override defaults)
  → common-web auto-configuration loads (JWT service, filters, error handler, OpenAPI)
  → DataSource connects to its own database
  → Flyway: baseline (V0) if needed, then V1, V2… (adds only sms_* tables)
  → Hibernate ddl-auto=validate (entities must match tables)
  → Kafka topics declared (KafkaAdmin), consumers/producers start
  → @Scheduled jobs start (outbox publisher, saga recovery, notification dispatcher)
  → Eureka registration (name = student-service, course-service, …)
  → Student Service only: creates the `admin` user if missing
  → health endpoints become UP
```

## 2.4 Flow A – a client call (login, then any API)

```
1. Client  → POST http://localhost:8080/api/auth/login {username,password}
2. Gateway : CorrelationIdGlobalFilter adds X-Correlation-Id
             JwtAuthGlobalFilter: login is a public path → pass
             Route "student-service": lb://student-service → asks Eureka for an address
3. Student Service: AuthController → AuthService
             checks BCrypt hash → creates JWT (15 min) + refresh token (stored hashed)
4. Client  ← accessToken, refreshToken
5. Client  → GET /api/courses  with  Authorization: Bearer <accessToken>
6. Gateway : JwtAuthGlobalFilter validates the token (401 if bad) → forwards
7. Course Service: JwtAuthenticationFilter validates again, @PreAuthorize checks the role
             CourseService → Redis cache → (miss) MySQL → response
8. Client  ← JSON (X-Correlation-Id echoed back)
```

## 2.5 Flow B – enrollment (the main workflow, step by step)

```
Client → Gateway → Enrollment Service  POST /api/enrollments  (+ Idempotency-Key)

 1  Controller checks role (student may only enroll themselves)
 2  CreateEnrollmentCommandHandler
       • same key seen before?  → return stored result (idempotent replay)
       • active enrollment already exists? → 409
 3  Saga starts – row saved in sms_saga_instances (state STARTED)
 4  Step 1  Feign → Student Service  /eligibility + details      (retry, circuit breaker, timeout)
         not found / inactive → go to COMPENSATE
 5  Step 2  Feign → Course Service   course ACTIVE and seats > 0
         else → COMPENSATE
 6  Step 3  ONE DB transaction: insert enrollment PENDING + outbox row "EnrollmentRequested"
 7  Step 4  Feign → Course Service  reserve seat (atomic UPDATE, keyed by enrollmentId)
         no seat → COMPENSATE
 8  Step 5  ONE DB transaction: enrollment → CONFIRMED + outbox row "EnrollmentConfirmed"
 9  Saga COMPLETED → HTTP 201 CONFIRMED to the client

COMPENSATE: release the seat (safe even if none was taken) →
            ONE transaction: enrollment REJECTED + outbox row "EnrollmentRejected" → HTTP 422 + reason

If the service crashes or Course Service is down mid-way:
   the saga row remembers its state; SagaRecoveryJob (every 15 s) resumes it.
```

## 2.6 Flow C – events and notifications (runs in the background)

```
1  OutboxPublisher (every 1 s) selects pending rows (FOR UPDATE SKIP LOCKED)
2  sends each to Kafka topic (enrollment.requested|confirmed|rejected|cancelled), waits for ack
   failure → attempts+1, retry later with backoff (event is never dropped)
3  Notification Service consumer receives the event
4  NotificationIngestService (one transaction):
       inbox row for eventId (duplicate? → ignore) + create notification (unique per enrollment+type)
5  NotificationDispatcher (every 2 s) picks PENDING notifications
6  NotificationProcessor → EmailSimulator logs "EMAIL SENT"
       success → SENT;  failure → retry 5s, 10s, 20s… ; after 5 attempts → FAILED
7  Bad (unreadable) Kafka message → retried, then moved to <topic>.DLT so it cannot block others
```

## 2.7 Flow D – cancel, and low seat warning
- **Cancel:** `POST /api/enrollments/{id}/cancel` → Course Service releases the seat → enrollment CANCELLED + outbox event → notification "cancelled".
- **Low seats:** after a reservation commits, if seats ≤ 5 Course Service publishes `course.low-availability`; Notification Service sends an admin notification.

## 2.8 Flow E – concurrency (why seats never go negative)
```
50 requests for the last 10 seats
   each: UPDATE sms_courses SET available_seats = available_seats - 1
         WHERE course_id=? AND available_seats > 0            ← MySQL row lock decides the winner
   0 rows updated → HTTP 409 "no seats"
   plus CHECK(available_seats >= 0) and unique(enrollment_id) in sms_seat_reservations
```

## 2.9 Flow F – failure handling
| Failure | What happens |
|---|---|
| Student/Course service slow | timeout → retry ×3 → circuit breaker opens → fast failure |
| Course service down during enrollment | saga rejects or pauses; recovery job finishes it later |
| Notification service stopped | gateway returns 503 fallback JSON; other routes keep working |
| Kafka down | outbox rows wait in MySQL and are sent when Kafka returns |
| Redis down | caches skipped, MySQL used |
| Duplicate request / duplicate event | idempotency key, inbox table, unique constraints absorb it |

## 2.10 Observability flow
`Request → traceparent + X-Correlation-Id → every log line shows [app, traceId, spanId, correlationId] → spans sent to Jaeger (OTLP) → metrics at /actuator/prometheus → Prometheus scrapes every 10 s → Grafana dashboard "Student Management – Overview".`

## 2.11 What to do next (suggested order)
1. Run Steps 1–4 of §2.2 and watch `logs/*.log`.
2. Open Swagger `http://localhost:8080/swagger-ui.html`, log in as `admin`, try the calls.
3. Open Jaeger (16686) and look at one enrollment trace.
4. Run `scripts/verify-db.sh` to confirm original tables are untouched.
5. Pending work: run the Compose stack (choose MySQL access option in `docker/README.md`), apply Kubernetes manifests, remove default credentials from `application.yml` before sharing.

---

# PART 3 – What every file does

Paths are relative to `StudentManagement/`.

## 3.1 Root files
| File | Use | Order |
|---|---|---|
| `pom.xml` | Parent Maven file: versions, module list, failsafe for integration tests | read first by Maven |
| `README.md` | Entry document: architecture, endpoints, run steps, samples, checklist | read first by humans |
| `docker-compose.yml` | Kafka, Redis, Jaeger, Prometheus, Grafana, all apps, optional MySQL proxy | `docker compose up` |
| `.env` / `.env.example` | Variables for compose (DB user, JWT secret…); `.env` is git-ignored | read by compose |
| `.gitignore`, `.dockerignore` | What git / docker builds ignore | – |

## 3.2 `scripts/`
| File | Use |
|---|---|
| `start-local.sh` | Starts Eureka → services → gateway on the host and waits for health |
| `stop-local.sh` | Stops them by listening port |
| `e2e.py` | 43 end-to-end checks through the gateway (auth, roles, enrollment, notifications, concurrency) |
| `verify-db.sh` | Read-only report: original tables/rows vs new `sms_*` tables + Flyway history |

## 3.3 `common/` (shared libraries, built first)
| File | Use |
|---|---|
| `event-contracts/.../Topics.java` | Kafka topic names |
| `.../EnrollmentEvent.java`, `EnrollmentEventType.java` | Event sent by Enrollment (requested/confirmed/rejected/cancelled) |
| `.../LowCourseAvailabilityEvent.java` | Event sent by Course |
| `common-web/.../CommonAutoConfiguration.java` | Registers JWT service, filters, error handler, OpenAPI bean automatically |
| `.../security/JwtTokenService.java` | Creates and validates JWT (user and service tokens) |
| `.../security/JwtAuthenticationFilter.java` | Reads Bearer token → logged-in user for Spring Security |
| `.../security/AuthenticatedUser.java`, `JwtProperties.java`, `JsonSecurityHandlers.java` | Principal object, JWT settings, JSON 401/403 replies |
| `.../web/CorrelationIdFilter.java` | Adds correlation id, logs one line per request |
| `.../exception/GlobalExceptionHandler.java` + `ApiError`, `ConflictException`, `ResourceNotFoundException`, `BusinessRuleException`, `ServiceUnavailableException`, `UnauthorizedException` | One error JSON shape and HTTP codes for all services |
| `.../KafkaHealthAutoConfiguration.java` | Adds Kafka to health checks |

## 3.4 `eureka-server/`
`EurekaServerApplication.java` starts the registry; `application.yml` sets port 8761; `Dockerfile` builds its image.

## 3.5 `api-gateway/`
| File | Use |
|---|---|
| `ApiGatewayApplication.java` | Starts the gateway |
| `application.yml` | Routes (`/api/students|courses|enrollments|notifications/**`), CORS, timeouts, Swagger URLs |
| `filter/CorrelationIdGlobalFilter.java` | Correlation id + request log (runs first) |
| `filter/JwtAuthGlobalFilter.java` | Rejects missing/invalid token (public: login, register, refresh, docs, health) |
| `controller/FallbackController.java` | 503 JSON when a service is down |
| `JwtAuthGlobalFilterTest.java` | Tests the public-path rules |

## 3.6 `services/student-service/` (starts at `StudentServiceApplication`)
| File | Use |
|---|---|
| `controller/StudentController.java` | Student endpoints + role rules |
| `controller/AuthController.java` | register / login / refresh / logout / me |
| `service/StudentService.java` | Business rules, caching, eligibility |
| `service/AuthService.java` | Passwords (BCrypt), JWT, refresh-token rotation |
| `repository/*` | Database access (students, users, refresh tokens, search filters) |
| `entity/*` | Tables as Java classes: Student, UserAccount, RefreshToken, enums |
| `dto/*`, `mapper/StudentMapper.java` | Request/response objects; entity ↔ DTO conversion |
| `validation/ValidPhoneNumber.java`, `PhoneNumberValidator.java` | Custom phone validation |
| `config/SecurityConfig.java` | Which URLs are public, stateless JWT chain |
| `config/CacheConfig.java` | Redis cache setup |
| `config/AdminBootstrap.java` | Creates first admin at startup |
| `db/migration/V1__…sql`, `V2__…sql` | Creates `sms_students`, `sms_users`, `sms_refresh_tokens`; V2 adds delete cascade |
| `application.yml`, `Dockerfile`, `pom.xml` | Config, image, dependencies |
| `src/test/...` | Unit tests (service, auth, validator) and `StudentApiIT` integration tests |

## 3.7 `services/course-service/`
| File | Use |
|---|---|
| `controller/CourseController.java`, `CategoryController.java` | Course/category endpoints, availability, seat reserve/release |
| `service/CourseService.java`, `CategoryService.java` | CRUD rules, cache, capacity change |
| `service/SeatService.java` | Reserve/release seats – atomic and idempotent |
| `service/LowAvailabilityPublisher.java` | Sends Kafka event after commit when seats are low |
| `repository/CourseRepository.java` | The atomic `UPDATE` queries that prevent overselling |
| `entity/*` | Course, CourseCategory, SeatReservation + enums |
| `config/CourseCacheEvictor.java` | Clears caches after the transaction commits |
| `config/CacheConfig.java`, `KafkaConfig.java`, `SecurityConfig.java` | Redis, topic, security |
| `validation/*` | Course code format rule |
| `db/migration/V1__…sql` | `sms_course_categories`, `sms_courses` (with CHECK), `sms_seat_reservations` |
| tests | `SeatServiceTest`, `CourseServiceTest`, `SeatConcurrencyIT` (50-thread race) |

## 3.8 `services/enrollment-service/` (the orchestrator)
| File | Use |
|---|---|
| `controller/EnrollmentController.java` | Enrollment endpoints → calls command/query handlers |
| `command/*` | Write side: create, cancel, update handlers |
| `query/*` | Read side: get, search, history, course view |
| `saga/EnrollmentSagaOrchestrator.java` | The step-by-step workflow with compensation |
| `saga/SagaRecoveryJob.java` | Resumes stuck sagas every 15 s |
| `outbox/OutboxWriter.java`, `OutboxPublisher.java` | Store events with the transaction; publish them to Kafka |
| `event/EnrollmentEventRecorder.java` | Builds events and hands them to the outbox |
| `client/StudentClient`, `CourseClient` | Feign HTTP interfaces |
| `client/StudentGateway`, `CourseGateway` | Wrap calls with retry, circuit breaker, timeout, bulkhead |
| `client/FeignConfig.java` | Adds service JWT + correlation id; maps 404/409/5xx to exceptions |
| `client/RemoteCall.java`, `RemoteDtos.java`, `RemoteExceptions.java`, `TracingContextPropagator.java` | Result handling, response shapes, error types, keeps trace across threads |
| `entity/*` | Enrollment, SagaInstance, OutboxEvent + state enums |
| `repository/*` | DB access (outbox uses `SKIP LOCKED`) |
| `dto/*`, `config/*` | Request/response records, security, Kafka topics |
| `db/migration/V1__…sql` | `sms_enrollments` (unique active key), `sms_saga_instances`, `sms_outbox_events` |
| tests | Saga (10), handlers, outbox, status machine, `EnrollmentFlowIT`, `ResilienceIT` |

## 3.9 `services/notification-service/`
| File | Use |
|---|---|
| `consumer/EventConsumers.java` | Kafka listeners (entry point of this service's work) |
| `service/NotificationIngestService.java` | Inbox check + create notification in one transaction |
| `processing/NotificationDispatcher.java` | Scheduled picker of due notifications |
| `processing/NotificationProcessor.java` | Sends one notification; retry/backoff/FAILED |
| `processing/EmailSimulator.java` | Fake e-mail (logs it); `@fail.test` always fails, `@flaky.test` fails twice |
| `service/NotificationQueryService.java`, `controller/NotificationController.java` | History API and manual retry |
| `entity/*`, `repository/*`, `dto/*`, `mapper/*` | Data layer |
| `config/KafkaConfig.java` | Topics, `.DLT` topics, retry + dead-letter handling |
| `db/migration/V1__…sql` | `sms_notifications`, `sms_inbox_messages` |
| tests | Ingest, processor, `NotificationKafkaIT` |

## 3.10 Infrastructure folders
| Folder / file | Use |
|---|---|
| `*/Dockerfile` (6) | Multi-stage build: Maven builds jar → slim Java 21 runtime with health check |
| `docker/README.md` | How containers can reach the host MySQL (Option A reconfigure, Option B proxy) |
| `kubernetes/00…40-*.yaml`, `kustomization.yaml` | Namespace, ConfigMap, Secret placeholders, external-MySQL alias, Redis, Kafka, Eureka, services, gateway |
| `monitoring/prometheus/*.yml` | Scrape targets (container names / host variant) |
| `monitoring/grafana/*` | Auto-provisioned datasource and 12-panel dashboard |
| `database/<service>/README.md` | Notes on each service's tables and migrations |

## 3.11 `Documentation/`
`00`–`29` – one file per feature (overview, Maven, versions, MySQL, each service, gateway, Eureka, Feign, Kafka, saga, outbox/inbox, idempotency, CQRS, Redis, security, Resilience4j, concurrency, background jobs, logging, tracing, health, Docker, Kubernetes, testing, API docs, configuration) and `29` the full change log with known issues.

---

# Quick reference

| I want to… | Do this |
|---|---|
| Start everything | §2.2 steps 1–3 |
| See it work | `python3 scripts/e2e.py` |
| Try APIs | Swagger `http://localhost:8080/swagger-ui.html`, login `admin` / `Admin@123` |
| Follow one request | Jaeger `http://localhost:16686` |
| Check DB safety | `scripts/verify-db.sh` |
| Run all tests | `mvn clean verify` (Docker needed) |
| Understand a feature | matching file in `Documentation/` |
