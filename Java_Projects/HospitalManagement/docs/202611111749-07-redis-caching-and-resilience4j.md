# 7. Redis caching and Resilience4j

# Part A - Redis caching (Spring Data Redis + Spring Cache)

Redis 7 runs from `docker/docker-compose.yml` on host port **16379**. Caching is switched on per service with `hospital.cache.enabled=true` (Patient, Doctor, Appointment, Hospital); it is implemented once in `common/.../cache/CacheConfig.java`.

## Configuration
* `RedisCacheManager` with **JSON** values (`GenericJackson2JsonRedisSerializer`, Java-time module, default typing for DTO classes) - entries are readable with `redis-cli GET`.
* Key layout: `hospital:<service>:<cache>:<key>`, e.g. `hospital:doctor-service:doctors:2`.
* **Per-cache TTL** (`hospital.cache.ttl.<cache>` in each service's yml); null values are not cached.
* **Failure isolation:** a `CacheErrorHandler` logs and swallows Redis errors, and Redis timeouts are 1 s - if Redis is down the request is simply served from MySQL.

## What is cached, and how it stays correct
| Service | Cache (TTL) | Key | Filled by | Updated / evicted by |
|---|---|---|---|---|
| Doctor | `doctors` (15 min) | `doctorId` | `@Cacheable DoctorService.get` | `@CachePut` on update; `@CacheEvict(allEntries)` on deactivate |
| Doctor | `doctorSlots` (5 min) = **doctor availability** | `doctorId:date` | `@Cacheable SlotService.slots` | `@CacheEvict(allEntries)` on schedule replace, day-off add/remove, deactivate |
| Hospital | `hospitals` (30 min) | `hospitalId` | `@Cacheable get` | `@CachePut` on update, `@CacheEvict` on deactivate |
| Hospital | `hospitalDepartments` (30 min) | `hospitalId` | `@Cacheable departments` | `@CacheEvict` on add/update/deactivate department |
| Patient | `patients` (10 min) | `patientId` | `@Cacheable get` | `@CachePut` on update, `@CacheEvict` on deactivate |
| Patient | `patientSummaries` (10 min) - hot path used by Feign callers | `patientId` | `@Cacheable summary` | `@CacheEvict` on update/deactivate |
| Appointment | `appointmentAvailability` (60 s) | `doctorId:date` | `@Cacheable availability` | evicted **after commit** for the affected doctor/date on book, cancel, reschedule, missed |
| Appointment | `appointments` (5 min) | `appointmentId` | `@Cacheable loadCached` | evicted after commit on every state change and on billing events |

Design decisions:
* **Create / read / update / evict** are all demonstrated: `@Cacheable` (create-on-read), `@CachePut` (refresh on update), `@CacheEvict` (invalidate on change).
* Appointment evictions run in `CacheEvictor` through a transaction `afterCommit` hook so a reader can never re-cache the pre-commit state.
* Slot grids are cached *without* booked appointments (pure schedule data) - bookings are overlaid by the Appointment Service, so booking a slot never invalidates the doctor's cache, while a schedule change does.
* The cross-service staleness window is bounded by short TTLs (appointment availability 60 s, slots 5 min); booking itself always reads the live grid and re-checks overlaps in the database.

## Looking at it
```bash
docker exec hospital-redis redis-cli --scan --pattern 'hospital:*'
docker exec hospital-redis redis-cli get hospital:doctor-service:doctors:2
docker exec hospital-redis redis-cli ttl  hospital:doctor-service:doctors:2
```
Verified live: after a schedule change the next slot request recomputed the grid; after booking the slot, availability showed it taken immediately (cache evicted); after cancelling it was free again; removing a leave day restored the 7 slots.

# Part B - Resilience4j

## Where it is applied
`@CircuitBreaker` on the gateway classes that wrap **both** client technologies - details and fallbacks in the synchronous-communication document:

| Instance | Technology | Used by |
|---|---|---|
| `patientService` | OpenFeign | Appointment, Records, Prescription, Laboratory, Billing |
| `hospitalService` | OpenFeign | Doctor |
| `prescriptionService` | OpenFeign | Pharmacy |
| `doctorService` | WebClient | Appointment, Prescription, Laboratory |
| `appointmentService` | WebClient | Billing |

## Configuration (`common/src/main/resources/hospital-common.yml`)
```yaml
resilience4j.circuitbreaker.configs.default:
  slidingWindowType: COUNT_BASED
  slidingWindowSize: 10               # evaluate the last 10 calls
  minimumNumberOfCalls: 5             # ...but only after 5 calls
  failureRateThreshold: 50            # open at >= 50% failures
  slowCallDurationThreshold: 4s       # calls slower than 4 s count as slow
  slowCallRateThreshold: 80
  waitDurationInOpenState: 15s        # fail fast for 15 s
  permittedNumberOfCallsInHalfOpenState: 3
  automaticTransitionFromOpenToHalfOpenEnabled: true
  ignoreExceptions: [ResourceNotFoundException, BadRequestException, ConflictException, DownstreamClientException]
```
Business answers (404/409/...) never trip a breaker. Together with the HTTP timeouts (connect 2 s, read/response 5 s) this stops a dead dependency from exhausting threads.

## Behaviour (verified)
| Situation | Result |
|---|---|
| Doctor Service down, 8 availability requests | 1-5: 503 after connection failure; 6-8: instant 503 "circuit is open" (~9 ms) |
| Patient Service down, known patient | 200 from last-known data (degraded, WARN log) |
| Patient Service down, unknown patient | 503 "no previously validated data" |
| Dependency restarted | breaker half-opens after 15 s; next calls succeed (200) |
| `CallNotPermittedException` (breaker open) reaching a controller | `GlobalExceptionHandler` -> 503 JSON |

Where a stale answer is acceptable (patient identity, doctor profile) the fallback degrades gracefully; where acting on stale data would be unsafe (accepting a booking against an unknown schedule, dispensing on an unverified prescription, storing an unverified hospital reference) the fallback **refuses with 503**.
