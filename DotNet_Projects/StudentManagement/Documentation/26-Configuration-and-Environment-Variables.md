# 26 - Configuration and Environment Variables

## 1. Feature Overview
Each program has an `appsettings.json` with safe local defaults; every value can be overridden by an environment variable (`Section__Key`), which is how Docker Compose and Kubernetes configure the same binaries.

## 2. Purpose
12-factor configuration; no credentials in container images or source for deployed environments.

## 3. Files Created
`*/appsettings.json` (5 programs), `.env.example`, `.env` (git-ignored, local only), `docker-compose.yml`, `Kubernetes/01-configmap.yaml`, `Kubernetes/03-secret.yaml` (template).

## 4. Files Modified
None.

## 5. Implementation Details
ASP.NET Core precedence (highest wins): command line > environment variables > `appsettings.json`. Nested keys use `__` in environment variables.

| Setting (env name) | Used by | Meaning | Default |
|---|---|---|---|
| `ConnectionStrings__StudentDb` / `CourseDb` / `EnrollmentDb` / `NotificationDb` | each service | MySQL connection to its own database | localhost:3306 (dev login in appsettings) |
| `ConnectionStrings__Redis` | Student, Course | Redis | `localhost:6379` |
| `RabbitMq__HostName/Port/UserName/Password/VirtualHost` | Course, Enrollment, Notification | broker | localhost:5672 guest/guest |
| `Jwt__Secret` (>= 32 chars), `Jwt__Issuer`, `Jwt__Audience`, `Jwt__AccessTokenMinutes`, `Jwt__RefreshTokenDays` | gateway + all services | token signing/validation - **identical everywhere** | dev secret in appsettings |
| `Bootstrap__AdminPassword` (+ `AdminUsername`, `AdminEmail`) | Student | first admin | dev default |
| `Services__Student`, `Services__Course` | Enrollment | downstream base URLs | `http://localhost:8081`, `:8082` |
| `ReverseProxy__Clusters__<name>__Destinations__d1__Address` | gateway | service URL per cluster | localhost ports |
| `Resilience__*` | Enrollment | timeouts/retries/breaker | see `16` |
| `Saga__*`, `Outbox__*` | Enrollment | job intervals | see `10`, `11` |
| `Notification__*` | Notification | dispatcher/consumer tuning | see `06` |
| `Course__LowAvailabilityThreshold` | Course | alert threshold | 5 |
| `Database__MigrateOnStartup` | all services | apply EF migrations at start | true |
| `OpenTelemetry__OtlpEndpoint` | all | OTLP gRPC trace endpoint (e.g. `http://localhost:4317`) | empty (tracing exporter off) |
| `Cors__AllowedOrigins` | gateway | browser origins | localhost 3000/4200/5173 |
| `ASPNETCORE_URLS` | containers | listen address | `http://+:8080` in Docker; `Urls` in appsettings locally (808x) |
| `MYSQL_HOST/PORT/USER/PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD`, `RABBITMQ_USER/PASSWORD`, `GRAFANA_PASSWORD` | docker-compose `.env` | compose-level variables that feed the settings above | see `.env.example` |

**Secrets:** the committed `appsettings.json` files contain *development defaults* (the existing local MySQL login, a throw-away JWT secret and admin password) so the project runs out of the box on this machine, as requested. They must be overridden for any shared/production deployment; Kubernetes uses a Secret created out-of-band; `.env` is git-ignored.

## 6. Architecture Details
Docker: the containers get connection strings built from `.env` (`MYSQL_HOST` defaults to `host.docker.internal`, i.e. the host, because `localhost` inside a container is the container itself).

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
`cp .env.example .env`, fill values, `docker compose --profile apps up -d --build`.

## 13. Testing
Integration tests override settings through environment variables (`Program.cs` reads configuration while the builder is created, before `WebApplicationFactory` overrides could apply - see `24`).

## 14. Pending Items
Replace development defaults before sharing the repository. No secret manager integration.
