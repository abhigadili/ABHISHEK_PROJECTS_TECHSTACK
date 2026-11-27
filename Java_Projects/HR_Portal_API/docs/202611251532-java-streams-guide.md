# Java Streams Guide

**What:** a `Stream<T>` is a lazy pipeline over a data source: *source → intermediate operations → one terminal operation*. **Why:** declarative filtering / grouping / aggregation replaces nested loops and mutable accumulators, reads like the business rule, and parallelises with one word.
**Where:** the complete API tour is `reporting-service/src/main/java/com/hrportal/reporting/analytics/WorkforceAnalytics.java`, served by `GET /api/v1/reports/analytics/workforce` (HR_ADMIN / SUPER_ADMIN, through the gateway). Streams are also used throughout the services (mapping entities to DTOs, building maps, summing lines): e.g. `PayrollRunService`, `LeaveCalendarService`, `EmployeeService`.
**Expected output below is real:** captured from the running system with two test employees (Priya Sharma, active; Rahul Verma, resigned), one leave request and one payroll run. Ids shortened where noted.

```bash
curl -s localhost:9080/api/v1/reports/analytics/workforce -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## 1. Creating streams
```java
all.stream().count();                                              // Collection.stream()
Stream.of("EMPLOYEES","LEAVE","PAYROLL").collect(Collectors.joining("+"));
Stream.empty().count();
Stream.concat(leave.stream(), timesheets.stream()).count();
Stream.iterate(YearMonth.now(), m -> m.minusMonths(1)).limit(6).map(YearMonth::toString).toList();  // infinite, cut by limit
Stream.generate(() -> "n/a").limit(2).toList();
```
```json
"sources": { "fromCollection": 2, "ofValues": "EMPLOYEES+LEAVE+PAYROLL", "emptyStream": 0, "concatenated": 2,
             "last6Months": ["2026-11","2026-10","2026-09","2026-08","2026-07","2026-06"], "generatedPlaceholders": ["n/a","n/a"] }
```
*HR use:* `last6Months` produces the month keys for payroll-trend reports. `iterate` / `generate` are infinite - always bounded by `limit`.

## 2. Intermediate operations (lazy, return a stream)
| Operation | Code | Output |
|---|---|---|
| `filter` + `map` + `distinct` + `sorted` | `active.stream().map(RptEmployee::getFullName).filter(nonNull).distinct().sorted(CASE_INSENSITIVE_ORDER)` | `activeNamesSorted: ["Priya Sharma"]` |
| `sorted(Comparator)` + `limit` | `sorted(comparing(joiningDate)).limit(3)` | `longestServing3: ["Priya Sharma","Rahul Verma"]` |
| `skip` | `byJoining.stream().skip(1).count()` | `allButFirst: 1` |
| `takeWhile` | leading elements while `joiningDate < cutoff` | `joinedBeforeLastYear_takeWhile: 2` |
| `dropWhile` | drop that leading run, keep the rest | `joinedWithinLastYear_dropWhile: 0` |
| `flatMap` | `flatMap(e -> Stream.of(e.getManagerId(), e.getDepartmentId()))` | `departmentsOfManagers_flatMap: 2` |
| `peek` | logging only (`log.trace`) - never for business logic | - |

`takeWhile` / `dropWhile` need **ordered** data (here sorted by joining date); they stop at the first non-matching element, unlike `filter`.

## 3. Terminal operations (trigger the work)
```json
"terminal": { "count": 2, "earliestJoiner_min": "Priya Sharma", "latestJoiner_max": "Rahul Verma",
  "firstWithoutManager_findFirst": "Priya Sharma", "anyWithoutManager_findAny": true,
  "anyOnNotice_anyMatch": false, "allHaveCode_allMatch": true, "noneTerminated_noneMatch": true,
  "totalNetPayroll_reduce": 23061.88, "employeeCodes_toArray": ["EMP00001","EMP00002"],
  "firstThreeCodes_forEach": ["EMP00001","EMP00002"] }
```
| Operation | Meaning | Note |
|---|---|---|
| `count`, `min`, `max` | with a `Comparator`, return `Optional` for min / max | `orElse(null)` at the edge |
| `findFirst` / `findAny` | first / any match; `findAny` is cheaper in parallel | short-circuit |
| `anyMatch`, `allMatch`, `noneMatch` | boolean questions - "is anyone on notice?" | short-circuit |
| `reduce(BigDecimal.ZERO, BigDecimal::add)` | total net payroll = **23061.88** (the only payslip with net pay) | use `BigDecimal` for money, never `double` |
| `toArray(String[]::new)` | typed array | |
| `forEach` | side effect; here fills a list (prefer `collect`) | |

## 4. Primitive streams
```java
all.stream().mapToInt(e -> (int) MONTHS.between(e.getJoiningDate(), LocalDate.now())).summaryStatistics();
payroll.stream().mapToDouble(f -> f.getNumC().doubleValue()).summaryStatistics();
IntStream.rangeClosed(1, 12).filter(m -> m % 3 == 0).boxed().toList();
LongStream.rangeClosed(1, 5).map(n -> n * n).sum();
DoubleStream.of(4.0, 4.5, 5.0).average().orElse(0);
```
```json
"primitive": { "tenureMonths_IntSummary": {"min":17,"max":22,"avg":19.5,"count":2},
  "netPay_DoubleSummary": {"min":0.0,"max":23061.88,"avg":11530.94,"sum":23061.88},
  "leaveMinutes_LongStream": 960, "quarterEndMonths_IntStream": [3,6,9,12],
  "cumulative_LongStream": 55, "average_DoubleStream": 4.5 }
