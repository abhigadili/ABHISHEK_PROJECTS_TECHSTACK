# 11 - Outbox Pattern

## 1. Feature Overview
Events are stored in `dn_outbox_messages` in the **same transaction** as the business change and published to RabbitMQ by a `BackgroundService`.

## 2. Purpose
Prevent event loss / state-event divergence when the service or broker fails right after a commit.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| Services/EnrollmentService/EventHandlers/EnrollmentEventRecorder.cs | Created | Builds `EnrollmentEvent`, adds an `OutboxMessage`; **throws if no transaction is open** |
| Services/EnrollmentService/Outbox/OutboxPublisher.cs | Created | Poller/publisher + metrics |
| Services/EnrollmentService/Entities/Entities.cs (`OutboxMessage`, `OutboxStatus`) | Created | Row model |

## 4. Files Modified
None.

## 5. Implementation Details
- Every second (`Outbox:IntervalMs`) one transaction runs: `SELECT * FROM dn_outbox_messages WHERE Status='Pending' AND NextAttemptAt <= UTC_TIMESTAMP(6) ORDER BY OutboxId LIMIT 50 FOR UPDATE SKIP LOCKED`.
- Each row is published (persistent, publisher confirm); on confirm -> `Published`, `PublishedAt`.
- Failure -> `Attempts++`, `NextAttemptAt = now + min(60, 2^attempts) s`, `LastError`; the remaining events of **that enrollment** are skipped in the batch (ordering); other enrollments continue.
- `SKIP LOCKED` lets several service instances poll concurrently without publishing a row twice.
- Metrics (meter `enrollment-service`): `outbox_events_published`, `outbox_events_failed`, gauge `outbox_events_pending` (Prometheus names get a `_total` suffix for counters).
- Guarantee: **at-least-once** (a crash after broker confirm but before commit re-sends); consumers de-duplicate (`12`).

## 6. Architecture Details
Producer side of `09`. Course Service's low-availability event is deliberately **not** outboxed (best-effort alert).

## 7. Dependencies
EF Core raw SQL (`FromSqlInterpolated`), RabbitMQ.Client.

## 8. Configuration Changes
`Outbox:IntervalMs` (1000), `Outbox:BatchSize` (50).

## 9. Database Changes
`dn_outbox_messages`: OutboxId PK, EventId (unique), AggregateId, EventType, RoutingKey, Payload (longtext), CorrelationId, Status, Attempts, NextAttemptAt, LastError, CreatedAt, PublishedAt; index (Status, NextAttemptAt, OutboxId).

## 10. API Changes
None.

## 11. Communication Changes
Publishes `enrollment.*` routing keys (`09`).

## 12. Execution Instructions
`python3 scripts/failure-scenarios.py` section 1: stops RabbitMQ, enrols (201), shows 2 outbox rows still `Pending` with retry attempts, restarts the broker, both rows become `Published` and the notification is `Sent`.

## 13. Testing
Integration (`EnrollmentOutboxIntegrationTests`): publish -> persistent message with correct routing key/message id; broker outage keeps rows pending with back-off and per-enrollment ordering, a later poll publishes all; four concurrent publishers publish 20 rows exactly once each. Unit: events recorded by the saga (`Recorded` lists).

## 14. Pending Items
Published rows are never purged (add a retention job for production).
