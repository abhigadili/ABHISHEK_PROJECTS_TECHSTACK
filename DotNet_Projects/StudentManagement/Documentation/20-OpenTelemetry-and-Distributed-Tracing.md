# 20 - OpenTelemetry and Distributed Tracing

## 1. Feature Overview
Distributed traces across API Gateway -> Student/Course/Enrollment/Notification, exported by OTLP (gRPC) to Jaeger, plus OpenTelemetry metrics (see `19`).

## 2. Purpose
See the full path and timing of one enrollment, including the asynchronous RabbitMQ hop.

## 3. Files Created
`BuildingBlocks/Observability/ObservabilityExtensions.cs` (tracing setup), `BuildingBlocks/Messaging/RabbitMq.cs` (`MessagingTelemetry` ActivitySource; `traceparent` header on publish, consumer span).

## 4. Files Modified
`docker-compose.yml` (Jaeger service, `OpenTelemetry__OtlpEndpoint=http://jaeger:4317` for containers).

## 5. Implementation Details
- Instrumentation: ASP.NET Core (health/metrics filtered out), HttpClient (propagates W3C `traceparent` on every outgoing REST call - gateway proxy and Enrollment's clients), custom source `Messaging`.
- RabbitMQ: the publisher copies `Activity.Current.Id` to a `traceparent` message header; the consumer starts a `rabbitmq process <queue>` span (`ActivityKind.Consumer`) with that parent, so the notification processing joins the enrollment trace.
- Resource name = service name (`api-gateway`, `student-service`, ...). Exporter only when `OpenTelemetry:OtlpEndpoint` is set.

## 6. Architecture Details
Gateway starts the trace (or continues the client's `traceparent`); every downstream service continues it.

## 7. Dependencies
`OpenTelemetry.Exporter.OpenTelemetryProtocol 1.9.0`, Jaeger all-in-one 1.62 (OTLP enabled).

## 8. Configuration Changes
`OpenTelemetry__OtlpEndpoint=http://localhost:4317` for local processes (set by `scripts/start-local.sh` unless already defined).

## 9. Database Changes
None.

## 10. API Changes
None.

## 11. Communication Changes
OTLP/gRPC to Jaeger :4317; UI `http://localhost:16686`.

## 12. Execution Instructions
Start Jaeger (`docker compose up -d jaeger`), start the services, run an enrollment, open Jaeger and search service `api-gateway`.

## 13. Testing
See `27` for the verification record (services listed in Jaeger, one trace spanning gateway, enrollment, student, course, notification).

## 14. Pending Items
EF Core / MySQL query spans are not instrumented. Sampling is 100 % (default always-on).
