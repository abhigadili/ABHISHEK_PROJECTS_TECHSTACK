# 8. The six business scenarios, end to end

Every step below was exercised through the gateway by `scripts/e2e.py` (136 checks, all passing). Calls shown as `curl` use `$GW=http://localhost:18080` and a token in `$T` (see the authentication document).

---
## Scenario 1 - Patient registration

**Actors:** a new patient (or ADMIN on their behalf). **Services:** Hospital (account), Patient, Kafka, Notification, Medical Records.

1. `POST /api/auth/register` creates the login (role PATIENT) -> `POST /api/auth/login` -> token.
2. `POST /api/patients` with the profile. `PatientService.register`:
   * Bean Validation (e-mail format, phone `+?[0-9]{7,15}`, date of birth in the past, blood group pattern) -> **400** with field details;
   * duplicate prevention: same login (one profile per `userId`), e-mail (case-insensitive), phone, identity number -> **409** with a message naming the field; unique indexes catch races;
   * insert into PatientDB and, in the **same transaction**, an `outbox_events` row.
3. After commit the outbox publishes **PatientRegistered** (`hospital.patient.registered`).
4. **Notification Service** consumes it -> a "Welcome" notification (simulated e-mail log + `hms_notifications` row). **Medical Records Service** consumes it -> creates the patient's clinical file.
5. Retrieval/update: `GET/PUT /api/patients/{id}` - the owner or staff only; the Redis entry is refreshed (`@CachePut`) and the summary entry evicted.

Verified: duplicate registration -> 409; second profile for the same login -> 409; another patient reading the profile -> 403; exactly one welcome notification even when the event is replayed.

---
## Scenario 2 - Doctor appointment booking
**Services:** Doctor, Appointment, Patient, Billing, Notification (+ Redis, Kafka).

1. Discover: `GET /api/doctors/specializations`, `GET /api/doctors/available?date=2026-11-16&specialization=Cardiology` (only doctors who work that weekday and are not on leave, with slot counts), `GET /api/doctors/{id}` (details, fee).
2. Check: `GET /api/appointments/availability?doctorId=1&date=2026-11-16` -> slots with `available` true/false.
3. Book: `POST /api/appointments`. The Appointment Service: verifies patient access (**Feign** -> Patient), reads doctor + slot grid (**WebClient** -> Doctor), rejects past times, times not on the grid, break times, doctor-on-leave; checks overlap for the doctor **and** the patient; inserts with the unique `slot_key`; evicts the availability cache after commit; writes **AppointmentBooked** to the outbox.
4. Asynchronously: Notification sends the confirmation to patient **and** doctor; Billing creates the consultation bill from the event (fee 800.00) and publishes BillingGenerated; Appointment stores `billNumber` + `paymentStatus=PENDING`.
5. Reschedule: `PUT /api/appointments/{id}/reschedule` - same validation, old slot freed, new slot taken, `AppointmentRescheduled` -> notifications.
6. Cancel: `PUT /api/appointments/{id}/cancel` - `slot_key` set to NULL (slot bookable again), `AppointmentCancelled` -> notifications, and Billing **cancels the still-unpaid bill** (compensating action).
7. Reminders: the `AppointmentJobs` scheduler publishes `NotificationRequested` for BOOKED appointments inside the lead window (`hospital.scheduler.reminder.lead-hours`) once (`reminder_sent`).

Verified: double booking -> 409; break/off-grid/past -> 400; another patient's id -> 403/404; reschedule moves the slot; cancelled slot re-bookable; bill auto-created and later cancelled; reminders sent when the lead window covers the appointment.

---
## Scenario 3 - Availability management
**Services:** Doctor (+ Redis), Appointment.

* `PUT /api/doctors/{id}/schedule` (ADMIN or the doctor): per weekday `startTime`, `endTime`, `slotMinutes`, optional `breakStart/breakEnd`; validations (start < end, break inside hours, no duplicate day, at least one slot) -> 400.
* `POST /api/doctors/{id}/unavailability` marks a full day off; `DELETE` removes it.
* `GET /api/doctors/{id}/slots?date=` generates the grid (09:00-13:00, 30 min, break 11:00-11:30 -> 7 slots) and caches it (`doctorSlots`); every schedule/leave change evicts it.
* Booking availability = grid minus BOOKED appointments minus elapsed slots (`appointmentAvailability`, 60 s TTL, evicted after commit on book/cancel/reschedule).
* Overlap prevention: service-level interval check + unique slot key.

Verified: grid honours the break; leave day -> empty grid and booking 400; removing the leave restores the grid; non-working day -> doctor absent from "available".

