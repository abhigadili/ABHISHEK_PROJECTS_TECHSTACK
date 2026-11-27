# 06 - Notification Service

## 1. Feature Overview
Consumes enrollment and course events from RabbitMQ, stores notification history, "sends" (simulated) e-mails with retry, and exposes history APIs. Port 8084, database **NotificationDB**.

## 2. Purpose
Decouple user communication from the enrollment transaction: a slow or failing e-mail never blocks or rolls back an enrollment.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| Services/NotificationService/Program.cs | Created | DbContext, JWT, RabbitMQ, hosted services |
| Services/NotificationService/Entities/Entities.cs | Created | `Notification`, `InboxMessage`, enums |
| Services/NotificationService/Data/NotificationDbContext.cs, Configurations/EntityConfigurations.cs, DesignTimeFactory.cs | Created | Mapping, unique indexes |
| Services/NotificationService/Consumers/Consumers.cs | Created | `EnrollmentEventsConsumer`, `CourseEventsConsumer` |
| Services/NotificationService/Services/NotificationIngestService.cs | Created | Inbox + notification creation (one transaction) |
| Services/NotificationService/Services/NotificationQueryService.cs | Created | Search/get/retry |
| Services/NotificationService/Processing/Processing.cs | Created | `EmailSimulator`, `NotificationProcessor`, `NotificationDispatcher` |
| Services/NotificationService/Controllers/NotificationsController.cs, Dtos/NotificationResponse.cs, appsettings.json, Data/Migrations/* | Created | API, DTO, config, migration |

## 4. Files Modified
None.

## 5. Implementation Details
- `EnrollmentRequested` -> recorded in the inbox only; `EnrollmentConfirmed/Rejected/Cancelled` -> one `Pending` notification each; `LowCourseAvailability` -> admin notification.
- Dispatcher (every 2 s) sends due `Pending` notifications; failure -> `RetryCount++`, back-off `5s x 2^(n-1)`, `Failed` after 5 attempts or immediately for non-retryable errors (no recipient). `POST /{id}/retry` re-queues a `Failed` one.
- E-mail is a **simulation** (`EMAIL SENT ...` log). Test addresses: `@fail.test` always fails, `@flaky.test` fails twice.

## 6. Architecture Details
Consumer-only for messaging; no outbound service calls. Idempotency via inbox - `12-Idempotency.md`; consumer retry/DLQ - `09`.

## 7. Dependencies
Pomelo/EF Core, RabbitMQ.Client (Messaging block).

## 8. Configuration Changes
`ConnectionStrings:NotificationDb`, `RabbitMq:*`, `Notification:AdminEmail|DispatchIntervalMs|BatchSize|MaxAttempts|BaseBackoffSeconds|ConsumerMaxAttempts|ConsumerRetryDelayMs`, `Jwt:*`.

## 9. Database Changes
NotificationDB: `dn_notifications` (unique (EnrollmentId, NotificationType), indexes (Status, NextAttemptAt), (StudentId, CreatedAt)), `dn_inbox_messages` (unique (MessageId, ConsumerGroup)).

## 10. API Changes
`GET /api/notifications` (studentId, status, type, page, size), `GET /{id}`, `GET /student/{studentId}` (student: own only), `POST /{id}/retry`. Notifications cannot be created by API.

## 11. Communication Changes
Consumes queues `notification.enrollment-events` (binding `enrollment.*`) and `notification.course-events` (binding `course.*`) on exchange `sms.events`; dead letters to `<queue>.dlq`.

## 12. Execution Instructions
Start the stack, enrol a student, then `GET /api/notifications/student/{id}` shows `EnrollmentConfirmed` / `Sent` within ~2-3 s.

## 13. Testing
Unit: `Tests/UnitTests/Notification/NotificationTests.cs`. Integration (real RabbitMQ + MySQL): `Tests/IntegrationTests/NotificationMessagingIntegrationTests.cs`.

## 14. Pending Items
Real SMTP/SMS integration not implemented (not required).
