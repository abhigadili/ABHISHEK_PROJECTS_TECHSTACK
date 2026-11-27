# 17 - Concurrency Control

## 1. Feature Overview
Many students enrolling in the same course at once can never push `AvailableSeats` below zero or above capacity.

## 2. Purpose
Prevent overselling; make reserve/release idempotent.

## 3. Files Created
`Services/CourseService/Repositories/CourseRepository.cs` (atomic statements), `Services/CourseService/Services/SeatService.cs`, `Services/CourseService/Data/Configurations/EntityConfigurations.cs` (CHECK, concurrency token), `BuildingBlocks/Common/DbContextExtensions.cs`.

## 4. Files Modified
`CourseRepository.ChangeCapacityAsync` was rewritten from `ExecuteUpdate` to raw SQL after a live test showed `AvailableSeats = 0` (SET evaluation order).

## 5. Implementation Details
| Technique | Where | Protects |
|---|---|---|
| Atomic conditional UPDATE (`... WHERE AvailableSeats > 0 AND Status='Active'`) | `TryReserveSeatAsync` | oversell; InnoDB row lock serialises concurrent updates |
| CHECK `0 <= AvailableSeats <= TotalSeats` | `dn_courses` | last line of defence (also proven by integration test) |
| Unique `EnrollmentId` reservation row | `dn_seat_reservations` | idempotent reserve/release |
| Optimistic concurrency token `Version` | `Course`, `SagaInstance`, `Enrollment`, `Notification` | lost updates -> 409 / saga skip |
| Unique generated `ActiveKey` | `dn_enrollments` | duplicate active enrollment |
| `FOR UPDATE SKIP LOCKED` | outbox poll | double publish |
Seat statements and the reservation row are in one transaction (`InTransactionAsync`), cache eviction happens after commit. Seat columns are `AfterSaveBehavior.Ignore`.

## 6. Architecture Details
Course Service is the single writer of seat counters.

## 7. Dependencies
MySQL 8 InnoDB, EF Core 8 `ExecuteUpdateAsync`.

## 8. Configuration Changes
None.

## 9. Database Changes
CHECK constraint `chk_dn_courses_seats`, unique indexes listed above.

## 10. API Changes
`POST /api/courses/{id}/seats/reserve|release` -> 200, 409 (no seats / inactive / conflicting reservation), 404.

## 11. Communication Changes
None.

## 12. Execution Instructions
`scripts/e2e.py`: 15 students race for 4 seats through the gateway -> exactly 4 `201`, 11 `422`, seats exactly 0.

## 13. Testing
Integration (real MySQL): 30 concurrent reservations for 5 seats -> exactly 5 succeed; 8 concurrent reservations of one enrollment -> one seat consumed; CHECK rejects `-1` and over-capacity; capacity change keeps reserved seats; inactive course refuses. Unit: `SeatServiceTests`.

## 14. Pending Items
None known.
