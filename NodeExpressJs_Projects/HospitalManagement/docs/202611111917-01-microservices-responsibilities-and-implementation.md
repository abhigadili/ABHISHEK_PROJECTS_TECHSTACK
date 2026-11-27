# 1. Microservices - responsibilities and implementation

One npm-workspaces monorepo (Node.js 20, JavaScript ES Modules throughout, **Express 5**). Every service has its **own `package.json`**, its own Prisma schema, own database and own entry point (`npm start` inside the folder); the workspace only hoists `node_modules` so `npm install` runs once.

| Folder | Purpose |
|---|---|
| `shared/` (`@hms/shared`) | Infrastructure only - no business logic: `config` (env, URLs, ports), `logging` (Pino + correlation context), `utils` (errors, Passport/jose auth, Zod validation, Redis cache, HTTP client with Opossum), `kafka` (outbox, relay, idempotent consumer), `grpc` (loader, server, client), `contracts` (Zod event schemas), `constants`, `clients` (patient/doctor directories), `docs` (OpenAPI), `bootstrap` (start-up + graceful shutdown). |
| `proto/` | `patient.proto`, `doctor.proto`, `hospital.proto` - gRPC contracts. |
| `api-gateway/` | Express + http-proxy-middleware, route table in `config/routes.json`. |
| `services/<name>-service/` | The ten business services: `src/{index,routes,service,schemas}.js`, `prisma/schema.prisma` (+ migrations), generated client in `generated/`. |

## Common structure of a service
```
src/schemas.js   Zod request schemas (DTOs / validation)
src/routes.js    routes + thin controllers: ONE declaration per endpoint = path + roles + Zod schemas + OpenAPI description + handler
src/service.js   business logic (transactions, caching, events, peer calls) - no Express objects
src/index.js     wiring: startService({ service, dbName, ports, build }) -> routes, gRPC services, Kafka handlers, cron jobs
prisma/          schema.prisma, migrations/<ts>_init/migration.sql
```
`startService` (shared/bootstrap.js) does for every service, in this order: config → Pino logger → Prisma connect + `SELECT 1` (**database connectivity verified, fatal otherwise**) → Redis (fail-open) → Kafka topics, outbox relay, consumer → gRPC server → Express (helmet, pino-http, correlation context, JSON, Passport, routes, `/openapi.json`, 404, central error handler) → node-cron jobs → signal handlers. **Graceful shutdown** (SIGINT/SIGTERM) closes cron tasks, the HTTP server (idle connections first), outbox relay, Kafka consumer, gRPC server, Redis and Prisma, with a 15 s safety timeout.

Error handling (`shared/utils/errors.js`): one JSON contract `{timestamp,status,error,message,path,details}` - Zod → 400 with per-field details, `AppError` subclasses → their status, Prisma `P2002` → 409, `P2025` → 404, open circuit → 503, malformed JSON → 400, everything else → 500 (logged with context).

## Service overview
| # | Service (REST / gRPC, DB) | Owns | Calls (sync) | Publishes | Consumes |
|---|---|---|---|---|---|
| 1 | **Patient** (30101 / 30201, PatientDB) | Patient profiles, uniqueness | gRPC **server** | PatientRegistered | - |
| 2 | **Doctor** (30102 / 30202, DoctorDB) | Doctors, schedules, breaks, days off, slots | Hospital (gRPC); gRPC **server** | - | - |
| 3 | **Appointment** (30103, AppointmentDB) | Appointments, slot uniqueness, availability, reminders | Patient (gRPC), Doctor (gRPC profile + HTTP slots) | AppointmentBooked/Cancelled/Rescheduled/Completed, NotificationRequested | BillingGenerated, PaymentCompleted, PaymentFailed |
| 4 | **Hospital** (30104 / 30204, HospitalDB) | Hospitals, departments **and identity** (users, bcrypt, JWT + refresh tokens) | gRPC **server** | - | - |
| 5 | **Medical Records** (30105, MedicalRecordsDB) | Clinical file + timeline | Patient (gRPC) | - | PatientRegistered, LabReportGenerated, PrescriptionCreated, AppointmentCompleted |
| 6 | **Prescription** (30106, PrescriptionDB) | Prescriptions, status | Patient (gRPC), Doctor (gRPC) | PrescriptionCreated | MedicineDispensed |
| 7 | **Laboratory** (30107, LaboratoryDB) | Test catalogue, requests, reports, **attachments (Multer)** | Patient (gRPC), Doctor (gRPC) | LabTestRequested, LabReportGenerated | LabTestRequested |
| 8 | **Billing** (30108, BillingDB) | Bills, payments, simulated gateway | Patient (gRPC), Appointment (HTTP) | BillingGenerated, PaymentCompleted, PaymentFailed, NotificationRequested | AppointmentBooked, AppointmentCancelled, LabTestRequested, MedicineDispensed |
| 9 | **Pharmacy** (30109, PharmacyDB) | Inventory, orders, dispensing | Prescription (HTTP) | MedicineDispensed, NotificationRequested | PrescriptionCreated |
| 10 | **Notification** (30110, NotificationDB) | Notification log + delivery worker | - | - | all business events + NotificationRequested |

