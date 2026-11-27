# 20 – Background Processing

## 1. Feature Overview
Scheduled and event-driven workers: outbox publishing, saga recovery, notification dispatch/retry, Kafka consumers (retry/DLT).

## 2. Purpose
Move reliability work off the request path.

## 3. Files Created
`…/enrollment/outbox/OutboxPublisher.java`, `…/enrollment/saga/SagaRecoveryJob.java`, `…/notification/processing/NotificationDispatcher.java`, `NotificationProcessor.java`, `…/notification/consumer/EventConsumers.java`, `…/notification/config/KafkaConfig.java` (full paths in [06](06-Enrollment-Service.md), [07](07-Notification-Service.md)).

## 4. Files Modified
None.

## 5. Implementation Details
| Job | Mechanism | Default schedule | Purpose |
|---|---|---|---|
| Outbox publisher | `@Scheduled(fixedDelay)` + `FOR UPDATE SKIP LOCKED` | 1 s, batch 50 | Publish pending events with backoff retry |
| Saga recovery | `@Scheduled(fixedDelay, initialDelay)` | 15 s, stale after 30 s | Resume sagas; retry compensations |
| Notification dispatcher | `@Scheduled(fixedDelay)` | 2 s, batch 50 | Send due notifications; backoff 5 s×2ⁿ, max 5 attempts |
| Kafka consumers | `@KafkaListener` (3 threads) | continuous | Ingest events; retry then DLT |

`@EnableScheduling` is on the Enrollment and Notification applications. Each notification is processed in its own `REQUIRES_NEW` transaction, so one failure cannot roll back others. `@Async` is not used: the work items are small, ordered and already isolated; the scheduler thread + Kafka listener threads provide the concurrency.

## 6. Architecture Details
All workers are safe to run in several instances (SKIP LOCKED, optimistic `@Version`, unique constraints, consumer groups).

## 7. Dependencies
Spring scheduling, Spring Kafka.

## 8. Configuration Changes
`enrollment.outbox.*`, `enrollment.saga.*`, `notification.dispatch.*`, `notification.consumer.*`.

## 9. Database Changes
Uses `sms_outbox_events`, `sms_saga_instances`, `sms_notifications`.

## 10. API Changes
`POST /api/notifications/{id}/retry` re-queues a FAILED notification.

## 11. Communication Changes
Kafka produce/consume as described in [11](11-Kafka-Event-Driven-Architecture.md).

## 12. Execution Instructions
Logs show `Outbox published …`, `Recovering saga …`, `EMAIL SENT …`, `Notification n attempt k failed, retry in …s`.

## 13. Testing
Outbox (unit + broker outage IT), recovery IT, processor unit tests, `NotificationKafkaIT` (flaky → SENT, failing → FAILED).

## 14. Pending Items
No dedicated cleanup/retention jobs (outbox, inbox, finished sagas, notifications).
