# Java Collections Guide

Each entry: **what / why / where (file) / HR use / code / expected output / pros-cons**. Paths are under `<service>/src/main/java/com/hrportal/<pkg>/`.

## Overview: which collection where
| Collection | Property | Used in |
|---|---|---|
| `ArrayList` / `List` | ordered, indexed | every DTO list, page content |
| `HashSet` / `LinkedHashSet` / `Set.of` | uniqueness (insertion order for Linked) | role sets (`UserAccount.roles`), `BeanMapper` set conversion, allow-lists (`Set.of("firstName", ...)` in `PageRequests` callers) |
| `HashMap` / `Map.of` | key lookup | lookup maps (`componentById` in payroll, `Map.of` responses) |
| `LinkedHashMap` | insertion-ordered map | stable JSON output (`DirectoryService`, `DashboardService`, `WorkforceAnalytics`) |
| `TreeMap` | sorted keys, navigable | directory grouped A-Z (`DirectoryService`), allocation sweep line (`AllocationCalculator`) |
| `EnumMap` / `EnumSet` | array / bitset speed for enums | status counts, calculator registry (`SalaryCalculationEngine`), visible statuses (`DirectoryService.VISIBLE`), finished states (`ExitWorkflowService.FINISHED`), project status order |
| `PriorityQueue` | order by priority | pending corrections list (`CorrectionService.pending`) |
| `DelayQueue` | items released when due | `CorrectionEscalationQueue` |
| `LinkedBlockingQueue` (bounded) | producer / consumer | `PunchImportQueue` |
| `ArrayBlockingQueue` (bounded) | producer / consumer with fixed array | `EmailDispatchQueue` |
| `ConcurrentHashMap` | thread-safe map | `BeanMapper.FIELD_CACHE` |
| `Collections.unmodifiableList`, `List.copyOf`, `toList()` | immutability | returned directory lists |

## 1. TreeMap + EnumMap + EnumSet + LinkedHashMap + unmodifiable list (directory)
**Where:** `employee-service/.../service/DirectoryService.java` (`GET /api/v1/employees/directory/grouped`).
```java
private static final Set<EmployeeStatus> VISIBLE = EnumSet.of(ACTIVE, ON_NOTICE);
Map<String, List<DirectoryEntry>> byInitial = new TreeMap<>();            // keeps A..Z order
byInitial.replaceAll((k, v) -> Collections.unmodifiableList(v));
Map<EmployeeStatus, Long> counts = new EnumMap<>(EmployeeStatus.class);   // array-backed, enum order
```
**Real output** (one visible employee, one resigned):
```json
{ "total": 1,
  "byInitial": { "P": [ { "employeeCode": "EMP00001", "fullName": "Priya Sharma", "status": "ACTIVE", ... } ] },
  "byStatus": { "ACTIVE": 1, "INACTIVE": 0, "ON_NOTICE": 0, "RESIGNED": 1, "TERMINATED": 0 } }
```
**Why each:** `TreeMap` gives sorted keys without a sort step; `EnumSet`/`EnumMap` are the fastest and clearest structures for enum keys and print in declaration order; `unmodifiableList` stops callers (or the cache) mutating shared data. **Cons:** `TreeMap` is O(log n) and needs comparable keys; unmodifiable wrappers are views, not copies.

## 2. TreeMap sweep line (project allocation)
**Where:** `project-service/.../service/AllocationCalculator.java`. An employee must never exceed 100 % allocation at any moment. Each allocation adds `+%` on its start date and `-%` the day after its end; walking the sorted map with a running sum gives the peak load.
```java
TreeMap<LocalDate, BigDecimal> deltas = new TreeMap<>();
deltas.merge(start, percent, BigDecimal::add);  deltas.merge(end.plusDays(1), percent.negate(), BigDecimal::add);
BigDecimal running = ZERO, peak = ZERO;
for (var e : deltas.entrySet()) { running = running.add(e.getValue()); if (running.compareTo(peak) > 0) peak = running; }
```
**Output:** existing 60 % (1 Jan-31 Mar) + new 50 % (1 Mar-30 Apr): deltas `Mar 1: +50`, so peak = **110** → the API answers `400 Allocation would put the employee at 110% of their time (maximum 100%)`. New 40 % instead → peak 100 → accepted. **Pros:** O(n log n), no day-by-day loop. **Cons:** correctness depends on the +1 day boundary convention.

