# 8. Pino logging and background processing

# Part A - Pino logging (`shared/logging`)

* **Structured JSON** logs from **pino** + **pino-http**; every line has `level`, `time` (ISO), `service`, `correlationId` and the event fields:
```json
{"level":"info","time":"2026-11-11T13:46:15.306Z","service":"billing-service","correlationId":"4dc3a6417851473d","count":1,"msg":"Pending-payment job: payment(s) timed out"}
```
* **Levels:** `info`, `warn`, `error`, `fatal` (plus `debug`; default `LOG_LEVEL=info`). 4xx responses log at warn, 5xx and handler exceptions at error, start-up failures (database/Redis/Kafka/port) at **fatal** (the process then exits).
* **Console + rolling file**: `pino.multistream` → stdout and **pino-roll** (`logs/<service>.<n>.log`, rotated daily or at 20 MB, 7 files kept). Directory via `LOG_DIR`.
* **Correlation identifiers:** pino-http takes `X-Correlation-Id` from the request or generates one, returns it in the response and puts it in an `AsyncLocalStorage` context; the Pino `mixin` adds it to **every** line of that request, and it is forwarded on HTTP calls, gRPC metadata, the gateway proxy, stored in the outbox row and sent as a Kafka header so consumer logs carry the same id (scheduled jobs get a fresh id per run).
* **What is logged:** one line per HTTP request (method, path **without query string**, status, duration), important business operations (patient registered, appointment booked/cancelled, bill generated, payment settled, order dispensed, ...), service-to-service failures (with service, method/path and error code), circuit-breaker state changes, **Kafka PRODUCED** (topic, partition, offset, key, outbox id) and **CONSUMED** (type, eventId, topic, partition, offset), duplicates ignored, handler failures with attempt numbers, dead-letter decisions, cron job results, database/Redis/Kafka status, shutdown steps; exceptions via `logger.error({ err }, ...)` with serialised stack and request path.
* **Never logged:** passwords, JWTs, refresh tokens, payment details or clinical content: request/response bodies and headers are not logged at all; Pino `redact` additionally censors `authorization`, `cookie`, `password`, `passwordHash`, `token`, `accessToken`, `refreshToken` paths if they ever appear in a log object. Verified by grepping all log files for JWT-looking strings and the test passwords (nothing found).
* KafkaJS' own logs are routed through the same logger (namespaced `kafka`).

# Part B - Background processing

## Kafka consumers (see the Kafka document)
Appointment (billing/payment status), Medical Records (timeline), Prescription (dispensed), Laboratory (work queue), Billing (bills + cancellation compensation), Pharmacy (orders), Notification (11 topics). Idempotent through the inbox table, 3 attempts with back-off, then `<topic>.DLT`.

## node-cron jobs (`shared/bootstrap.js` registers them; every schedule is configuration)
| Service | Job | What it does | Config |
|---|---|---|---|
| Appointment | `appointment-reminders` | finds BOOKED appointments starting within the lead window that have no reminder yet, stages `NotificationRequested` for patient and doctor, sets `reminderSent` (same transaction) | `REMINDER_CRON` (default every minute), `REMINDER_LEAD_HOURS` (24) |
| Appointment | `missed-appointments` | BOOKED appointments that ended > 2 h ago → MISSED, slot key freed | `MISSED_CRON` (5 min) |
| Billing | `pending-payments` | PENDING payments older than the timeout → FAILED (publishes PaymentFailed → patient notified) | `PENDING_PAYMENTS_CRON` (1 min), `PAYMENT_TIMEOUT_MINUTES` (30) |
| Billing | `overdue-and-reminders` | PENDING bills past due date → OVERDUE; reminders at most once per interval | `OVERDUE_CRON` (5 min), `BILL_REMINDER_HOURS` (24) |
| Pharmacy | `low-stock-alerts` | one alert per low-stock medicine per interval | `LOW_STOCK_CRON` (10 min), `LOW_STOCK_ALERT_HOURS` (24), `PHARMACY_ALERT_EMAIL` |
| Prescription | `prescription-expiry` | ACTIVE prescriptions past `validUntil` → EXPIRED | `PRESCRIPTION_EXPIRY_CRON` (10 min) |
| Notification | `notification-delivery` | PENDING notifications → SENT (simulated delivery), ≤ 3 attempts then FAILED | `DELIVERY_CRON` (every 5 s, 6-field cron) |
| every publisher | outbox relay | ships committed outbox rows to Kafka | `OUTBOX_INTERVAL_MS` (1000) |

* Jobs never overlap themselves (a busy flag skips a tick), run inside a correlation context, are **idempotent scans of the database** (safe to re-run after a crash) and are stopped on graceful shutdown. `JOBS_DISABLED=true` turns them off.
* BullMQ was evaluated and **not** introduced: no job needs durable delayed execution or a persistent queue - retries are naturally provided by re-scanning state (reminder flags, payment status), and the outbox/inbox cover event delivery.

### Verified (live, schedules overridden to 5 s)
appointment reminders queued (6), pending payment timed out → FAILED + notification, 8 bill reminders, low-stock alert for a medicine pushed under its reorder level - each appearing as a log line and as notifications in `NotificationDB`.
