# 1. Microservices - responsibilities and implementation

The system is one Maven reactor (`HospitalManagement/pom.xml`) with three kinds of module:

| Module | Purpose |
|---|---|
| `common` (`hospital-common`) | Small library of genuinely cross-cutting code: JWT resource-server security, JSON error handling, event contracts, Kafka outbox/idempotency, Redis cache configuration, Feign/WebClient helpers, Log4j2 config, Resilience4j defaults. It contains **no business logic** and no service owns another service's data through it. |
| `gateway` | Spring Cloud Gateway - the only entry point. |
| `services/*` | The ten business microservices, each an independently executable Spring Boot jar with its own database. |

Every service follows the same layering: `web` (REST controllers, `@PreAuthorize`) -> `service` (business rules, `@Transactional`, cache annotations, event publishing) -> `domain` (JPA entities + Spring Data repositories) with `dto` classes (request/response, Bean Validation) at the boundary. Controllers never contain business logic. Exceptions are mapped by one `GlobalExceptionHandler` (from `common`) to a uniform JSON body:

```json
{ "timestamp": "2026-11-11T12:11:13Z", "status": 409, "error": "Conflict", "message": "License number 'LIC-1' is already registered", "path": "/api/doctors", "details": null }
```

Logging uses **Log4j2** (`spring-boot-starter-log4j2`; Logback is excluded globally through a managed exclusion in the parent POM). The shared `log4j2-spring.xml` writes to the console and to `logs/<service>.log` (rolling, 20 MB / daily, 7 files).

## Service overview

| # | Service (port, DB) | Owns | Calls (sync) | Publishes | Consumes |
|---|---|---|---|---|---|
| 1 | **Patient** (18101, PatientDB) | Patient profiles, uniqueness of email/phone/identity number | - | PatientRegistered | - |
| 2 | **Doctor** (18102, DoctorDB) | Doctors, weekly schedules, breaks, days off, slot generation | Hospital (OpenFeign) | - | - |
| 3 | **Appointment** (18103, AppointmentDB) | Appointments, double-booking prevention, availability view, reminders | Patient (OpenFeign), Doctor (WebClient) | AppointmentBooked / Cancelled / Rescheduled / Completed, NotificationRequested | BillingGenerated, PaymentCompleted, PaymentFailed |
| 4 | **Hospital** (18104, HospitalDB) | Hospitals, departments **and the user/identity store that issues JWTs** | - | - | - |
| 5 | **Medical Records** (18105, MedicalRecordsDB) | Patient clinical file and timeline | Patient (OpenFeign) | - | PatientRegistered, LabReportGenerated, PrescriptionCreated, AppointmentCompleted |
| 6 | **Prescription** (18106, PrescriptionDB) | Prescriptions + status tracking | Patient (OpenFeign), Doctor (WebClient) | PrescriptionCreated | MedicineDispensed |
| 7 | **Laboratory** (18107, LaboratoryDB) | Test catalogue, test requests, reports | Patient (OpenFeign), Doctor (WebClient) | LabTestRequested, LabReportGenerated | LabTestRequested |
| 8 | **Billing** (18108, BillingDB) | Bills, payments, simulated gateway | Patient (OpenFeign), Appointment (WebClient) | BillingGenerated, PaymentCompleted, PaymentFailed, NotificationRequested | AppointmentBooked, AppointmentCancelled, LabTestRequested, MedicineDispensed |
| 9 | **Pharmacy** (18109, PharmacyDB) | Medicine inventory, pharmacy orders, dispensing | Prescription (OpenFeign) | MedicineDispensed, NotificationRequested | PrescriptionCreated |
| 10 | **Notification** (18110, NotificationDB) | Notification log, simulated e-mail/SMS delivery | - | - | all business events + NotificationRequested |

### Why identity lives in the Hospital Service
The requirements ask for *centralised* authentication and for exactly ten services. The Hospital Service owns "who works here" master data, so it also owns login accounts (`users` table), `POST /api/auth/login` and JWT signing. Every other component only **validates** tokens. A future dedicated Identity Service would only need to take over that one package.

## 1. Patient Service
* **Entities:** `Patient` (unique: `userId`, `email`, `phone`, `identityNumber`; `@Version`).
* **Rules:** a PATIENT login can create exactly one profile (bound to the JWT user id); ADMIN may register on behalf of someone. Duplicates are checked in the service (clear 409 message) and enforced again by the unique indexes. A patient may read/update only their own profile; staff roles may search all.
* **Cross-service projection:** `GET /api/patients/{id}/summary` and `/by-user/{userId}` return a minimal `PatientSummary` (no clinical data) - this is what other services fetch via OpenFeign.
* **Events:** `PatientRegistered` is written to the outbox in the same transaction as the insert.
* **Cache:** `patients`, `patientSummaries` (Redis) - updated/evicted on update/deactivate.

## 2. Doctor Service
* **Entities:** `Doctor`, `DoctorSchedule` (one row per working weekday: hours, slot length, optional break), `DoctorUnavailability` (full day off).
* **Slot generation** (`SlotService`): from the weekly template for the date's weekday, minus the break, empty on days off or for inactive doctors; cached in Redis (`doctorSlots`, key `doctorId:date`) and evicted whenever a schedule or day off changes.
* **Validation:** hospital/department are checked through the **Hospital Service via OpenFeign + circuit breaker** before a doctor is stored (no cross-database FK).
* **Authorization:** ADMIN manages everything; a DOCTOR may change only their own schedule (`doctor.userId == JWT uid`).

