# 4. Kafka - producers, consumers, topics and event flows

Broker: Apache Kafka (KRaft, single node, `docker-compose.yml`), host port **39092**. Client: **KafkaJS** (its logs are routed through Pino).

## Topics
13 topics declared in `shared/constants` (`TOPICS`), created at start-up by `ensureTopics` (3 partitions, replication 1, idempotent), each with a dead-letter topic `<topic>.DLT` (**26 topics**). Messages are keyed by the aggregate id (ordering per appointment/bill/...).

| Topic | Event | Producer | Consumers (group = service name) |
|---|---|---|---|
| `hospital.patient.registered` | PatientRegistered | Patient | Notification, Medical Records |
| `hospital.appointment.booked` | AppointmentBooked | Appointment | Notification, Billing |
| `hospital.appointment.cancelled` | AppointmentCancelled | Appointment | Notification, Billing |
| `hospital.appointment.rescheduled` | AppointmentRescheduled | Appointment | Notification |
| `hospital.appointment.completed` | AppointmentCompleted | Appointment | Medical Records |
| `hospital.lab.test-requested` | LabTestRequested | Laboratory | Laboratory (queue step), Billing |
| `hospital.lab.report-generated` | LabReportGenerated | Laboratory | Notification, Medical Records |
| `hospital.prescription.created` | PrescriptionCreated | Prescription | Pharmacy, Notification, Medical Records |
| `hospital.billing.generated` | BillingGenerated | Billing | Notification, Appointment |
| `hospital.payment.completed` | PaymentCompleted | Billing | Notification, Appointment |
| `hospital.payment.failed` | PaymentFailed | Billing | Notification, Appointment |
| `hospital.medicine.dispensed` | MedicineDispensed | Pharmacy | Prescription, Billing, Notification |
| `hospital.notification.requested` | NotificationRequested | Appointment, Billing, Pharmacy (cron jobs) | Notification |

## Event contracts (`shared/contracts/events.js`)
Zod schemas, **independent of any database entity**; the wire format is an envelope:
```json
{ "eventId": "5f0b2c1e-...", "type": "AppointmentBooked", "occurredAt": "2026-11-11T13:40:11.215Z", "correlationId": "4dc3a6417851473d",
  "payload": { "appointmentId": 7, "patientId": 1, "patientName": "Asha Rao", "patientEmail": "asha@mail.com", "doctorId": 1, "doctorName": "Dr. Ravi Kumar",
               "doctorEmail": "ravi@hospital.local", "date": "2026-11-16", "startTime": "09:30", "endTime": "10:00", "fee": 800 } }
```
Producers build events with `buildEvent()` (payload validated - an invalid event cannot be created), consumers re-validate with `parseEvent()`. Events carry what consumers need (names, e-mails, fee ...) so consumers never call the producer back.

## Producing: transactional OUTBOX (`shared/kafka`)
```js
await prisma.$transaction(async (tx) => {
  const created = await tx.appointment.create({ ... });
  await stageEvent(tx, 'AppointmentBooked', created.id, { ... });     // INSERT into hjs_outbox_events - same transaction
});                                                                    // commit: business row + event row, or neither
```
`startOutboxRelay` polls unsent rows every second (`OUTBOX_INTERVAL_MS`) in id order, `producer.send` (idempotent producer, `acks=-1`), sets `sentAt`, logs *Kafka PRODUCED event* with topic/partition/offset; on a broker failure the batch stops (keeps ordering), the row stays unsent and is retried. **No event is ever published before its transaction commits, and none is lost** (at-least-once; consumers de-duplicate). The correlation id is stored in the row and sent as a header.

## Consuming: inbox idempotency, retries, dead letters (`startConsumer`)
One consumer group per service (`groupId = service name`), `fromBeginning`, KafkaJS auto-commit after the handler returns. Per message:
1. `parseEvent` - malformed or contract-violating messages are **poison**: straight to `<topic>.DLT`, no retries;
2. `prisma.$transaction`: if `(eventId, "<group>:<topic>")` exists in `hjs_processed_events` → log *Duplicate event ignored*, skip; otherwise run the handler **with the transaction client** and insert the inbox row - the effect and the idempotency record commit atomically;
3. on failure retry with exponential back-off (`KAFKA_MAX_ATTEMPTS` = 3, `KAFKA_RETRY_BASE_MS` = 500); after the last attempt publish the original record to `<topic>.DLT` (header `error`) and move on so the partition never blocks.
Handlers are idempotent by data model as well (unique `(referenceType, referenceId)` on bills, unique `prescriptionId` on pharmacy orders, unique `(entryType, referenceType, referenceId)` on timeline entries, accession number only when empty).

### Verified (live)
* a processed `PatientRegistered` payload re-published by hand → notification count unchanged, log `Duplicate event ignored`;
* a non-JSON message on `hospital.payment.completed` → both consumer groups logged *Giving up … dead-letter* and the message is on `hospital.payment.completed.DLT`;
* after the full end-to-end run every consumer group had **lag 0**.

## Background processing
| Service | Kafka consumers | node-cron jobs (schedule from environment, defaults in `shared/config`) |
|---|---|---|
| Appointment | billing/payment status sync | `REMINDER_CRON` + `REMINDER_LEAD_HOURS` (upcoming appointments → reminders); `MISSED_CRON` |
| Billing | appointment/lab/medicine → bills, cancellation compensation | `PENDING_PAYMENTS_CRON` + `PAYMENT_TIMEOUT_MINUTES`; `OVERDUE_CRON` + `BILL_REMINDER_HOURS` |
| Laboratory | lab queue (accession numbers) | - |
| Pharmacy | prescription → order | `LOW_STOCK_CRON` + `LOW_STOCK_ALERT_HOURS` |
| Prescription | dispensed → status | `PRESCRIPTION_EXPIRY_CRON` |
| Medical Records | timeline building | - |
| Notification | all events → notifications | `DELIVERY_CRON` (6-field, seconds) - notification delivery worker |
| every publisher | - | outbox relay (`OUTBOX_INTERVAL_MS`) |

## Event flow
```
Patient ─PatientRegistered──────────► Notification, Medical Records
Appointment ─AppointmentBooked──────► Notification, Billing ─BillingGenerated─► Notification, Appointment
Appointment ─AppointmentCancelled───► Notification, Billing (cancels the unpaid bill = compensating action)
Laboratory ─LabTestRequested────────► Laboratory (queue), Billing ; ─LabReportGenerated─► Notification, Medical Records
Prescription ─PrescriptionCreated───► Pharmacy, Notification, Medical Records
Pharmacy ─MedicineDispensed─────────► Prescription, Billing, Notification
Billing ─PaymentCompleted/Failed────► Notification, Appointment ; cron jobs ─NotificationRequested─► Notification
```
No distributed transactions: every service commits locally; consistency across services comes from events and compensating actions.

```bash
K="docker run --rm -i --network host apache/kafka:latest /opt/kafka/bin"
$K/kafka-topics.sh --bootstrap-server localhost:39092 --list
$K/kafka-console-consumer.sh --bootstrap-server localhost:39092 --topic hospital.appointment.booked --from-beginning --timeout-ms 5000
$K/kafka-consumer-groups.sh --bootstrap-server localhost:39092 --describe --all-groups
```
