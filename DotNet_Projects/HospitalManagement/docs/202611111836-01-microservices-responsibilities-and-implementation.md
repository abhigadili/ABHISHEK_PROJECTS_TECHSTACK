# 1. Microservices - responsibilities and implementation

One solution (`HospitalManagement.sln`, .NET 8 LTS - the newest SDK installed here), 12 projects:

| Project | Purpose |
|---|---|
| `src/Shared` (`HMS.Shared`) | Only genuinely reusable infrastructure: JWT validation, JSON error contract, correlation id, Serilog set-up, Kafka outbox/inbox/consumer/relay, Redis cache service, HttpClient + gRPC resilience, peer clients (Patient over gRPC, Doctor over HttpClient), generic repository, scheduler base class, **the compiled `proto/*.proto` contracts**. No business logic. |
| `src/ApiGateway` | YARP reverse proxy - the single external entry point. |
| `src/<Name>Service` x 10 | The business microservices, each its own ASP.NET Core Web API with its own DbContext, EF Core migrations and database. |

Every service has the same shape: `Controllers` (thin, `[Authorize(Roles=...)]`) -> `Services` (business rules, transactions, cache, events) -> `Domain` entities + `Data/<X>DbContext` (EF Core, explicit mappings, indexes) with `Dtos` (DataAnnotations validation) at the boundary - entities are never returned by APIs. `Shared` provides `IRepository<T>` (`EfRepository<T>`) for simple CRUD; services use the DbContext directly for transactions and richer queries. All I/O is `async/await` with `CancellationToken` flowing from the request.

Cross-cutting behaviour (registered by `AddHospitalCore` / `UseHospitalPipeline`):
* **Serilog** - structured console + rolling file `logs/<service>-<date>.log`, `CorrelationId` on every event, request logging (method, path, status, time only - never bodies, headers or tokens).
* **Global exception handling** (`ExceptionHandlingMiddleware`) - uniform JSON `{timestamp,status,error,message,path,details}`; maps business exceptions, EF conflicts, gRPC and Polly circuit-open errors to 404/409/503 etc.
* **Validation** - DataAnnotations (`[Required]`, `[EmailAddress]`, `[RegularExpression]`, `[Range]`, custom `[PastDate]`, `[FutureOrToday]`) with the platform's 400 body listing every field problem.
* **JWT validation** (issuer, audience, signature, lifetime, 30 s skew) with role claims.

## Service overview

| # | Service (REST, DB) | Owns | Calls (sync) | Publishes | Consumes |
|---|---|---|---|---|---|
| 1 | **Patient** (28101 + gRPC 28201, PatientDB) | Patient profiles, uniqueness | - (is a gRPC **server**) | PatientRegistered | - |
| 2 | **Doctor** (28102, DoctorDB) | Doctors, weekly schedules, breaks, days off, slots | Hospital (HttpClient) | - | - |
| 3 | **Appointment** (28103, AppointmentDB) | Appointments, slot uniqueness, availability, reminders | Patient (gRPC), Doctor (HttpClient) | AppointmentBooked / Cancelled / Rescheduled / Completed, NotificationRequested | BillingGenerated, PaymentCompleted, PaymentFailed |
| 4 | **Hospital** (28104, HospitalDB) | Hospitals, departments **and ASP.NET Core Identity / JWT issuing** | - | - | - |
| 5 | **Medical Records** (28105, MedicalRecordsDB) | Clinical file + timeline | Patient (gRPC) | - | PatientRegistered, LabReportGenerated, PrescriptionCreated, AppointmentCompleted |
| 6 | **Prescription** (28106 + gRPC 28206, PrescriptionDB) | Prescriptions, status | Patient (gRPC), Doctor (HttpClient); gRPC **server** for Pharmacy | PrescriptionCreated | MedicineDispensed |
| 7 | **Laboratory** (28107, LaboratoryDB) | Test catalogue, requests, reports | Patient (gRPC), Doctor (HttpClient) | LabTestRequested, LabReportGenerated | LabTestRequested |
| 8 | **Billing** (28108, BillingDB) | Bills, payments, simulated gateway | Patient (gRPC), Appointment (HttpClient) | BillingGenerated, PaymentCompleted, PaymentFailed, NotificationRequested | AppointmentBooked, AppointmentCancelled, LabTestRequested, MedicineDispensed |
| 9 | **Pharmacy** (28109, PharmacyDB) | Inventory, orders, dispensing | Prescription (gRPC) | MedicineDispensed, NotificationRequested | PrescriptionCreated |
| 10 | **Notification** (28110, NotificationDB) | Notification log + delivery worker | - | - | all business events + NotificationRequested |

