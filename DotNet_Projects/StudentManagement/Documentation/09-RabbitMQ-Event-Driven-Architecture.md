# 09 - RabbitMQ Event-Driven Architecture

## 1. Feature Overview
Integration events over RabbitMQ with durable topology, persistent messages, publisher confirms, manual acknowledgement, bounded retry and dead-letter queues.

## 2. Purpose
Asynchronous, loosely coupled communication: Enrollment/Course publish facts; Notification reacts.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| BuildingBlocks/EventContracts/Events.cs | Created | `EnrollmentEvent`, `LowCourseAvailabilityEvent`, `EventTypes` (+ routing keys), `Topology` names |
| BuildingBlocks/Messaging/RabbitMq.cs | Created | `RabbitMqConnection`, `RabbitMqTopology`, `RabbitMqEventPublisher`, `RabbitMqConsumer` base, `RabbitMqHealthCheck`, `AddSmsRabbitMq`, trace propagation |
| Services/NotificationService/Consumers/Consumers.cs | Created | Queue consumers |

## 4. Files Modified
None.

## 5. Implementation Details
**Topology** (declared idempotently by publishers *and* consumers, so nothing is published into a void):
| Item | Name | Properties |
|---|---|---|
| Exchange | `sms.events` | topic, durable |
| Dead-letter exchange | `sms.events.dlx` | direct, durable |
| Queue | `notification.enrollment-events` | durable, binding `enrollment.*`, `x-dead-letter-exchange=sms.events.dlx`, DLX routing key = queue name |
| Queue | `notification.course-events` | durable, binding `course.*`, same DLX settings |
| DLQs | `notification.enrollment-events.dlq`, `notification.course-events.dlq` | durable, bound to the DLX |

**Events and routing keys:** `EnrollmentRequested` -> `enrollment.requested`; `EnrollmentConfirmed` -> `enrollment.confirmed`; `EnrollmentRejected` -> `enrollment.rejected`; `EnrollmentCancelled` -> `enrollment.cancelled`; `LowCourseAvailability` -> `course.low-availability`. Payload = JSON (camelCase) of the record; `messageId` AMQP property = `EventId`; `type` = event type; `correlationId` = correlation id; `traceparent` header carries the W3C trace context.

**Publisher:** `delivery_mode=2` (persistent), `ConfirmSelect` + `WaitForConfirmsOrDie(5 s)`; thread-safe (one channel, lock).
**Consumer (`RabbitMqConsumer`):** manual ack; `BasicQos(prefetch 10)`; the handler runs; on exception it retries in-process with exponential back-off (`Notification:ConsumerMaxAttempts` = 4, base delay 1 s) and finally `BasicNack(requeue:false)` -> broker dead-letters to `<queue>.dlq`. The consumer reconnects (5 s loop) if the broker is not up yet; the connection uses automatic recovery.

## 6. Architecture Details
Enrollment publishes only through its outbox (`11`). Course publishes `LowCourseAvailability` directly after commit (best effort). Notification is the only consumer. Delivery is **at-least-once**; duplicates are neutralised by the inbox (`12`).

## 7. Dependencies
`RabbitMQ.Client 6.8.1`; RabbitMQ 3.13 (Docker `sms-dn-rabbitmq`).

## 8. Configuration Changes
`RabbitMq:HostName|Port|UserName|Password|VirtualHost` (env `RabbitMq__HostName` ...), `Notification:ConsumerMaxAttempts|ConsumerRetryDelayMs`.

## 9. Database Changes
None here (inbox/outbox tables: `11`, `12`).

## 10. API Changes
None.

## 11. Communication Changes
As the topology table. Management UI: `http://localhost:15672`.

## 12. Execution Instructions
`docker compose up -d rabbitmq`; inspect: `docker exec sms-dn-rabbitmq rabbitmqctl list_queues name messages consumers`. Poison-message demo: publish `{not json` to `sms.events` with routing key `enrollment.confirmed` -> 3 retry warnings, then 1 message in `notification.enrollment-events.dlq` (performed during development and covered by an integration test).

## 13. Testing
Integration (real RabbitMQ): publish -> consume -> notification; duplicate delivery; poison message -> DLQ while good messages continue; topology exists; outbox publish yields persistent messages with the right routing key/message id.

## 14. Pending Items
No automatic DLQ replay tooling (inspect/shovel manually). Retry is in-process (blocks one consumer channel during the back-off) rather than a delay-queue.
