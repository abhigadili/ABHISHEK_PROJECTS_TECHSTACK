# Student Management System (SMS) — Python / FastAPI microservices

A production-oriented, interview-grade backend: **six FastAPI services**, **five MySQL databases** (one per service), **Apache Kafka** events with a **transactional outbox**, JWT + OAuth2 + RBAC, an API gateway with rate limiting, asynchronous e-mail, file management, Docker Compose — all verified end to end.

| | |
|---|---|
| Language / framework | Python 3.12, FastAPI, Pydantic v2 |
| Persistence | MySQL 8, SQLAlchemy 2.x (async **and** sync), Alembic |
| Messaging | Apache Kafka (KRaft) via aiokafka, outbox + idempotent consumers + DLQ |
| Security | JWT (access/refresh, rotation, revocation), OAuth2 password flow with scopes, Argon2id, RBAC, optional OIDC login |
| Gateway | routing, JWT validation, SlowAPI rate limits, retries/timeouts, merged Swagger |
| E-mail | Jinja2 HTML + text templates, aiosmtplib, retry/back-off, delivery tracking |
| Files | `UploadFile`, magic-byte validation, storage abstraction (local disk; S3-ready design) |
| Ops | structured logs with correlation ids, health probes, Docker + Compose |

## Architecture at a glance

```
 client ─▶ API GATEWAY :8000 ─┬─▶ auth         :8001  (AuthDB)         sync SQLAlchemy, Argon2, JWT, OAuth2, RBAC
                              ├─▶ student      :8002  (StudentDB)      profile 1‑1, contacts 1‑N, interests N‑M, files
                              ├─▶ course       :8003  (CourseDB)       categories, teachers (assoc. object), files
                              ├─▶ enrollment   :8004  (EnrollmentDB)   REST → student + course, capacity lock, history
                              └─▶ notification :8005  (NotificationDB) e-mail queue, templates, retry
  REST (HTTPX) between services where an answer is needed now; Kafka events where facts are announced:
  StudentCreated/Updated/Deleted · CourseCreated/Updated · StudentEnrolled · EnrollmentCancelled · NotificationRequested · TokenRevoked
```

Full explanation: [`docs/202611191349-ARCHITECTURE.md`](docs/202611191349-ARCHITECTURE.md).

## Quick start (local processes)

```bash
python3 -m pip install --user uv && ~/.local/bin/uv python install 3.12
~/.local/bin/uv venv --python 3.12 .venv
~/.local/bin/uv pip install --python .venv/bin/python -r requirements-dev.txt -e libs/sms_common
cp .env.example .env            # fill MYSQL_USER, MYSQL_PASSWORD, JWT_SECRET, BOOTSTRAP_ADMIN_*
.venv/bin/python scripts/init_databases.py
for s in auth student course enrollment notification; do (cd services/$s && ../../.venv/bin/alembic upgrade head); done
scripts/kafka_up.sh && .venv/bin/python scripts/create_topics.py
scripts/svc.sh start            # all six services
curl -s localhost:8000/health/services
# Swagger UI for every service:  http://localhost:8000/docs
```

## Quick start (everything in Docker)

```bash
cp .env.example .env            # add MYSQL_ROOT_PASSWORD too
docker compose up -d --build    # MySQL, Kafka, topic init, 5 services, gateway — all with health checks
docker compose ps
```

Details, ports, troubleshooting: [`SETUP_AND_EXECUTION`](docs/202611191349-SETUP_AND_EXECUTION.md).

## Documentation

| File | Contents |
|---|---|
| [ARCHITECTURE](docs/202611191349-ARCHITECTURE.md) | services, DB ownership, REST vs Kafka, outbox, middleware order, trade-offs, a traced request |
| [DATABASE](docs/202611191349-DATABASE.md) | creating DBs, sessions/transactions, relationships, loading strategies, **generated schemas**, Alembic workflow |
| [API_DOCUMENTATION](docs/202611191349-API_DOCUMENTATION.md) | conventions, status codes, filters, **all 79 endpoints with access rules**, real sample requests/responses |
| [KAFKA_DOCUMENTATION](docs/202611191349-KAFKA_DOCUMENTATION.md) | topics, events, producers/consumers, groups, idempotency, retry, DLQ, operations |
| [AUTHENTICATION](docs/202611191349-AUTHENTICATION.md) | JWT, OAuth2 + scopes, refresh rotation, revocation, Argon2, reset, lock-out, RBAC, OIDC |
| [FILE_MANAGEMENT](docs/202611191349-FILE_MANAGEMENT.md) | upload/download pipeline, validation, storage layout, security, S3 path |
| [EMAIL_CONFIGURATION](docs/202611191349-EMAIL_CONFIGURATION.md) | backends, SMTP setup, templates, workflows, retry |
| [IMPLEMENTATION_DETAILS](docs/202611191349-IMPLEMENTATION_DETAILS.md) | feature → service → file/class/function map |
| [PYTHON_CONCEPTS](docs/202611191349-PYTHON_CONCEPTS.md) | Python / FastAPI / Pydantic / SQLAlchemy / asyncio concepts with source references |
| [SETUP_AND_EXECUTION](docs/202611191349-SETUP_AND_EXECUTION.md) | prerequisites, environment, running, verification, troubleshooting |

(PDF copies of every document are in `docs/pdf/`.)  Doc file names carry a `YYYYMMDDHHmm` prefix; `README.md` keeps its conventional name.

## Verification summary (run on 2026-11-19)

| Suite | Result |
|---|---|
| Unit tests | 38 passed |
| End-to-end through the gateway, local processes | **199 / 199** |
| End-to-end, Docker Compose stack | **199 / 199** |
| Rate limiting / SMTP + retry / OIDC (mock IdP) | 7 / 7 · 14 / 14 · 10 / 10 |
| Postman collection (81 requests) replayed | 81 / 81 |

Bugs the live tests caught and that are fixed: async lazy-load crashes after INSERT, stale post-commit collections, an unreliable service-manager PID file, an unwired `NOTIFICATION_MAX_ATTEMPTS`, MySQL-unsafe autogenerated downgrades, a naive/UTC timezone mismatch.

**Not verified** (stated plainly): real `newman`, Compose `tools` profile (Kafka UI / Mailpit), a real OIDC provider, a real SMTP provider with TLS, multi-broker Kafka, multi-replica gateway rate limits (counters are in memory). See IMPLEMENTATION_DETAILS §6.

## Repository map

```
libs/sms_common/     shared library (+ unit tests)          services/<name>/   the six services (+ alembic, Dockerfile)
scripts/             run/verify/generate tooling             docker/, docker-compose.yml
postman/             collection + environment + samples      docs/              documentation (+ docs/pdf)
```

Default development credentials are *not* in the repository: `.env` is gitignored; `.env.example` lists every variable.
