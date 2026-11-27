# Feign and WebClient Guide

Synchronous service-to-service communication uses two clients, deliberately:

| | **OpenFeign** | **WebClient** (Spring WebFlux client) |
|---|---|---|
| Style | declarative interface, blocking | fluent, non-blocking (`Mono` / `Flux`) |
| Best for | one simple call whose answer is needed now | several calls in parallel, optional / best-effort sections, timeouts and fallbacks as operators |
| In this project | validation lookups, per-employee reads | dashboards, settlement, TDS, holiday sync |

Both carry the **caller's JWT and correlation id** downstream, so the downstream service authorises the same user and logs share one id. Service base URLs come from `hr.services.<name>.url` in each `application.yml` (env-overridable; in Docker they point to container names).

## 1. OpenFeign
**What:** an annotated interface; Spring generates the HTTP client. **Why:** least code for blocking calls, with central error / retry / header handling.

**Clients (all in `<service>/.../client/`):**
| Caller → callee | Interface | Purpose |
|---|---|---|
| employee → organization | `OrganizationClient` | validate department, designation, location, job grade on onboarding / transfer |
| leave → employee | `EmployeeClient` | team members of a manager |
| project → employee | `EmployeeClient` | employee name / status when allocating |
| attendance → employee, holiday | `ExternalClients.EmployeeClient`, `ExternalClients.HolidayClient` | team members and holidays for the month |
| timesheet → project | `ProjectClient` | allocation check for a day |
| payroll → employee, attendance, leave | `PayrollClients.*` | employee summary, monthly attendance, unpaid leave days |
| exit → employee | `ExitClients` (nested Feign interface) | employee details for resignation / settlement |
```java
@FeignClient(name = "organization-service", url = "${hr.services.organization.url}")
public interface OrganizationClient {
    record OrgRef(String id, Boolean active) { }
    @GetMapping("/api/v1/organization/departments/{id}") OrgRef department(@PathVariable("id") String id);
}
OrgRef d = organizationClient.department(deptId);      // 404 -> ResourceNotFoundException; inactive → `400 department is inactive`
```
**Global configuration** (`common-library/.../client/FeignGlobalConfig.java`, applied to every client):
| Piece | Behaviour |
|---|---|
| `RequestInterceptor` | adds `Authorization: Bearer <caller token>` (`CurrentUser.token()`) and `X-Correlation-Id` (from MDC) |
| `ErrorDecoder` | downstream 404 → `ResourceNotFoundException`, 400/422 → `BadRequestException`, 409 → `ConflictException`, 401 → `UnauthorizedException`, 403 → `ForbiddenOperationException`, other 4xx → `DownstreamClientException`; 502/503/504 → retryable; else `ServiceUnavailableException`. The downstream `message` is carried over, so the user sees the real reason |
| `Retryer` | `Retryer.Default(200 ms, 1 s, 3 attempts)`; only I/O failures and 502/503/504 are retried, business errors never |
| Timeouts | connect 2 s, read 8 s (`hr-common.yml`), logger level `basic` |

*Expected output:* onboarding with an unknown department id → `404 {"code":"RESOURCE_NOT_FOUND","message":"..."}` produced **by the organization service** and re-raised locally; organization stopped → three attempts, then `503 Downstream service unavailable`.
**Pros:** tiny code, uniform errors. **Cons:** blocking (a thread waits), retries are only safe for idempotent calls - all Feign clients here are `GET`s.

## 2. WebClient
**Where:** `common-library/.../client/HrWebClient.java` (+ `WebClientFactory`), used by `TaxGateway` (payroll → tax), `PayrollGateway` (tax → payroll), `HolidayGateway` (leave → holiday), the Payroll / Leave gateway inside `ExitClients` (exit), `DashboardService` and `DepartmentNames` (reporting).
Built on Reactor Netty with `CONNECT_TIMEOUT_MILLIS` and `responseTimeout`; every call has `.timeout(responseTimeout + 1 s)`.

| Method | WebClient/Reactor feature shown | Behaviour |
|---|---|---|
| `get(uri, Class)` | `retrieve()`, `onStatus`, `bodyToMono`, `retryWhen(Retry.backoff(2, 200 ms))` | retries only transient failures (connect errors, timeouts, 5xx); exhausted → `ServiceUnavailableException` |
| `getOptional` | `exchangeToMono` | inspects the status itself: **404 → `Optional.empty()`**, other errors mapped, 2xx → value |
| `getOrDefault(fallback)` | `onErrorReturn` | best-effort value |
| `getOrEmpty` | `onErrorResume` | log and degrade to empty |
| `post / put / patch / delete` | `bodyValue`, `bodyToMono`, `Mono<Void>` | same error mapping (no retry: not idempotent) |
| `as(token, correlationId)` → `Bound` | explicit header capture | for calls created inside reactive operators |

```java
// payroll: strict - a failed TDS lookup must fail the employee's entry (a silent 0 would under-deduct tax)
Mono<MonthlyTds> tds = client.get("/api/v1/tax/monthly-tds?employeeId={id}&month={m}", MonthlyTds.class, id, month);

// dashboard: optional section - one slow service must not break the page
Mono<Object> section = mono.timeout(SECTION_TIMEOUT).map(v -> (Object) v);   // .toFuture().handle(...) adds the fallback
```
**Settlement (exit service):** payroll and leave data are fetched through WebClient and combined with `Mono.zip` (e.g. the encashable days of every leave type are zipped and summed) using a `Bound` client (token captured on the servlet thread) - this fixed a bug where calls built inside `flatMap` ran on Netty threads with no JWT, received a 401 and were silently swallowed by `onErrorReturn`, dropping the leave-encashment line.
**Dashboards:** `GET /api/v1/dashboard/employee` starts nine calls at once (`toFuture()` subscribes immediately) and returns `assembledInMs`; failed sections become `{"error": "..."}`.

### Header propagation difference
Feign runs on the request thread → `CurrentUser.token()` works. WebClient chains may continue on other threads → either build the call on the request thread (`HrWebClient.get` reads the token when the call is *assembled*) or use `as(token, cid)`.

## 3. Choosing
Use Feign for simple blocking reads and write calls where retry semantics are controlled; use WebClient when you need parallelism, `Optional`/fallback semantics or per-call timeouts. Never make a downstream call while holding a database transaction open longer than necessary (payroll gathers data first, persists afterwards).

## Pros / cons
| | Pros | Cons |
|---|---|---|
| Feign | readable interfaces, global config, error translation | blocking, thread per call |
| WebClient | non-blocking, composable (`zip`, `timeout`, `retryWhen`), fallbacks | Reactor learning curve; thread-local context is not available on its threads |
| Both | JWT + correlation id forwarded; downstream message preserved | synchronous coupling: if the callee is down, the caller degrades (hence events for everything that need not be synchronous) |