### Why identity lives in the Hospital Service
The requirements ask for centralised authentication and exactly ten services. The Hospital Service owns "who works here" master data, so it also owns users, password hashes (bcrypt), `POST /api/auth/login|refresh|logout` and JWT signing. Every other component only **validates** tokens.

## 1. Patient Service
`Patient` with unique `userId`, `email`, `phone`, `identityNumber`. A PATIENT login registers exactly one profile bound to the JWT subject; ADMIN may register for someone. Registration = **one Prisma transaction**: insert + outbox row `PatientRegistered`. gRPC `PatientService.GetSummary/GetByUser` returns the minimal projection (no clinical data). Redis: `patient:{id}`, `summary:{id}`.

## 2. Doctor Service
`Doctor`, `DoctorSchedule` (per weekday: hours, slot minutes, optional break), `DoctorUnavailability`. Hospital/department validated through the **Hospital gRPC service** (never stored unverified). Slot grid generated from the template minus the break, cached in Redis with a **per-doctor version key** (schedule/leave change = one `SET`, every cached date becomes unreachable). A doctor manages only their own schedule.

## 3. Appointment Service
`Appointment` with the unique `slotKey` (`doctor|date|start`, set only while BOOKED, NULL otherwise) - the database guarantee behind "concurrent requests cannot reserve the same slot". Booking: patient access (gRPC) → doctor (gRPC) → live slot grid (**HTTP + Opossum**) → overlap checks (doctor, patient) → `$transaction{ insert, outbox }` → evict availability cache after commit. Availability = grid minus BOOKED minus elapsed, cached 60 s; **booking never reads that cache**. cron jobs: reminders, missed appointments.

## 4. Hospital Service
`Hospital`, `Department`, `User`, `RefreshToken`. Seeds the six roles' users and hospital `CGH` with six departments on first start. Hospital/department reads are cached; gRPC `GetHospital/GetDepartment`.

## 5. Medical Records Service
`PatientRecord`, `RecordEntry` timeline (DIAGNOSIS, VISIT, LAB_REPORT, PRESCRIPTION, ALLERGY, NOTE; MANUAL or EVENT). Event entries are idempotent through unique `(entryType, referenceType, referenceId)`; system entries cannot be edited. PATIENTs read only their own record.

## 6. Prescription Service
`Prescription` + `PrescriptionItem`; ACTIVE → DISPENSED / CANCELLED / EXPIRED. A DOCTOR prescribes only in their own name. The event carries the items, so Pharmacy needs no call to open its order. cron job expires overdue prescriptions.

## 7. Laboratory Service
`LabTest` (seeded catalogue), `LabRequest`, `LabReport` (+ attachment metadata). State machine REQUESTED → SAMPLE_COLLECTED → IN_PROGRESS → COMPLETED (only via the report); CANCELLED from the first two. Publishes `LabTestRequested` **and consumes it** (queue step assigning the accession number); Billing consumes it for the lab bill. **Multer** stores report attachments (PDF/PNG/JPEG, ≤ 5 MB) under random names in `uploads/lab/`, only metadata in MySQL.

## 8. Billing Service
`Bill`/`BillItem`/`Payment`. Unique `(referenceType, referenceId)` → one bill per appointment/lab request/pharmacy order (idempotent events). Unique `Payment.activeBillId` (set only while PENDING) → at most one in-flight payment per bill under concurrency. Simulated gateway: only the **method** is accepted/stored, never card data. Compensation: `AppointmentCancelled` cancels an unpaid appointment bill (a paid one gets a REFUND REQUIRED note). cron jobs: time out stale payments, mark OVERDUE, remind.

## 9. Pharmacy Service
`Medicine`, `PharmacyOrder`/`PharmacyOrderItem` (one order per prescription). Dispensing: prescription verified over **HTTP (fetch + Opossum, no fallback)**, then one transaction that locks the stock rows (`SELECT … FOR UPDATE`, id order), verifies every line, decrements stock and stages `MedicineDispensed` - all or nothing. cron low-stock alerts.

## 10. Notification Service
`Notification` (PENDING → SENT/FAILED). Kafka handlers queue; a **cron delivery worker** sends (simulated e-mail/SMS: log line + stored record) with up to 3 attempts. 11 topics consumed.

## API Gateway
Edge JWT validation (Passport + jose), route role rules, per-route rate limits, helmet, CORS, correlation ids, timeouts, JSON 401/403/404/429/503/504, aggregated Swagger UI. Details in the authentication document.

## Package choices (one library per concern)
express 5 · http-proxy-middleware · `@prisma/client`/prisma 6 · kafkajs · redis (node-redis) · opossum · pino, pino-http, pino-roll · passport + passport-custom + **jose** (JWT) · bcrypt · zod 4 (validation + OpenAPI schemas) · node-cron · `@grpc/grpc-js` + `@grpc/proto-loader` · swagger-ui-express · multer · helmet, cors, express-rate-limit · dotenv. Native `fetch` is used for HTTP (no Axios: no interceptor need). No BullMQ: no job needs durable delayed queues - cron jobs are idempotent scans of the database.
