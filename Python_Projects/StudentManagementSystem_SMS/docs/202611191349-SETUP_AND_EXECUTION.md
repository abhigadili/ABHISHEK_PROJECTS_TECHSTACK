# Setup and Execution

## 1. Prerequisites

| Need | Version used | Notes |
|---|---|---|
| Python | **3.12** (project `requires-python >= 3.11`) | the system Python here was 3.8 → install a newer one with **uv** (below); no sudo needed |
| MySQL | 8.0 on `localhost:3306` | an account with `CREATE` + DDL/DML on `StudentManagement%` databases |
| Kafka | Apache Kafka 3.x/4.x, KRaft | easiest via Docker (`scripts/kafka_up.sh`) |
| Docker + Compose v2 | any recent | for Kafka (local run) and for the full containerised stack |
| curl, bash | | scripts |

## 2. Python environment

```bash
cd ~/Documents/PROJECTS_TECKSTACK/Python_Projects/StudentManagementSystem_SMS

# one-time: get uv and Python 3.12 (user-space install)
python3 -m pip install --user uv
~/.local/bin/uv python install 3.12

# virtual environment + dependencies
~/.local/bin/uv venv --python 3.12 .venv
~/.local/bin/uv pip install --python .venv/bin/python -r requirements-dev.txt   # runtime + pytest + aiosmtpd
~/.local/bin/uv pip install --python .venv/bin/python -e libs/sms_common         # the shared library (editable)
source .venv/bin/activate
```

* `requirements.txt` — direct runtime dependencies; `requirements.lock` — fully pinned versions used by the Docker images (`uv pip compile requirements.txt -o requirements.lock`); `requirements-dev.txt` — adds tests and a local SMTP test server.
* Key versions at build time: FastAPI 0.165, Starlette 1.10, Pydantic 2.14, SQLAlchemy 2.1, Alembic 1.20, aiokafka 0.15, HTTPX 0.28, PyJWT 2.15, argon2-cffi 25.1, SlowAPI 0.1.10, aiomysql 0.3, aiosmtplib 5.1.

## 3. Configuration (`.env`)

```bash
cp .env.example .env      # then edit; .env is gitignored
```

| Variable | Required | Purpose |
|---|:-:|---|
| `MYSQL_USER`, `MYSQL_PASSWORD` | **yes** | database login (never hard-coded; no defaults) |
| `MYSQL_HOST`, `MYSQL_PORT` | no (`localhost`, `3306`) | |
| `JWT_SECRET` | **yes** | `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `KAFKA_BOOTSTRAP_SERVERS` | no (`localhost:9092`) | |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | recommended | first administrator, created only when the users table is empty (use a non-reserved domain such as `example.com`: `.local` is rejected by e-mail validation) |
| `ENVIRONMENT`, `LOG_LEVEL`, `LOG_FORMAT` | no | `development` (shows `X-Middleware-Trace`), `INFO`, `text` or `json` |
| `RATE_LIMIT_DEFAULT` / `_AUTH` / `_LOGIN` | no | `120/minute`, `20/minute`, `5/minute` |
| `EMAIL_BACKEND` + `SMTP_*` | no | see EMAIL_CONFIGURATION.md |
| `STORAGE_ROOT` | no | `var/storage` |
| `MYSQL_ROOT_PASSWORD` | Compose only | root password of the *containerised* MySQL |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` | optional | enable OpenID Connect login |

Per-service ports (override with `--port`/Compose variables): gateway **8000**, auth **8001**, student **8002**, course **8003**, enrollment **8004**, notification **8005**.

## 4. Databases

```bash
python scripts/init_databases.py                     # creates the five databases (idempotent, never drops)
for s in auth student course enrollment notification; do
  (cd services/$s && alembic upgrade head)           # creates tables
done
```

## 5. Kafka

```bash
scripts/kafka_up.sh              # single-node KRaft broker in Docker on localhost:9092 (volume sms-kafka-data)
python scripts/create_topics.py  # 5 event topics (3 partitions) + 5 DLQ topics
```

## 6. Run the services

### All at once

```bash
scripts/svc.sh start             # auth, student, course, enrollment, notification, gateway (in that order)
scripts/svc.sh status
scripts/svc.sh stop
scripts/svc.sh restart student course
tail -f var/logs/gateway.log
```

### One service in the foreground (development, hot reload)

```bash
cd services/student && uvicorn app.main:app --port 8002 --reload
cd services/gateway && uvicorn app.main:app --port 8000 --reload
```

