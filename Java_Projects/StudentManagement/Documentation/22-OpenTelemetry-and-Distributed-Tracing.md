# 22 – OpenTelemetry and Distributed Tracing

## 1. Feature Overview
Micrometer Tracing with the OpenTelemetry bridge; spans exported over OTLP/HTTP to Jaeger (`jaegertracing/all-in-one:1.62.0`, UI :16686). Gateway, Student, Course, Enrollment and Notification all participate.

## 2. Purpose
See one request as a single trace across processes, with trace/span ids in logs.

## 3. Files Created
No code files (auto-configuration). `docker-compose.yml` defines `jaeger`; `services/enrollment-service/src/main/java/com/example/enrollment/client/TracingContextPropagator.java` keeps the trace across the Resilience4j thread pool.

## 4. Files Modified
`application.yml` of course/enrollment/notification: `spring.kafka.template.observation-enabled: true` (notification also `listener.observation-enabled: true`).

## 5. Implementation Details
`management.tracing.sampling.probability: 1.0` (all requests; lower in production), `management.otlp.tracing.endpoint=${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:http://localhost:4318/v1/traces}`. HTTP server and Feign client calls are observed automatically (`feign-micrometer`), W3C `traceparent` propagated. Log lines carry `traceId`/`spanId` (and `correlationId`).

## 6. Architecture Details
Verified in Jaeger: all five services appear in `/api/services`; one enrollment trace contained 48 spans across `api-gateway`, `enrollment-service`, `student-service`, `course-service`.

## 7. Dependencies
`micrometer-tracing-bridge-otel` 1.4.5, `opentelemetry-exporter-otlp` 1.43.0, `feign-micrometer`.

## 8. Configuration Changes
`management.tracing.*`, `management.otlp.tracing.endpoint` (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`: `http://jaeger:4318/v1/traces` in Compose/K8s).

## 9. Database Changes
None.

## 10. API Changes
None.

## 11. Communication Changes
OTLP/HTTP to Jaeger :4318; `traceparent` header between services; Kafka producer/consumer observation enabled.

## 12. Execution Instructions
`docker compose up -d jaeger`, run the E2E, open `http://localhost:16686`, service `api-gateway`.

## 13. Testing
Verified live via the Jaeger query API (see §6). Not covered by automated tests.

## 14. Pending Items
The outbox poller runs on a scheduler thread, so the trace of the original HTTP request does not continue into the Kafka publish/consume spans (they form separate traces; the `correlationId` inside the event ties them together in logs). Storing `traceparent` in the outbox row would close the gap.
