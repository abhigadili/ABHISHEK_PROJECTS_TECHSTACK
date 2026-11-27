# 4. Kafka - producers, consumers, topics and event flows

Broker: Apache Kafka (KRaft, single node) from `docker/docker-compose.yml`, host port **19092**.

## Topics
All 13 topics are declared in `common/.../events/Topics.java` and created at start-up by `KafkaCommonConfig` (`KafkaAdmin.NewTopics`, 3 partitions, replication 1). Every topic has a dead-letter topic `<topic>.DLT`. Messages are keyed by the aggregate id (so one appointment/bill/... is always processed in order) and carry JSON.

| Topic | Event (record in `common/.../events`) | Producer | Consumers (consumer group) |
|---|---|---|---|
| `hospital.patient.registered` | `PatientRegisteredEvent` | Patient | Notification, Medical Records |
| `hospital.appointment.booked` | `AppointmentBookedEvent` | Appointment | Notification, Billing |
| `hospital.appointment.cancelled` | `AppointmentCancelledEvent` | Appointment | Notification, Billing |
| `hospital.appointment.rescheduled` | `AppointmentRescheduledEvent` | Appointment | Notification |
| `hospital.appointment.completed` | `AppointmentCompletedEvent` | Appointment | Medical Records |
| `hospital.lab.test-requested` | `LabTestRequestedEvent` | Laboratory | Laboratory (queue step), Billing |
| `hospital.lab.report-generated` | `LabReportGeneratedEvent` | Laboratory | Notification, Medical Records |
| `hospital.prescription.created` | `PrescriptionCreatedEvent` | Prescription | Pharmacy, Notification, Medical Records |
| `hospital.billing.generated` | `BillingGeneratedEvent` | Billing | Notification, Appointment |
| `hospital.payment.completed` | `PaymentCompletedEvent` | Billing | Notification, Appointment |
| `hospital.payment.failed` | `PaymentFailedEvent` | Billing | Notification, Appointment |
| `hospital.medicine.dispensed` | `MedicineDispensedEvent` | Pharmacy | Prescription, Billing, Notification |
| `hospital.notification.requested` | `NotificationRequestedEvent` | Appointment, Billing, Pharmacy (schedulers) | Notification |

The consumer group id is the service name (e.g. `billing-service`), so each service sees every event once.

## Event contracts
Every event is a Java `record` implementing `DomainEvent { eventId(); occurredAt(); }`. Example:
```json
{ "eventId": "5f0b2c1e-...", "occurredAt": "2026-11-11T12:11:40.215Z", "appointmentId": 7, "patientId": 1, "patientName": "Asha Rao",
  "patientEmail": "asha@mail.com", "doctorId": 1, "doctorName": "Dr. Ravi Kumar", "doctorEmail": "ravi@hospital.local",
  "date": "2026-11-16", "startTime": "09:30:00", "endTime": "10:00:00", "fee": 800.00 }
```
Events carry the data consumers need (name, e-mail, fee ...) - *event-carried state transfer* - so consumers never have to call the producer back.

## Producing: transactional outbox (`EventPublisher`, `OutboxRelay`)
```
@Transactional business method
   ├─ save entity
   └─ eventPublisher.publish(topic, key, event)   -> INSERT into outbox_events   (same DB transaction)
after commit  ->  kafka.send(...) ; on success outbox row gets sent_at
OutboxRelay (@Scheduled, every 10 s) -> re-sends rows with sent_at IS NULL older than 15 s   (broker down / crash)
```
Guarantees: the business change and the event are atomic (no "saved but never announced"); delivery is at-least-once. Producer settings: `acks=all`, `enable.idempotence=true`, bounded `max.block.ms` so HTTP requests never hang on a dead broker. Table `outbox_events` exists in every database.

