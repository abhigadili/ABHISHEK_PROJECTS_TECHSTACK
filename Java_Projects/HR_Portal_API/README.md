# HR Portal API

Enterprise HR backend built as **16 Spring Boot 3.4 / Java 21 microservices** behind a Spring Cloud Gateway, with MySQL (one database per service), Apache Kafka, Redis, Flyway, OpenFeign + WebClient, JWT security and OpenAPI documentation.

| | |
|---|---|
| Language / framework | Java 21, Spring Boot 3.4.5, Spring Cloud 2024.0.1 |
| Services | gateway + auth, employee, organization, leave, attendance, holiday, payroll, tax, performance, project, timesheet, exit, document, notification, reporting |
| Data | MySQL 8 (15 databases `hr_*_db`), Flyway migrations, 155 tables, 8 functions, 6 stored procedures, 9 views, 35 triggers |
| Messaging | Kafka (24 business topics + dead-letter topics), transactional outbox, idempotent consumers |
| Cache / coordination | Redis (cache, JWT revocation, refresh tokens, login attempts, rate limiting, distributed locks, notification de-duplication) |
| API docs | Swagger UI per service (`/swagger-ui.html`) and aggregated at the gateway |

## Ports

| Component | Port | Database |
|---|---|---|
| `hr-api-gateway` | **9080** | - |
| `hr-auth-service` | 9101 | `hr_auth_db` |
| `hr-employee-service` | 9102 | `hr_employee_db` |
| `hr-organization-service` | 9103 | `hr_organization_db` |
| `hr-leave-service` | 9104 | `hr_leave_db` |
| `hr-attendance-service` | 9105 | `hr_attendance_db` |
| `hr-holiday-service` | 9106 | `hr_holiday_db` |
| `hr-payroll-service` | 9107 | `hr_payroll_db` |
| `hr-tax-service` | 9108 | `hr_tax_db` |
| `hr-performance-service` | 9109 | `hr_performance_db` |
| `hr-project-service` | 9110 | `hr_project_db` |
| `hr-timesheet-service` | 9111 | `hr_timesheet_db` |
| `hr-exit-service` | 9112 | `hr_exit_db` |
| `hr-document-service` | 9113 | `hr_document_db` |
| `hr-notification-service` | 9114 | `hr_notification_db` |
| `hr-reporting-service` | 9115 | `hr_reporting_db` |
| Kafka (host) / Kafka UI / Redis | 9192 / 9190 / 9379 | - |

## Quick start (local, existing MySQL server)

```bash
cp .env.example .env            # fill in the placeholders (see "Configuration" below)
docker compose up -d            # Kafka, Kafka UI, Redis
./scripts/create-databases.sh   # 15 databases + least-privilege runtime user on the EXISTING MySQL server
./scripts/build.sh              # mvn clean package (no tests exist in this project)
./scripts/start-all.sh          # 15 services + gateway from the built jars
# API entry point: http://localhost:9080     Swagger UI: http://localhost:9080/swagger-ui.html
./scripts/stop-all.sh
```

Log in (the initial super admin comes from `HR_BOOTSTRAP_ADMIN_*` in `.env`):

```bash
curl -s -X POST localhost:9080/api/v1/auth/login -H 'Content-Type: application/json' \
     -d '{"username":"superadmin","password":"<HR_BOOTSTRAP_ADMIN_PASSWORD>"}'
```

Everything else is documented in `docs/` (files carry a `YYYYMMDDHHmm-` prefix):

| Document | Topic |
|---|---|
| `*-architecture.md` | system design, request flow, communication styles, design decisions |
| `*-microservices.md` | responsibilities, packages, dependencies and APIs of every service |
| `*-database-design.md` | databases, tables, keys, audit columns, procedures, functions, views, triggers |
| `*-api-documentation.md` | every endpoint (generated from the OpenAPI specs) |
| `*-security.md` | JWT, roles, permissions, method security, data protection |
| `*-kafka-guide.md`, `kafka/` | topics, producers, consumers, DTOs, sample messages, commands |
| `*-redis-guide.md` | all Redis usage with key design |
| `*-java-concepts.md`, `*-spring-boot-concepts.md` | Java 21 and Spring concepts as used in this project |
| `*-jpa-hibernate-guide.md`, `*-jdbc-guide.md`, `*-mysql-advanced-guide.md` | persistence layers |
| `*-java-collections-guide.md`, `*-java-streams-guide.md`, `*-java-concurrency-guide.md` | collections, streams, concurrency |
| `*-feign-webclient-guide.md` | synchronous communication |
| `*-servlet-request-pipeline.md`, `*-dependency-injection-guide.md`, `*-validation-mapping-guide.md` | web layer, IoC, validation / mapping |
| `*-sql-injection-prevention.md`, `*-logging-exception-handling.md` | hardening, logging, errors |
| `*-docker-setup.md`, `*-business-workflows.md` | Docker, and every HR workflow end to end |

## Configuration (`.env`)

All credentials come from environment variables - nothing secret is in source, Dockerfiles or committed configuration. `.env` is git-ignored; `.env.example` has placeholders only.

| Variable | Purpose |
|---|---|
| `MYSQL_HOST`, `MYSQL_PORT` | existing MySQL server |
| `MYSQL_APP_USER` / `MYSQL_APP_PASSWORD` | runtime login with **DML + EXECUTE only** on the 15 `hr_*` databases (created by `create-databases.sh`) |
| `MYSQL_MIGRATION_USER` / `MYSQL_MIGRATION_PASSWORD` | privileged login used **only by Flyway** (triggers and functions need SUPER while the binary log is on) |
| `KAFKA_BOOTSTRAP_SERVERS`, `REDIS_HOST/PORT/PASSWORD` | infrastructure |
| `JWT_SECRET` | HS256 signing key shared by the auth service, the gateway and all services (>= 32 bytes) |
| `HR_DATA_ENCRYPTION_KEY` | key material for AES-GCM column encryption (bank account, PAN, customer tax number) |
| `HR_BOOTSTRAP_ADMIN_*` | the first SUPER_ADMIN account (no default credentials exist in migrations) |
| `HR_EXPOSE_RESET_TOKEN` | `true` only in development: returns the password-reset token in the API response instead of e-mailing it |
| `SMTP_PASSWORD` | SMTP password for the notification service (host / port / user live in the `email_settings` table) |

## What is deliberately NOT in the project

No test classes or test dependencies, no Actuator / Prometheus / Grafana / tracing / monitoring configuration (as required). Liveness for scripts and Docker is a plain `/ping` endpoint.

## Statutory data warning

Tax slabs, PF percentage / wage ceiling and professional-tax slabs shipped in the migrations are **sample values for development**. They are configuration rows (`payroll_config`, `tax_rules`) editable through the API. **Verify every statutory value against current regulations before any real payroll or TDS run.**

## Operational notes

* `HR_FLYWAY_REPAIR=true` (remove FAILED migration entries) and `HR_FLYWAY_RESET=true` + `SPRING_FLYWAY_CLEAN_DISABLED=false` (Flyway clean + migrate of that service's own database) are opt-in **development** switches, off by default.
* Generated files (payslip PDFs, uploaded documents) go to `HR_STORAGE_ROOT` (`./storage` locally, the `hr-storage` volume in Docker). The payroll and document services must share it.
* Production checklist: strong unique secrets, TLS in front of the gateway, a dedicated Kafka / Redis with authentication, rotate `JWT_SECRET`, verified statutory configuration, backups of the 15 databases.
