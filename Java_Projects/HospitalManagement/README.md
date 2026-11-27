# HospitalManagement - Hospital / Healthcare Management System

A working **Java 21 / Spring Boot 3.4 microservices** system: API gateway, 10 independently executable services, MySQL (one database per service), Apache Kafka, Redis, Resilience4j, Spring Security + JWT, OpenFeign **and** WebClient, Log4j2.
It implements six end-to-end healthcare workflows (patient registration, appointment booking, availability management, lab requests/reports, prescriptions, billing & payments) and was verified live: **136 end-to-end checks pass through the gateway** (`scripts/e2e.py`).

## Contents
1. [Architecture](#1-architecture-and-microservice-responsibilities) · 2. [Technology stack](#2-technology-stack) · 3. [Folder structure](#3-project-folder-structure) · 4. [Databases](#4-databases-and-initialisation) · 5. [Kafka](#5-kafka-topics-and-event-flow) · 6. [Sync communication](#6-synchronous-communication-webclient-and-openfeign) · 7. [Gateway](#7-api-gateway-routing) · 8. [Auth](#8-authentication-and-authorization) · 9. [Redis](#9-redis-caching) · 10. [Resilience4j](#10-resilience4j) · 11. [Run it](#11-running-the-application-locally) · 12. [API & samples](#12-api-endpoints-and-sample-payloads) · 13. [Workflows](#13-end-to-end-business-workflows) · 14. [Docs](#14-detailed-documentation)

## 1. Architecture and microservice responsibilities

```
                        ┌────────────────────────────┐
   client ─HTTP/JWT──►  │  API Gateway  :18080       │  validates JWT, coarse RBAC, JSON errors, hides internals
                        └──────────────┬─────────────┘
      ┌────────┬────────┬──────────┬────┴─────┬───────────┬───────────┬──────────┬──────────┬─────────┐
   Hospital  Patient  Doctor   Appointment  Medical    Prescription Laboratory  Billing   Pharmacy  Notification
   +Identity :18101   :18102    :18103     Records       :18106      :18107     :18108    :18109     :18110
    :18104                                  :18105
      │         │       │          │           │            │           │          │          │          │
   HospitalDB PatientDB DoctorDB AppointmentDB MedicalRecordsDB PrescriptionDB LaboratoryDB BillingDB PharmacyDB NotificationDB
          sync (Feign/WebClient + Resilience4j) ◄──────────────►  async (Kafka topics, outbox, idempotent consumers)
                          Redis :16379 (cache)                    Kafka :19092
```

| Service | Responsibility |
|---|---|
| **Patient** | patient profiles, duplicate prevention, ownership rules, `PatientRegistered` |
| **Doctor** | doctors, specializations, weekly schedules, breaks, days off, cached slot grids |
| **Appointment** | booking / rescheduling / cancelling, overlap prevention, availability, reminders |
| **Hospital** | hospitals, departments **and** the identity store that logs users in and signs JWTs |
| **Medical Records** | patient clinical file and timeline (manual + event-built) |
| **Prescription** | prescriptions, items, status tracking, expiry |
| **Laboratory** | test catalogue, test requests, status workflow, reports |
| **Billing** | bills from events or by staff, payments (simulated gateway), overdue/reminder jobs |
| **Pharmacy** | medicine inventory, orders from prescriptions, dispensing, low-stock alerts |
| **Notification** | consumes business events, stores and (simulated) sends e-mail/SMS |

Each service owns its data and never touches another service's database; the shared `common` library holds only cross-cutting code. Cross-service consistency is reached with events and compensating actions - **no distributed transactions**. Full responsibilities: [docs/202611111749-01](./docs/202611111749-01-microservices-responsibilities-and-implementation.md).

## 2. Technology stack

| Requirement | Used |
|---|---|
| Language / framework | Java 21, Spring Boot 3.4.5, Spring Cloud 2024.0.1 |
| Gateway | Spring Cloud Gateway (WebFlux) |
| Sync communication | **OpenFeign** and **WebClient** (both in real flows) |
| Async communication | Apache Kafka (KRaft, `apache/kafka` image) with transactional outbox + idempotent consumers + DLT |
| ORM / data | Hibernate 6 + Spring Data JPA, MySQL 8 (existing local server) |
| Cache | Spring Data Redis + Spring Cache (Redis 7) |
| Circuit breaker | Resilience4j 2.2 (annotations on Feign and WebClient gateways) |
| Security | Spring Security, OAuth2 resource server, JWT (HS256), BCrypt, `@PreAuthorize` |
| Background | Kafka consumers + Spring `@Scheduled` (configurable intervals) |
| Logging | Log4j2 (Logback excluded) - console + rolling files in `logs/` |
| Build | Maven 3.8 multi-module reactor |

## 3. Project folder structure
```
HospitalManagement/
├── pom.xml                      # parent (dependency management, Logback exclusion, versions)
├── README.md  PORT-CONFIGURATION.md  .env.example  .gitignore   (.env = local secrets, git-ignored)
├── common/                      # hospital-common: security, errors, events, outbox/idempotency, cache, Feign/WebClient helpers
│   └── src/main/resources/hospital-common.yml, log4j2-spring.xml
├── gateway/                     # api-gateway (routes in application.yml)
├── services/
│   ├── pom.xml                  # baseline dependencies of every business service
│   ├── hospital-service/        # 18104  HospitalDB       (+ identity / JWT)
│   ├── patient-service/         # 18101  PatientDB
│   ├── doctor-service/          # 18102  DoctorDB
│   ├── appointment-service/     # 18103  AppointmentDB
│   ├── medical-records-service/ # 18105  MedicalRecordsDB
│   ├── prescription-service/    # 18106  PrescriptionDB
│   ├── laboratory-service/      # 18107  LaboratoryDB
│   ├── billing-service/         # 18108  BillingDB
│   ├── pharmacy-service/        # 18109  PharmacyDB
│   └── notification-service/    # 18110  NotificationDB
│       (each: src/main/java/com/hospital/<svc>/{domain,dto,service,web,...}, resources/application.yml, pom.xml)
├── database/scripts/            # 00-create-databases.sql + 11..20-<DB>-schema.sql
├── docker/docker-compose.yml    # Kafka (19092) + Redis (16379) only
├── scripts/                     # build.sh start-all.sh stop-all.sh create-databases.sh verify-db.sh e2e.py gen-*.{sh,py}
└── docs/                        # detailed documentation (8 files)
```

## 4. Databases and initialisation
Ten databases on the **existing** MySQL server (port 3306 untouched): **PatientDB, DoctorDB, AppointmentDB, HospitalDB, MedicalRecordsDB, PrescriptionDB, LaboratoryDB, BillingDB, PharmacyDB, NotificationDB** - 42 tables in total, no cross-database foreign keys. Details: [docs/202611111749-05](./docs/202611111749-05-database-schema-and-tables.md).

* `NotificationDB` already existed (other application's tables); it is reused untouched and this project's tables there are prefixed `hms_`.
* Credentials are never in source: `.env` (git-ignored; copy `.env.example`) supplies `MYSQL_HOST/PORT/USER/PASSWORD`; `application` configs read `${MYSQL_USER}` / `${MYSQL_PASSWORD}` (no default password).

```bash
cp .env.example .env && chmod 600 .env && $EDITOR .env      # set MYSQL_PASSWORD
./scripts/create-databases.sh      # CREATE DATABASE IF NOT EXISTS x10, then CREATE TABLE IF NOT EXISTS (never drops/alters)
./scripts/verify-db.sh             # read-only connectivity + table counts per service
```
Services start with `ddl-auto=validate`: Hibernate checks its mappings against the scripted schema at start-up.

Configuration examples (all in `common/src/main/resources/hospital-common.yml`, environment-overridable):
```yaml
spring.datasource.url:        jdbc:mysql://${MYSQL_HOST:localhost}:${MYSQL_PORT:3306}/PatientDB   # per service
spring.kafka.bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:19092}
spring.data.redis:            { host: ${REDIS_HOST:localhost}, port: ${REDIS_PORT:16379} }
```

## 5. Kafka topics and event flow
13 topics (+ `<topic>.DLT`): `hospital.patient.registered`, `appointment.booked|cancelled|rescheduled|completed`, `lab.test-requested`, `lab.report-generated`, `prescription.created`, `billing.generated`, `payment.completed`, `payment.failed`, `medicine.dispensed`, `notification.requested` (all prefixed `hospital.`).

```
Patient ─PatientRegistered──────────► Notification, Medical Records
Appointment ─AppointmentBooked──────► Notification, Billing ─BillingGenerated─► Notification, Appointment
Appointment ─AppointmentCancelled───► Notification, Billing (cancels unpaid bill)
Laboratory ─LabTestRequested────────► Laboratory (queue), Billing        ; ─LabReportGenerated─► Notification, Medical Records
Prescription ─PrescriptionCreated───► Pharmacy, Notification, Medical Records
Pharmacy ─MedicineDispensed─────────► Prescription, Billing, Notification
Billing ─PaymentCompleted/Failed────► Notification, Appointment
schedulers ─NotificationRequested───► Notification
```
Reliability: events are written to an **outbox** table in the business transaction and relayed to Kafka (at-least-once); consumers record `(eventId, consumer)` in the same transaction (**idempotent**), retry with back-off, then dead-letter. See [docs/202611111749-04](./docs/202611111749-04-kafka-producers-consumers-topics-and-event-flows.md).

## 6. Synchronous communication (WebClient and OpenFeign)
| Caller → callee | Technique | Purpose |
|---|---|---|
| Appointment / Records / Prescription / Laboratory / Billing → Patient | OpenFeign | validate patient, ownership |
| Doctor → Hospital | OpenFeign | validate hospital + department |
| Pharmacy → Prescription | OpenFeign | prescription must be ACTIVE |
| Appointment / Prescription / Laboratory → Doctor | WebClient | doctor profile, slot grid |
| Billing → Appointment | WebClient | verify appointment of a manual bill |

Reusable WebClient instances (timeouts, JWT propagation, error mapping) and a Feign error decoder turn downstream HTTP errors/timeouts into typed exceptions; the caller's JWT is forwarded. Details: [docs/202611111749-03](./docs/202611111749-03-synchronous-communication-webclient-and-openfeign.md).

## 7. API Gateway routing
Single entry point **http://localhost:18080**; `gateway/src/main/resources/application.yml`:

| Path | → Service (port) |
|---|---|
| `/api/auth/**`, `/api/users/**`, `/api/hospitals/**`, `/api/departments/**` | Hospital (18104) |
| `/api/patients/**` | Patient (18101) |
| `/api/doctors/**` | Doctor (18102) |
| `/api/appointments/**` | Appointment (18103) |
| `/api/records/**` | Medical Records (18105) |
| `/api/prescriptions/**` | Prescription (18106) |
| `/api/lab/**` | Laboratory (18107) |
| `/api/bills/**`, `/api/payments/**` | Billing (18108) |
| `/api/pharmacy/**` | Pharmacy (18109) |
| `/api/notifications/**` | Notification (18110) |

`/internal/**`, `/ping`, `/actuator/**` are denied. 401/403/404/503/504 are returned as JSON by the gateway's security and error handlers.

## 8. Authentication and authorization
Login at `POST /api/auth/login` (Hospital Service = single identity authority) returns an HS256 **JWT** (claims `sub`, `uid`, `email`, `roles`). The gateway and every service validate it (Spring Security resource server). Roles **ADMIN, DOCTOR, PATIENT, LAB_STAFF, PHARMACIST, BILLING_STAFF** are enforced with `@PreAuthorize` plus ownership rules (a patient only sees own data, a doctor only acts in their own name). Seeded accounts: `admin / Admin@123`, `doctor1|doctor2|labstaff1|pharmacist1|billing1 / Staff@123` (development defaults - override with `SEED_*_PASSWORD`). Details and permission matrix: [docs/202611111749-06](./docs/202611111749-06-authentication-and-authorization.md).

## 9. Redis caching
Caches (JSON in Redis, per-cache TTL, failure-tolerant): doctor details, **doctor availability (slot grids)**, hospital details and departments, patient profile + summary, appointment details and **appointment availability**. Entries are filled with `@Cacheable`, refreshed with `@CachePut`, and evicted on every relevant change (appointment caches are evicted after the DB commit). Details: [docs/202611111749-07](./docs/202611111749-07-redis-caching-and-resilience4j.md).

## 10. Resilience4j
Circuit breakers `patientService`, `hospitalService`, `prescriptionService` (Feign) and `doctorService`, `appointmentService` (WebClient): window 10, min 5 calls, open at 50 % failures or 80 % slow calls (>4 s), 15 s open, 3 half-open probes; 4xx business answers are ignored. Fallbacks: last-known data where staleness is harmless, otherwise a clean **503**. Live-tested by stopping the Doctor and Patient services.

## 11. Running the application locally

**Prerequisites:** Java 21, Maven 3.8+, Docker (for Kafka + Redis), the existing local MySQL (user in `.env`).

```bash
cd ~/Documents/PROJECTS_TECKSTACK/Java_Projects/HospitalManagement
cp .env.example .env   # fill MYSQL_PASSWORD (already present on this machine)

docker compose -f docker/docker-compose.yml up -d     # Kafka :19092, Redis :16379
./scripts/create-databases.sh                          # databases + tables (idempotent)
./scripts/build.sh                                     # mvn -DskipTests clean package  (all jars)
./scripts/start-all.sh                                 # 10 services + gateway, waits for each /ping
python3 scripts/e2e.py                                 # optional: 136 end-to-end checks through the gateway
./scripts/stop-all.sh                                  # stops the Java processes (by listening port)
docker compose -f docker/docker-compose.yml down       # infrastructure (add -v to drop Kafka/Redis data)
```
Logs: `logs/<service>.log` (Log4j2) and `logs/<service>.out`. Start one service alone: `set -a; . ./.env; set +a; java -jar services/patient-service/target/patient-service-1.0.0.jar` (Kafka/Redis/MySQL must be reachable; services that call others expect them to be up, otherwise they answer 503 - the circuit breakers protect them).
Start order is not enforced (services retry Kafka connections), but `start-all.sh` starts identity/reference services first.

Scheduler / job tuning is by environment variable (all have defaults), e.g. `REMINDER_LEAD_HOURS=48 REMINDER_FIXED_DELAY_MS=30000 BILL_REMINDER_INTERVAL_HOURS=12 PAYMENT_TIMEOUT_MINUTES=15 ./scripts/start-all.sh`.

Port allocation and how it was verified: [PORT-CONFIGURATION.md](./PORT-CONFIGURATION.md).

## 12. API endpoints and sample payloads
Complete tables (method, path, roles) with request/response samples for every service are in [docs/202611111749-02](./docs/202611111749-02-rest-api-reference.md). A few key calls:

```bash
GW=http://localhost:18080
T=$(curl -s -X POST $GW/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
```
```http
POST /api/auth/login        {"username":"admin","password":"Admin@123"}
 → 200 {"accessToken":"eyJ...","tokenType":"Bearer","expiresInSeconds":7200,"user":{"id":1,"username":"admin","role":"ADMIN"}}

POST /api/patients          {"firstName":"Asha","lastName":"Rao","dateOfBirth":"1990-05-17","gender":"FEMALE","email":"asha@mail.com","phone":"+919876543210","bloodGroup":"O+"}
 → 201 {"id":1,"userId":9,"firstName":"Asha","status":"ACTIVE",...}        409 on duplicate e-mail/phone/identity

PUT  /api/doctors/1/schedule {"days":[{"dayOfWeek":"MONDAY","startTime":"09:00","endTime":"13:00","slotMinutes":30,"breakStart":"11:00","breakEnd":"11:30"}]}
GET  /api/appointments/availability?doctorId=1&date=2026-11-16
 → 200 [{"startTime":"09:00:00","endTime":"09:30:00","available":true}, ...]

POST /api/appointments      {"patientId":1,"doctorId":1,"date":"2026-11-16","startTime":"09:30","reason":"Follow-up"}
 → 201 {"id":7,"status":"BOOKED","fee":800.00,"paymentStatus":"NOT_BILLED",...}     409 overlap · 400 invalid slot

POST /api/lab/requests      {"patientId":1,"doctorId":1,"testCode":"CBC","priority":"URGENT"}
POST /api/prescriptions     {"patientId":1,"doctorId":1,"diagnosis":"Mild anaemia","items":[{"medicineName":"Paracetamol","dosage":"500mg","frequency":"TID","durationDays":5,"quantity":15}]}
POST /api/pharmacy/orders/4/dispense
POST /api/bills/5/payments  {"method":"UPI"}   → 201 {"transactionRef":"TXN-...","status":"PENDING"}
PUT  /api/payments/TXN-.../status {"status":"SUCCESS"}
```

## 13. End-to-end business workflows
1. **Patient registration** - account → profile (validated, duplicate-proof) → `PatientRegistered` → welcome notification + medical record.
2. **Appointment booking** - find doctors → availability → book (Feign + WebClient checks, overlap prevention) → `AppointmentBooked` → notifications + consultation bill; reschedule/cancel (cancel compensates the bill).
3. **Availability management** - weekly schedule with breaks, days off, cached slot grids; booked/elapsed slots removed from the view; caches evicted on change.
4. **Lab** - doctor requests test → `LabTestRequested` (queue + bill) → staff status workflow → report → `LabReportGenerated` (notification + timeline); doctor/patient retrieve report.
5. **Prescription** - doctor prescribes → `PrescriptionCreated` → pharmacy order → dispense (verifies prescription, locks stock) → `MedicineDispensed` → prescription DISPENSED + medicine bill.
6. **Billing** - bills from events or staff → payment initiation (PENDING, transaction ref) → status update SUCCESS/FAILED → `PaymentCompleted/Failed` → patient notification, appointment payment status; jobs time out/overdue/remind.
Step-by-step with verification notes: [docs/202611111749-08](./docs/202611111749-08-business-scenarios-end-to-end.md).

## 14. Detailed documentation
| # | Document |
|---|---|
| 1 | [Microservices - responsibilities and implementation](./docs/202611111749-01-microservices-responsibilities-and-implementation.md) |
| 2 | [REST API reference](./docs/202611111749-02-rest-api-reference.md) |
| 3 | [Synchronous communication (WebClient & OpenFeign)](./docs/202611111749-03-synchronous-communication-webclient-and-openfeign.md) |
| 4 | [Kafka producers, consumers, topics, event flows](./docs/202611111749-04-kafka-producers-consumers-topics-and-event-flows.md) |
| 5 | [Database schema and tables](./docs/202611111749-05-database-schema-and-tables.md) |
| 6 | [Authentication and authorization](./docs/202611111749-06-authentication-and-authorization.md) |
| 7 | [Redis caching and Resilience4j](./docs/202611111749-07-redis-caching-and-resilience4j.md) |
| 8 | [The six business scenarios end to end](./docs/202611111749-08-business-scenarios-end-to-end.md) |
| - | [PORT-CONFIGURATION.md](./PORT-CONFIGURATION.md) |

## Scope notes
* As required, there are **no unit/integration tests, no monitoring stack, no Kubernetes, Prometheus, Grafana or tracing**. Verification is the live end-to-end script.
* Payments use a simulated gateway; e-mail/SMS delivery is simulated (logged + stored).
* Production hardening that is deliberately out of scope: key management for the JWT secret (use a secret store / asymmetric keys), TLS, multi-broker Kafka, per-service network isolation.