## Consuming: idempotency and error handling
Each listener is a one-liner delegating to `IdempotentEventProcessor.handle(payload, EventType.class, "<group>:<name>", handler)`:
1. deserialises the JSON (malformed => `IllegalArgumentException`, *not retried*, straight to the DLT);
2. checks `processed_events` for `(eventId, consumer)` - a duplicate delivery is logged ("Duplicate event ... ignored") and skipped;
3. runs the handler and inserts the `processed_events` row **in the same transaction** - a failing handler rolls both back so the retry processes it cleanly.

Handlers are additionally idempotent by data model: unique `(referenceType, referenceId)` on bills, unique `prescriptionId` on pharmacy orders, unique `(entryType, referenceType, referenceId)` on timeline entries, accession number assigned only when empty.

Retry/DLT (`KafkaCommonConfig`): `DefaultErrorHandler` with exponential back-off (0.5 s x2, max ~5 s) then `DeadLetterPublishingRecoverer` -> `<topic>.DLT`. Ack mode `RECORD`, auto-commit off, `auto-offset-reset=earliest`.

### Verified (live)
* A processed `PatientRegistered` payload re-published by hand -> notification count unchanged, log `Duplicate event ... ignored by notification-service:patient-registered`.
* A non-JSON message on `hospital.payment.completed` -> both consumer groups logged `Giving up ... -> dead-letter` and the message appeared on `hospital.payment.completed.DLT`.
* After the full end-to-end run all consumer groups had **lag 0**.

## Background processing summary
| Where | Kafka consumers | Spring `@Scheduled` jobs (all intervals configurable) |
|---|---|---|
| Appointment | payment/billing status sync | `reminder.fixed-delay-ms`, `reminder.lead-hours` - upcoming appointment reminders; `missed.fixed-delay-ms` - mark unattended appointments MISSED |
| Billing | appointment/lab/medicine -> bills, cancellation compensation | `pending-payments.fixed-delay-ms` - time out PENDING payments (`pending-payment-timeout-minutes`); `overdue.fixed-delay-ms` - OVERDUE + reminders (`reminder-interval-hours`) |
| Laboratory | lab queue (accession numbers) | - |
| Pharmacy | prescription -> order | `low-stock.fixed-delay-ms`, `alert-interval-hours` - low-stock alerts |
| Prescription | dispensed -> status | `expiry.fixed-delay-ms` - expire prescriptions |
| Medical Records | timeline building | - |
| Notification | all events -> notifications | - |
| every producer | - | `hospital.outbox.relay-delay-ms` - outbox relay |

## Event flow diagrams

```
Patient registration         Patient ──PatientRegistered──► Notification (welcome)  +  Medical Records (empty file)

Appointment booked           Appointment ──AppointmentBooked──► Notification (patient+doctor)
                                                          └────► Billing ──BillingGenerated──► Notification, Appointment (billNumber, PENDING)
Appointment cancelled        Appointment ──AppointmentCancelled──► Notification, Billing (cancels unpaid bill = compensating action)

Lab                          Laboratory ──LabTestRequested──► Laboratory (queue), Billing (lab bill)
                             Laboratory ──LabReportGenerated──► Notification, Medical Records

Prescription                 Prescription ──PrescriptionCreated──► Pharmacy (order), Notification, Medical Records
                             Pharmacy ──MedicineDispensed──► Prescription (DISPENSED), Billing (medicine bill), Notification

Payment                      Billing ──PaymentCompleted/Failed──► Notification, Appointment (paymentStatus)
```
There are **no distributed transactions**: every service commits locally, and cross-service consistency is reached through these events and compensations (cancelled appointment -> cancelled bill; paid-then-cancelled -> "REFUND REQUIRED" note).

## Inspecting Kafka locally
```bash
K="docker run --rm -i --network host apache/kafka:latest /opt/kafka/bin"
$K/kafka-topics.sh --bootstrap-server localhost:19092 --list
$K/kafka-console-consumer.sh --bootstrap-server localhost:19092 --topic hospital.appointment.booked --from-beginning --timeout-ms 5000
$K/kafka-consumer-groups.sh --bootstrap-server localhost:19092 --describe --all-groups
```
