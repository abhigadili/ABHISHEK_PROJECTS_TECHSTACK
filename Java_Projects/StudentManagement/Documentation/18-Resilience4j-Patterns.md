# 18 – Resilience4j Patterns

## 1. Feature Overview
Retry, Circuit Breaker, Time Limiter and Bulkhead (thread pool) around every Enrollment → Student/Course call; circuit breaker + fallback at the gateway; graceful degradation.

## 2. Purpose
A slow or failing dependency must not exhaust threads or cascade; callers get a fast, explicit answer.

## 3. Files Created
`StudentGateway.java`, `CourseGateway.java`, `RemoteCall.java`, `RemoteExceptions.java`, `TracingContextPropagator.java` under `services/enrollment-service/src/main/java/com/example/enrollment/client/` ([10](10-Service-to-Service-Communication.md)); `api-gateway/src/main/java/com/example/gateway/controller/FallbackController.java`; `services/enrollment-service/src/test/java/com/example/enrollment/it/ResilienceIT.java`.

## 4. Files Modified
None.

## 5. Implementation Details
Instances `studentService` and `courseService` (configured in `services/enrollment-service/src/main/resources/application.yml`):

| Pattern | Setting |
|---|---|
| Retry | 3 attempts, 300 ms exponential ×2; **ignores** 404/409/4xx business answers |
| Circuit breaker | count window 10, min 5 calls, open at ≥ 50 % failures, 10 s open, 3 half-open probes, auto half-open; business answers are **not** failures |
| Time limiter | 4 s (+ Feign read timeout 3 s, connect 2 s) |
| Bulkhead | thread-pool: core 10, max 20, queue 50, `TracingContextPropagator` |
| Graceful failure | `RemoteCall.await` → `ServiceUnavailableException` (“circuit breaker is OPEN”, “timed out”, “overloaded”); the saga turns this into a rejection + compensation or a paused saga |

Aspect order (Resilience4j default): Retry ⟶ CircuitBreaker ⟶ TimeLimiter ⟶ Bulkhead ⟶ call. Seat reserve/release are idempotent, which is what makes retrying them safe. Gateway: per-route `CircuitBreaker` with `forward:/fallback/<service>` (503 JSON).

## 6. Architecture Details
One breaker per dependency (verified independent). States are exported as metrics (`resilience4j_circuitbreaker_state`, `…_calls_seconds`, retry and bulkhead gauges) and as health (`/actuator/health` → `circuitBreakers`).

## 7. Dependencies
`resilience4j-spring-boot3` 2.2.0, `spring-cloud-starter-circuitbreaker-resilience4j` (services), `…-reactor-resilience4j` (gateway), `spring-boot-starter-aop`.

## 8. Configuration Changes
`resilience4j.circuitbreaker|retry|timelimiter|thread-pool-bulkhead.*` (enrollment), `resilience4j.*` (gateway).

## 9. Database Changes
None.

## 10. API Changes
A dependency outage surfaces as `503` (`ServiceUnavailableException`) on direct calls or as a `422 REJECTED` / `202 IN_PROGRESS` enrollment outcome.

## 11. Communication Changes
None.

## 12. Execution Instructions
Stop `course-service` and enroll: after the retries the saga rejects with “Course validation failed: course-service …”; after ≥5 failed calls the breaker opens and later calls fail instantly; restart the service and the breaker closes after its probes.

## 13. Testing
`ResilienceIT` (7): retry-until-success (3 hits), 404/409 not retried, exhausted retries then OPEN then fail-fast without reaching the stub, HALF_OPEN → CLOSED after recovery, slow responses cut off (< 12 s), breakers independent, correlation id/service token present on bulkhead threads. Live: gateway fallback returned `503` when `notification-service` was stopped.

## 14. Pending Items
Gateway-level retry for GET is not configured; no rate limiter; thresholds are untuned defaults.
