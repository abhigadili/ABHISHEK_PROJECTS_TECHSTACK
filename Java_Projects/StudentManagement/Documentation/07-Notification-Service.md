# 07 – Notification Service

## 1. Feature Overview
Kafka consumers turn enrollment/course events into notifications; an inbox table makes consumption idempotent; a background dispatcher "sends" them (e-mail **simulation**) with exponential-backoff retry; history is queryable by API.

## 2. Purpose
Decouple user communication from enrollment processing and make it reliable under redelivery and failures.

## 3. Files Created
Base `services/notification-service/src/main/java/com/example/notification/`:

| File Path | Change Type | Description |
|---|---|---|
| …/NotificationServiceApplication.java | Created | `@EnableScheduling` |
| …/consumer/EventConsumers.java | Created | `@KafkaListener` for the 4 enrollment topics and `course.low-availability` |
| …/service/NotificationIngestService.java | Created | Inbox check + notification creation in one transaction |
| …/service/NotificationQueryService.java | Created | Search, per-student history, manual retry |
| …/processing/NotificationDispatcher.java | Created | `@Scheduled` poller of due notifications |
| …/processing/NotificationProcessor.java | Created | One notification per `REQUIRES_NEW` transaction; retry/backoff/FAILED |
| …/processing/EmailSimulator.java | Created | Logs the e-mail; `@fail.test` always fails, `@flaky.test` fails twice |
| …/entity/Notification.java, InboxMessage.java, NotificationStatus.java, NotificationType.java | Created | |
| …/repository/NotificationRepository.java, InboxMessageRepository.java | Created | |
| …/dto/NotificationResponse.java, …/mapper/NotificationMapper.java | Created | |
| …/controller/NotificationController.java | Created | API |
| …/config/KafkaConfig.java | Created | Topics + DLT topics, JSON/bytes templates, `DefaultErrorHandler` with back-off and dead-lettering |
| …/config/SecurityConfig.java | Created | |
| services/notification-service/src/main/resources/application.yml, db/migration/V1__create_notification_tables.sql | Created | |
| services/notification-service/src/test/java/com/example/notification/service/NotificationIngestServiceTest.java, processing/NotificationProcessorTest.java | Created | Unit tests |
| services/notification-service/src/test/java/com/example/notification/it/AbstractIT.java, NotificationKafkaIT.java | Created | Integration tests |
| services/notification-service/Dockerfile | Created | |

## 4. Files Modified
| File Path | Change Type | Description |
|---|---|---|
| …/config/KafkaConfig.java | Modified | Added explicit `KafkaTemplate<String,Object>` (Boot backs off its default once a template bean exists); dead-letter destination resolver `<topic>.DLT` (default would have been `<topic>-dlt` and the recoverer blocked 60 s on a missing topic – found by `NotificationKafkaIT`) |
| …/processing/EmailSimulator.java, NotificationProcessor.java | Modified | `NonRetryableNotificationException`: a missing recipient fails immediately instead of being retried 5×; found in the first live E2E run |
| services/notification-service/src/main/resources/application.yml | Modified | `forward-headers-strategy`; Kafka observation; producer `max.block.ms: 5000` |

## 5. Implementation Details
* Notification types: `ENROLLMENT_CONFIRMED`, `ENROLLMENT_REJECTED`, `ENROLLMENT_CANCELLED`, `COURSE_LOW_AVAILABILITY` (to `admin@sms.local`). `EnrollmentRequested` is consumed and recorded in the inbox but produces **no** notification.
* Statuses: `PENDING` (new or waiting for retry), `SENT`, `FAILED`. Backoff `base × 2^(attempt-1)` (5 s default), max 5 attempts; `POST /api/notifications/{id}/retry` re-queues a FAILED one.
* Consumer errors: retry with exponential back-off (1 s ×2, max 15 s) then publish to `<topic>.DLT`; undeserialisable ("poison") records go to the DLT without blocking the partition.

## 6. Architecture Details
Owns NotificationDB. Consumer group `notification-service`, 3 listener threads, offsets committed per record after the listener returns.

## 7. Dependencies
JPA, Flyway, Kafka, Security, Actuator, springdoc, Micrometer/OTel, `event-contracts`, `common-web`.

## 8. Configuration Changes
`notification.*` (dispatch interval/batch/max-attempts/backoff, consumer retry), `spring.kafka.consumer.*` (`ErrorHandlingDeserializer` → `JsonDeserializer`, trusted package `com.example.events`, no type headers).

## 9. Database Changes
`sms_notifications` (UNIQUE `(enrollment_id, notification_type)`), `sms_inbox_messages` (UNIQUE `(message_id, consumer_group)`).

## 10. API Changes
| Method & path | Roles |
|---|---|
| `GET /api/notifications?studentId&status&type&page&size` | ADMIN, STAFF |
| `GET /api/notifications/{id}` | ADMIN, STAFF |
| `GET /api/notifications/student/{studentId}` | ADMIN, STAFF, STUDENT(own) |
| `POST /api/notifications/{id}/retry` | ADMIN, STAFF |

## 11. Communication Changes
Consumes `enrollment.requested|confirmed|rejected|cancelled`, `course.low-availability`; dead-letters to `<topic>.DLT`.

## 12. Execution Instructions
Start with the stack; watch `logs/notification-service.log` for `EMAIL SENT …`.

## 13. Testing
Unit: ingest (6), processor (6). Integration `NotificationKafkaIT` (6): confirmed event → SENT; same `eventId` twice + same fact with new `eventId` → exactly one notification; flaky recipient SENT on 3rd attempt; failing recipient → FAILED after 3; low-availability to admin mailbox; poison message appears on `enrollment.confirmed.DLT` and the next valid message is still processed.

## 14. Pending Items
Real SMTP/SMS delivery is out of scope (simulation only).
