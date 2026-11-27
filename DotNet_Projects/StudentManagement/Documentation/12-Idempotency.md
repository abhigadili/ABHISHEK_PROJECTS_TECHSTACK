# 12 - Idempotency

## 1. Feature Overview
Duplicate **enrollment requests**, duplicate **message processing** and duplicate **notifications** are prevented, plus idempotent seat operations.

## 2. Purpose
Retries (client, network, broker redelivery, saga recovery) must never create double effects.

## 3. Files Created
No dedicated files - the mechanisms are part of: `Saga/EnrollmentSagaOrchestrator.cs`, `Commands/Commands.cs`, `Controllers/EnrollmentsController.cs` (Enrollment), `Services/SeatService.cs` (Course), `Services/NotificationIngestService.cs` (Notification).

## 4. Files Modified
None.

## 5. Implementation Details
| Duplicate | Prevention | Database guard |
|---|---|---|
| Same enrollment request retried | `Idempotency-Key` header -> saga row keyed by it; replay returns the stored outcome | unique `dn_saga_instances.IdempotencyKey`, unique `dn_enrollments.IdempotencyKey` |
| Different keys, same student+course | pre-check + `ActiveKey` | unique generated column `dn_enrollments.ActiveKey` |
| Concurrent same-key requests | the loser catches the duplicate-key error and returns the winner's saga | unique key |
| Seat reserve/release repeated | `dn_seat_reservations` per `EnrollmentId` -> `replayed:true` | unique `EnrollmentId` |
| Same RabbitMQ message redelivered | inbox lookup by `(MessageId=EventId, ConsumerGroup)` then insert in the same transaction as the notification | unique (MessageId, ConsumerGroup) |
| Two events, same enrollment+type | existence check | unique (EnrollmentId, NotificationType) |
| Outbox row published twice after crash | consumers de-duplicate | - |

## 6. Architecture Details
Defence layers: application check (fast path) + unique index (race-proof).

## 7. Dependencies
None beyond EF Core/MySQL.

## 8. Configuration Changes
None. Header `Idempotency-Key` (max 64 chars).

## 9. Database Changes
See the table above (all created by the initial migrations).

## 10. API Changes
`POST /api/enrollments` accepts `Idempotency-Key`.

## 11. Communication Changes
Message id = `EventId` (AMQP `messageId`).

## 12. Execution Instructions
`e2e.py`: "idempotent replay returns the same enrollment", "duplicate active enrollment -> 409", "no duplicate notifications per enrollment". Manual: publish the same message twice (see `09`).

## 13. Testing
Unit: saga replay, command duplicate/replay/re-enrol after cancel, ingest duplicates, Requested-event handling. Integration: unique `ActiveKey`/`IdempotencyKey` under real MySQL, concurrent same-key saga inserts -> one row, concurrent reserve of one enrollment -> one seat, duplicate RabbitMQ delivery -> one notification.

## 14. Pending Items
Idempotency keys never expire (rows are kept).
