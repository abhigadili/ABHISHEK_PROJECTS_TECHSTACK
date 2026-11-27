# 4. Kafka - producers, consumers, topics and event flows

Broker: Apache Kafka (KRaft, single node) from `docker-compose.yml`, host port **29092**. Client library: Confluent.Kafka 2.3.

## Topics
All 13 topics are declared in `Shared/Messaging/Events.cs` (`Topics`) and created at start-up by `KafkaTopicInitializer` (3 partitions, replication 1, idempotent). Each has a dead-letter topic `<topic>.DLT` (26 topics in total). Messages are keyed by the aggregate id (ordering per appointment/bill/...) and carry JSON.

| Topic | Event (record in `Events.cs`) | Producer | Consumers (group = service name) |
|---|---|---|---|
| `hospital.patient.registered` | `PatientRegistered` | Patient | Notification, Medical Records |
| `hospital.appointment.booked` | `AppointmentBooked` | Appointment | Notification, Billing |
| `hospital.appointment.cancelled` | `AppointmentCancelled` | Appointment | Notification, Billing |
| `hospital.appointment.rescheduled` | `AppointmentRescheduled` | Appointment | Notification |
| `hospital.appointment.completed` | `AppointmentCompleted` | Appointment | Medical Records |
| `hospital.lab.test-requested` | `LabTestRequested` | Laboratory | Laboratory (queue step), Billing |
| `hospital.lab.report-generated` | `LabReportGenerated` | Laboratory | Notification, Medical Records |
| `hospital.prescription.created` | `PrescriptionCreated` | Prescription | Pharmacy, Notification, Medical Records |
| `hospital.billing.generated` | `BillingGenerated` | Billing | Notification, Appointment |
| `hospital.payment.completed` | `PaymentCompleted` | Billing | Notification, Appointment |
| `hospital.payment.failed` | `PaymentFailed` | Billing | Notification, Appointment |
| `hospital.medicine.dispensed` | `MedicineDispensed` | Pharmacy | Prescription, Billing, Notification |
| `hospital.notification.requested` | `NotificationRequested` | Appointment, Billing, Pharmacy (schedulers) | Notification |

## Event contracts
Strongly typed C# `record`s deriving from `IntegrationEvent { Guid EventId; DateTimeOffset OccurredAt }`. Events carry what consumers need (names, e-mails, fee ...) - *event-carried state transfer* - so consumers never call the producer back.
```json
{ "eventId": "46a690df-...", "occurredAt": "2026-11-11T13:02:11Z", "appointmentId": 7, "patientId": 1, "patientName": "Asha Rao", "patientEmail": "asha@mail.com",
  "doctorId": 1, "doctorName": "Dr. Ravi Kumar", "doctorEmail": "ravi@hospital.local", "date": "2026-11-16", "startTime": "09:30:00", "endTime": "10:00:00", "fee": 800.00 }
```

## Producing: transactional outbox (`EventPublisher`, `OutboxRelayService`)
```
service method:  await db.InTransactionAsync(async () => {
                     db.Add(entity); await db.SaveChangesAsync();             // generated id available
                     events.Publish(topic, key, evt);                         // stages a row in hdn_outbox_messages
                     await db.SaveChangesAsync(); });                         // ONE DB transaction commits both
OutboxRelayService (BackgroundService + PeriodicTimer, every Kafka:OutboxPollIntervalMs = 1 s):
     reads unsent rows in id order -> ProduceAsync (acks=all, idempotent producer) -> sets SentAt
     broker down: row stays unsent, retried next tick (ordering kept: the batch stops at the first failure)
```
This satisfies **"never publish before the transaction commits"** and never loses an event (at-least-once). Correlation id is stored in the row and sent as a Kafka header. The outbox table exists in every database of a publishing service.

## Consuming: idempotency, retries, dead letters (`KafkaConsumerService`)
One hosted consumer per service (consumer group = service name, manual commit, `AutoOffsetReset=Earliest`). Handlers derive from `KafkaEventHandler<TEvent>` and are registered with `AddScoped<IEventHandler, ...>`; the consumer subscribes to the union of their topics. Per message:
1. deserialize (malformed JSON = **poison**: straight to the DLT, no retries);
2. open a DB transaction; if `(EventId, "<group>:<Handler>")` is already in `hdn_inbox_messages` -> log *Duplicate event ... ignored* and skip;
3. run the handler (it shares the DbContext/transaction), insert the inbox row, commit - so effect and idempotency record are atomic;
4. on failure retry with exponential back-off (`Kafka:MaxProcessingAttempts` = 3, `RetryBaseDelayMs` = 500); after the last attempt publish the record to `<topic>.DLT` (with an `error` header) and commit the offset so the partition keeps moving.

