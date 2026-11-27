# 19 - Logging and Monitoring

## 1. Feature Overview
Serilog structured logging (requests, application, exceptions, RabbitMQ processing, correlation ids) and Prometheus + Grafana monitoring (OpenTelemetry metrics).

## 2. Purpose
Follow one request across services in logs, and watch throughput/latency/outbox health in dashboards.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| BuildingBlocks/Observability/ObservabilityExtensions.cs | Created | `AddSmsObservability` (Serilog + OpenTelemetry), `UseSmsObservability` (request logging + `/metrics`) |
| BuildingBlocks/Common/Web/CorrelationIdMiddleware.cs | Created | `X-Correlation-Id` in/out, request header, Serilog `LogContext`, trace tag |
| BuildingBlocks/Common/Errors/GlobalExceptionHandler.cs | Created | Exception logging (500 = Error with stack trace, 4xx = Warning) |
| Monitoring/Prometheus/prometheus.yml | Created | Scrape `/metrics` of containers and host processes |
| Monitoring/Grafana/provisioning/datasources/prometheus.yml, dashboards/dashboards.yml | Created | Auto-provisioned datasource + dashboard provider |
| Monitoring/Grafana/dashboards/sms-overview.json | Created | Dashboard: req/s, p95, 5xx, outbox published/pending/failed, CPU, GC heap |

## 4. Files Modified
`docker-compose.yml` (Prometheus + Grafana services).

## 5. Implementation Details
- Log line: `{time} {level} [{Service},{TraceId},{CorrelationId}] {SourceContext}: {message}`. Request logging line: `HTTP GET /api/x -> 200 (12 ms)` (health/metrics paths demoted to Verbose). Microsoft/System.Net.Http noise at Warning.
- RabbitMQ processing logs: `Published ... messageId= routingKey=`, `Processed ... messageId= (attempt n)`, handler failures with attempt counters, `Dead-lettering ...`.
- Business events logged by services: saga steps, seat reserved/released, outbox publish/failure, notification queued/sent/failed.
- Metrics: ASP.NET Core, HttpClient and .NET runtime instrumentation + custom meter `enrollment-service` (`outbox_events_published`, `outbox_events_failed`, `outbox_events_pending`), exposed at `GET /metrics` (Prometheus text) by every program.

## 6. Architecture Details
Correlation id is generated at the gateway (or taken from the client), forwarded in HTTP headers, stored in Enrollment's saga row and in outbox rows / AMQP `correlationId`, so it survives asynchronous hops.

## 7. Dependencies
`Serilog.AspNetCore 8.0.3`, `OpenTelemetry.Extensions.Hosting/Instrumentation.AspNetCore/Http/Runtime 1.9.x`, `OpenTelemetry.Exporter.Prometheus.AspNetCore 1.9.0-beta.2`, Prometheus 2.55, Grafana 11.3.

## 8. Configuration Changes
`OpenTelemetry:OtlpEndpoint` (traces), Prometheus `Monitoring/Prometheus/prometheus.yml`, Grafana admin password `GRAFANA_PASSWORD`.

## 9. Database Changes
None.

## 10. API Changes
`GET /metrics` on every program.

## 11. Communication Changes
Prometheus scrapes every 10 s.

## 12. Execution Instructions
```bash
docker compose up -d prometheus grafana        # http://localhost:9090 , http://localhost:3001 (admin / GRAFANA_PASSWORD)
curl localhost:8083/metrics | grep outbox
grep <correlation-id> logs/*.log
```

## 13. Testing
`scripts/e2e.py` asserts `outbox_events_published` appears in Enrollment's `/metrics`; correlation id echo verified via the gateway; see `27` for the Prometheus/Grafana verification record.

## 14. Pending Items
Log shipping/aggregation (ELK/Loki) not included. Alert rules not defined.