Each service reads the same `.env` (found by walking up from the library) and exposes `/docs`, `/redoc`, `/health` and `/health/ready`. Start order does not matter functionally (Kafka consumers and outbox relays reconnect and retry), but starting `auth` first lets the bootstrap admin exist before you log in.

Smoke test:

```bash
curl -s localhost:8000/health/services                         # all five services UP
TOKEN=$(curl -s localhost:8000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@sms.example.com","password":"<your bootstrap password>"}' | python -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s localhost:8000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
# then browse http://localhost:8000/docs  (Swagger UI for the whole system)
```

## 7. Run everything in Docker Compose

```bash
docker compose up -d --build                  # MySQL, Kafka (KRaft), kafka-init, 5 services, gateway
docker compose ps                             # every service reports "healthy"
docker compose --profile tools up -d          # + Kafka UI :8090, Mailpit :8025 (not exercised in verification)
docker compose logs -f api-gateway
docker compose down                           # keeps the mysql-data / kafka-data volumes
```

How the stack is wired: `mysql` initialises the five databases on first start (`docker/mysql/10-init-databases.sh`); `kafka` has an internal listener (`kafka:29092`) and a host listener (`localhost:9094`); `kafka-init` creates topics and exits; each service container runs `alembic upgrade head` then uvicorn (`docker/entrypoint.sh`), runs as a non-root user and has a `HEALTHCHECK` on `/health`; `depends_on: condition: service_healthy` orders the start-up (MySQL + topics → services → gateway).

Host ports are configurable so Compose can run next to local infrastructure: `MYSQL_HOST_PORT` (3308), `KAFKA_HOST_PORT` (9094), `GATEWAY_PORT` (8000), `AUTH_PORT` … `NOTIFICATION_PORT`, `KAFKA_UI_PORT`, `MAILPIT_UI_PORT`. Stop locally started services (`scripts/svc.sh stop`) before `docker compose up`, they use the same ports. E-mails and uploaded files land in `./var/compose/emails` and `./var/compose/storage` (bind mounts).

## 8. Verification (everything below was run; results at the end)

| Command | What it proves |
|---|---|
| `scripts/run_tests.sh` | 38 unit tests: JWT validation (expiry, signature, `alg:none`, type, issuer), role/scope matrix, log redaction, URL escaping, storage validation, pagination/sort whitelist, Argon2 + password policy, every template (HTML+text) |
| `python scripts/e2e_verify.py` | **199** live checks through the gateway: health/docs, authentication, OAuth2 scopes, refresh rotation, logout revocation, reset by e-mail, lock-out, RBAC, student/course/enrollment CRUD + search/pagination, capacity under concurrency, Kafka idempotency + DLQ, notifications, file upload/download/validation/authorisation, middleware order, correlation ids, log hygiene, CORS, error envelopes, downstream outage handling |
| `python scripts/e2e_verify.py --docker` (with `KAFKA_BOOTSTRAP_SERVERS=localhost:9094`) | the same 199 checks against the Compose stack |
| `python scripts/verify_rate_limit.py` | 7 checks on a throw-away gateway: login limit, auth limit, per-user general limit, headers, 429 envelope |
| `python scripts/verify_email.py` | 14 checks: real SMTP delivery, retry/back-off, DEAD, manual retry, permanent failure |
| `python scripts/verify_oidc.py` | 10 checks: OIDC code flow against a mock provider |
| `python scripts/run_postman_collection.py` | 81/81 requests of the Postman collection replayed |

For the long functional run the gateway limits are lifted, because the suite sends far more than 5 logins/minute:

```bash
scripts/svc.sh stop gateway
RATE_LIMIT_DEFAULT=100000/minute RATE_LIMIT_AUTH=100000/minute RATE_LIMIT_LOGIN=100000/minute scripts/svc.sh start gateway
python scripts/e2e_verify.py
scripts/svc.sh restart gateway      # back to the .env limits
```

### Recorded results (2026-11-19)

| Suite | Result |
|---|---|
| Unit tests (`libs/sms_common`, auth, notification) | 19 + 8 + 11 = **38 passed** |
| End-to-end, local processes | **199 / 199** |
| End-to-end, Docker Compose | **199 / 199** |
| Rate limiting | **7 / 7** |
| E-mail (SMTP, retry, DEAD) | **14 / 14** |
| OIDC (mock provider) | **10 / 10** |
| Postman collection replay | **81 / 81** |
| Alembic | `upgrade head` on all 5 DBs (local and containerised), `alembic check` clean |

