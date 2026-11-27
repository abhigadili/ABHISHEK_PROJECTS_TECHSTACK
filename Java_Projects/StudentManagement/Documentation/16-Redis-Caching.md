# 16 – Redis Caching

## 1. Feature Overview
Spring Cache abstraction on Redis 7 for **student information** (Student Service) and **course information** and **course availability** (Course Service), with TTLs, explicit invalidation and update-on-change.

## 2. Purpose
Offload the hot read path (every enrollment validates a student and a course) from MySQL without ever serving stale seat counts after a change.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| services/student-service/src/main/java/com/example/student/config/CacheConfig.java | Created | `RedisCacheManager`, cache `students` |
| services/course-service/src/main/java/com/example/course/config/CacheConfig.java | Created | Caches `courses`, `courseAvailability` |
| services/course-service/src/main/java/com/example/course/config/CourseCacheEvictor.java | Created | After-commit eviction |
| docker-compose.yml | Created | `redis` service (AOF on, volume `redis-data`, `redis-cli ping` health check) |

## 4. Files Modified
None.

## 5. Implementation Details
| Cache | Key | TTL | Fill | Update / invalidate |
|---|---|---|---|---|
| `sms:students` | student id | 10 min (`app.cache.student-ttl`) | `getById` `@Cacheable` | `update`, `updateStatus` `@CachePut`; `delete` `@CacheEvict` |
| `sms:courses` | course id | 10 min | `getById` `@Cacheable` | evicted after commit on update/status/delete/seat change |
| `sms:courseAvailability` | course id | 1 min | `availability` `@Cacheable` | evicted after commit on every reserve/release/capacity change |

Values are JSON of the response records (`Jackson2JsonRedisSerializer` with `JavaTimeModule`); keys are strings; null values are not cached. **Redis outage is tolerated**: `CacheErrorHandler` logs and falls through to MySQL. Seat reservation itself never reads the cache (it uses the atomic UPDATE).

## 6. Architecture Details
Enrollment Service benefits transparently: its Feign calls hit the cached endpoints of Student/Course Service.

## 7. Dependencies
`spring-boot-starter-data-redis` (Lettuce), `spring-boot-starter-cache`.

## 8. Configuration Changes
`spring.data.redis.host|port` (`REDIS_HOST`, `REDIS_PORT`), `spring.data.redis.timeout: 1s`, `spring.cache.type: redis`, `app.cache.*`.

## 9. Database Changes
None.

## 10. API Changes
None (transparent).

## 11. Communication Changes
Redis protocol (6379).

## 12. Execution Instructions
```bash
docker compose up -d redis
docker exec sms-redis redis-cli --scan --pattern 'sms:*'      # sms:students::1, sms:courses::2 …
docker exec sms-redis redis-cli ttl sms:students::1
```

## 13. Testing
`StudentApiIT.crudLifecycleWithRedisCacheAndEviction` (fill, TTL > 0, update visible, evict on delete – real Redis); `SeatConcurrencyIT.availabilityIsCachedAndEvictedAfterSeatChange`. Live: `sms:students::1` and `sms:courseAvailability::1` keys observed after reads.

## 14. Pending Items
Single Redis node, no authentication/TLS; Redis health indicator is part of readiness (a Redis outage makes the pod *not ready* even though the API would still work – adjust the readiness group if undesired).