## 3. EnumMap as a strategy registry (payroll)
**Where:** `payroll-service/.../engine/SalaryCalculationEngine.java`: `Map<CalcType, ComponentCalculator> calculators = new EnumMap<>(CalcType.class)` - one calculator per calculation type (FIXED, PERCENT_OF_CTC, PERCENT_OF_BASIC, BALANCE, STATUTORY_PF, SLAB_PT, TAX_TDS, VARIABLE). A new type = a new enum value + calculator, no `if/else` chain.

## 4. PriorityQueue (attendance corrections)
**Where:** `attendance-service/.../service/CorrectionService.java#pending`.
```java
PriorityQueue<AttendanceCorrection> pq = new PriorityQueue<>(
    Comparator.comparing(AttendanceCorrection::isEscalated).reversed().thenComparing(AttendanceCorrection::getCreatedAt));
pq.addAll(source);  while (!pq.isEmpty()) out.add(toResponse(pq.poll()));
```
**Output:** `GET /api/v1/attendance/corrections/pending` lists escalated requests first, then oldest first (e.g. `[#3 escalated 6 days old, #1 3 days old, #2 1 day old]`). **Note:** iterating a `PriorityQueue` is *not* ordered - always `poll()`.

## 5. DelayQueue (escalate unreviewed corrections)
**Where:** `attendance-service/.../queue/CorrectionEscalationQueue.java`.
```java
record Task(String correctionId, Instant dueAt) implements Delayed { getDelay(unit) ...; compareTo(...) ... }
DelayQueue<Task> queue = new DelayQueue<>();
queue.add(new Task(id, now.plus(48h)));            // schedule
Task due = queue.poll(2, SECONDS);                  // returns only items whose delay has expired
```
One daemon worker thread escalates (flag + remind the manager) requests still PENDING after `hr.attendance.escalation-hours` (48). Pending requests are re-registered at start-up because the queue is in memory. **Pros:** no polling of the DB; **cons:** memory-only (hence the re-registration).

## 6. LinkedBlockingQueue (bulk punch import - producer/consumer)
**Where:** `attendance-service/.../queue/PunchImportQueue.java`; endpoint `POST /api/v1/attendance/punches/import`.
The HTTP thread (producer) validates and `offer`s punches, sorted by time, to a queue bounded at `hr.attendance.punch-queue-capacity` (5000); one worker (consumer) applies them. If `remainingCapacity() < batch size` the caller gets **400 "Import queue is full, retry with a smaller batch"** - back-pressure instead of an `OutOfMemoryError`. First punch of the day = check-in, later = check-out.

## 7. ArrayBlockingQueue (outgoing e-mail)
**Where:** `notification-service/.../queue/EmailDispatchQueue.java`. Kafka listener threads `offer(job)` (non-blocking); 2 worker threads `poll(1s)` and send. Queue full → `offer` returns false and the notification stays PENDING for the retry job. A slow SMTP server therefore never stalls Kafka consumption.

## 8. ConcurrentHashMap / LinkedHashSet (mapper)
`common-library/.../persistence/BeanMapper.java`: `FIELD_CACHE = new ConcurrentHashMap<>()` caches reflected fields per class (computed once, read by all threads); `LinkedHashSet` keeps order when mapping a collection to a `Set`.

## 9. Immutable factories
`Set.of(...)` / `Map.of(...)` for constants and small responses (null-hostile and immutable - a `null` key or value throws immediately); `Stream.toList()` for read-only results.

## Pros / cons summary
| Choice | Pros | Cons |
|---|---|---|
| Specialised collections (`EnumMap`, `TreeMap`, queues) | express intent, faster, fewer bugs | must know their contracts (ordering, thread-safety, null policy) |
| Bounded blocking queues | back-pressure, memory safety | producers must handle rejection |
| In-memory queues (`DelayQueue`) | simple, no extra infra | lost on restart unless rebuilt (done at start-up) |
| Immutable collections | thread-safe, cache-safe | cannot be modified - copy first |