Not run: real `newman` (the npx download was blocked by the sandbox; the Python replayer covers URLs, bodies, auth, variable capture, status codes and simple assertions but not Postman's JavaScript sandbox), the Compose `tools` profile (Kafka UI, Mailpit), a real OIDC tenant, a real SMTP provider.

## 9. Manual testing recipes

```bash
# watch events flow
docker exec sms-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic sms.enrollment.events --from-beginning --property print.headers=true
# read the e-mails the system "sent"
ls -t var/emails | head; python - <<'PY'
import email, email.policy, pathlib
f = sorted(pathlib.Path("var/emails").glob("*.eml"))[-1]
m = email.message_from_bytes(f.read_bytes(), policy=email.policy.default)
print(m["To"], m["Subject"]); print(m.get_body(("plain",)).get_content())
PY
# trace one request across services with a correlation id
curl -s localhost:8000/api/v1/students -H "Authorization: Bearer $TOKEN" -H 'X-Correlation-ID: demo-123' -D- -o /dev/null | grep -i correlation
grep demo-123 var/logs/*.log
```

## 10. Troubleshooting (real problems met while building this, and their fixes)

| Symptom | Cause | Fix |
|---|---|---|
| Service exits at start: `Field required: mysql_user / jwt_secret` | secrets have no defaults | create `.env` (see §3) or export the variables |
| `Access denied for user …` | wrong `MYSQL_*` or missing privileges | test with `mysql -u$MYSQL_USER -p -h127.0.0.1`; the user needs rights on `StudentManagement%` |
| `value is not a valid email address: … special-use or reserved name` | `.local`/`.test` domains are rejected by `email-validator` | use `example.com` (or a real domain) for `BOOTSTRAP_ADMIN_EMAIL` |
| `MissingGreenlet: greenlet_spawn has not been called` (HTTP 500) | an async SQLAlchemy session tried to lazy-load (e.g. a server-default column after INSERT, an unloaded collection) | load eagerly (`selectinload`/`joinedload`), `await session.refresh(obj)` or re-read after commit; use explicit `INSERT` instead of appending to an unloaded relationship |
| `alembic downgrade` fails with *error 1553: Cannot drop index … needed in a foreign key constraint* | autogenerated `drop_index` before `drop_table` | `python scripts/fix_downgrade.py <revision file>` |
| Kafka client connects to bootstrap, then times out / `NodeNotReady` | advertised listener does not match how you reach the broker | see KAFKA §7: `localhost:9092` for the local script, `kafka:29092` inside Compose, `localhost:9094` from the host to Compose |
| Port already in use on `docker compose up` | locally started services use 8000–8005 | `scripts/svc.sh stop`, or change `*_PORT` variables |
| `scripts/svc.sh restart` leaves old code running | (fixed) the PID file must hold the uvicorn PID, so the script now `exec`s uvicorn inside the subshell | if you have stale processes: `ss -ltnp \| grep :800` and `kill <pid>` |
| 429 on `/auth/*` during manual testing | the gateway's per-IP auth/login limits (20/min, 5/min) | wait `Retry-After` seconds, or raise `RATE_LIMIT_*` for the gateway |
| Revoked token still accepted | request went directly to a service (bypassing the gateway) or the gateway's Kafka listener is down | call through `:8000`; check `/health/ready` of the gateway (`revocation_listener`) |
| No e-mails arrive | default backend is `file` | look in `var/emails` (or `var/compose/emails`), or configure `EMAIL_BACKEND=smtp` |
| `/health/ready` is 503 | a dependency is down (the JSON body lists which: `database`, `kafka_consumer`, `outbox_relay`, `dispatcher`) | fix the named dependency; Kafka consumers reconnect on their own |
| Upload rejected with 415 although the type is right | the *content* does not match the declared type (magic-byte check) or the extension does not match | upload a genuine file; see FILE_MANAGEMENT §2 |
| `Permission denied` writing `var/compose/...` | bind-mounted directory not writable by container uid 1000 | `mkdir -p var/compose/{storage,emails}` as your own user (uid 1000) |
| Brand-new consumer group re-sends old e-mails | consumers start from `earliest` | expected for a *new* group; keep the group ids stable |

Resetting a development environment: stop services, `docker compose down -v` removes the Compose volumes; for the local databases drop/recreate only the five `StudentManagement*DB` databases yourself — the scripts never drop anything.
