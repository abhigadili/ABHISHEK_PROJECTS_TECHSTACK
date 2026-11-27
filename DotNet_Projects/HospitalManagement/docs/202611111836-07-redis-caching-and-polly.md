# 7. Redis caching and Polly

# Part A - Redis caching

Redis 7 runs from `docker-compose.yml` on host port **26379**. The integration is `Microsoft.Extensions.Caching.StackExchangeRedis` (`IDistributedCache`) behind the small `ICacheService` (`Shared/Cache/CacheService.cs`): `GetOrCreateAsync` (create/retrieve), `SetAsync` (update), `RemoveAsync`/`RemoveManyAsync` (evict). It is enabled per service with `AddHospitalCache` (Patient, Doctor, Appointment, Hospital).

## Behaviour
* **JSON** values (System.Text.Json, enum strings, flexible `TimeOnly`), readable with `redis-cli GET`; keys `hospital:<service>:<key>`.
* **Configurable expiration** (`Cache:*` in `appsettings.json`): patient 10 min, doctor 15 min, hospital 30 min, slot grid 5 min, appointment 5 min, availability 60 s.
* **Failure isolation:** Redis connect/sync timeouts are 1 s and every cache call is wrapped - a Redis outage is logged (`Cache GET failed ...`) and the request simply uses MySQL.

## What is cached and how it stays correct
| Service | Key | TTL | Filled by | Updated / evicted by |
|---|---|---|---|---|
| Doctor | `doctor:{id}` | 15 min | `GetAsync` | write-through `SetAsync` on update; `RemoveAsync` on deactivate |
| Doctor | `doctor-slots:{id}:{version}:{date}` = **doctor availability** | 5 min | `SlotsAsync` | the per-doctor key `doctor-slots-version:{id}` is replaced on schedule change, day off add/remove and deactivation - every cached grid of that doctor becomes unreachable at once (O(1) invalidation, no key scanning) |
| Hospital | `hospital:{id}` | 30 min | `GetAsync` | write-through on update; evicted on deactivate |
| Hospital | `hospital-departments:{id}` | 30 min | `DepartmentsAsync` | evicted on add/update/deactivate department |
| Patient | `patient:{id}`, `patient-summary:{id}` | 10 min | `GetAuthorizedAsync`, `SummaryAsync` (the summary is the gRPC hot path) | both evicted on update/deactivate |
| Appointment | `availability:{doctorId}:{date}` | 60 s | `AvailabilityAsync` | evicted **after the DB commit** on book, cancel, reschedule (old and new date) and when an appointment is marked MISSED |
| Appointment | `appointment:{id}` | 5 min | `GetAsync` | evicted after commit on every state change and on billing events |

## Avoiding stale availability / double booking
* The cached availability is only a **view**. `BookAsync`/`RescheduleAsync` never read it: they re-read the live slot grid from the Doctor Service, re-check overlaps against MySQL and rely on the unique `SlotKey` - so even a stale cache entry cannot cause a double booking (proved by firing 8 simultaneous bookings of one slot: one 201, seven 409).
* Invalidation happens **after** `SaveChanges` (a reader can never re-cache the pre-commit state) and the TTL is only 60 s.

## Looking at it
```bash
docker exec hospital-dn-redis redis-cli --scan --pattern 'hospital:*'
docker exec hospital-dn-redis redis-cli get hospital:doctor-service:doctor:2
```
Verified live: slot grids re-computed after schedule changes, a leave day emptied the grid and removing it restored all 7 slots, booked/cancelled slots flipped in the availability view immediately.

# Part B - Polly resilience

Polly v8 is used through `Microsoft.Extensions.Http.Resilience` (HttpClient) and `Microsoft.Extensions.Resilience` (`AddResiliencePipeline`, used for gRPC).

## HttpClient pipeline (`AddHospitalHttpClient<TClient, TImpl>` in `Shared/Http/DownstreamHttp.cs`)
| Strategy | Configuration |
|---|---|
| Total timeout | 12 s |
| **Retry** | 2 retries, exponential back-off 200 ms + jitter, **only for GET/HEAD/OPTIONS** (`ShouldHandle` inspects the request method) on transient failures (5xx, 408, timeouts, connection errors). POST/PUT/PATCH/DELETE are never retried automatically |
| **Circuit breaker** | failure ratio 0.5, minimum throughput 5, sampling 30 s, break 15 s |
| Per-attempt timeout | 5 s |

Used by: Doctor->Hospital, Appointment/Prescription/Laboratory->Doctor, Billing->Appointment.

## gRPC pipeline (`GrpcResilience`, name `"grpc"`)
Retry 2x (150 ms exponential + jitter) on `Unavailable/DeadlineExceeded/Internal/Unknown` -> circuit breaker (same thresholds) -> 8 s overall timeout, plus a **3 s deadline per call**. All gRPC calls are read-only lookups, therefore safe to retry. `NotFound`/`PermissionDenied` are business answers and do not count as failures.
Used by: Patient lookups (5 services), Pharmacy->Prescription.

## Fallbacks (where meaningful)
| Call | Fallback |
|---|---|
| Patient lookup (gRPC) | last-known summary (degraded, WARN log) or 503 if never seen |
| Doctor profile (HttpClient) | last-known copy or 503 |
| Doctor slot grid, hospital validation, prescription verification, appointment verification | **none - clean 503** (acting on unverified data would be unsafe) |

## Non-idempotent operations
No write is ever auto-retried. Event publication is protected differently: the outbox relay retries at-least-once and consumers de-duplicate through the inbox. Payment initiation is a POST (no retry) and a unique `ActiveBillId` prevents two in-flight payments.

## Verified behaviour
| Situation | Result |
|---|---|
| Doctor Service down, 8 availability requests | 1st: ~0.4 s after retries, then 503 "circuit is open" in ~4 ms |
| Patient Service down, known patient | 200 from last-known data (WARN log); unknown patient -> 503 |
| Services restarted | breaker half-opens after 15 s, calls succeed again |
| Circuit open reaching a controller | `ExceptionHandlingMiddleware` -> 503 JSON |
