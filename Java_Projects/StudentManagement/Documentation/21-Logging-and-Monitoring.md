# 21 – Logging and Monitoring

## 1. Feature Overview
SLF4J/Logback logging with correlation ids, trace/span ids and optional structured JSON; Micrometer metrics scraped by Prometheus and shown in a provisioned Grafana dashboard.

## 2. Purpose
Follow one request across services and watch rates, latency, errors, outbox and resilience state.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| common/common-web/src/main/java/com/example/common/web/CorrelationIdFilter.java | Created | `X-Correlation-Id` → MDC `correlationId`, response header, one log line per request (`http.request` logger), actuator calls skipped |
| api-gateway/src/main/java/com/example/gateway/filter/CorrelationIdGlobalFilter.java | Created | Same at the edge (`gateway.request` logger) |
| monitoring/prometheus/prometheus.yml | Created | Compose scrape config (container names) |
| monitoring/prometheus/prometheus-host.yml | Created | Variant for services running on the host |
| monitoring/grafana/provisioning/datasources/prometheus.yml, provisioning/dashboards/dashboards.yml | Created | Auto-provisioning |
| monitoring/grafana/dashboards/student-management.json | Created | 12 panels |

## 4. Files Modified
`common/common-web/src/main/java/com/example/common/CommonAutoConfiguration.java` – request-log filter order changed to run *inside* Spring's observation scope so `traceId/spanId` are present in the request log line.

## 5. Implementation Details
* **Log pattern** (all modules): `%5p [app,traceId,spanId,correlationId]` – e.g. `INFO [enrollment-service,357ea…,564a6…,corr-1]`.
* **Structured logging**: Spring Boot 3.4 native structured logging; set `LOGGING_STRUCTURED_FORMAT_CONSOLE=logstash` (already set in Compose/Kubernetes). Verified output: `{"@timestamp":…,"message":"GET /api/students -> 401 (25 ms)","logger_name":"http.request","level":"INFO","correlationId":"demo-corr-1"}`.
* **Exceptions** are logged once centrally by `GlobalExceptionHandler`; Kafka processing logs `Consumed <type> eventId=… [topic-partition@offset]`.
* **Metrics**: `micrometer-registry-prometheus`, tag `application=<name>`; `/actuator/prometheus` on every module. Custom: `outbox_events_*`. Built-in: `http_server_requests_*`, JVM, Hikari, `resilience4j_*`, Kafka client/listener.
* **Grafana dashboard** panels: HTTP req/s and p95 per service, 5xx rate, enrollment POST by status, outbox published/failed/pending, circuit-breaker state, retries, bulkhead threads, JVM heap, Kafka listener rate, Hikari connections, `up`.

## 6. Architecture Details
Prometheus (:9090) scrapes all six Java modules every 10 s; Grafana (:3001, admin/`GRAFANA_PASSWORD`) uses datasource `prometheus`.

## 7. Dependencies
`micrometer-registry-prometheus`, `spring-boot-starter-actuator`; images `prom/prometheus:v2.55.1`, `grafana/grafana:11.3.0`.

## 8. Configuration Changes
`logging.pattern.level`, `management.endpoints.web.exposure.include`, `management.metrics.tags.application` in every `application.yml`.

## 9. Database Changes
None.

## 10. API Changes
`/actuator/prometheus`, `/actuator/metrics`.

## 11. Communication Changes
Prometheus pull over HTTP.

## 12. Execution Instructions
Compose: `docker compose up -d prometheus grafana`. Host-run services: start Prometheus with `prometheus-host.yml` (command in that file) then open `http://localhost:3001` → *Student Management – Overview*.

## 13. Testing
Verified live: Prometheus reported all 6 targets `up`; `sum(outbox_events_published_total)` returned data; Grafana `/api/health` OK, datasource health “Successfully queried the Prometheus API”, dashboard `sms-overview` provisioned, and a dashboard-style query through Grafana's datasource proxy returned frames. JSON logging verified with a real request.

## 14. Pending Items
Panels were validated by query, not visually; no alert rules; the Compose-network Prometheus (container-name targets) could not be exercised because the full Compose stack was not run (see [24](24-Docker-and-Docker-Compose.md)).
