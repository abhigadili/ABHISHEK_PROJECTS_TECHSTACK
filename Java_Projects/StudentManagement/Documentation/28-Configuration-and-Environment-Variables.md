# 28 – Configuration and Environment Variables

## 1. Feature Overview
All configuration is externalised through Spring placeholders (`${VAR:default}`), a Compose `.env`, and Kubernetes ConfigMap/Secret.

## 2. Purpose
One build, any environment.

## 3. Files Created
`services/*/src/main/resources/application.yml` (4), `api-gateway/src/main/resources/application.yml`, `eureka-server/src/main/resources/application.yml`, `.env`, `.env.example`, `kubernetes/01-configmap.yaml`, `kubernetes/03-secret.yaml`.

## 4. Files Modified
The service `application.yml` files were modified after creation as recorded in [29](29-Implementation-Change-Log.md) (forward-headers, Kafka observation, `max.block.ms`, `context-propagators`).

## 5. Implementation Details – environment variables
| Variable | Default (local) | Used by | Meaning |
|---|---|---|---|
| `MYSQL_HOST` / `MYSQL_PORT` | `localhost` / `3306` | 4 services | Host of the **existing** MySQL (Compose: `host.docker.internal`, K8s: `mysql-external`) |
| `MYSQL_USER` / `MYSQL_PASSWORD` | `abhig` / the dev password set in `application.yml` (**dev default on user request**) | 4 services | Required in Compose (`.env`) and Kubernetes (Secret); override everywhere outside local dev |
| `JWT_SECRET` | dev placeholder (≥ 32 chars) | all incl. gateway | HMAC secret – must be identical everywhere |
| `ADMIN_PASSWORD` | `Admin@123` | student-service | Bootstrap admin password |
| `EUREKA_URL` | `http://localhost:8761/eureka` | gateway + services | |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | student, course | |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | course, enrollment, notification | |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://localhost:4318/v1/traces` | all | |
| `LOGGING_STRUCTURED_FORMAT_CONSOLE` | unset (text) | all | `logstash` = JSON logs |
| `SERVER_PORT` | 8080–8084 | each | |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,4200,5173` | gateway | |
| `LOW_AVAILABILITY_THRESHOLD` | `5` | course | Seats at/below which an event is published |
| `MYSQL_PROXY_PORT`, `DOCKER_BRIDGE_IP`, `GRAFANA_PASSWORD` | `3307`, `172.17.0.1`, `admin` | Compose | |

Application properties of note: `app.cache.*` (TTLs), `enrollment.saga.*`, `enrollment.outbox.*`, `notification.dispatch.*`, `notification.consumer.*`, `resilience4j.*`, `management.*`, `spring.flyway.*`, `spring.jpa.hibernate.ddl-auto=validate`.

## 6. Architecture Details
Precedence: environment variable → `application.yml` default.

## 7. Dependencies
None.

## 8. Configuration Changes
This document.

## 9. Database Changes
None.

## 10. API Changes
None.

## 11. Communication Changes
None.

## 12. Execution Instructions
Local: nothing to set (defaults), or `export MYSQL_USER=… MYSQL_PASSWORD=…`. Compose: edit `.env`. Kubernetes: Secret + ConfigMap.

## 13. Testing
Integration tests override datasource/Kafka/Redis through `@DynamicPropertySource`; the Resilience IT overrides `clients.*.url`.

## 14. Pending Items
The prompt requires "do not expose database credentials in source code"; the dev defaults `abhig` / the dev password set in `application.yml` in the four `application.yml` files and in the git-ignored `.env` deviate from this **on the project owner's explicit instruction**. Remove the `:abhig` / `:<dev password>` defaults (and `ADMIN_PASSWORD`/JWT defaults) before publishing or deploying.
