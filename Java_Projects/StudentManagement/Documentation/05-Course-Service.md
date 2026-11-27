# 05 – Course Service

## 1. Feature Overview
Course and category management, search/filter/paging, availability, atomic seat reservation/release, Redis caching, and `LowCourseAvailability` events to Kafka.

## 2. Purpose
System of record for courses and seats; guarantees seats are never oversold ([19](19-Distributed-Concurrency-Control.md)).

## 3. Files Created
Base `services/course-service/src/main/java/com/example/course/`:

| File Path | Change Type | Description |
|---|---|---|
| …/CourseServiceApplication.java | Created | Application class |
| …/controller/CourseController.java | Created | Course CRUD, availability, seat reserve/release |
| …/controller/CategoryController.java | Created | `/api/courses/categories` CRUD |
| …/service/CourseService.java | Created | CRUD, capacity change, caching (`courses`, `courseAvailability`) |
| …/service/SeatService.java | Created | Idempotent reserve/release |
| …/service/CategoryService.java | Created | Category rules (unique name, cannot delete when used) |
| …/service/LowAvailabilityPublisher.java | Created | `@TransactionalEventListener(AFTER_COMMIT)` → Kafka |
| …/repository/CourseRepository.java | Created | Atomic `reserveSeat`, `releaseSeat`, `changeCapacity` UPDATE queries |
| …/repository/CourseCategoryRepository.java, SeatReservationRepository.java, CourseSpecifications.java | Created | Persistence / filters (text, category, status, fee range, `availableOnly`) |
| …/entity/Course.java, CourseCategory.java, SeatReservation.java, CourseStatus.java, ReservationStatus.java | Created | `total_seats/available_seats` are `updatable=false` in JPA; `@Version` |
| …/dto/CourseRequest.java, CourseResponse.java, CourseAvailabilityResponse.java, CategoryDtos.java, SeatDtos.java, StatusRequest.java | Created | Records |
| …/mapper/CourseMapper.java | Created | Manual mapping |
| …/validation/ValidCourseCode.java, CourseCodeValidator.java | Created | Code format `^[A-Z0-9][A-Z0-9-]{1,19}$` |
| …/config/CacheConfig.java | Created | Two caches: `courses` (10 min), `courseAvailability` (1 min) |
| …/config/CourseCacheEvictor.java | Created | Evicts **after commit** |
| …/config/KafkaConfig.java | Created | Declares topic `course.low-availability` (3 partitions) |
| …/config/SecurityConfig.java | Created | Stateless JWT chain |
| services/course-service/src/main/resources/application.yml, db/migration/V1__create_course_tables.sql | Created | Config + schema |
| services/course-service/src/test/java/com/example/course/service/SeatServiceTest.java, CourseServiceTest.java | Created | Unit tests |
| services/course-service/src/test/java/com/example/course/it/AbstractIT.java, SeatConcurrencyIT.java | Created | Integration tests (MySQL, Redis, Kafka containers) |
| services/course-service/Dockerfile | Created | |

## 4. Files Modified
| File Path | Change Type | Description |
|---|---|---|
| services/course-service/src/main/resources/application.yml | Modified | `server.forward-headers-strategy`; `spring.kafka.template.observation-enabled: true` |

## 5. Implementation Details
* `fees` is `DECIMAL(10,2)`; `duration` is stored as `duration_weeks` (integer, 1–520).
* Changing `totalSeats` runs one atomic UPDATE that keeps the number of reserved seats (`available += newTotal - oldTotal`, refused if it would go negative → 422). MySQL evaluates `SET` left-to-right, so `available_seats` is assigned before `total_seats` (documented in the repository).
* Low availability: after a reservation commits, if `available <= app.course.low-availability-threshold` (default 5) an event is published (failure is logged; it does not roll back the reservation).
* Cache consistency: all writes call `CourseCacheEvictor.evictAfterCommit(id)`, so a concurrent reader cannot re-populate the cache with pre-commit data.

## 6. Architecture Details
Owns CourseDB. Called by Enrollment Service (Feign). Publishes to Kafka; consumed by Notification Service ([11](11-Kafka-Event-Driven-Architecture.md)).

## 7. Dependencies
As Student Service + `spring-kafka`, `event-contracts`; Testcontainers Kafka.

## 8. Configuration Changes
`app.cache.course-ttl`, `app.cache.availability-ttl`, `app.course.low-availability-threshold` (`LOW_AVAILABILITY_THRESHOLD`), Kafka producer (`acks=all`, idempotence, JSON serializer without type headers).

## 9. Database Changes
`sms_course_categories`, `sms_courses`, `sms_seat_reservations` ([03](03-MySQL-Database-Configuration.md)).

## 10. API Changes
| Method & path | Roles |
|---|---|
| `POST/PUT/PATCH(status) /api/courses[/{id}]` | ADMIN, STAFF |
| `DELETE /api/courses/{id}` | ADMIN |
| `GET /api/courses`, `GET /api/courses/{id}`, `GET /api/courses/{id}/availability` | any authenticated user |
| `POST /api/courses/{id}/seats/reserve` `{"enrollmentId":N}` | ADMIN, SERVICE |
| `POST /api/courses/{id}/seats/release` `{"enrollmentId":N}` | ADMIN, SERVICE |
| `GET/POST/PUT/DELETE /api/courses/categories[/{id}]` | read: any; write: ADMIN/STAFF; delete: ADMIN |

Reserve responses: `200 {"courseId":1,"enrollmentId":100,"reservationStatus":"RESERVED","availableSeats":4,"replayed":false}`; sold out / inactive → `409`; re-reserve of a released enrollment → `409`; release is always `200` (idempotent).

## 11. Communication Changes
Produces `course.low-availability` (key = courseId, JSON `LowCourseAvailabilityEvent`). No consumers.

## 12. Execution Instructions
Start via `scripts/start-local.sh`; see README for curl examples.

## 13. Testing
Unit: `SeatServiceTest` (9), `CourseServiceTest` (4). Integration `SeatConcurrencyIT` (7): 50 threads on 10 seats → exactly 10 successes/40 conflicts and 0 seats; concurrent duplicate releases give +5 not +20; same enrollment reserved by 10 threads consumes exactly one seat; CHECK constraint rejects negative seats; availability cache filled and evicted after commit; capacity change keeps reserved seats / refuses to go below them; low-availability events arrive in a real Kafka topic. Live check through the gateway: 15 students racing for 4 seats → exactly 4 confirmed.

## 14. Pending Items
Course deletion with existing reservations fails with 409 (FK) rather than archiving.
