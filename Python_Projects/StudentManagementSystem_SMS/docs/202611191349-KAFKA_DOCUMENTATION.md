# Kafka Documentation

Client library: **aiokafka 0.15** (asyncio-native, maintained). Broker: Apache Kafka in **KRaft mode** (no ZooKeeper) — `apache/kafka:latest`, single node for development.

Code: `libs/sms_common/src/sms_common/{events.py, outbox.py, kafka.py}` plus each service's `consumers.py` and `main.py`.

## 1. Topics

Created by `scripts/create_topics.py` (local) or the `kafka-init` job in Compose; the broker also auto-creates on demand. Partitions: 3 for event topics (parallelism per key), 1 for DLQs.

| Topic | Message key | Producers | Event types |
|---|---|---|---|
| `sms.auth.events` | user id | auth-service | `UserRegistered`, `TokenRevoked` |
| `sms.student.events` | student id | student-service | `StudentCreated`, `StudentUpdated`, `StudentDeleted` |
| `sms.course.events` | course id | course-service | `CourseCreated`, `CourseUpdated` |
| `sms.enrollment.events` | course id | enrollment-service | `StudentEnrolled`, `EnrollmentCancelled` |
| `sms.notification.requests` | user id | auth-service | `NotificationRequested` |
| `sms.<…>.dlq` (×5) | original key | any consumer | the original message, plus `dlq_*` headers |

Keys keep all events of one entity in one partition, so a consumer sees them in order (e.g. all enrollments of a course).

## 2. Event envelope (every message value)

```json
{
  "event_id": "efc45911-56f2-4dd9-a988-5aa11b57708e",
  "event_type": "NotificationRequested",
  "occurred_at": "2026-11-19T07:48:08.716994Z",
  "source": "auth-service",
  "correlation_id": "7063b1a5a4c74e86a62800f1e553cc2b",
  "version": 1,
  "payload": { "template": "user_registered", "to_email": "stu1@example.com", "to_name": "Stu One",
               "variables": {"name": "Stu One", "email": "stu1@example.com"} }
}
```

(That is a real message read back from the topic with `kafka-console-consumer`.) Kafka record headers repeat `event_id` and `event_type` for tooling. `correlation_id` is the HTTP correlation id of the request that caused the event, so one id follows a journey from the gateway through Kafka into the consumer's logs.

### Payloads (`sms_common/events.py`, Pydantic models — the shared contract)

| Event | Payload fields |
|---|---|
| `UserRegistered` | `user_id, email, full_name, roles[]` |
| `TokenRevoked` | `jti, exp` (unix seconds; consumers forget it after `exp`) |
| `StudentCreated/Updated/Deleted` | `student_id, student_number, user_id?, first_name, last_name, email, status, department_code?` |
| `CourseCreated/Updated` | `course_id, code, title, credits, status, capacity, category?` |
| `StudentEnrolled` / `EnrollmentCancelled` | `enrollment_id, student_id, student_user_id?, student_name, student_email, course_id, course_code, course_title, status, reason?, actor_user_id?` |
| `NotificationRequested` | `template, to_email, to_name?, variables{}` |

Producers build payloads from these models; consumers validate with `Model.model_validate(event.payload)`. A payload that fails validation raises inside the handler → retried → dead-lettered.

> `password_reset` notifications carry the reset link inside `variables`. Inside a private cluster this is acceptable for the demo; in production restrict topic ACLs/encrypt, or carry only a token id and let the Notification service fetch the link. The Notification service scrubs `variables` from its database once the e-mail is sent.

## 3. Producers

`EventProducer` (`sms_common/kafka.py`) wraps `AIOKafkaProducer`:

* `acks="all"`, `enable_idempotence=True` (no duplicates from producer retries), `linger_ms=5`;
* JSON `value` (the envelope), key = aggregate id, headers `event_id` / `event_type`;
* async context manager (`async with EventProducer(...) as p:`) and lazy (re)start — if Kafka is down at boot the service still starts; the relay keeps retrying with exponential back-off (cap 10 s).

Services never call the producer from request handlers. They write an **outbox row** (`enqueue_event(session, OutboxEvent, topic=…, event_type=…, payload=…, key=…)`) inside the business transaction; the `OutboxRelay` task publishes it (see ARCHITECTURE §5). Outbox rows: `PENDING → SENT`, with `attempts`, `last_error`, `sent_at`; `SENT` rows are purged after 24 h.

## 4. Consumers

`EventConsumer` (`sms_common/kafka.py`): manual offset commit (`enable_auto_commit=False`), `auto_offset_reset="earliest"`, auto-reconnect with back-off, one handler per `event_type`, unknown types ignored (so topics can grow new event types safely).