## 3. Appointment Service
* **Entity:** `Appointment` with snapshots of patient/doctor name and e-mail (so notifications need no lookup), `paymentStatus`, `reminderSent`, `@Version`, and the unique `slotKey` (`doctor|date|start`, set only while BOOKED).
* **Booking pipeline:** access check via Patient Service (Feign) -> doctor check + live slot grid via Doctor Service (WebClient) -> overlap checks (doctor and patient) -> insert (unique slot key is the last line of defence) -> evict availability cache after commit -> publish `AppointmentBooked`.
* **Availability:** `GET /api/appointments/availability` = doctor's slot grid minus booked and elapsed slots, cached 60 s (`appointmentAvailability`), evicted *after commit* by `CacheEvictor` on every book/cancel/reschedule.
* **Jobs:** `AppointmentJobs.sendReminders` (configurable lead time/interval) and `markMissed`.
* **Consumers:** keep `paymentStatus`/`billNumber` in sync with billing events.

## 4. Hospital Service (master data + identity)
* **Entities:** `Hospital`, `Department` (FK inside HospitalDB), `UserAccount` (BCrypt hash, role, enabled).
* **Auth:** `/api/auth/login`, public `/api/auth/register` (always creates a PATIENT account), `/api/auth/me`; ADMIN-only `/api/users` to create staff accounts of any role and enable/disable accounts.
* **Seed (first start):** admin + one account per staff role (`doctor1`, `doctor2`, `labstaff1`, `pharmacist1`, `billing1`) and the hospital `CGH` with six departments.
* **Cache:** `hospitals`, `hospitalDepartments`.

## 5. Medical Records Service
* **Entities:** `PatientRecord` (header, created from `PatientRegistered`), `RecordEntry` (timeline; types DIAGNOSIS, VISIT, LAB_REPORT, PRESCRIPTION, ALLERGY, NOTE; `source` MANUAL or EVENT).
* **Event-built timeline:** lab reports, prescriptions and completed appointments add entries automatically; the unique `(entryType, referenceType, referenceId)` makes it idempotent. System entries cannot be edited.
* **Access:** ADMIN/DOCTOR full access; PATIENT only their own record (ownership resolved through the Patient Service).

## 6. Prescription Service
* **Entities:** `Prescription` (+ `PrescriptionItem`: medicine, dosage, frequency, duration, quantity, instructions), statuses ACTIVE -> DISPENSED / CANCELLED / EXPIRED.
* **Rules:** a DOCTOR can issue prescriptions only in their own name (doctor profile `userId` must equal the caller); patient must be ACTIVE.
* **Event:** `PrescriptionCreated` carries the items so the Pharmacy never needs a synchronous call to create its order.
* **Jobs/consumers:** consumes `MedicineDispensed` -> DISPENSED; scheduled job expires prescriptions past `validUntil`.

## 7. Laboratory Service
* **Entities:** `LabTest` (catalogue with price, seeded with CBC, LIPID, HBA1C, TSH, UA, LFT), `LabRequest`, `LabReport`.
* **State machine:** REQUESTED -> SAMPLE_COLLECTED -> IN_PROGRESS -> COMPLETED (only by submitting the report); CANCELLED from the first two states.
* **Kafka:** the service publishes `LabTestRequested` and also *consumes* it (background step that assigns the accession number / queue time); Billing consumes the same event to raise the lab bill. `LabReportGenerated` feeds Medical Records and Notification.

## 8. Billing Service
* **Entities:** `Bill` (+ `BillItem`), `Payment` (transaction reference, method, status). Unique `(referenceType, referenceId)` => at most one bill per appointment / lab request / pharmacy order, which also makes event processing idempotent.
* **Payments:** a simulated gateway (`PaymentGatewaySimulator`); only the *method* is stored - never card numbers. `simulateOutcome` SUCCESS/FAILURE settles instantly, otherwise the payment stays PENDING until confirmed by staff (`PUT /api/payments/{ref}/status`) or timed out by the scheduler.
* **Compensation:** `AppointmentCancelled` cancels an unpaid appointment bill; for an already paid bill a REFUND REQUIRED note is recorded.
* **Jobs:** fail stale PENDING payments; mark bills OVERDUE; send payment reminders at a configurable interval.

## 9. Pharmacy Service
* **Entities:** `Medicine` (stock, price, reorder level, optimistic version), `PharmacyOrder` (+ items, one per prescription), seeded with six common medicines.
* **Flow:** `PrescriptionCreated` -> PENDING order with each line matched to inventory by name/generic name -> pharmacist dispenses: prescription verified through **OpenFeign** (must be ACTIVE), all lines checked first (stock rows locked with `PESSIMISTIC_WRITE`), then stock decremented atomically -> `MedicineDispensed`.
* **Job:** low-stock alert (`NotificationRequested`) once per configured interval.

## 10. Notification Service
* **Entity:** `Notification` (channel, subject, message, event type, reference id, status). Delivery is simulated (log line + stored record); replacing `NotificationService.deliver()` plugs in a real provider.
* **Consumers:** 11 topics -> patient/doctor messages. `GET /api/notifications/my` lets any user read messages addressed to their e-mail.
* **Table prefix:** `NotificationDB` already existed on the server with tables of other applications, so every table of this project in it is prefixed `hms_` (`HmsTablePrefixNamingStrategy`).

## API Gateway
Routes the ten services by path, validates the JWT once (Spring Security WebFlux resource server), applies coarse role rules, returns JSON 401/403/404/503/504, and blocks `/internal/**`, `/ping`, `/actuator/**`. Details in [authentication doc](./202611111749-06-authentication-and-authorization.md).
