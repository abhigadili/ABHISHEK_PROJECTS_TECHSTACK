# 16 - Resilience Patterns

## 1. Feature Overview
Retry, circuit breaker, timeouts and graceful failure for Enrollment -> Student/Course calls (Microsoft.Extensions.Http.Resilience), plus gateway-level 503 handling.

## 2. Purpose
A slow or down dependency must neither hang enrollments nor cascade failures.

## 3. Files Created
`Services/EnrollmentService/Clients/ClientRegistration.cs` (pipeline), `Clients/Clients.cs` (exception translation); gateway 503 middleware in `ApiGateway/Program.cs`.

## 4. Files Modified
None.

## 5. Implementation Details
Pipeline per client (outermost -> innermost), all configurable under `Resilience:`:
| Strategy | Default | Notes |
|---|---|---|
| Total timeout | 12 s | whole call incl. retries |
| Retry | 3 retries, 300 ms exponential + jitter | only 5xx, 408, 429, network errors (`HttpRetryStrategyOptions` default predicate); 404/409/other 4xx are business answers |
| Circuit breaker | 30 s sampling, min throughput 5, failure ratio 0.5, break 10 s | open circuit -> `BrokenCircuitException` -> `ServiceUnavailableException("... circuit breaker is OPEN")` |
| Attempt timeout | 4 s | per HTTP attempt |
`RemoteClientBase` maps `BrokenCircuitException`, `TimeoutRejectedException`, `HttpRequestException`, timeouts to `ServiceUnavailableException` (HTTP 503 if it escapes a controller). In the saga a validation-step outage becomes a clean Rejected result with reason; a compensation outage pauses the saga (`10`).

## 6. Architecture Details
Gateway: unreachable cluster -> 503 JSON; passive health check temporarily marks a destination unhealthy.

## 7. Dependencies
`Microsoft.Extensions.Http.Resilience 8.10.0` (Polly 8).

## 8. Configuration Changes
`Resilience:TotalTimeoutSeconds|AttemptTimeoutSeconds|RetryAttempts|RetryDelayMs|BreakerSamplingSeconds|BreakerMinimumThroughput|BreakerDurationSeconds`.

## 9. Database Changes
None.

## 10. API Changes
503 responses on dependency failure.

## 11. Communication Changes
Synchronous calls only.

## 12. Execution Instructions
Stop Course Service (`kill $(lsof -ti tcp:8082 -sTCP:LISTEN)`) and call `POST /api/enrollments` -> fast `422` with "Course validation failed"; `GET /api/courses` through the gateway -> `503`. `python3 scripts/failure-scenarios.py` automates it.

## 13. Testing
Integration (`RemoteClientIntegrationTests`, real pipeline vs stub server): 404 -> 1 attempt, transient 500 x2 retried then success (3 calls), persistent 503 opens the breaker and the next call does **not** reach the stub, unreachable host -> ServiceUnavailable.

## 14. Pending Items
No bulkhead/rate limiter (not required). No fallback data (fail-fast by design).
