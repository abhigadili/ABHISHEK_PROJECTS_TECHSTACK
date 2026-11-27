# 18 - Background Processing

## 1. Feature Overview
`BackgroundService` jobs: outbox publishing, saga recovery, notification dispatching, RabbitMQ consumers, admin seeding (hosted service).

## 2. Purpose
Move reliability-critical and slow work off the request path.

## 3. Files Created / 5. Details
| Job | File | Interval | Work |
|---|---|---|---|
| `OutboxPublisher` | Services/EnrollmentService/Outbox/OutboxPublisher.cs | 1 s | publish due outbox rows (`11`) |
| `SagaRecoveryJob` | Services/EnrollmentService/Saga/EnrollmentSagaOrchestrator.cs | 15 s | resume stuck sagas (`10`) |
| `NotificationDispatcher` | Services/NotificationService/Processing/Processing.cs | 2 s | send due `Pending` notifications, retry with back-off, `Failed` after 5 attempts |
| `EnrollmentEventsConsumer`, `CourseEventsConsumer` | Services/NotificationService/Consumers/Consumers.cs | continuous | consume queues (`09`), failed-message retry + DLQ |
| `AdminSeeder` (IHostedService) | Services/StudentService/Services/AdminSeeder.cs | once | roles + first admin |
All use `PeriodicTimer` (no overlap), a fresh DI scope per unit of work, and catch exceptions so one failure never stops the loop. Failed-message retry processing = consumer back-off/DLQ (messages) and `NotificationProcessor` back-off (notifications).

## 4. Files Modified
None.

## 6. Architecture Details
Each job is idempotent and safe to run in several instances (`SKIP LOCKED`, optimistic concurrency, inbox).

## 7. Dependencies
`Microsoft.Extensions.Hosting` (framework).

## 8. Configuration Changes
`Outbox:*`, `Saga:*`, `Notification:*`.

## 9. Database Changes
Tables used: `dn_outbox_messages`, `dn_saga_instances`, `dn_notifications`, `dn_inbox_messages`.

## 10. API Changes
None.

## 11. Communication Changes
RabbitMQ publish/consume.

## 12. Execution Instructions
Logs: `logs/enrollment.log` (`Outbox published ...`, `Recovering saga`), `logs/notification.log` (`Processed ...`, `EMAIL SENT ...`).

## 13. Testing
Unit: `NotificationProcessorTests` (backoff maths, failure, flaky). Integration: outbox batch, consumers. Live: `failure-scenarios.py`.

## 14. Pending Items
Graceful-shutdown draining of in-flight RabbitMQ messages is basic (unacked messages are redelivered).