```
Primitive streams avoid boxing and give `sum / average / summaryStatistics`. `leaveMinutes` = 2 leave days × 8 h × 60. Sum of squares 1..5 = 55. Statistics objects are a one-pass min/max/avg/count.

## 5. Collectors
| Collector | Question answered | Real output |
|---|---|---|
| `groupingBy(dept, TreeMap::new, counting())` | headcount per department | `{"881f0ced-...": 2}` |
| `groupingBy(..., mapping(designation, toSet()))` | distinct designations per department | `{"881f0ced-...": 2}` |
| `partitioningBy(isActive, counting())` | active vs not | `{"false":1,"true":1}` |
| `groupingBy(location, filtering(active, counting()))` | active people per location | `{"c7079255-...": 1}` |
| `groupingBy(dept, flatMapping(...))` | managers and reports per department | `{"881f0ced-...": 1}` |
| `toMap(code, name, mergeFn)` | code → name lookup (merge function avoids duplicate-key exceptions) | `{"EMP00001":"Priya Sharma","EMP00002":"Rahul Verma"}` |
| `joining(", ", "[", "]")` | printable list | `"[EMP00001, EMP00002]"` |
| `collectingAndThen(toSet(), ...)` | post-process the result | `2` distinct statuses |
| `teeing(averagingDouble, maxBy, merge)` | two aggregates in one pass | `{"average":11530.94,"highestNet":23061.88}` |
| `groupingBy(status, counting())` (leave) | leave requests per status | `{"APPLIED":1}` |
| `summingDouble` / `averagingDouble` / `summarizingDouble` | leave days per type, average, stats | `{"Casual Leave":2.0}`, `2.0`, `DoubleSummaryStatistics{count=1, sum=2.000000, ...}` |
| `reducing` | hours per employee | `{"bf7f7bd2-...": 15.5}` |
| `maxBy` / `minBy` per department | highest / lowest net pay | `23061.88` / `0.0` |
| `summingInt` / `averagingInt` / `summarizingInt` | months of service | `39`, `19.5`, `IntSummaryStatistics{count=2, sum=39, min=17, average=19.500000, max=22}` |
| `summingLong` / `averagingLong` / `summarizingLong` | length of codes | `16`, `8.0`, `LongSummaryStatistics{count=2, sum=16, ...}` |

`TreeMap::new` as the map factory gives sorted, deterministic JSON. Downstream collectors (second argument of `groupingBy`) are what make streams compose.

## 6. Parallel streams
```java
ConcurrentMap<String, Long> m = all.parallelStream().collect(Collectors.groupingByConcurrent(e -> status(e), counting()));
```
```json
"parallel": { "statusCounts_parallelStream_groupingByConcurrent": {"ACTIVE":1,"RESIGNED":1}, "sequentialEqualsParallel": true }
```
Used only for CPU-bound, side-effect-free work with a concurrent collector. **Do not** use parallel streams for blocking I/O (they share the common ForkJoinPool) - the project uses `hrExecutor` + `CompletableFuture` for I/O (`java-concurrency-guide`).

## 7. Laziness and short-circuiting
```java
int[] visited = {0};
all.stream().peek(e -> visited[0]++).filter(e -> e.getJoiningDate() != null).findFirst();
```
```json
"laziness": { "elementsVisitedBeforeFindFirstStopped": 1, "totalElements": 2, "found": true }
```
Nothing runs until the terminal operation, and `findFirst` stops after the first match - only 1 of 2 elements was touched.

## 8. Other streams in the code base
| Where | What |
|---|---|
| `payroll-service/.../PayrollRunService` (lines 154-165, 304) | `toMap` of salary components, `groupingBy(employeeId)` of pending adjustments and active loans, lines grouped per entry |
| `leave-service/.../LeaveCalendarService` | `map(...).collect(toSet())` of team / department member ids |
| `employee-service/.../EmployeeService` | DTO mapping of pages and lists |
| `reporting-service/.../DashboardService` | combines section results |

## Pros / cons
| Pros | Cons |
|---|---|
| Concise, declarative, composable; one-pass statistics | Hard to debug long pipelines (`peek` helps); stack traces are deep |
| Lazy + short-circuit saves work; easy parallelism | Not reusable (a stream can be consumed once); misuse of `forEach` / shared state causes bugs |
| Collectors express group-by/aggregate like SQL | Overkill for tiny loops; parallel streams need care |
