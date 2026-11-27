# 14 – Idempotency

## 1. Feature Overview
Three independent guards: duplicate **enrollment requests**, duplicate **event processing**, duplicate **notification creation** – plus idempotent seat operations.

## 2. Purpose
Retries (client, network, Feign, Kafka) must never double-enroll, double-reserve or double-notify.

## 3. Files Created
No dedicated files; the mechanisms live in files listed in [06](06-Enrollment-Service.md), [05](05-Course-Service.md), [07](07-Notification-Service.md), [13](13-Outbox-and-Inbox-Patterns.md).

## 4. Files Modified
None.

## 5. Implementation Details
| Concern | Mechanism | Where |
|---|---|---|
| Duplicate enrollment **request** | `Idempotency-Key` header (generated if absent) → UNIQUE `sms_saga_instances.idempotency_key` and `sms_enrollments.idempotency_key`; replay returns the stored outcome without running a step | `EnrollmentSagaOrchestrator.start`, `CreateEnrollmentCommandHandler` |
| Concurrent same-key requests | Unique violation on insert → re-read the winner | `start()` |
| Duplicate **active enrollment** (new key) | Pre-check → 409; DB guard: generated column `active_key` UNIQUE (only PENDING/CONFIRMED rows carry a value) | handler + `V1__create_enrollment_tables.sql` |
| Duplicate seat reserve/release | UNIQUE `sms_seat_reservations.enrollment_id`; reserve replays `replayed:true`; release of unknown/released is a 200 no-op; reserve after release → 409 | `SeatService` |
| Duplicate event processing | Inbox UNIQUE `(message_id, consumer_group)` | `NotificationIngestService` |
| Duplicate notification | UNIQUE `(enrollment_id, notification_type)` | `V1__create_notification_tables.sql` |
| Duplicate outbox row | UNIQUE `event_id` | outbox table |

## 6. Architecture Details
Keys are chosen so every *retry path* hits a unique constraint rather than relying on in-memory state.

## 7. Dependencies
None beyond those of the components above.

## 8. Configuration Changes
None.

## 9. Database Changes
Unique indexes listed above ([03](03-MySQL-Database-Configuration.md)).

## 10. API Changes
Optional request header `Idempotency-Key` (≤ 64 chars) on `POST /api/enrollments`.

## 11. Communication Changes
Events carry `eventId`; Kafka producer idempotence is enabled.

## 12. Execution Instructions
```bash
curl -XPOST :8080/api/enrollments -H "Authorization: Bearer $T" -H 'Idempotency-Key: demo-1' -H 'Content-Type: application/json' -d '{"studentId":1,"courseId":1}'   # run twice → same enrollmentId
```

## 13. Testing
`sameIdempotencyKeyNeverCreatesASecondEnrollmentOrReservesASecondSeat`, `duplicateActiveEnrollmentIsBlockedByTheApplicationAndByTheDatabaseConstraint`, `SeatServiceTest` replay tests, `SeatConcurrencyIT.manyThreadsReservingForTheSameEnrollmentConsumeExactlyOneSeat`, `NotificationKafkaIT.redeliveredAndDuplicateEventsCreateExactlyOneNotification`, E2E "idempotent replay" and "no duplicate notifications per enrollment".

## 14. Pending Items
Idempotency keys never expire (no TTL/cleanup); a key reused with *different* student/course returns the first request's result rather than a 422.
