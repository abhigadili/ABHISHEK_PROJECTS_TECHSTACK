# 19 – Distributed Concurrency Control

## 1. Feature Overview
Simultaneous enrollments for the same course can never oversell seats; reservations and releases are idempotent; concurrent edits cannot overwrite seat counters.

## 2. Purpose
Correctness under load with several service instances and no distributed lock.

## 3. Files Created
`services/course-service/src/main/java/com/example/course/repository/CourseRepository.java`, `service/SeatService.java`, `entity/SeatReservation.java`, `db/migration/V1__create_course_tables.sql` ([05](05-Course-Service.md)); `services/course-service/src/test/java/com/example/course/it/SeatConcurrencyIT.java`; `scripts/e2e.py` (concurrency scenario).

## 4. Files Modified
None.

## 5. Implementation Details
1. **Atomic conditional UPDATE** (primary mechanism)
   `UPDATE sms_courses SET available_seats = available_seats - 1, version = version + 1 WHERE course_id=? AND available_seats > 0 AND status='ACTIVE'` – InnoDB evaluates the predicate under the row lock; `0 rows` ⇒ sold out ⇒ 409. No read-modify-write in Java.
2. **CHECK constraint** `available_seats BETWEEN 0 AND total_seats` – last line of defence (even manual SQL cannot make it negative).
3. **Idempotency table** `sms_seat_reservations` (UNIQUE `enrollment_id`): reserve once per enrollment; the decrement and the reservation row are one transaction, so if two threads race on the *same* enrollment the loser's unique-key violation rolls back its decrement too.
4. **Optimistic locking** `@Version` on `Course`, bumped by every seat UPDATE; seat columns are `updatable=false` in JPA, so a stale `PUT` cannot clobber counters (capacity changes use their own atomic UPDATE).
5. **Release** is `available_seats + 1 WHERE available_seats < total_seats` plus reservation status flip (RESERVED → RELEASED) – double release is a no-op.
6. **Enrollment side**: unique `active_key` (one active enrollment per student/course) and `SKIP LOCKED` outbox polling.

## 6. Architecture Details
All guarantees are enforced inside MySQL, so they hold for any number of Course Service instances.

## 7. Dependencies
MySQL 8.0 InnoDB (row locks, CHECK constraints, generated columns).

## 8. Configuration Changes
None.

## 9. Database Changes
CHECK constraint, unique and generated-column indexes ([03](03-MySQL-Database-Configuration.md)).

## 10. API Changes
`POST /api/courses/{id}/seats/reserve|release` ([05](05-Course-Service.md)).

## 11. Communication Changes
None.

## 12. Execution Instructions
`python3 scripts/e2e.py` (15 concurrent students, 4 seats) or run `SeatConcurrencyIT`.

## 13. Testing
* IT: 50 threads / 10 seats → 10 OK, 40 conflicts, 0 seats left, 10 RESERVED rows; 20 competing releases of 5 reservations → exactly +5; 10 threads same enrollment → 1 seat consumed; direct SQL `available_seats=-1` rejected; capacity changes.
* Live through gateway + Feign + saga: 15 students → exactly 4 CONFIRMED, 11 REJECTED, `availableSeats == 0`. A first manual run (50 parallel `curl` on 10 seats) gave 10×200 / 40×409.

## 14. Pending Items
No load/soak test beyond these scenarios; throughput on a single hot course is bounded by one row lock.
