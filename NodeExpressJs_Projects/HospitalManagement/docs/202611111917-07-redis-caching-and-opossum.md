# 7. Redis caching and Opossum

# Part A - Redis caching (node-redis)

Redis 7 (`docker-compose.yml`, port **36379**). One reusable module, `createCache` (`shared/utils/cache.js`): `get`, `set(key, value, ttlSec)`, `del(...keys)`, `getOrSet(key, ttl, loader)` (cache-aside; null results are not cached). Values are JSON, keys `hospital:<service>:<key>`, TTLs come from configuration (`CACHE_PATIENT_SEC`, `CACHE_DOCTOR_SEC`, `CACHE_HOSPITAL_SEC`, `CACHE_SLOTS_SEC`, `CACHE_AVAILABILITY_SEC`, `CACHE_APPOINTMENT_SEC`).

**Redis unavailable = fail-open:** connect timeout 1 s, auto-reconnect with back-off, every operation first checks `client.isReady` and is wrapped in try/catch - on any problem the call is a miss/no-op, a throttled WARN is logged and the request is served from MySQL. (Redis is never required to start a service.)

| Service | Key | TTL | Filled by | Updated / evicted by |
|---|---|---|---|---|
| Doctor | `doctor:{id}` | 15 min | `get` | write-through `set` on update; `del` on deactivate |
| Doctor | `slots:{id}:{version}:{date}` = **doctor availability** | 5 min | `slots` | `slots-version:{id}` is replaced on schedule change / day off add-remove / deactivate: every cached grid of that doctor becomes unreachable at once (O(1), no key scan) |
| Hospital | `hospital:{id}` | 30 min | `getHospital` | write-through on update; `del` on deactivate |
| Hospital | `departments:{hospitalId}` | 30 min | `listDepartments` | `del` on add/update/deactivate |
| Patient | `patient:{id}`, `summary:{id}` | 10 min | `get`, `summary` (gRPC hot path) | both `del` on update/deactivate |
| Appointment | `availability:{doctorId}:{date}` | 60 s | `availability` | `del` **after commit** on book, cancel, reschedule (old and new date), MISSED |
| Appointment | `appointment:{id}` | 5 min | `get` | `del` after commit on every state change and on billing events |

**No double booking from stale cache:** the cached availability is only a *view*. `book`/`reschedule` never read it - they fetch the **live** slot grid, re-check overlaps in MySQL (the Appointment database is the source of truth) and rely on the unique `slotKey`. Evictions happen *after* the transaction commits, and the TTL is 60 s. Verified: 8 simultaneous bookings of one slot → exactly one 201, seven 409.

```bash
docker exec hospital-node-redis redis-cli --scan --pattern 'hospital:*'
docker exec hospital-node-redis redis-cli get hospital:doctor-service:doctor:1
```

# Part B - Opossum circuit breakers

Applied to **both** synchronous channels: every HTTP client (`createHttpClient`) and every gRPC client method (`createGrpcClient`).

| Setting | HTTP client | gRPC client |
|---|---|---|
| `timeout` | request timeout + 1 s (`HTTP_TIMEOUT_MS`, default 4 s) | deadline 3 s + 0.5 s |
| `errorThresholdPercentage` | 50 | 50 |
| `volumeThreshold` (min calls) | 5 | 5 |
| `rollingCountTimeout` | 30 s | 30 s |
| `resetTimeout` (open → half-open) | 15 s | 15 s |
| `errorFilter` (not counted as failures) | any HTTP **4xx** | `NOT_FOUND`, `PERMISSION_DENIED`, `INVALID_ARGUMENT`, `UNAUTHENTICATED` |
| retries | **GET only**, 2×, exponential + jitter | none (calls are fast read-only lookups; breaker + deadline) |

* State changes are logged: `Circuit breaker OPEN / HALF-OPEN / CLOSED` (breaker names `http:doctor-service`, `grpc:patient-service.getSummary`, ...).
* **Fallbacks:** patient and doctor directories (gRPC) return the **last-known** value when the dependency is unavailable (degraded, WARN log) or 503 if never seen; HTTP clients can opt into last-known for GETs. **No fallback (clean 503)** for the slot grid, hospital validation and the prescription status - acting on unverified data (booking against an unknown schedule, dispensing on an unverified prescription, storing an unverified reference) would be unsafe.
* Non-idempotent operations (POST/PUT/...) are **never retried automatically**; event publication is protected separately by the outbox + inbox idempotency, payment initiation by the unique `activeBillId`.

### Verified (live)
| Situation | Result |
|---|---|
| Doctor Service down, 8 availability calls | 1st ~0.57 s (retries), 2nd ~0.56 s, then **3 ms** instant 503 "circuit is open" |
| Patient Service down, known patient | 200 from last-known data (WARN); unseen patient → 503 |
| Services restarted | breaker half-opens after 15 s, calls succeed (200) |