| Service | Group id | Topics | Handlers (`consumers.py`) |
|---|---|---|---|
| course-service | `course-service` | `sms.enrollment.events` | `StudentEnrolled` → `enrolled_count + 1`; `EnrollmentCancelled` → `− 1` (floor 0) |
| student-service | `student-service` | `sms.enrollment.events` | same for `enrolled_courses_count` |
| enrollment-service | `enrollment-service` | `sms.student.events`, `sms.course.events` | `StudentUpdated`/`CourseUpdated` → refresh snapshots (bulk UPDATE); `StudentDeleted` → cancel the student's active enrollments + emit `EnrollmentCancelled` for each |
| notification-service | `notification-service` | `sms.notification.requests`, `sms.student.events`, `sms.enrollment.events` | `NotificationRequested`, `StudentCreated`, `StudentEnrolled`, `EnrollmentCancelled` → insert a `notifications` row (sending is done later by the dispatcher) |
| api-gateway | `gateway-<host>-<rand>` | `sms.auth.events` | `TokenRevoked` → in-memory revocation cache (own consumer loop in `revocations.py`; **unique group per instance** so every instance gets every event) |

### Per-message processing algorithm

```
parse envelope ──invalid JSON / schema──▶ DLQ immediately (attempts=0)
no handler for event_type ───────────────▶ ignore, commit
for attempt in 1..max_attempts (3):
    BEGIN
      INSERT processed_events(event_id, group)  ── duplicate key? ─▶ ROLLBACK, "duplicate", skip  (idempotent)
      handler(session, envelope)                ── raises? ──▶ ROLLBACK (ledger row too), sleep backoff·2^(n-1), retry
    COMMIT                                       ── ledger + business change are atomic
    commit Kafka offset
after max_attempts ──▶ publish original bytes to <topic>.dlq with error headers, then commit offset (partition keeps flowing)
```

Why this is correct:

* **At-least-once → effectively-once:** the ledger row and the business change commit together; a crash before commit repeats the work, a crash after commit makes the redelivery a no-op.
* **Offsets are committed after the DB commit**, never before.
* A poison message never blocks the partition: after bounded retries it is parked in the DLQ.
* `correlation_id` from the envelope is placed in the logging context while the handler runs, so consumer log lines carry the originating request's id.

Settings: `KAFKA_CONSUMER_MAX_ATTEMPTS` (3), `KAFKA_CONSUMER_RETRY_BACKOFF` (0.5 s → 0.5, 1.0 s between attempts).

## 5. Retry and DLQ

| Layer | Behaviour |
|---|---|
| Producer | idempotent, `acks=all`; relay retries the *whole publish* until the broker accepts (outbox row stays `PENDING`, `attempts`/`last_error` updated) |
| Consumer, transient error | in-process retry with exponential back-off, up to 3 attempts, then DLQ |
| Consumer, poison message | straight to DLQ |
| Notification delivery | separate, longer retry cycle on the DB row (e-mail, not Kafka) — see EMAIL_CONFIGURATION.md |

DLQ record = original value + headers:

| Header | Meaning |
|---|---|
| `dlq_reason` | exception class and message (≤ 500 chars) |
| `dlq_source_topic`, `dlq_source_partition`, `dlq_source_offset` | where it came from |
| `dlq_consumer_group` | which group gave up |
| `dlq_attempts` | attempts made (`0` for malformed messages) |

**Verified live** (e2e step 5): an event with an unknown e-mail template was retried 3× and arrived in `sms.notification.requests.dlq` with `dlq_attempts=3` and a reason mentioning the template; a malformed-JSON record on `sms.student.events` arrived in `sms.student.events.dlq` with `dlq_attempts=0`; services stayed healthy.

Replaying a DLQ message after fixing the cause: consume it from `<topic>.dlq` and produce its value back to the source topic (the idempotency ledger lets the same `event_id` through only if the earlier attempts rolled back — which they did).

## 6. Operating it

```bash
# list topics
docker exec sms-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
# watch an event topic
docker exec sms-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
   --topic sms.enrollment.events --from-beginning --property print.headers=true
# DLQ with headers
docker exec sms-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
   --topic sms.notification.requests.dlq --from-beginning --property print.headers=true
# consumer group lag
docker exec sms-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --all-groups
```

(For the Compose stack the container is `sms-kafka-1` and the in-network bootstrap address is `kafka:29092`; from the host use `localhost:9094`.) Kafka UI is available with `docker compose --profile tools up -d` at `http://localhost:8090`.

Readiness (`/health/ready`) of each service reports the outbox backlog (`outbox_pending`), whether the relay task is running and whether its consumer is connected.

## 7. Listener configuration (the usual Kafka pitfall)

| Where the client runs | Bootstrap address | Advertised listener it must match |
|---|---|---|
| Host process (local run) | `localhost:9092` (`scripts/kafka_up.sh`) | `PLAINTEXT://localhost:9092` |
| Container in Compose | `kafka:29092` | `INTERNAL://kafka:29092` |
| Host tooling against Compose | `localhost:9094` | `EXTERNAL://localhost:9094` |

Clients first connect to the bootstrap address, then reconnect to whatever address the broker **advertises** — a mismatch shows up as connect timeouts after a successful bootstrap. Compose therefore defines two listeners.
