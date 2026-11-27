# 14 - Redis Caching

## 1. Feature Overview
Cache-aside for student information, course information and course availability, with TTLs, update-on-change and invalidation.

## 2. Purpose
Cut repeated reads (Enrollment's saga calls `GET student/course/availability` on every attempt) while never letting Redis break the API.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| BuildingBlocks/Common/Caching/CacheService.cs | Created | `ICacheService` + `RedisCacheService` (JSON via `IDistributedCache`, errors swallowed and logged) |
| BuildingBlocks/Common/ServiceCollectionExtensions.cs | Created | `AddSmsRedis` (StackExchange Redis cache, key prefix `sms:`, `RedisHealthCheck`) |
| Services/StudentService/Services/StudentAppService.cs, Services/CourseService/Services/CourseAppService.cs, SeatService.cs | Created | Use the cache |

## 4. Files Modified
None.

## 5. Implementation Details
| Key (prefix `sms:`) | TTL | Written | Updated | Evicted |
|---|---|---|---|---|
| `student:{id}` | 10 min | first read | `PUT`, `PATCH status` (value refreshed) | `DELETE` |
| `course:{id}` | 10 min | first read | - | update, status change, delete, every seat change |
| `course-availability:{id}` | 1 min | first read | - | same as above (after commit) |
`GetOrSetAsync` never caches `null`. Connection string options `abortConnect=false, connectTimeout/syncTimeout=1000 ms`: if Redis is down each cache call logs a warning and the database answer is returned. (`IDistributedCache` stores each entry as a Redis **hash**, fields `data/absexp/sldexp`.)

## 6. Architecture Details
Student and Course Services own their caches; Enrollment calls them over HTTP and benefits transparently.

## 7. Dependencies
`Microsoft.Extensions.Caching.StackExchangeRedis 8.0.10` (StackExchange.Redis), Redis 7 (`sms-dn-redis`).

## 8. Configuration Changes
`ConnectionStrings:Redis` (`localhost:6379`; env `ConnectionStrings__Redis`). TTLs are constants in `StudentAppService`/`CourseAppService`.

## 9. Database Changes
None.

## 10. API Changes
None (transparent).

## 11. Communication Changes
Redis protocol.

## 12. Execution Instructions
`docker exec sms-dn-redis redis-cli keys 'sms:*'` after a `GET /api/courses/1/availability` shows `sms:course-availability:1`.

## 13. Testing
Integration (real Redis): load-once then hit, key exists with prefix, TTL expiry, update-on-change and eviction, null not cached, **Redis unreachable -> loader result returned**; API test: student key created on read, refreshed on status change, removed on delete. Unit: cache interaction of `StudentAppService`/`CourseAppService`.

## 14. Pending Items
No cache for search result lists (hard to invalidate; deliberately not cached).