---
## Scenario 4 - Lab test requests and reports
**Services:** Laboratory, Billing, Medical Records, Notification.

1. `GET /api/lab/tests` (catalogue with prices).
2. A doctor `POST /api/lab/requests` (test code, priority, clinical notes). The doctor must be the caller's own profile; patient verified through Feign, doctor through WebClient. Stored `REQUESTED`; **LabTestRequested** published.
3. Kafka consumers: the **Laboratory Service itself** queues the request (assigns accession number `LAB-yyyymmdd-nnnnnn`) and **Billing** raises the lab bill (350.00 for CBC).
4. Lab staff move the request: `SAMPLE_COLLECTED` -> `IN_PROGRESS` (invalid jumps -> 409).
5. `POST /api/lab/requests/{id}/report` (only from `IN_PROGRESS`) stores the report, marks the request `COMPLETED` and publishes **LabReportGenerated**.
6. Consumers: Notification tells the patient; Medical Records adds a `LAB_REPORT` timeline entry (flagged ABNORMAL when applicable).
7. `GET /api/lab/requests/{id}/report` - authorised doctors/staff, or the patient who owns it (others 403).

---
## Scenario 5 - Prescription generation
**Services:** Prescription, Pharmacy, Billing, Medical Records, Notification.

1. Doctor `POST /api/prescriptions` (diagnosis, items with medicine, dosage, frequency, duration, quantity, instructions; validity defaults to 30 days). Stored `ACTIVE`; **PrescriptionCreated** published with the items.
2. **Pharmacy** consumes it -> opens one `PENDING` order, matching each line to inventory by name/generic name.
3. Pharmacist `POST /api/pharmacy/orders/{id}/dispense`: prescription must be `ACTIVE` (Feign call to Prescription Service), every line must exist with enough stock (rows locked) - otherwise **409 and nothing changes**; then stock is decremented and **MedicineDispensed** published (e.g. 15 x 2.50 + 5 x 1.50 = 45.00).
4. **Prescription Service** consumes it -> status `DISPENSED` (`GET /api/prescriptions/{id}/status`); **Billing** creates the medicine bill; **Notification** informs the patient; Medical Records already has the `PRESCRIPTION` entry from step 1's event.
5. The `expiry` scheduler turns overdue `ACTIVE` prescriptions into `EXPIRED`; a doctor can `cancel` an ACTIVE one.

---
## Scenario 6 - Billing and payments
**Services:** Billing, Notification, Appointment.

* **Bill generation:** automatically from events (appointment booked -> consultation bill, lab test requested -> lab bill, medicine dispensed -> medicine bill with a line per medicine) or manually by billing staff (`POST /api/bills`, APPOINTMENT bills verified against the Appointment Service through WebClient). One bill per business object (unique reference). Each creation publishes **BillingGenerated**.
* **Payment initiation:** `POST /api/bills/{id}/payments {method}` -> a `Payment` with a unique `TXN-...` reference and status **PENDING**; only one pending payment per bill. The simulated gateway can settle immediately (`simulateOutcome` SUCCESS/FAILURE) or leave it for confirmation.
* **Status update:** `PUT /api/payments/{ref}/status` (billing staff/admin) -> **SUCCESS** (bill `PAID`, **PaymentCompleted** published) or **FAILED** (**PaymentFailed**, bill stays payable for a retry). Settled payments are immutable (409).
* **Notify the patient:** Notification consumes both payment events. Appointment consumes them to update `paymentStatus` (PAID/FAILED).
* **Housekeeping jobs:** stale PENDING payments time out to FAILED; bills past `dueDate` become `OVERDUE`; reminders every `reminder-interval-hours`.
* Only the method and reference are stored - never card data.

Verified: failed payment -> FAILED + notification; retry -> PENDING; second concurrent payment -> 409; patient cannot confirm a payment (403) nor see another patient's bill (403); SUCCESS -> bill PAID, notification, appointment `paymentStatus=PAID`.

---
## Cross-scenario sequence (one patient journey)
```
register account ─► register patient ─► [PatientRegistered]
book appointment ─► [AppointmentBooked] ─► bill ─► [BillingGenerated] ─► pay ─► [PaymentCompleted]
doctor requests CBC ─► [LabTestRequested] ─► lab bill ; staff process ─► report ─► [LabReportGenerated] ─► timeline
doctor prescribes ─► [PrescriptionCreated] ─► pharmacy order ─► dispense ─► [MedicineDispensed] ─► prescription DISPENSED + medicine bill
every arrow in [] is a Kafka event consumed idempotently; every box commits in its own local transaction
```
