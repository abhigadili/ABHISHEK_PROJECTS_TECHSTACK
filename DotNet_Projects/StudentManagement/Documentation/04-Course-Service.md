# 04 - Course Service

## 1. Feature Overview
Courses, categories, fees, duration, **seat capacity/availability**, search/filter, and atomic **reserve/release** seat operations. Port 8082, database **CourseDB**.

## 2. Purpose
Own course data and the single source of truth for seats so that concurrent enrolments never oversell (`17-Concurrency-Control.md`).

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| Services/CourseService/Program.cs | Created | DbContext, JWT, Redis, RabbitMQ publisher, health, migrate-on-start |
| Services/CourseService/Entities/Entities.cs | Created | `Course`, `CourseCategory`, `SeatReservation`, enums |
| Services/CourseService/Data/CourseDbContext.cs, Configurations/EntityConfigurations.cs, DesignTimeFactory.cs | Created | Mapping, CHECK constraint, indexes |
| Services/CourseService/Repositories/CourseRepository.cs | Created | Search + atomic seat statements (`TryReserveSeatAsync`, `TryReleaseSeatAsync`, `ChangeCapacityAsync`) |
| Services/CourseService/Services/CourseAppService.cs | Created | CRUD, cached reads, cache eviction |
| Services/CourseService/Services/CategoryAppService.cs | Created | Category CRUD |
| Services/CourseService/Services/SeatService.cs | Created | Idempotent reserve/release, low-availability event |
| Services/CourseService/Controllers/CoursesController.cs, CategoriesController.cs | Created | Endpoints |
| Services/CourseService/Dtos/Dtos.cs | Created | DTOs + validation |
| Services/CourseService/appsettings.json | Created | Config, port 8082, threshold |
| Services/CourseService/Data/Migrations/* | Created | `InitialCreate` |

## 4. Files Modified
None.

## 5. Implementation Details
- `TotalSeats`/`AvailableSeats` have `AfterSaveBehavior = Ignore`: entity saves can never overwrite them. They change only through atomic statements.
- Reserve: `UPDATE ... SET AvailableSeats = AvailableSeats - 1 ... WHERE CourseId=@id AND AvailableSeats > 0 AND Status='Active'` via `ExecuteUpdateAsync`; rows = 0 -> 409 ("No seats" / "not active"). A `dn_seat_reservations` row (unique `EnrollmentId`) makes it idempotent: replay -> `replayed=true`, no extra seat.
- Capacity change uses **raw SQL** because MySQL assigns `SET` left-to-right and EF's `ExecuteUpdate` order produced `AvailableSeats = 0` in the first implementation (found by a live test; fixed and covered by an integration test).
- `Version` is an optimistic-concurrency token bumped by every write; a concurrent `PUT` gets 409.
- Cache: `course:{id}` 10 min, `course-availability:{id}` 1 min; both evicted after every update/status/delete/seat change (after commit).
- `LowCourseAvailability` published (best effort, after commit) when `AvailableSeats <= Course:LowAvailabilityThreshold` (default 5).

## 6. Architecture Details
Called by Enrollment Service (`GET course`, `GET availability`, `POST seats/reserve|release`, Service-role JWT). Publishes to RabbitMQ exchange `sms.events`, routing key `course.low-availability`.

## 7. Dependencies
Pomelo, EF Core, Redis cache, RabbitMQ.Client (Messaging block).

## 8. Configuration Changes
`ConnectionStrings:CourseDb`, `ConnectionStrings:Redis`, `RabbitMq:*`, `Course:LowAvailabilityThreshold`, `Jwt:*`, `Urls`.

## 9. Database Changes
CourseDB: `dn_course_categories` (unique name), `dn_courses` (unique `CourseCode`, FK category RESTRICT, CHECK `0 <= AvailableSeats <= TotalSeats`, index status), `dn_seat_reservations` (unique `EnrollmentId`, FK course RESTRICT, index (CourseId, Status)).

## 10. API Changes
`/api/courses` CRUD + search (`search, categoryId, status, minFees, maxFees, availableOnly, page, size, sort`), `GET /{id}/availability`, `PATCH /{id}/status`, `POST /{id}/seats/reserve|release` (Admin or Service role), `/api/courses/categories` CRUD. Example: `POST /api/courses {"courseName":"Java","courseCode":"JV-101","durationWeeks":12,"fees":24999.00,"totalSeats":30}` -> 201.

## 11. Communication Changes
RabbitMQ publish `course.low-availability` (event `LowCourseAvailabilityEvent`). Inbound REST from Enrollment.

## 12. Execution Instructions
Via gateway: `curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/courses`. Concurrency proof: 20 parallel reserves for 4 seats -> `4 x 200, 16 x 409`, seats = 0 (run during development) and in `e2e.py`.

## 13. Testing
Unit: `Tests/UnitTests/Course/CourseTests.cs`. Integration (real MySQL 8): `Tests/IntegrationTests/CourseSeatIntegrationTests.cs` - 30 concurrent reservations for 5 seats, idempotency, release, CHECK constraint, capacity change.

## 14. Pending Items
Course schedules/instructors not in scope.