Handlers are additionally idempotent by data model: unique `(ReferenceType, ReferenceId)` on bills, unique `PrescriptionId` on pharmacy orders, unique `(EntryType, ReferenceType, ReferenceId)` on timeline entries, accession number assigned only when empty.

### Verified (live)
* A processed `PatientRegistered` payload re-published by hand -> notification count unchanged, log `Duplicate event ... ignored`.
* A non-JSON message on `hospital.payment.completed` -> logged `Giving up ... -> dead-letter topic` and found on `hospital.payment.completed.DLT`.
* An early handler bug (nested transaction) showed the retry path for real: 3 attempts with back-off, then the record on the DLT, while the rest of the stream kept flowing.
* After the full end-to-end run all consumer groups had **lag 0**.

## Background processing summary
| Service | Kafka consumers | Hosted schedulers (`PeriodicJob` = BackgroundService + PeriodicTimer; all intervals configurable) |
|---|---|---|
| Appointment | billing/payment status sync | `ReminderJob` (`Scheduler:ReminderIntervalSeconds`, `ReminderLeadHours`) - upcoming appointments; `MissedAppointmentsJob` |
| Billing | appointment/lab/medicine -> bills, cancellation compensation | `StalePaymentsJob` (`PendingPaymentsIntervalSeconds`, `Billing:PendingPaymentTimeoutMinutes`); `OverdueAndReminderJob` (`OverdueIntervalSeconds`, `Billing:ReminderIntervalHours`) |
| Laboratory | lab queue (accession numbers) | - |
| Pharmacy | prescription -> order | `LowStockJob` (`LowStockIntervalSeconds`, `Pharmacy:AlertIntervalHours`) |
| Prescription | dispensed -> status | `PrescriptionExpiryJob` (`ExpiryIntervalSeconds`) |
| Medical Records | timeline building | - |
| Notification | all events -> notifications | `NotificationDeliveryJob` (`Delivery:IntervalSeconds`, `MaxAttempts`) - notification delivery |
| every publisher | - | `OutboxRelayService` (`Kafka:OutboxPollIntervalMs`) |

Common settings: `Scheduler:InitialDelaySeconds` (first run), environment override style `Scheduler__ReminderLeadHours=48`.

## Event flow diagrams
```
Patient registration   Patient ──PatientRegistered──► Notification (welcome) + Medical Records (clinical file)
Appointment booked     Appointment ──AppointmentBooked──► Notification (patient+doctor) + Billing ──BillingGenerated──► Notification, Appointment (billNumber, PENDING)
Appointment cancelled  Appointment ──AppointmentCancelled──► Notification, Billing (cancels the unpaid bill = compensating action)
Lab                    Laboratory ──LabTestRequested──► Laboratory (queue), Billing (lab bill) ; ──LabReportGenerated──► Notification, Medical Records
Prescription           Prescription ──PrescriptionCreated──► Pharmacy (order), Notification, Medical Records
                       Pharmacy ──MedicineDispensed──► Prescription (DISPENSED), Billing (medicine bill), Notification
Payment                Billing ──PaymentCompleted/Failed──► Notification, Appointment (paymentStatus)
Schedulers             Appointment/Billing/Pharmacy ──NotificationRequested──► Notification
```
There are **no distributed transactions**: every service commits locally, and cross-service consistency is reached through these events and compensations.

## Inspecting Kafka locally
```bash
K="docker run --rm -i --network host apache/kafka:latest /opt/kafka/bin"
$K/kafka-topics.sh --bootstrap-server localhost:29092 --list
$K/kafka-console-consumer.sh --bootstrap-server localhost:29092 --topic hospital.appointment.booked --from-beginning --timeout-ms 5000
$K/kafka-consumer-groups.sh --bootstrap-server localhost:29092 --describe --all-groups
```
