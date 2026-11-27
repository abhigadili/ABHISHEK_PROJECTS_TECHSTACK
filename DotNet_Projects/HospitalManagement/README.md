# HospitalManagement - Hospital / Healthcare Management System (ASP.NET Core microservices)

A working **C# / .NET 8 ASP.NET Core Web API microservices** system: YARP API gateway, 10 independently executable services, MySQL (one database per service, Entity Framework Core + migrations), Apache Kafka, Redis, Polly, Serilog, ASP.NET Core Identity + JWT, **HttpClient and gRPC** for synchronous calls.
It implements six end-to-end healthcare workflows (patient registration, appointment booking, availability management, lab requests/reports, prescriptions, billing & payments) and was verified live: **142 end-to-end checks pass through the gateway** (`scripts/e2e.py`), including 8 simultaneous bookings of one slot (exactly one wins).

> .NET 8 (LTS) is the newest SDK installed on this machine (8.0.422), so it is the target framework.

## Contents
1. [Architecture](#1-architecture-and-microservice-responsibilities) · 2. [Stack](#2-technology-stack) · 3. [Folders](#3-project-folder-structure) · 4. [Databases](#4-databases-and-initialisation) · 5. [Kafka](#5-kafka-topics-and-event-flow) · 6. [HttpClient & gRPC](#6-httpclient-and-grpc-communication) · 7. [YARP](#7-yarp-routing-configuration) · 8. [Auth](#8-authentication-and-authorization) · 9. [Redis](#9-redis-caching) · 10. [Polly](#10-polly-resilience) · 11. [Serilog](#11-serilog) · 12. [Ports](#12-port-allocation) · 13. [Run it](#13-starting-the-application) · 14. [API & samples](#14-api-endpoints-and-sample-payloads) · 15. [Workflows](#15-end-to-end-business-workflows) · 16. [Docs](#16-detailed-documentation)

## 1. Architecture and microservice responsibilities

```
                      ┌──────────────────────────────┐
   client ─HTTP/JWT─► │  YARP API Gateway   :28080   │  JWT validation, route policies, JSON errors, hides internals
                      └───────────────┬──────────────┘
   ┌────────┬────────┬──────────┬─────┴────┬───────────┬───────────┬─────────┬─────────┬──────────┐
 Hospital  Patient  Doctor  Appointment  Medical   Prescription Laboratory Billing  Pharmacy  Notification
 +Identity :28101   :28102    :28103     Records     :28106      :28107     :28108   :28109     :28110
  :28104   gRPC     │           │         :28105     gRPC
           :28201   │           │           │        :28206
   HospitalDB PatientDB DoctorDB AppointmentDB MedicalRecordsDB PrescriptionDB LaboratoryDB BillingDB PharmacyDB NotificationDB
        sync: gRPC (Patient, Prescription) + HttpClient (Doctor, Hospital, Appointment) with Polly   ◄─►   async: Kafka topics + outbox/inbox
                        Redis :26379 (cache)                                                                 Kafka :29092
```

| Service | Responsibility |
|---|---|
| **Patient** | patient profiles, duplicate prevention, ownership rules, gRPC patient lookup, `PatientRegistered` |
| **Doctor** | doctors, specializations, weekly schedules, breaks, days off, cached slot grids |
| **Appointment** | booking / rescheduling / cancelling, overlap + concurrency-safe slots, availability, reminders |
| **Hospital** | hospitals, departments **and ASP.NET Core Identity** (users, roles, login, JWT issuing) |
| **Medical Records** | clinical file and timeline (manual + event-built) |
| **Prescription** | prescriptions, items, status tracking, expiry, gRPC status lookup |
| **Laboratory** | test catalogue, requests, status workflow, reports |
| **Billing** | bills from events or by staff, payments (simulated gateway), overdue/reminder jobs |
| **Pharmacy** | inventory, orders from prescriptions, dispensing (row-locked stock), low-stock alerts |
| **Notification** | consumes business events, queues and delivers (simulated) e-mail/SMS |

Each service owns its data; `Shared` contains only cross-cutting infrastructure and the compiled `.proto` contracts. Cross-service consistency uses events and compensating actions - **no distributed transactions**. Details: [docs/202611111836-01](./docs/202611111836-01-microservices-responsibilities-and-implementation.md).

## 2. Technology stack
| Requirement | Used |
|---|---|
| Language / framework | C# 12, .NET 8, ASP.NET Core Web API (controllers) |
| Gateway | **YARP** (Yarp.ReverseProxy 2.2) |
| Sync communication | **HttpClient** (typed clients via `IHttpClientFactory`) **and gRPC** (Grpc.AspNetCore, `.proto` contracts) |
| Async communication | Apache Kafka (KRaft, `apache/kafka` image) via Confluent.Kafka; transactional outbox + idempotent inbox + DLT |
| ORM / DB | Entity Framework Core 8 + Pomelo MySQL provider, migrations; MySQL (existing server) |
| Cache | Redis 7 via `IDistributedCache` (StackExchange.Redis) |
| Resilience | **Polly v8** (Microsoft.Extensions.Http.Resilience + resilience pipelines) |
| Logging | **Serilog** (console + rolling file, correlation ids) |
| Auth | **ASP.NET Core Identity** + JWT bearer (HS256), role-based authorization |
| Background | Kafka consumer hosted services + `BackgroundService`/`PeriodicTimer` jobs |
| DI / build | built-in .NET DI, .NET CLI |

## 3. Project folder structure
```
HospitalManagement/                  (Documents/PROJECTS_TECKSTACK/DotNet_Projects/HospitalManagement)
├── HospitalManagement.sln
├── README.md  PORT-CONFIGURATION.md  .env.example  docker-compose.yml  .gitignore      (.env = local secrets, git-ignored)
├── proto/                      patient.proto  prescription.proto           # gRPC contracts (compiled in Shared)
├── src/
│   ├── Shared/                 JWT, errors, correlation, Serilog, Kafka outbox/inbox/consumer, cache, Http/gRPC resilience, peer clients
│   ├── ApiGateway/             YARP (routes/clusters in appsettings.json)
│   ├── PatientService/  DoctorService/  AppointmentService/  HospitalService/  MedicalRecordsService/
│   ├── PrescriptionService/  LaboratoryService/  BillingService/  PharmacyService/  NotificationService/
│   │     each: Program.cs, appsettings.json, Controllers/, Services/, Domain/, Data/<X>DbContext.cs, Dtos/, Migrations/ (+ Clients/, Grpc/)
├── database/scripts/           00-create-databases.sql + 11..20-<DB>-migrations.sql (generated, idempotent)
├── scripts/                    build.sh start-all.sh stop-all.sh create-databases.sh generate-sql.sh verify-db.sh e2e.py gen-schema-doc.py
├── docs/                       9 detailed documents
└── logs/                       Serilog files (git-ignored)
```

## 4. Databases and initialisation
Ten databases on the **existing** MySQL server (port 3306 untouched): **PatientDB, DoctorDB, AppointmentDB, HospitalDB, MedicalRecordsDB, PrescriptionDB, LaboratoryDB, BillingDB, PharmacyDB, NotificationDB** - 44 `hdn_*` tables, no cross-database foreign keys, one DbContext per service. Details: [docs/202611111836-05](./docs/202611111836-05-database-schema-and-tables.md).

> **These databases already existed** (the Java build of this system created the nine hospital ones; `NotificationDB` also holds other applications' tables). Nothing existing is touched: all tables of this build are prefixed **`hdn_`**, FK constraint names **`fk_hdn_`**, the EF history table is **`__hdn_migrations_history`**, and no migration alters a database.

* Credentials never live in source: `.env` (git-ignored; copy `.env.example`) provides `MYSQL_HOST/PORT/USER/PASSWORD`; the connection string is assembled at run time (`DbConnection.Build`), the password has no default.
```bash
cp .env.example .env && chmod 600 .env && $EDITOR .env    # MYSQL_PASSWORD
./scripts/create-databases.sh     # CREATE DATABASE IF NOT EXISTS x10 + idempotent EF migration scripts (never drops/alters others' objects)
./scripts/verify-db.sh            # read-only connectivity + table counts
# new migration:  cd src/PatientService && dotnet ef migrations add <Name> -o Migrations   then   ./scripts/generate-sql.sh
```
Services apply their own migrations at start-up as well (`Database.MigrateAsync`, with retry).

## 5. Kafka topics and event flow
13 topics (+ `<topic>.DLT`, 26 in total): `hospital.patient.registered`, `appointment.booked|cancelled|rescheduled|completed`, `lab.test-requested`, `lab.report-generated`, `prescription.created`, `billing.generated`, `payment.completed`, `payment.failed`, `medicine.dispensed`, `notification.requested` (all prefixed `hospital.`).
```
Patient ─PatientRegistered──────────► Notification, Medical Records
Appointment ─AppointmentBooked──────► Notification, Billing ─BillingGenerated─► Notification, Appointment
Appointment ─AppointmentCancelled───► Notification, Billing (cancels the unpaid bill)
Laboratory ─LabTestRequested────────► Laboratory (queue), Billing        ; ─LabReportGenerated─► Notification, Medical Records
Prescription ─PrescriptionCreated───► Pharmacy, Notification, Medical Records
Pharmacy ─MedicineDispensed─────────► Prescription, Billing, Notification
Billing ─PaymentCompleted/Failed────► Notification, Appointment          ; schedulers ─NotificationRequested─► Notification
```
**Events are published only after the DB transaction commits**: they are staged in an `hdn_outbox_messages` row inside the business transaction and shipped by a `BackgroundService` relay (at-least-once). Consumers use manual commits, a **transactional inbox** (`EventId`+consumer) for idempotency, 3 attempts with exponential back-off, then the dead-letter topic. See [docs/202611111836-04](./docs/202611111836-04-kafka-producers-consumers-topics-and-event-flows.md).

## 6. HttpClient and gRPC communication
| Caller → callee | Technique | Purpose |
|---|---|---|
| Appointment / Records / Prescription / Laboratory / Billing → Patient | **gRPC** (`patient.proto`, :28201) | validate patient, ownership |
| Pharmacy → Prescription | **gRPC** (`prescription.proto`, :28206) | prescription must be ACTIVE |
| Appointment / Prescription / Laboratory → Doctor | **HttpClient** | doctor profile, live slot grid |
| Doctor → Hospital | **HttpClient** | validate hospital + department |
| Billing → Appointment | **HttpClient** | verify appointment of a manual bill |

`IHttpClientFactory` typed clients with the Polly pipeline; gRPC clients with a JWT/correlation interceptor, per-call deadlines and a Polly pipeline; gRPC servers on separate HTTP/2 ports. Details and verified failure behaviour: [docs/202611111836-03](./docs/202611111836-03-synchronous-communication-httpclient-and-grpc.md).

## 7. YARP routing configuration
Single entry point **http://localhost:28080**. Routes, clusters (destinations, `RoundRobin` load balancing, passive health checks, 30 s activity timeout) and per-route authorization policies are in `src/ApiGateway/appsettings.json` (`ReverseProxy`) - nothing is hard-coded:

| Path | → Service (port) | Policy |
|---|---|---|
| `/api/auth/**` | Hospital (28104) | anonymous (service protects `/me`) |
| `/api/users/**` | Hospital | admin |
| `/api/hospitals/**`, `/api/departments/**` | Hospital | authenticated |
| `/api/patients/**` | Patient (28101) | authenticated |
| `/api/doctors/**` | Doctor (28102) | authenticated |
| `/api/appointments/**` | Appointment (28103) | authenticated |
| `/api/records/**` | Medical Records (28105) | authenticated |
| `/api/prescriptions/**` | Prescription (28106) | authenticated |
| `/api/lab/**` | Laboratory (28107) | lab roles |
| `/api/bills/**`, `/api/payments/**` | Billing (28108) | billing roles |
| `/api/pharmacy/**` | Pharmacy (28109) | pharmacy roles |
| `/api/notifications/**` | Notification (28110) | authenticated |

Not routed (never reachable from outside): `/ping`, `/internal/**`, the gRPC ports. 401/403/404/503/504 are returned as JSON. To add a second instance of a service for load balancing, add a destination under its cluster.

## 8. Authentication and authorization
**ASP.NET Core Identity** (Hospital Service) manages users/roles/password hashes; `POST /api/auth/login` returns an HS256 **JWT** (`sub`, `unique_name`, `email`, `role`, `iss`, `aud`, `exp`; 120 min). The gateway and every service (REST and gRPC) validate issuer, audience, signature and lifetime. Roles **ADMIN, DOCTOR, PATIENT, LAB_STAFF, PHARMACIST, BILLING_STAFF** are enforced with `[Authorize(Roles=...)]` plus ownership rules (a patient sees only their own data, a doctor acts only in their own name). Seeded: `admin / Admin@123`, `doctor1|doctor2|labstaff1|pharmacist1|billing1 / Staff@123` (development defaults - override `Seed__*`). Details and matrix: [docs/202611111836-06](./docs/202611111836-06-authentication-and-authorization.md).

## 9. Redis caching
`ICacheService` over `IDistributedCache`: doctor details, **doctor availability** (versioned slot grids), hospital details/departments, patient profile + summary, appointment details and **appointment availability**. Create/retrieve (cache-aside), update (write-through), evict (after commit), configurable TTLs (`Cache:*`), failure-tolerant. Booking never trusts the cache (live grid + DB overlap checks + unique slot key). Details: [docs/202611111836-07](./docs/202611111836-07-redis-caching-and-polly.md).

## 10. Polly resilience
HttpClient pipeline: total timeout 12 s → **retry** (2×, exponential + jitter, **GET/HEAD only**) → **circuit breaker** (50 % / 30 s / min 5 / break 15 s) → 5 s attempt timeout. gRPC pipeline: retry on Unavailable/DeadlineExceeded → circuit breaker → 8 s timeout, 3 s deadline per call. Fallbacks: last-known data where harmless (patient, doctor profile), otherwise a clean **503**. Non-idempotent operations are never auto-retried. Live-tested by stopping the Doctor and Patient services.

## 11. Serilog
Configured once in `Shared/Hosting/HospitalHosting.AddHospitalCore` (can be overridden by a `Serilog` section / `LOG_DIR`): console + rolling file `logs/<service>-<date>.log` (daily, 7 files, 20 MB), levels Information/Warning/Error/Fatal (bootstrap logger reports `Fatal` start-up failures), noisy namespaces at Warning. Output template `time level [service] [CorrelationId] source - message`. A **correlation id** (`X-Correlation-Id`, generated at the first hop if absent) is on every log line, returned to the caller, forwarded on HttpClient/gRPC/YARP calls and stored in Kafka headers, so one request can be followed across all services. Logged: request outcomes, business operations, Kafka produce/consume, downstream failures, circuit/fallback events, exceptions with context. **Never logged:** passwords, JWTs, payment data, clinical content (request logging records only method, path, status, duration; verified by grepping the logs).

## 12. Port allocation
Gateway 28080 · services 28101-28110 · gRPC 28201 (Patient) and 28206 (Prescription) · Kafka 29092 · Redis 26379 · MySQL 3306 (existing). All verified free before use and absent from other local projects - see [PORT-CONFIGURATION.md](./PORT-CONFIGURATION.md) (component, port, config location, internal URL, verification).

## 13. Starting the application
**Prerequisites:** .NET 8 SDK, Docker, the existing local MySQL (user in `.env`).
```bash
cd ~/Documents/PROJECTS_TECKSTACK/DotNet_Projects/HospitalManagement
cp .env.example .env     # fill MYSQL_PASSWORD (already present on this machine)
docker compose up -d                 # Kafka :29092, Redis :26379
./scripts/create-databases.sh        # databases + tables (idempotent)
./scripts/build.sh                   # dotnet publish -c Release (all projects)
./scripts/start-all.sh               # 10 services + gateway
python3 scripts/e2e.py               # optional: 142 checks through the gateway
./scripts/stop-all.sh ; docker compose down
```
**Start one service:** `set -a; . ./.env; set +a; dotnet run --project src/PatientService --no-launch-profile` (commands for all eleven projects in [docs/202611111836-09](./docs/202611111836-09-port-configuration-and-local-startup.md)). Configuration comes from `appsettings.json` and environment variables (`Ports__Http`, `Kafka__BootstrapServers`, `Redis__ConnectionString`, `Services__Doctor`, `Scheduler__ReminderLeadHours`, `Billing__ReminderIntervalHours`, `Jwt__Key`, ...).

## 14. API endpoints and sample payloads
Complete tables (method, path, roles) with request/response samples for every service: [docs/202611111836-02](./docs/202611111836-02-rest-api-reference.md). Key calls (`GW=http://localhost:28080`):
```http
POST /api/auth/login        {"username":"admin","password":"Admin@123"}
 → 200 {"accessToken":"eyJ...","tokenType":"Bearer","expiresInSeconds":7200,"user":{"id":1,"username":"admin","role":"ADMIN","enabled":true}}

POST /api/patients          {"firstName":"Asha","lastName":"Rao","dateOfBirth":"1990-05-17","gender":"FEMALE","email":"asha@mail.com","phone":"+919876543210","bloodGroup":"O+"}
 → 201 {"id":1,"userId":9,"firstName":"Asha","status":"ACTIVE",...}       409 duplicate e-mail/phone/identity · 400 validation (details[])

PUT  /api/doctors/1/schedule {"days":[{"dayOfWeek":"MONDAY","startTime":"09:00","endTime":"13:00","slotMinutes":30,"breakStart":"11:00","breakEnd":"11:30"}]}
GET  /api/appointments/availability?doctorId=1&date=2026-11-16
 → 200 [{"startTime":"09:00:00","endTime":"09:30:00","available":true}, ...]

POST /api/appointments      {"patientId":1,"doctorId":1,"date":"2026-11-16","startTime":"09:30","reason":"Follow-up"}
 → 201 {"id":7,"status":"BOOKED","fee":800.0,"paymentStatus":"NOT_BILLED",...}    409 overlap/slot taken · 400 invalid slot · 503 dependency down

POST /api/lab/requests      {"patientId":1,"doctorId":1,"testCode":"CBC","priority":"URGENT"}
POST /api/prescriptions     {"patientId":1,"doctorId":1,"items":[{"medicineName":"Paracetamol","dosage":"500mg","frequency":"TID","durationDays":5,"quantity":15}]}
POST /api/pharmacy/orders/4/dispense
POST /api/bills/5/payments  {"method":"UPI"}   → 201 {"transactionRef":"TXN-...","status":"PENDING"}
PUT  /api/payments/TXN-.../status {"status":"SUCCESS"}
```

## 15. End-to-end business workflows
1. **Patient registration** - Identity account → validated, duplicate-proof profile (one transaction with the outbox row) → `PatientRegistered` → welcome notification + medical record.
2. **Appointment booking** - available doctors → availability → book (gRPC + HttpClient checks, overlap prevention, unique slot key) → `AppointmentBooked` → notifications + consultation bill; reschedule/cancel (cancel compensates the bill).
3. **Availability management** - weekly schedule with breaks, days off, versioned cached slot grids; booked/elapsed slots removed from the view; concurrency-safe.
4. **Lab** - doctor requests test → `LabTestRequested` (queue + bill) → staff status workflow → report → `LabReportGenerated` (notification + timeline); doctor/patient retrieve it.
5. **Prescription** - doctor prescribes → `PrescriptionCreated` → pharmacy order → dispense (gRPC verification, row-locked stock) → `MedicineDispensed` → prescription DISPENSED + medicine bill.
6. **Billing** - bills from events or staff → payment initiation (PENDING + transaction ref) → SUCCESS/FAILED → `PaymentCompleted/Failed` → patient notification + appointment payment status; jobs time out / overdue / remind.
Step by step with verification notes: [docs/202611111836-08](./docs/202611111836-08-business-scenarios-end-to-end.md).

## 16. Detailed documentation
| # | Document |
|---|---|
| 1 | [Microservices - responsibilities and implementation](./docs/202611111836-01-microservices-responsibilities-and-implementation.md) |
| 2 | [REST API reference](./docs/202611111836-02-rest-api-reference.md) |
| 3 | [Synchronous communication (HttpClient & gRPC)](./docs/202611111836-03-synchronous-communication-httpclient-and-grpc.md) |
| 4 | [Kafka producers, consumers, topics, event flows](./docs/202611111836-04-kafka-producers-consumers-topics-and-event-flows.md) |
| 5 | [Database schema and tables](./docs/202611111836-05-database-schema-and-tables.md) |
| 6 | [Authentication and authorization](./docs/202611111836-06-authentication-and-authorization.md) |
| 7 | [Redis caching and Polly](./docs/202611111836-07-redis-caching-and-polly.md) |
| 8 | [The six business scenarios end to end](./docs/202611111836-08-business-scenarios-end-to-end.md) |
| 9 | [Port configuration and local startup](./docs/202611111836-09-port-configuration-and-local-startup.md) |
| - | [PORT-CONFIGURATION.md](./PORT-CONFIGURATION.md) |

## Scope notes
* As required: **no unit/integration tests**, no monitoring stack, no Kubernetes/Prometheus/Grafana/distributed tracing. Verification is the live end-to-end script.
* Payments use a simulated gateway; e-mail/SMS delivery is simulated (logged + stored). No card data is stored.
* Out of scope hardening: secret management for the JWT key (use a vault / asymmetric keys), TLS (h2c is used locally for gRPC), multi-broker Kafka, per-service network isolation.
