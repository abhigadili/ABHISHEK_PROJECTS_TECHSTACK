# Logging and Exception Handling

## Part A - Logging

**Stack:** SLF4J API + Logback (Spring Boot default), configured once in `common-library/src/main/resources/logback-spring.xml` for every service. (Log files and console only - no log shipping or monitoring stack by requirement.)

### 1. Format
```
2026-11-25 15:49:07.593 INFO  [hr-employee-service] [cid=3b16743f-e708-439f-bc49-276d034ca453] [uid=] http.access - <-- GET /api/v1/employees/directory 200 (9 ms)
%d  %-5level  [service]  [correlation id]  [user id]  logger  - message
```
| Field | Source |
|---|---|
| service | `spring.application.name` |
| `cid` | MDC `correlationId` - set by `CorrelationIdFilter` (from the gateway's `X-Correlation-Id`), re-set from the event metadata by `IdempotentEventProcessor` for Kafka handlers, copied to async threads by the `TaskDecorator` |
| `uid` | MDC `userId` - set by `JwtAuthenticationFilter` after authentication (empty on the outer access-log lines and on unauthenticated paths) |
| extra MDC | `clientIp` (`RequestMetadataInterceptor`), `service` |
**Following one request:** `grep <cid> logs/*.log` shows the gateway line, the service access lines, outbox / Kafka publish lines, consumer lines in other services and the audit row's `correlation_id`.

### 2. Appenders and levels
* Console + rolling file `${LOG_DIR:-./logs}/<service>.log` (size and time based: 20 MB, 14 days, 500 MB cap, gzip).
* Root `INFO`; `org.apache.kafka` WARN, `org.hibernate.SQL` WARN (set DEBUG locally to see statements), Hikari WARN, Flyway INFO.
* Levels used: `ERROR` unexpected failures (stack trace), `WARN` degraded behaviour (slow method, retry, downstream failure, event giving up → DLT), `INFO` business events and access lines, `DEBUG` timing detail.

### 3. What is logged (and what never is)
| Logged | Never logged |
|---|---|
| access line per request (method, path, status, ms) | request / response **bodies** |
| business milestones: "Event queued topic=... eventId=...", "Event published ... partition ... offset", "Outbox relay delivered ...", payroll start / failure counts, login failures | passwords, tokens, secrets, bank / PAN numbers, salary figures in free text |
| downstream calls (Feign: `Feign -> GET url` at DEBUG, error decoder at INFO) | argument values of service methods (`ServiceTimingAspect` logs names and durations only) |
| masked identifiers | stack traces to clients |
**Masking (defence in depth):** (1) `RequestLoggingFilter` masks sensitive query parameters (`LogMasker.maskQuery`: `password|token|secret|authorization|pan|account=***`); (2) the Logback pattern applies a `%replace` regex to every message (`password=...`, `token: "..."` → `***`); (3) `LogMasker.maskTail/maskEmail` for explicit masking of account numbers and e-mails (`******7890`, `p***@acme.test`); (4) audit payloads store masked values for bank data.

### 4. Audit trail (business logging in the database)
`AuditService.record(entityType, entityId, action, previous, current)` runs **inside the caller's transaction** (state change and audit row commit together) and stores user, correlation id, timestamps and JSON before / after in `audit_history`; MySQL triggers make the table append-only. Read through `GET /api/v1/<area>/audit?entityType=&entityId=` on each service (e.g. `/api/v1/employees/audit`; HR_ADMIN, SUPER_ADMIN, FINANCE_ADMIN, PAYROLL_ADMIN). Domain histories (`employee_status_history`, `salary_revision_history`, `leave_balance_history`, `leave/exit/timesheet/document history`) complement it.

## Part B - Exception handling

### 1. One error shape everywhere
```json
{ "timestamp": "2026-11-25T10:21:03.955Z", "status": 404, "error": "Not Found", "code": "RESOURCE_NOT_FOUND",
  "message": "Employee not found: 00000000-0000-0000-0000-000000000000", "path": "/api/v1/employees/0000...", "correlationId": "edc7f987-...", "fieldErrors": null }
```
`ApiError` record in `common-library/.../exception/ApiError.java` (null fields omitted). The gateway returns the same fields for its own answers (`GatewayErrorHandler`).

### 2. Exception hierarchy
`ApiException` (abstract: HTTP status + stable `code`) →
`ResourceNotFoundException` (404 `RESOURCE_NOT_FOUND`), `BadRequestException` (400), `ValidationException` (400 `VALIDATION_FAILED` + `fieldErrors`), `UnauthorizedException` (401), `ForbiddenOperationException` (403), `ConflictException` (409), `ServiceUnavailableException` (503), `DownstreamClientException` (4xx from another service).
Services throw these *business* exceptions; they never build HTTP responses.

### 3. `GlobalExceptionHandler` (`@RestControllerAdvice`)
| Exception | Response |
|---|---|
| `ApiException` subclasses | their own status / code (5xx logged at ERROR, others INFO) |
| `MethodArgumentNotValidException` | 400 `VALIDATION_FAILED` + `fieldErrors` |
| `ConstraintViolationException` | 400 (parameter-level validation) |
| `HttpMessageNotReadableException`, type mismatch, missing parameter / header | 400 `MALFORMED_REQUEST` |
| `HttpRequestMethodNotSupportedException` / `HttpMediaTypeNotSupportedException` | 405 / 415 |
| `NoResourceFoundException` | 404 |
| `MaxUploadSizeExceededException` | 413 |
| `AccessDeniedException` / `AuthenticationException` | 403 `FORBIDDEN` / 401 `UNAUTHORIZED` |
| `DataIntegrityViolationException` | 409 `DATA_CONFLICT` (duplicate / referenced record) - no SQL text |
| `OptimisticLockingFailureException`, `PessimisticLockingFailureException` | 409 `CONCURRENT_MODIFICATION` ("reload and retry") |
| anything else | 500 `INTERNAL_ERROR`, "Unexpected server error"; full stack trace in the log only |
Exceptions thrown inside **servlet filters** (invalid JWT, bad header) happen before MVC, so `JsonSecurityHandlers` / the filters emit the same JSON themselves.

### 4. Real responses (through the gateway)
| Situation | Status | `code` / `message` |
|---|---|---|
| unknown employee id | 404 | `RESOURCE_NOT_FOUND` - "Employee not found: 0000..." |
| employee calls an admin API | 403 | `FORBIDDEN` - "You do not have permission to perform this action" |
| bad / expired / revoked token | 401 | `UNAUTHORIZED` - "Authentication required: missing, invalid, revoked or expired token" |
| wrong password | 401 | `UNAUTHORIZED` - "Invalid username or password" (same text for unknown user: no account enumeration) |
| broken JSON | 400 | `MALFORMED_REQUEST` |
| unknown route | 404 | `ROUTE_NOT_FOUND` - "No such endpoint" (gateway) |
| invalid sort field | 400 | `BAD_REQUEST` - "Cannot sort by 'password'. Allowed: [...]" |
| invalid body | 400 | `VALIDATION_FAILED` + `fieldErrors` |

### 5. Messaging and background errors
* Kafka consumers: retry with back-off, then `<topic>.DLT`, error logged with topic / partition / offset (`kafka-guide`).
* Outbox relay: a failed delivery is logged (`Outbox relay could not deliver outbox#N (attempt k)`) and retried next cycle.
* Feign: `ErrorDecoder` turns downstream errors into the same exception types (message preserved); retries only for I/O and 502/503/504.
* WebClient: `mapError`, `retryWhen` for transient failures, `onErrorResume/onErrorReturn` for optional sections.
* Scheduled jobs run under a Redis lock and catch / log per-item failures so one bad record does not stop a batch.

### 6. Rules followed
1. Throw a specific business exception with a user-safe message; never return `e.getMessage()` of framework or SQL exceptions.
2. 4xx are logged at INFO (client's problem), 5xx at ERROR with stack trace.
3. Every response carries the correlation id so a user can quote it to support.
4. Handle exceptions once, centrally; catch locally only to translate or to degrade (never to swallow silently - the swallowed 401 in the settlement flow was a real bug found this way).

## Pros / cons
| Pros | Cons |
|---|---|
| Uniform client contract; no information leaks; traceable via correlation id | Generic 500 hides detail from users (they must quote the id; support reads the log) |
| Business code stays free of HTTP and logging plumbing | Masking by regex can miss unusual field names - add them to `LogMasker` / the pattern |
| Audit rows commit atomically with the change | Audit JSON grows the database; archive policy needed |
