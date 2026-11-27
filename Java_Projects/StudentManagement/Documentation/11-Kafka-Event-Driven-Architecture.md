# 11 – Kafka Event-Driven Architecture

## 1. Feature Overview
Apache Kafka (KRaft, single broker `apache/kafka:3.9.0` in Docker) carries five integration events as JSON. Producers: Enrollment (via outbox) and Course. Consumer: Notification.

## 2. Purpose
Asynchronous, loosely coupled notification and monitoring of enrollment/course state.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| common/event-contracts/src/main/java/com/example/events/EnrollmentEvent.java | Created | Record: `eventId, eventType, enrollmentId, studentId, courseId, studentName, studentEmail, courseName, reason, correlationId, occurredAt` |
| common/event-contracts/src/main/java/com/example/events/EnrollmentEventType.java | Created | `EnrollmentRequested/Confirmed/Rejected/Cancelled` → topic |
| common/event-contracts/src/main/java/com/example/events/LowCourseAvailabilityEvent.java | Created | `eventId, courseId, courseCode, courseName, availableSeats, totalSeats, occurredAt` |
| common/event-contracts/src/main/java/com/example/events/Topics.java | Created | Topic-name constants |
| services/course-service/src/main/java/com/example/course/config/KafkaConfig.java | Created | Topic `course.low-availability` |
| services/enrollment-service/src/main/java/com/example/enrollment/config/KafkaConfig.java | Created | Four enrollment topics |
| services/notification-service/src/main/java/com/example/notification/config/KafkaConfig.java | Created | All topics + `.DLT` topics, error handler |
| services/notification-service/src/main/java/com/example/notification/consumer/EventConsumers.java | Created | Listeners |
| common/common-web/src/main/java/com/example/common/KafkaHealthAutoConfiguration.java | Created | `kafka` health indicator (cluster reachability) |
| docker-compose.yml | Created | `kafka` service (volume `kafka-data`, health check) |

## 4. Files Modified
`common/common-web/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (registers the Kafka health auto-configuration); notification `KafkaConfig.java` (see [07](07-Notification-Service.md)).

## 5. Implementation Details
| Topic | Event | Key | Producer | Consumer / group | DLT |
|---|---|---|---|---|---|
| `enrollment.requested` | EnrollmentRequested | enrollmentId | Enrollment (outbox) | notification-service | `enrollment.requested.DLT` |
| `enrollment.confirmed` | EnrollmentConfirmed | enrollmentId | Enrollment (outbox) | notification-service | `….DLT` |
| `enrollment.rejected` | EnrollmentRejected | enrollmentId | Enrollment (outbox) | notification-service | `….DLT` |
| `enrollment.cancelled` | EnrollmentCancelled | enrollmentId | Enrollment (outbox) | notification-service | `….DLT` |
| `course.low-availability` | LowCourseAvailability | courseId | Course (after commit) | notification-service | `….DLT` |

All topics: 3 partitions, replication 1. Producers: `acks=all`, idempotent producer; JSON without `__TypeId__` headers (contracts are plain records, independent of Java class names). Consumers: `ErrorHandlingDeserializer` + `JsonDeserializer` (default type per listener, trusted package `com.example.events`), manual offset semantics = `ack-mode: record`, `enable-auto-commit: false`, 3 threads, `auto-offset-reset: earliest`. Error handling: exponential back-off then dead-letter to `<topic>.DLT` (same partition).

## 6. Architecture Details
Ordering: all events of one enrollment share a key → same partition → ordered. Delivery is at-least-once; duplicates are absorbed by the inbox ([13](13-Outbox-and-Inbox-Patterns.md)).

## 7. Dependencies
`spring-kafka`, `kafka-clients`; Testcontainers (`confluentinc/cp-kafka:7.6.0` – the Testcontainers-managed KRaft image failed to start in this environment).

## 8. Configuration Changes
`spring.kafka.*` in course/enrollment/notification `application.yml`; `KAFKA_BOOTSTRAP_SERVERS` (`localhost:9092` on the host, `kafka:29092` inside Compose, `kafka:9092` in Kubernetes).

## 9. Database Changes
None directly (outbox/inbox: [13](13-Outbox-and-Inbox-Patterns.md)).

## 10. API Changes
None.

## 11. Communication Changes
This document *is* the communication contract. Example payload (`enrollment.confirmed`):
```json
{"eventId":"c0d3…","eventType":"EnrollmentConfirmed","enrollmentId":6,"studentId":4,"courseId":2,
 "studentName":"Tom Flaky","studentEmail":"tom@flaky.test","courseName":"Kafka Basics","reason":null,
 "correlationId":"…","occurredAt":"2026-11-10T10:12:05.2Z"}
```

## 12. Execution Instructions
```bash
docker compose up -d kafka
docker exec sms-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
docker exec sms-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic enrollment.confirmed --from-beginning
```

## 13. Testing
`SeatConcurrencyIT.lowAvailabilityEventIsPublishedToKafkaAfterCommit`, `EnrollmentFlowIT` (events through the outbox, outage recovery), `NotificationKafkaIT` (consumption, dedupe, DLT). Live: events visible end-to-end in the E2E run (notifications SENT).

## 14. Pending Items
Single broker (replication factor 1), no schema registry/compatibility checks, no TLS/SASL.
