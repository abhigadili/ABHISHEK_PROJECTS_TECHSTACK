# 24 – Docker and Docker Compose

## 1. Feature Overview
A Dockerfile per runnable module (6) and one `docker-compose.yml` with Kafka, Redis, Jaeger, Prometheus, Grafana, Eureka, gateway and the four services, all connecting to the **existing host MySQL** (no MySQL container).

## 2. Purpose
Run the whole system with `docker compose up`.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| eureka-server/Dockerfile, api-gateway/Dockerfile, services/student-service/Dockerfile, services/course-service/Dockerfile, services/enrollment-service/Dockerfile, services/notification-service/Dockerfile | Created | Multi-stage: `maven:3.9.9-eclipse-temurin-21` builds `-pl <module> -am` (BuildKit `.m2` cache) → `eclipse-temurin:21-jre-alpine`, non-root user, `JAVA_OPTS` (`MaxRAMPercentage=75`), `HEALTHCHECK` on `/actuator/health/readiness` |
| docker-compose.yml | Created | Project `student-management`, network `sms-net`, volumes `kafka-data`, `redis-data`, `grafana-data` |
| .dockerignore | Created | Excludes `target/`, `.env`, docs, kubernetes |
| .env, .env.example | Created | Variables; `.env` is git-ignored |
| docker/README.md | Created | How containers reach the host MySQL (two options) |

## 4. Files Modified
`docker-compose.yml` was created with the infrastructure services first and the application/monitoring services added afterwards (one file, no earlier content changed); `.env` gained `DOCKER_BRIDGE_IP` and `GRAFANA_PASSWORD`.

## 5. Implementation Details
* **MySQL host**: `MYSQL_HOST=${MYSQL_HOST:-host.docker.internal}` with `extra_hosts: host.docker.internal:host-gateway` on every DB service – `localhost` is never used inside containers. `MYSQL_USER`/`MYSQL_PASSWORD`/`JWT_SECRET` are required (`${VAR:?…}`) and come from `.env`; nothing is baked into images.
* **MySQL reachability** is environment-specific (host MySQL is bound to 127.0.0.1): see `docker/README.md`; the optional `mysql-proxy` profile implements the zero-config route.
* **Startup order**: Eureka healthy → Redis/Kafka healthy → Student & Course healthy → Enrollment → Notification → Gateway (all via `depends_on: condition: service_healthy`).
* **Kafka**: `apache/kafka:3.9.0` KRaft with two listeners – `kafka:29092` (containers) and `localhost:9092` (host tools / host-run services).
* Shared service environment (`x-service-env`): Eureka URL, Redis host, Kafka bootstrap, OTLP endpoint, `LOGGING_STRUCTURED_FORMAT_CONSOLE=logstash`.
* Published ports: gateway 8080, Eureka 8761, services 8081–8084 (convenient for development – remove for production), Kafka 9092, Redis 6379, Jaeger 16686/4318, Prometheus 9090, Grafana 3001.

## 6. Architecture Details
All containers share `sms-net`; only the MySQL link leaves the Docker network.

## 7. Dependencies
Docker 28.1 / Compose v2.35 (tested), images: `maven`, `eclipse-temurin`, `apache/kafka`, `redis`, `jaegertracing/all-in-one`, `prom/prometheus`, `grafana/grafana`, `alpine/socat`.

## 8. Configuration Changes
Variables in [28](28-Configuration-and-Environment-Variables.md).

## 9. Database Changes
None.

## 10. API Changes
None.

## 11. Communication Changes
Container DNS names replace `localhost` (`kafka:29092`, `redis`, `eureka-server`, `jaeger`).

## 12. Execution Instructions
```bash
cp .env.example .env          # set MYSQL_USER / MYSQL_PASSWORD / JWT_SECRET
# choose MySQL access option A or B from docker/README.md, then:
docker compose --profile mysql-proxy up -d --build      # (omit the profile with option A)
docker compose ps && curl -s localhost:8080/actuator/health
python3 scripts/e2e.py
docker compose down            # volumes kept; add -v to delete Kafka/Redis/Grafana data
```
Infrastructure only (what was used for development): `docker compose up -d kafka redis jaeger`.

## 13. Testing – what was verified
| Check | Result |
|---|---|
| `docker compose --profile mysql-proxy config -q` | valid |
| `docker compose build` of all 6 images | all built (268–332 MB) |
| `kafka`, `redis`, `jaeger` containers via Compose (health checks, ports, volumes) | running and used by the whole development/test cycle |
| `prometheus` + `grafana` containers with the provisioning files | verified against the host-run services (6/6 targets up, datasource OK, dashboard provisioned) |
| **Application containers + `mysql-proxy` via `docker compose up`** | **NOT executed** – the auto-mode safety classifier refused the step that exposes the host MySQL to the docker bridge (`mysql-proxy`), and Option A requires sudo/MySQL restart which was not performed. |

## 14. Pending Items
**Acceptance criterion 18 ("Docker Compose starts the application and connects to existing MySQL") is not verified.** To finish: choose Option A or B in `docker/README.md`, run the commands in §12 and then `python3 scripts/e2e.py`. Container-level `HEALTHCHECK`s and the Compose-network Prometheus targets are likewise unverified until then.