### Why identity lives in the Hospital Service
The requirements ask for *centralised* authentication and exactly ten services. The Hospital Service owns "who works here" master data, so it also hosts ASP.NET Core Identity (`hdn_users`, `hdn_roles`, ... with PBKDF2 hashing by Identity's `PasswordHasher`), `POST /api/auth/login` and JWT signing. Every other component only **validates** tokens. A dedicated Identity Service would only need to take over `AuthService`/`TokenService`.

## 1. Patient Service
* `Patient` (unique `UserId`, `Email`, `Phone`, `IdentityNumber`). PATIENT callers register exactly one profile bound to their JWT subject; ADMIN may register for someone. Duplicates produce a precise 409 and are enforced again by unique indexes.
* Registration runs in **one transaction**: INSERT patient -> outbox row `PatientRegistered`. The relay publishes after commit.
* **gRPC server** `PatientGrpc.GetSummary/GetByUser` (minimal projection, `[Authorize]`); the same data is available on REST for staff tools.
* Redis: `patient:{id}`, `patient-summary:{id}` (updated/evicted on update/deactivate).

## 2. Doctor Service
* `Doctor`, `DoctorSchedule` (one row per weekday: hours, slot minutes, optional break), `DoctorUnavailability` (day off). Hospital/department validated through the Hospital Service (**HttpClient + Polly**) - a reference is never stored unverified.
* `SlotsAsync` generates the grid (template minus break; empty on days off/inactive doctors) and caches it in Redis with a **per-doctor version key**: every schedule/leave change bumps the version (O(1) invalidation of all that doctor's dates).
* ADMIN manages anything; a DOCTOR only their own schedule (`UserId == sub`).

## 3. Appointment Service
* `Appointment` with unique `SlotKey` (`doctor|date|start`, set only while BOOKED) - the database-level guarantee behind "concurrent requests cannot reserve the same slot". Verified by firing 8 simultaneous bookings of one slot: exactly one 201, seven 409.
* Booking pipeline: patient access check (**gRPC**) -> doctor + live slot grid (**HttpClient**) -> overlap checks (doctor & patient) -> transaction { insert, outbox `AppointmentBooked` } -> evict availability cache after commit.
* Availability = doctor grid minus BOOKED minus elapsed slots, cached 60 s and evicted after every booking change; **booking never trusts the cache**.
* Hosted jobs: `ReminderJob` (upcoming appointments -> `NotificationRequested`), `MissedAppointmentsJob`. Consumers keep `PaymentStatus` in sync with billing events.

## 4. Hospital Service (master data + identity)
* `Hospital`, `Department` (FK inside HospitalDB), ASP.NET Core Identity tables. Seeds the six roles, one user per role (`admin`, `doctor1`, `doctor2`, `labstaff1`, `pharmacist1`, `billing1`) and hospital `CGH` with six departments on first start.
* Redis: `hospital:{id}` (write-through on update), `hospital-departments:{id}`.

## 5. Medical Records Service
* `PatientRecord` (created from `PatientRegistered`), `RecordEntry` timeline (DIAGNOSIS, VISIT, LAB_REPORT, PRESCRIPTION, ALLERGY, NOTE; MANUAL or EVENT). Event entries are idempotent through the unique `(EntryType, ReferenceType, ReferenceId)`; system entries cannot be edited. ADMIN/DOCTOR full access, PATIENT only their own (gRPC ownership check).

## 6. Prescription Service
* `Prescription` + `PrescriptionItem`; statuses ACTIVE -> DISPENSED / CANCELLED / EXPIRED. A DOCTOR can only prescribe in their own name. `PrescriptionCreated` carries the items so Pharmacy needs no call to open its order.
* **gRPC server** `PrescriptionGrpc.GetStatus` for the Pharmacy; consumes `MedicineDispensed`; hosted `PrescriptionExpiryJob`.

## 7. Laboratory Service
* `LabTest` catalogue (seeded CBC, LIPID, HBA1C, TSH, UA, LFT), `LabRequest`, `LabReport`. State machine REQUESTED -> SAMPLE_COLLECTED -> IN_PROGRESS -> COMPLETED (only by submitting the report); CANCELLED from the first two.
* Publishes `LabTestRequested` and also **consumes** it (background step assigning the accession number); Billing consumes it for the lab bill. `LabReportGenerated` -> Notification + Medical Records.

## 8. Billing Service
* `Bill`/`BillItem`/`Payment`. Unique `(ReferenceType, ReferenceId)` => one bill per appointment/lab request/pharmacy order (idempotent event processing). Unique `Payment.ActiveBillId` (set only while PENDING) => at most one in-flight payment per bill even under concurrency.
* Simulated payment gateway - only the *method* is stored, never card data. Compensation: `AppointmentCancelled` cancels an unpaid appointment bill (a paid one gets a REFUND REQUIRED note).
* Hosted jobs: time out stale PENDING payments; mark bills OVERDUE and send reminders.

## 9. Pharmacy Service
* `Medicine`, `PharmacyOrder`/`PharmacyOrderItem` (one order per prescription). Dispensing: prescription verified over **gRPC**, then one transaction that locks the stock rows (`SELECT ... FOR UPDATE`, in id order), verifies every line, decrements stock and stages `MedicineDispensed` - all or nothing. Hosted `LowStockJob`.

## 10. Notification Service
* `Notification` (PENDING -> SENT/FAILED). Kafka handlers queue notifications; the hosted `NotificationDeliveryJob` (PeriodicTimer) delivers them (simulated e-mail/SMS: log line + stored record) with retries. 11 topics consumed.
* NotificationDB pre-existed with other applications' tables; this project's tables there are prefixed `hdn_` and nothing else is touched.

## API Gateway (YARP)
Routes, clusters and policies come from `appsettings.json`; JWT is validated at the edge, coarse role policies per route family, JSON 401/403/404/503/504. Internal paths are simply not routed. See the authentication document.
