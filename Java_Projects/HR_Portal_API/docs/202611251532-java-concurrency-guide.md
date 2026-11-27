# Java Concurrency Guide

A request thread doing four slow HTTP calls one after another is slow; unbounded threads are dangerous. The project therefore uses **one bounded executor per service**, `CompletableFuture` composition, blocking queues for producer/consumer work, and Redis locks across instances. Paths are under `<service>/src/main/java/com/hrportal/...`.

## 1. The shared executor (`hrExecutor`)
**Where:** `common-library/.../async/AsyncConfig.java`.
```java
@Bean(name = "hrExecutor")
ThreadPoolTaskExecutor hrExecutor(TaskDecorator decorator) {
    ex.setCorePoolSize(Math.max(4, cpus * 2));  ex.setMaxPoolSize(Math.max(8, cpus * 4));  ex.setQueueCapacity(200);
    ex.setThreadNamePrefix("hr-async-");        ex.setTaskDecorator(decorator);
    ex.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());   // back-pressure
    ex.setWaitForTasksToCompleteOnShutdown(true); ex.setAwaitTerminationSeconds(15);
}
```
* **Why bounded:** the work is I/O-bound so 2×CPU core threads; queue 200 absorbs bursts; when pool *and* queue are full the **caller runs the task** - load slows the caller instead of exhausting memory.
* **TaskDecorator:** copies the logging MDC (correlation id) and Spring `SecurityContext` (the caller's JWT) to the worker thread and restores the worker's previous state afterwards. Without it, Feign calls on worker threads would reach other services unauthenticated and logs would lose the correlation id.
* **Pros:** predictable resource use, context-safe. **Cons:** a blocked pool delays all async work of that service - keep tasks short and timeouts on.

## 2. CompletableFuture: parallel data gathering (payroll)
**Where:** `payroll-service/.../service/PayrollInputGatherer.java`, used by `PayrollRunService`.
```java
CompletableFuture<EmployeeInfo>    emp    = supplyAsync(() -> employees.summary(id), executor);          // Feign
CompletableFuture<AttendanceMonth> att    = supplyAsync(() -> attendance.monthly(id, month), executor);  // Feign
CompletableFuture<UnpaidDays>      unpaid = supplyAsync(() -> leave.unpaidDays(id, month), executor);    // Feign
CompletableFuture<MonthlyTds>      tds    = tax.monthlyTds(id, month).toFuture();                        // WebClient Mono -> future
return CompletableFuture.allOf(emp, att, unpaid, tds).orTimeout(30, SECONDS)
        .thenApply(v -> new Input(..., emp.join(), att.join(), unpaid.join().unpaidDays(), ..., tds.join().tds(), ...));
```
`PayrollRunService` starts one gatherer per employee (`Map<String, CompletableFuture<Input>>`), waits with `allOf(...).handle((v, ex) -> null).join()` (never throws), then inspects every future individually and collects **all** failures. If any employee failed, the run is rejected with a `ValidationException` listing every failing employee and **nothing is stored** (payroll is all-or-nothing); otherwise everything is persisted in one transaction.
**HR use / output:** a run for 2 employees makes 8 downstream calls concurrently; latency ≈ the slowest call, not the sum. A failure answers e.g. `400 Payroll could not be processed for 1 employee(s) - nothing was stored` with `fieldErrors` = `{employeeId: reason}`.
**API shown:** `supplyAsync`, `allOf`, `thenApply`, `orTimeout`, `join`, `Mono.toFuture`.

## 3. CompletableFuture with fallbacks (executive summary)
**Where:** `reporting-service/.../service/AsyncReportService.java` (`GET /api/v1/reports/executive-summary`).
```java
private CompletableFuture<Object> section(String name, Supplier<Object> work) {
    return CompletableFuture.supplyAsync(work, executor).orTimeout(15, SECONDS)
        .handle((value, ex) -> ex == null ? value : Map.of("error", "section '" + name + "' unavailable: ..."));
}
CompletableFuture<Object> attrition = joiningExit.thenCombine(headcount, (je, hc) -> /* leavers / active * 100 */);
CompletableFuture.allOf(headcount, joiningExit, leave, attendance, timesheets, exits, attrition).join();
```
**Real output:** `sections` = headcount, joiningAndExit, leave, attendance, timesheets, exits, attrition → `attrition: {"attritionPercent":0.0,"activeHeadcount":1,"leaversThisYear":0}`, `elapsedMs: 253`.
A slow or failing section degrades to `{"error": "..."}` and the rest of the report still returns. **API shown:** `handle`, `thenCombine`, `allOf`, `orTimeout`.

## 4. Parallel team report
`attendance-service/.../service/MonthlyAttendanceService.java#teamReport`: one `supplyAsync` per direct report calling `AttendanceJdbc.monthlySummary` (the stored procedure) on `hrExecutor`, `allOf(...).join()`, then `futures.stream().map(CompletableFuture::join).toList()` (order preserved). `GET /api/v1/attendance/team/report`.

## 5. Reactive calls bridged to futures (dashboards)
`reporting-service/.../service/DashboardService.java`: nine downstream WebClient calls are started immediately with `mono.timeout(SECTION_TIMEOUT).toFuture()` (subscribing starts the request, so they run concurrently), each `.handle`d into a value or an error note, then joined with `allOf(...).orTimeout(...)`. The JWT and correlation id are captured **once on the servlet thread** and attached to every request (`HrWebClient.as(token, correlationId)`), because Reactor threads have no `SecurityContext`.
**Real output** (`GET /api/v1/dashboard/employee`): keys `employeeId, profile, leaveBalance, upcomingHolidays, attendanceSummary, recentTimesheets, latestPayslip, pendingApprovals, performanceReviewStatus, upcomingCompanyEvents, assembledInMs`.

## 6. Producer / consumer with blocking queues
`PunchImportQueue` (LinkedBlockingQueue, 5000), `EmailDispatchQueue` (ArrayBlockingQueue, 500, 2 workers), `CorrectionEscalationQueue` (DelayQueue) - see `java-collections-guide` §5-7. Pattern: HTTP / Kafka thread `offer`s (never blocks), daemon workers `poll(timeout)` in a loop that checks a `volatile boolean running`; `@PreDestroy` flips the flag and `shutdownNow()`s the pool.

## 7. Locks and atomic coordination
| Need | Tool | Where |
|---|---|---|
| Same row, one writer at a time | DB pessimistic lock `FOR UPDATE` | employee code counter, leave balance |
| Lost-update detection | optimistic `@Version` | 14 entities |
| One execution across N instances | Redis lock `hr:lock:<name>` (`SET NX PX` + Lua unlock) | `leave-apply:<employeeId>`, `leave-accrual`, `tax-reminders`, other scheduled jobs (`DistributedLockService.withLock`) |
| Idempotent event handling | unique key `(event_id, consumer)` | `IdempotentEventProcessor` |
| Shared state in one JVM | `ConcurrentHashMap` (`BeanMapper.FIELD_CACHE`), `volatile` (`CryptoKeyHolder.key`, `EventMetadata.SERVICE_NAME`) | |
| Transaction boundary around async/JDBC mix | `TransactionTemplate` | payroll run, settlement |
A Spring `@Transactional` context does **not** follow work into another thread - async tasks that touch the DB open their own transaction.

## 8. Scheduled jobs
`@Scheduled` (UTC cron): leave accrual monthly (`LeaveScheduler`), attendance missing-punch daily (`AttendanceScheduler`), document expiry daily (`ExpiryScheduler`), review reminders daily (`ReviewReminderScheduler`), tax reminders weekly (`TaxScheduler`), outbox relay every 10 s. Each cluster-wide job takes a Redis lock first so two instances never run it together.

## 9. Pitfalls handled
* Blocking calls inside `flatMap` of a reactive chain run on Netty threads with **no JWT** - this produced a silent 401 swallowed by `onErrorReturn` during development; fixed with `HrWebClient.Bound` (token captured up front).
* `parallelStream` is never used for I/O (shared common pool).
* Every future has a timeout (`orTimeout`) and a fallback (`handle`) so a hung dependency cannot hang a request.

## Pros / cons
| Pros | Cons |
|---|---|
| Latency of the slowest call, not the sum; graceful degradation | More complex error handling and testing |
| Bounded pools + caller-runs = no thread explosion | Context (MDC, security) must be propagated explicitly |
| Blocking queues give back-pressure | In-memory queues are lost on restart unless rebuilt |
