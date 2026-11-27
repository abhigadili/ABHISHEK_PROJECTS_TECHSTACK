# HospitalManagement - Hospital / Healthcare Management System (Node.js + Express 5 microservices)

A working **Node.js 20 / Express 5 (JavaScript, ES Modules)** microservices system: API gateway (Express + http-proxy-middleware), 10 independently executable services, MySQL (one database per service, **Prisma ORM** + migrations), Apache Kafka (KafkaJS), Redis (node-redis), **Opossum** circuit breakers, **Pino** logging, **Passport.js + jose JWT** with rotating refresh tokens, **fetch HTTP and gRPC** for synchronous calls, node-cron jobs, Zod validation, Swagger/OpenAPI, Multer uploads.
It implements six end-to-end healthcare workflows and was verified live: **146 end-to-end checks pass through the gateway** (`scripts/e2e.py`), including 8 simultaneous bookings of one slot (exactly one wins).

## Contents
1. [Architecture](#1-architecture-and-microservice-responsibilities) · 2. [Stack & packages](#2-technology-stack-and-package-choices) · 3. [Folders](#3-project-folder-structure) · 4. [Databases](#4-databases-and-initialisation) · 5. [Kafka](#5-kafka-topics-and-event-flow) · 6. [HTTP & gRPC](#6-http-and-grpc-communication) · 7. [Gateway](#7-api-gateway-routing) · 8. [Auth](#8-authentication-and-authorization) · 9. [Redis](#9-redis-caching) · 10. [Opossum](#10-opossum-circuit-breakers) · 11. [Pino](#11-pino-logging) · 12. [Background jobs](#12-background-processing-and-scheduled-jobs) · 13. [Ports](#13-port-allocation) · 14. [Run it](#14-starting-the-application) · 15. [API & samples](#15-api-endpoints-and-sample-payloads) · 16. [Workflows](#16-end-to-end-business-workflows) · 17. [Docs](#17-detailed-documentation)

## 1. Architecture and microservice responsibilities
```
                       ┌───────────────────────────────┐
   client ─HTTP/JWT──► │  API Gateway  :30080          │  Passport+jose JWT, route roles, rate limit, correlation id, JSON errors, Swagger
                       └───────────────┬───────────────┘
   ┌────────┬─────────┬──────────┬──────┴───┬───────────┬───────────┬─────────┬──────────┬──────────┐
 Hospital  Patient   Doctor   Appointment  Medical   Prescription Laboratory Billing  Pharmacy  Notification
 +Identity :30101    :30102     :30103     Records     :30106      :30107     :30108   :30109     :30110
  :30104   gRPC30201 gRPC30202             :30105
  gRPC30204
 HospitalDB PatientDB DoctorDB AppointmentDB MedicalRecordsDB PrescriptionDB LaboratoryDB BillingDB PharmacyDB NotificationDB
   sync: gRPC (patient, doctor, hospital) + HTTP/fetch (slots, appointment, prescription status), all behind Opossum   ◄─►   async: Kafka + outbox/inbox
                      Redis :36379 (cache)                                                                              Kafka :39092
```
| Service | Responsibility |
|---|---|
| **Patient** | profiles, duplicate prevention, ownership, gRPC patient lookup, `PatientRegistered` |
| **Doctor** | doctors, specializations, weekly schedules, breaks, days off, versioned cached slot grids, gRPC doctor lookup |
| **Appointment** | booking / rescheduling / cancelling, concurrency-safe slots, availability, reminders |
| **Hospital** | hospitals, departments **and identity** (users, bcrypt, JWT + refresh tokens), gRPC hospital lookup |
| **Medical Records** | clinical file and timeline (manual + event-built) |
| **Prescription** | prescriptions, items, status tracking, expiry |
| **Laboratory** | test catalogue, requests, status workflow, reports, attachments (Multer) |
| **Billing** | bills from events or staff, payments (simulated gateway), overdue/reminder jobs |
| **Pharmacy** | inventory, orders from prescriptions, row-locked dispensing, low-stock alerts |
| **Notification** | consumes business events, queues and delivers (simulated) e-mail/SMS |

Each service owns its data; `shared/` holds infrastructure only. Cross-service consistency uses events and compensating actions - **no distributed transactions**. Details: [docs/202611111917-01](./docs/202611111917-01-microservices-responsibilities-and-implementation.md).

## 2. Technology stack and package choices
| Requirement | Used (one library per concern) |
|---|---|
| Runtime / framework | Node.js 20 LTS, **Express 5**, JavaScript ES Modules |
| Gateway | Express + **http-proxy-middleware** (no separate gateway product) |
| Sync HTTP | native **fetch** (no Axios needed) in `shared/utils/http-client.js` |
| Sync RPC | **@grpc/grpc-js** + **@grpc/proto-loader**, `proto/*.proto` |
| Async | **Apache Kafka + KafkaJS**, outbox + inbox + DLT |
| ORM / DB | **Prisma 6** + MySQL (existing server), migrations |
| Cache | Redis + **node-redis** |
| Circuit breaker | **Opossum** |
| Logging | **Pino + pino-http** (+ pino-roll for rolling files) |
| Auth | **Passport.js** (passport-custom strategy) + **jose** JWT, **bcrypt** |
| Background | Kafka consumers + **node-cron** (BullMQ evaluated, not needed) |
| Validation / docs | **Zod 4**; **Swagger / OpenAPI** generated from the route declarations (swagger-ui-express) |
| Uploads / security | **Multer**; **Helmet, CORS, express-rate-limit** |
| Config | dotenv / environment variables |

## 3. Project folder structure
```
HospitalManagement/                 (Documents/PROJECTS_TECKSTACK/NodeJS_Projects/HospitalManagement)
├── package.json  (npm workspaces)   README.md  PORT-CONFIGURATION.md  .env.example  docker-compose.yml  .gitignore   (.env = local secrets)
├── api-gateway/    package.json  config/routes.json  src/index.js
├── services/
│   ├── hospital-service/  patient-service/  doctor-service/  appointment-service/  medical-records-service/
│   ├── prescription-service/  laboratory-service/  billing-service/  pharmacy-service/  notification-service/
│   │      each: package.json · src/{index,routes,service,schemas}.js · prisma/{schema.prisma,migrations/}   (+ generated/ client)
├── shared/         config/ constants/ contracts/ kafka/ grpc/ logging/ utils/ clients/ docs/ bootstrap.js
├── proto/          patient.proto  doctor.proto  hospital.proto
├── database/scripts/   00-create-databases.sql + 11..20-<DB>-init.sql (reference copies of the Prisma init migrations)
├── scripts/        create-databases.sh start-all.sh stop-all.sh e2e.py gen-schema-doc.py db-url.mjs common.sh
└── docs/           10 detailed documents
```

## 4. Databases and initialisation
Ten databases on the **existing** MySQL server (port 3306 untouched): **PatientDB, DoctorDB, AppointmentDB, HospitalDB, MedicalRecordsDB, PrescriptionDB, LaboratoryDB, BillingDB, PharmacyDB, NotificationDB** - 39 `hjs_*` tables, no cross-database foreign keys, one Prisma schema per service. Details: [docs/202611111917-05](./docs/202611111917-05-database-schema-and-tables.md).

> **These databases already existed** (created by the Java build, extended by the .NET build; `NotificationDB` also holds other applications' tables). Nothing existing is touched: all tables here are prefixed **`hjs_`**, `CREATE DATABASE IF NOT EXISTS` is used, and Prisma's `_prisma_migrations` is the only other object added.

* Credentials never live in source: `.env` (git-ignored; copy `.env.example`) supplies `MYSQL_HOST/PORT/USER/PASSWORD`; the Prisma URL is assembled at run time (`shared/config`), no default password.
```bash
cp .env.example .env && chmod 600 .env && $EDITOR .env
npm install && npm run prisma:generate
./scripts/create-databases.sh     # CREATE DATABASE IF NOT EXISTS x10 + Prisma init migration per service (baseline-safe, idempotent)
```
Every service verifies its database connection at start-up (`$connect` + `SELECT 1`; fatal if it fails). Configuration examples: `.env.example` (MySQL, Kafka `KAFKA_BROKERS=localhost:39092`, Redis `REDIS_URL=redis://localhost:36379`).

## 5. Kafka topics and event flow
13 topics (+ `<topic>.DLT` = 26): `hospital.patient.registered`, `appointment.booked|cancelled|rescheduled|completed`, `lab.test-requested`, `lab.report-generated`, `prescription.created`, `billing.generated`, `payment.completed`, `payment.failed`, `medicine.dispensed`, `notification.requested` (all prefixed `hospital.`).
```
Patient ─PatientRegistered──────────► Notification, Medical Records
Appointment ─AppointmentBooked──────► Notification, Billing ─BillingGenerated─► Notification, Appointment
Appointment ─AppointmentCancelled───► Notification, Billing (cancels the unpaid bill)
Laboratory ─LabTestRequested────────► Laboratory (queue), Billing ; ─LabReportGenerated─► Notification, Medical Records
Prescription ─PrescriptionCreated───► Pharmacy, Notification, Medical Records
Pharmacy ─MedicineDispensed─────────► Prescription, Billing, Notification
Billing ─PaymentCompleted/Failed────► Notification, Appointment ; cron jobs ─NotificationRequested─► Notification
```
Zod event contracts (independent of DB entities); **transactional outbox** (event row saved in the business `prisma.$transaction`, shipped by a relay after commit); consumers with an **inbox table** (idempotency), 3 attempts with exponential back-off, then the dead-letter topic. See [docs/202611111917-04](./docs/202611111917-04-kafka-producers-consumers-topics-and-event-flows.md).

## 6. HTTP and gRPC communication
| Caller → callee | Technique | Purpose |
|---|---|---|
| Appointment / Records / Prescription / Laboratory / Billing → Patient | **gRPC** (`patient.proto`, :30201) | validate patient, ownership |
| Appointment / Prescription / Laboratory → Doctor | **gRPC** (`doctor.proto`, :30202) | doctor profile |
| Doctor → Hospital | **gRPC** (`hospital.proto`, :30204) | validate hospital + department |
| Appointment → Doctor | **HTTP** (fetch + Opossum) | live slot grid |
| Billing → Appointment | **HTTP** | verify the appointment of a manual bill |
| Pharmacy → Prescription | **HTTP** | prescription must be ACTIVE |

Reusable clients with timeouts/deadlines, JWT + correlation propagation, Opossum breakers and last-known fallbacks where safe. Details and verified failure behaviour: [docs/202611111917-03](./docs/202611111917-03-synchronous-communication-http-and-grpc.md).

## 7. API Gateway routing
Single entry point **http://localhost:30080**; routes and role rules live in `api-gateway/config/routes.json`, destinations come from configuration (`<NAME>_SERVICE_URL`):

| Path | → Service (port) | Rule |
|---|---|---|
| `/api/auth/login|register|refresh|logout` | Hospital (30104) | public (rate-limited) |
| `/api/auth/me`, `/api/hospitals/**`, `/api/departments/**` | Hospital | authenticated |
| `/api/users/**` | Hospital | ADMIN |
| `/api/patients/**` | Patient (30101) | authenticated |
| `/api/doctors/**` | Doctor (30102) | authenticated |
| `/api/appointments/**` | Appointment (30103) | authenticated |
| `/api/records/**` | Medical Records (30105) | authenticated |
| `/api/prescriptions/**` | Prescription (30106) | authenticated |
| `/api/lab/**` | Laboratory (30107) | ADMIN, DOCTOR, LAB_STAFF, PATIENT |
| `/api/bills/**`, `/api/payments/**` | Billing (30108) | ADMIN, BILLING_STAFF, PATIENT |
| `/api/pharmacy/**` | Pharmacy (30109) | ADMIN, PHARMACIST, DOCTOR |
| `/api/notifications/**` | Notification (30110) | authenticated |
| `/docs` | aggregated Swagger UI of all services | public |

Correlation ids (`X-Correlation-Id`), 30 s proxy timeout (`GATEWAY_TIMEOUT_MS`), helmet, CORS, rate limiting; 401/403/404/429/503/504 as JSON. Not routed (never reachable from outside): `/ping`, `/internal/**`, gRPC ports.

## 8. Authentication and authorization
Hospital Service = single identity authority: **bcrypt** passwords, **jose** HS256 access token (15 min; issuer/audience/signature validated), opaque **rotating refresh token** (7 days, SHA-256 stored, reuse detection revokes the family). **Passport.js** (custom `jwt` strategy) authenticates in the gateway and every service; roles **ADMIN, DOCTOR, PATIENT, LAB_STAFF, PHARMACIST, BILLING_STAFF** with route role rules plus ownership checks. Seeded: `admin / Admin@123`, `doctor1|doctor2|labstaff1|pharmacist1|billing1 / Staff@123` (development defaults). Hashes/tokens never appear in responses (beyond login) or logs. Details and matrix: [docs/202611111917-06](./docs/202611111917-06-authentication-and-authorization.md).

## 9. Redis caching
`createCache` (node-redis): doctor details, **doctor availability** (versioned slot grids), hospital details/departments, patient profile + summary, appointment details and **appointment availability**. cache-aside, write-through, eviction after commit, configurable TTLs, **fail-open** when Redis is down. Booking never trusts the cache (live grid + MySQL overlap checks + unique slot key). Details: [docs/202611111917-07](./docs/202611111917-07-redis-caching-and-opossum.md).

## 10. Opossum circuit breakers
Every HTTP client and every gRPC method: timeout = request timeout (+margin), error threshold 50 %, min 5 calls, rolling window 30 s, reset 15 s; 4xx / business gRPC codes are not failures; retries only for GET; state changes logged (`Circuit breaker OPEN/HALF-OPEN/CLOSED`); fallbacks = last-known data where safe, otherwise clean 503.

## 11. Pino logging
JSON lines with `level/time/service/correlationId`; pino-http request logs (path without query); levels info/warn/error/fatal; console + **pino-roll** rolling files in `logs/` (daily or 20 MB, 7 kept); correlation ids across HTTP, gRPC, outbox and Kafka headers; Kafka PRODUCED/CONSUMED and downstream failures logged; passwords, JWTs and bodies never logged (+ `redact`). [docs/202611111917-08](./docs/202611111917-08-pino-logging-and-background-processing.md).

## 12. Background processing and scheduled jobs
Kafka consumers (appointments, lab, prescriptions, billing/payments, notifications) and **node-cron** jobs - appointment reminders, missed appointments, pending-payment timeout, overdue bills + reminders, low-stock alerts, prescription expiry, notification delivery worker - all with configurable cron expressions/lead times (`REMINDER_CRON`, `REMINDER_LEAD_HOURS`, `PAYMENT_TIMEOUT_MINUTES`, ...). Table in the logging/background document.

## 13. Port allocation
Gateway **30080** · services **30101-30110** · gRPC **30201 (patient), 30202 (doctor), 30204 (hospital)** · Kafka **39092** · Redis **36379** · MySQL 3306 (existing). The suggested 38xxx range was free but lies in the kernel's ephemeral port range and actually collided once (`EADDRINUSE` on 38204), so the app ports sit just below it - explained with the verification evidence in [PORT-CONFIGURATION.md](./PORT-CONFIGURATION.md).

## 14. Starting the application
```bash
cd ~/Documents/PROJECTS_TECKSTACK/NodeJS_Projects/HospitalManagement
cp .env.example .env              # fill MYSQL_PASSWORD (already present on this machine)
npm install && npm run prisma:generate
docker compose up -d              # Kafka :39092, Redis :36379
./scripts/create-databases.sh     # databases + tables (idempotent)
./scripts/start-all.sh            # 10 services + gateway
python3 scripts/e2e.py            # optional: 146 checks through the gateway
./scripts/stop-all.sh ; docker compose down
```
**One service alone:** `cd services/patient-service && npm start` (each has its own package.json; commands for all eleven in [docs/202611111917-10](./docs/202611111917-10-port-configuration-and-local-startup.md)). Swagger UI: http://localhost:30080/docs.

## 15. API endpoints and sample payloads
Complete tables (method, path, roles) with request/response samples: [docs/202611111917-02](./docs/202611111917-02-rest-api-reference.md) and the live Swagger UI. Key calls:
```http
POST /api/auth/login        {"username":"admin","password":"Admin@123"}
 → 200 {"accessToken":"eyJ...","refreshToken":"...","tokenType":"Bearer","expiresInSeconds":900,"user":{"id":1,"username":"admin","role":"ADMIN","enabled":true}}
POST /api/auth/refresh      {"refreshToken":"..."}              → 200 new pair (old token is now invalid; re-use → 401 + family revoked)

POST /api/patients          {"firstName":"Asha","lastName":"Rao","dateOfBirth":"1990-05-17","gender":"FEMALE","email":"asha@mail.com","phone":"+919876543210"}
 → 201 {"id":1,"userId":9,"status":"ACTIVE",...}              409 duplicate e-mail/phone/identity · 400 validation (details[])
PUT  /api/doctors/1/schedule {"days":[{"dayOfWeek":"MONDAY","startTime":"09:00","endTime":"13:00","slotMinutes":30,"breakStart":"11:00","breakEnd":"11:30"}]}
GET  /api/appointments/availability?doctorId=1&date=2026-11-16   → [{"startTime":"09:00","endTime":"09:30","available":true}, ...]
POST /api/appointments      {"patientId":1,"doctorId":1,"date":"2026-11-16","startTime":"09:30","reason":"Follow-up"}
 → 201 {"id":7,"status":"BOOKED","fee":800,"paymentStatus":"NOT_BILLED",...}   409 overlap/slot taken · 400 invalid slot · 503 dependency down
POST /api/lab/requests      {"patientId":1,"doctorId":1,"testCode":"CBC","priority":"URGENT"}
POST /api/lab/requests/2/report/attachment   (multipart field "file": PDF/PNG/JPEG ≤ 5 MB)
POST /api/prescriptions     {"patientId":1,"doctorId":1,"items":[{"medicineName":"Paracetamol","dosage":"500mg","frequency":"TID","durationDays":5,"quantity":15}]}
POST /api/pharmacy/orders/4/dispense
POST /api/bills/5/payments  {"method":"UPI"} → 201 {"transactionRef":"TXN-...","status":"PENDING"}
PUT  /api/payments/TXN-.../status {"status":"SUCCESS"}
```

## 16. End-to-end business workflows
1. **Patient registration** - account → validated, duplicate-proof profile (one transaction with the outbox row) → `PatientRegistered` → welcome notification + medical record.
2. **Appointment booking** - find doctors → availability → book (gRPC + HTTP checks, overlap prevention, unique slot key) → `AppointmentBooked` → notifications + consultation bill; reschedule/cancel (cancel compensates the bill).
3. **Availability management** - weekly schedule with breaks, days off, versioned cached slot grids; booked/elapsed slots removed; concurrency-safe.
4. **Lab** - doctor requests → `LabTestRequested` (queue + bill) → staff status workflow → report (+ attachment) → `LabReportGenerated` (notification + timeline); doctor/patient retrieve it.
5. **Prescription** - doctor prescribes → `PrescriptionCreated` → pharmacy order → dispense (HTTP verification, row-locked stock) → `MedicineDispensed` → prescription DISPENSED + medicine bill.
6. **Billing** - bills from events or staff → payment initiation (PENDING + transaction ref) → SUCCESS/FAILED → `PaymentCompleted/Failed` → notification + appointment payment status; cron jobs time out / overdue / remind.
Step by step with verification notes: [docs/202611111917-09](./docs/202611111917-09-business-scenarios-end-to-end.md).

## 17. Detailed documentation
| # | Document |
|---|---|
| 1 | [Microservices - responsibilities and implementation](./docs/202611111917-01-microservices-responsibilities-and-implementation.md) |
| 2 | [REST API reference](./docs/202611111917-02-rest-api-reference.md) |
| 3 | [Synchronous communication (HTTP & gRPC)](./docs/202611111917-03-synchronous-communication-http-and-grpc.md) |
| 4 | [Kafka producers, consumers, topics, event flows](./docs/202611111917-04-kafka-producers-consumers-topics-and-event-flows.md) |
| 5 | [Database schema and tables](./docs/202611111917-05-database-schema-and-tables.md) |
| 6 | [Authentication and authorization](./docs/202611111917-06-authentication-and-authorization.md) |
| 7 | [Redis caching and Opossum](./docs/202611111917-07-redis-caching-and-opossum.md) |
| 8 | [Pino logging and background processing](./docs/202611111917-08-pino-logging-and-background-processing.md) |
| 9 | [The six business scenarios end to end](./docs/202611111917-09-business-scenarios-end-to-end.md) |
| 10 | [Port configuration and local startup](./docs/202611111917-10-port-configuration-and-local-startup.md) |
| - | [PORT-CONFIGURATION.md](./PORT-CONFIGURATION.md) |

## Scope notes
* As required: **no unit/integration tests**, no monitoring stack, no Kubernetes/Prometheus/Grafana/distributed tracing. Verification is the live end-to-end script.
* Payments use a simulated gateway; e-mail/SMS delivery is simulated (logged + stored). No card data is stored.
* Out of scope hardening: secret management for the JWT key, TLS (gRPC runs cleartext locally), multi-broker Kafka, per-service network isolation.
