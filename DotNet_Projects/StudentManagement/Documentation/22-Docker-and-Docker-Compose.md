# 22 - Docker and Docker Compose

## 1. Feature Overview
One parameterised multi-stage `Docker/Dockerfile` builds all five programs; `docker-compose.yml` defines RabbitMQ, Redis, Jaeger, Prometheus, Grafana (infrastructure) and, under the compose profile `apps`, the gateway and four services.

## 2. Purpose
Reproducible packaging and local orchestration **without a second MySQL**: containers connect to the MySQL server already running on the host.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| Docker/Dockerfile | Created | `sdk:8.0` build stage (`dotnet publish $PROJECT`) -> `aspnet:8.0` runtime, non-root `app` user, `HEALTHCHECK` |
| Docker/healthcheck.sh | Created | bash `/dev/tcp` GET `/health/live` (the aspnet image has no curl/wget) |
| docker-compose.yml | Created | Infra + `apps` profile, networks, volumes, health checks, `depends_on: service_healthy` |
| .env.example | Created | Variable template (copy to `.env`, git-ignored) |
| .dockerignore | Created | Excludes bin/obj/logs/.env/Tests/Documentation from the build context |
| Monitoring/Prometheus/prometheus.yml, prometheus-host.yml | Created | Scrape configs (containers / host processes) |

## 4. Files Modified
None.

## 5. Implementation Details
- **Infrastructure containers** (named `sms-dn-*`): `rabbitmq:3.13-management-alpine` (volume `rabbitmq-data`, health `rabbitmq-diagnostics ping`), `redis:7-alpine` (AOF, volume `redis-data`), `jaegertracing/all-in-one:1.62.0` (OTLP gRPC 4317, UI 16686), `prom/prometheus:v2.55.1` (9090), `grafana/grafana:11.3.0` (3001, provisioned datasource + dashboard, volume `grafana-data`).
- **Application containers** (profile `apps`): `ASPNETCORE_URLS=http://+:8080`; service-to-service DNS names (`http://student-service:8080`); `Redis`/`RabbitMq` host names; `OpenTelemetry__OtlpEndpoint=http://jaeger:4317`.
- **MySQL:** `ConnectionStrings__<X>Db` is built from `MYSQL_HOST` (default `host.docker.internal`, mapped through `extra_hosts: host.docker.internal:host-gateway`), `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`. Inside a container `localhost` is the container itself, hence the variable. Credentials come from `.env`, never from source.
- Startup order: Redis/RabbitMQ healthy -> Student & Course healthy -> Enrollment & Notification -> Gateway.
- Compose validation: `docker compose config -q` (with `.env`) succeeds for both the infra-only and `--profile apps` renderings.
- **Verification actually performed:** the infrastructure containers run and are used by every live test. The five application images were built with `docker compose --profile apps build` (result recorded in `27-Implementation-Change-Log.md`).
- **Not performed - host MySQL reachability:** MySQL on this machine listens on `127.0.0.1:3306` and the grant is `...@localhost`, so a container (source address = docker bridge) cannot connect. Making it reachable requires either re-binding MySQL (+ a grant for the bridge subnet + firewall rule) or a loopback TCP proxy on the bridge address, the same two options described in `~/Documents/Java_Projects/StudentManagement/docker/README.md`. Both change how a local service is exposed, so they were **not applied automatically**; the containerised application stack was therefore **not run end to end**.

## 6. Architecture Details
Network `sms-net` (bridge). Only the gateway (8080) publishes an application port; Prometheus/Grafana/Jaeger/RabbitMQ UI ports are published for development.

## 7. Dependencies
Docker 28, Compose v2; base images `mcr.microsoft.com/dotnet/sdk:8.0`, `aspnet:8.0`.

## 8. Configuration Changes
`.env` keys: `MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, RABBITMQ_USER, RABBITMQ_PASSWORD, GRAFANA_PASSWORD`.

## 9. Database Changes
None (existing host MySQL).

## 10. API Changes
None.

## 11. Communication Changes
Container DNS names; see `26` for the environment mapping.

## 12. Execution Instructions
```bash
docker compose up -d rabbitmq redis jaeger prometheus grafana               # infrastructure (verified)
docker compose --profile apps build                                         # images (see change log)
docker compose --profile apps up -d                                         # needs MySQL reachable from containers (see above)
docker compose ps; docker compose logs -f enrollment-service
docker compose --profile apps down                                          # keeps volumes
```

## 13. Testing
Infra containers healthy (`docker compose ps`); Prometheus (host-network variant) scraped all five programs; Grafana datasource + dashboard provisioned (API check); Jaeger received traces from all five services. Application containers: see section 5.

## 14. Pending Items
Run the `apps` profile once MySQL is reachable from the bridge network; Prometheus container scraping of host processes needs the host-network variant (`prometheus-host.yml`) because the processes listen on localhost only.
