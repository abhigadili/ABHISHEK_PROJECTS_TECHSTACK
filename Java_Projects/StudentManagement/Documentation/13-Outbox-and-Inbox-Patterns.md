# 13 – Outbox and Inbox Patterns

## 1. Feature Overview
* **Outbox** (EnrollmentDB `sms_outbox_events`): events are inserted in the same local transaction as the business change and published to Kafka by a background poller.
* **Inbox** (NotificationDB `sms_inbox_messages`): every consumed `eventId` is recorded in the same transaction as its effect, so redelivery is harmless.

## 2. Purpose
Never lose an event when the service/broker crashes after the DB commit; never apply an event twice.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| services/enrollment-service/src/main/java/com/example/enrollment/outbox/OutboxWriter.java | Created | `@Transactional(MANDATORY)` insert |
| services/enrollment-service/src/main/java/com/example/enrollment/outbox/OutboxPublisher.java | Created | `@Scheduled` publisher with retry/backoff and metrics |
| services/enrollment-service/src/main/java/com/example/enrollment/event/EnrollmentEventRecorder.java | Created | Builds `EnrollmentEvent`, calls the writer (MANDATORY) |
| services/enrollment-service/src/main/java/com/example/enrollment/entity/OutboxEvent.java, OutboxStatus.java, repository/OutboxEventRepository.java | Created | |
| services/notification-service/src/main/java/com/example/notification/entity/InboxMessage.java, repository/InboxMessageRepository.java | Created | |
| services/notification-service/src/main/java/com/example/notification/service/NotificationIngestService.java | Created | Inbox + notification in one tx |
| services/enrollment-service/src/test/java/com/example/enrollment/outbox/OutboxPublisherTest.java | Created | |

## 4. Files Modified
None.

## 5. Implementation Details
Outbox publisher (every 1 s, batch 50): `SELECT … FOR UPDATE SKIP LOCKED` (several instances can poll safely) → `send(...).get(5 s)` (waits for the broker ack, `acks=all`) → `PUBLISHED`. On failure: `attempts++`, `next_attempt_at = now + min(60, 2^attempts) s`, status stays `PENDING` (**never dropped**); later events of the same enrollment in that batch are skipped to preserve per-enrollment ordering. Headers `eventId`, `eventType` are added. Metrics: `outbox_events_published_total`, `outbox_events_failed_total`, gauge `outbox_events_pending`.
Inbox: `existsByMessageIdAndConsumerGroup` → skip; else insert inbox row + create notification atomically; unique indexes make concurrent duplicates fail the transaction and be retried by the Kafka error handler (then skipped).

## 6. Architecture Details
At-least-once end-to-end + idempotent consumer = effectively-once effect. The crash window "committed but not yet published" is covered because the event row is committed with the business change.

## 7. Dependencies
`spring-kafka`, JPA, Jackson (payload serialisation), Micrometer.

## 8. Configuration Changes
`enrollment.outbox.interval-ms|batch-size|send-timeout-seconds`; producer `value-serializer: StringSerializer` (payload is stored as JSON text).

## 9. Database Changes
`sms_outbox_events` (UNIQUE `event_id`, idx `(status, next_attempt_at, outbox_id)`), `sms_inbox_messages` (UNIQUE `(message_id, consumer_group)`).

## 10. API Changes
None.

## 11. Communication Changes
Outbox → Kafka topics ([11](11-Kafka-Event-Driven-Architecture.md)).

## 12. Execution Instructions
`mysql … -e "select outbox_id,event_type,status,attempts from sms_outbox_events order by outbox_id desc limit 10" EnrollmentDB`.

## 13. Testing
Unit `OutboxPublisherTest` (4): published / failure keeps PENDING with backoff / ordering skip / backoff cap. Integration: events arrive in Kafka and the outbox drains; **business change and outbox row roll back together**; `recorder.record` outside a transaction is refused; **Kafka paused → events stay PENDING with `attempts>0`, unpaused → all delivered** (`EnrollmentFlowIT`); inbox/duplicate tests in `NotificationKafkaIT`.

## 14. Pending Items
The outbox table is never purged (add a retention job); no trace-context propagation through the outbox.
