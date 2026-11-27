# 00 - Project Overview

## 1. Feature Overview
Student Management System implemented as **ASP.NET Core 8 microservices** (C#): Student, Course, Enrollment and Notification services, a **YARP API Gateway**, RabbitMQ, Redis, MySQL (existing server), Serilog, OpenTelemetry, Prometheus/Grafana, Docker Compose and Kubernetes manifests. It is the .NET counterpart of the Java/Spring version at `~/Documents/Java_Projects/StudentManagement` (separate code, same business model).

## 2. Purpose
Learn and demonstrate real microservice concepts through one small business domain: database-per-service, gateway, synchronous REST with resilience, asynchronous events, saga, transactional outbox, inbox/idempotency, CQRS, caching, JWT security and observability.

## 3. Files Created
See the per-feature documents. Top level: `StudentManagement.sln`, `Directory.Build.props`, `docker-compose.yml`, `.env.example`, `.gitignore`, `.dockerignore`, `README.md`.

## 4. Files Modified
None (new project).

## 5. Implementation Details
| Folder | Role |
|---|---|
| `ApiGateway/` | YARP reverse proxy, central JWT validation, 503 fallback |
| `Services/StudentService/` | students, ASP.NET Identity users, login/refresh (StudentDB) |
| `Services/CourseService/` | courses, categories, seats (CourseDB) |
| `Services/EnrollmentService/` | saga, outbox, CQRS (EnrollmentDB) |
| `Services/NotificationService/` | RabbitMQ consumers, inbox, dispatcher (NotificationDB) |
| `BuildingBlocks/Common` | JWT, errors, paging, cache, correlation id, health helpers |
| `BuildingBlocks/EventContracts` | integration event records + topology names |
| `BuildingBlocks/Messaging` | RabbitMQ connection, topology, publisher, consumer base class |
| `BuildingBlocks/Observability` | Serilog + OpenTelemetry setup |
| `Tests/UnitTests`, `Tests/IntegrationTests` | xUnit + Moq + Testcontainers |
| `Docker/`, `Kubernetes/`, `Monitoring/`, `scripts/` | packaging, orchestration, dashboards, run scripts |

## 6. Architecture Details
Clients -> **API Gateway :8080** -> Student :8081 / Course :8082 / Enrollment :8083 / Notification :8084. Enrollment calls Student and Course synchronously (REST + service JWT). Enrollment publishes events through its outbox to RabbitMQ exchange `sms.events`; Course publishes `LowCourseAvailability`; Notification consumes. Each service owns one MySQL database; no service reads another's database. See `09-RabbitMQ-Event-Driven-Architecture.md`, `10-Saga-Pattern.md`.

## 7. Dependencies
.NET 8 SDK/LTS (8.0.422 installed), EF Core 8.0.10, Pomelo.EntityFrameworkCore.MySql 8.0.2, Yarp.ReverseProxy 2.2.0, RabbitMQ.Client 6.8.1, Microsoft.Extensions.Http.Resilience 8.10.0, Serilog.AspNetCore 8.0.3, OpenTelemetry 1.9.x, Swashbuckle 6.8.1, xUnit 2.9.2, Moq 4.20.72, Testcontainers 3.10.0. External: MySQL 8 (host), RabbitMQ 3.13, Redis 7, Jaeger, Prometheus, Grafana.

## 8. Configuration Changes
Per service `appsettings.json`; secrets via environment variables - see `26-Configuration-and-Environment-Variables.md`.

## 9. Database Changes
Only **new** `dn_*` tables (+ `__EFMigrationsHistory`) are added to the four existing databases. Existing tables and data are untouched - `02-MySQL-Database-Configuration.md`.

## 10. API Changes
36 business endpoints behind the gateway - `README.md` section "API endpoints".

## 11. Communication Changes
REST (Enrollment -> Student/Course), RabbitMQ events - `08` and `09`.

## 12. Execution Instructions
```bash
docker compose up -d rabbitmq redis jaeger        # infra (host MySQL must be running)
dotnet build StudentManagement.sln
scripts/start-local.sh                            # 4 services + gateway
python3 scripts/e2e.py                            # end-to-end checks through the gateway
scripts/stop-local.sh
```

## 13. Testing
See `24-Unit-and-Integration-Testing.md` and `27-Implementation-Change-Log.md` for results.

## 14. Pending Items
See the checklist in `README.md` and the per-document "Pending Items".
