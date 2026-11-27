# API Integration Documentation

Everything in this document was taken from the **running** backend (OpenAPI documents served at `http://localhost:30080/docs-json/<service>`, the backend's own docs under `NodeJS_Projects/HospitalManagement/docs`, and live requests made on 2026-11-12, re-confirmed from the Angular application). Nothing was invented and the backend was **not modified**.

## Contents
1. [Backend project location](#backend-project-location) · 2. [Gateway information](#backend-api-gateway-information) · 3. [Verified base URLs](#verified-api-base-urls) · 4. [Microservices](#microservice-information) · 5. [Authentication](#authentication-requirements) · 6. [Error handling](#error-handling) · 7. [Endpoints](#api-endpoints) · 8. [Mapping to Angular modules](#api-mapping-to-angular-modules) · 9. [Unavailable or missing APIs](#unavailable-or-missing-apis) · 10. [Integration status](#api-integration-status)

## Backend project location
`~/Documents/PROJECTS_TECKSTACK/NodeJS_Projects/HospitalManagement` (npm workspaces: `api-gateway/`, `services/*-service`, `shared/`, `proto/`). Node 20, Express 5, Prisma 6 + MySQL (one database per service), Kafka, Redis, gRPC between services. The Angular project only ever talks HTTP to the gateway – never to MySQL, Kafka, Redis, gRPC or a service port.

## Backend API gateway information
* **A centralised gateway exists** (Express + http-proxy-middleware) – `http://localhost:30080`. It validates the JWT (Passport + jose), applies route-level role rules (`api-gateway/config/routes.json`), rate limiting, helmet, CORS (`CORS_ORIGINS`, default `*`), correlation ids (`X-Correlation-Id`) and JSON error bodies (401/403/404/429/503/504).
* Routing table (prefix → service): `/api/auth`, `/api/users`, `/api/hospitals`, `/api/departments` → Hospital (30104) · `/api/patients` → Patient (30101) · `/api/doctors` → Doctor (30102) · `/api/appointments` → Appointment (30103) · `/api/records` → Medical Records (30105) · `/api/prescriptions` → Prescription (30106) · `/api/lab` → Laboratory (30107) · `/api/bills`, `/api/payments` → Billing (30108) · `/api/pharmacy` → Pharmacy (30109) · `/api/notifications` → Notification (30110).
* Swagger UI of all services: `http://localhost:30080/docs`.
* Role rules enforced **at the gateway**: `/api/users/**` ADMIN · `/api/lab/**` ADMIN, DOCTOR, LAB_STAFF, PATIENT · `/api/bills/**`, `/api/payments/**` ADMIN, BILLING_STAFF, PATIENT · `/api/pharmacy/**` ADMIN, PHARMACIST, DOCTOR. Services add ownership/role checks of their own.

## Verified API base URLs

| What | Value | Verified |
|---|---|---|
| Gateway (the only URL the frontend uses) | `http://localhost:30080` | ✔ listening; `POST /api/auth/login` answers 200/401 as documented; all ten services reachable through it |
| Service ports (internal) | 30101–30110 | ✔ listening – **not used by the frontend** |
| gRPC | 30201, 30202, 30204 | ✔ internal only |
| Frontend → gateway | `apiBaseUrl` in `src/environments/environment.ts` (`''` = same origin: the browser calls `/api/*` on `http://localhost:4300` and `ng serve` proxies to the gateway through `proxy.conf.json`) | ✔ (proxy verified: `GET /api/hospitals` through :4300 answers like the gateway; CORS also allows direct mode) |

Configured vs. operational: the endpoint inventory below was exercised live per role (`GET` on every read endpoint for ADMIN, DOCTOR, LAB_STAFF, PHARMACIST, BILLING_STAFF; all write endpoints used by the UI were exercised through the browser (headless Chrome), see [integration status](#api-integration-status)). Every configured endpoint listed answered; the 403s in the matrix are role restrictions, not outages.

## Microservice information

| Service | Port | Database | Responsibility | Frontend module |
|---|---|---|---|---|
| Hospital (+identity) | 30104 | HospitalDB | hospitals, departments, users, JWT/refresh tokens | hospitals, authentication |
| Patient | 30101 | PatientDB | patient profiles | patients |
| Doctor | 30102 | DoctorDB | doctors, weekly schedules, days off, slot grids | doctors |
| Appointment | 30103 | AppointmentDB | booking, rescheduling, cancelling, availability | appointments |
| Medical Records | 30105 | MedicalRecordsDB | clinical timeline + chronic conditions | medical-records |
| Prescription | 30106 | PrescriptionDB | prescriptions, items, status | prescriptions |
| Laboratory | 30107 | LaboratoryDB | test catalogue, requests, reports, attachments | laboratory |
| Billing | 30108 | BillingDB | bills, payments (simulated gateway) | billing |
| Pharmacy | 30109 | PharmacyDB | inventory, orders, dispensing | pharmacy |
| Notification | 30110 | NotificationDB | stored/“sent” e-mail/SMS messages | notifications |

Events between services (Kafka) are asynchronous: e.g. a booked appointment creates a bill and a notification a moment later, a report creates a medical-record entry, a prescription creates a pharmacy order. The frontend therefore re-reads the affected data after the triggering call and shows an "asynchronous follow-up" notice where relevant (e.g. `src/app/features/appointments/appointment-book.component.ts`), polls notifications every 30 s (`src/app/core/services/notification-center.service.ts`), polls pharmacy orders every 15 s (`src/app/features/pharmacy/pharmacy-orders.component.ts`) and the prescription status every 10 s (`src/app/features/prescriptions/prescription-details.component.ts`).

## Authentication requirements
* `POST /api/auth/login {username, password}` → `{accessToken, refreshToken, tokenType:"Bearer", expiresInSeconds:900, user:{id,username,email,role,enabled}}`.
* Access token: HS256 JWT, 15 minutes, claims `sub, preferred_username, email, roles, iss=hospital-identity, aud=hospital-api, iat, exp, jti`.
* Refresh token: opaque, 7 days, **rotating**; `POST /api/auth/refresh {refreshToken}` returns a new pair and revokes the old one; re-using an old token revokes the whole family (401).
* `POST /api/auth/logout {refreshToken}` → 204. `GET /api/auth/me`. `POST /api/auth/register {username,email,password}` → PATIENT account (username 4–60 `[A-Za-z0-9._-]`, password 8–72 with upper, lower, digit).
* Login lock-out: 8 failures lock the account for 5 minutes; `/api/auth/*` is rate-limited (429).
* **No** OAuth 2 / OIDC, **no** MFA, **no** HttpOnly cookie, **no** password reset – see [missing APIs](#unavailable-or-missing-apis).
* Frontend contract: `Authorization: Bearer <accessToken>` on every call except login/register/refresh/logout (functional `authInterceptor`, `src/app/core/interceptors/auth.interceptor.ts`, skipping via the `SKIP_AUTH` `HttpContextToken` in `src/app/core/interceptors/http-context.ts`); token handling in `src/app/core/auth/auth.service.ts` and `src/app/core/auth/token-store.service.ts` (access token in memory, refresh token in `sessionStorage`, single-flight refresh because tokens rotate).

## Error handling
Every service and the gateway return the same body:
```json
{ "timestamp": "...", "status": 400, "error": "Bad Request", "message": "Validation failed", "path": "/api/patients", "details": ["email: must be a well-formed email address"] }
```
`400` validation (details = `field: message`) · `401` missing/expired token or bad credentials · `403` role/ownership · `404` · `409` duplicate / invalid state / slot taken / payment in progress · `429` rate limit · `503` dependency down (circuit breaker) · `504` gateway timeout.

Frontend handling (single implementation): the functional `errorInterceptor` (`src/app/core/interceptors/error.interceptor.ts`) turns every failure into an `ApiError` (`src/app/core/models/api-error.ts`: `status`, `message`, `details[]`, `fieldErrors{}`, `isNetworkError`, `isTimeout`, `correlationId`, helpers `isUnauthorized/isForbidden/isNotFound/isConflict`). `fieldErrors` are parsed from `details` and mapped back onto form controls (e.g. `serverErrors` of `src/app/features/patients/patient-form.component.ts`). 401 → single-flight refresh + replay (`authInterceptor`), otherwise session-expired logout; 403 on a route → `/access-denied` (`src/app/core/guards/auth.guards.ts`); network/timeout → friendly message with a retry button (`src/app/shared/components/state-views.component.ts`); idempotent GETs are retried with exponential back-off (`src/app/core/interceptors/retry.interceptor.ts`); uncaught errors go to `src/app/core/services/app-error-handler.ts`. Views never see raw `HttpErrorResponse`: they receive `LoadState<T>` (`src/app/shared/utilities/load-state.ts`).

## API endpoints
All paths are relative to `/api`. Roles: **A**=ADMIN **D**=DOCTOR **P**=PATIENT **L**=LAB_STAFF **PH**=PHARMACIST **B**=BILLING_STAFF; *(own)* = ownership enforced. Pagination: `?page=0&size=20` → `{content, page, size, totalElements, totalPages}`; dates `YYYY-MM-DD`, times `HH:mm`.

### Authentication & users – Hospital service
| Method | Path | Roles | Request | Response |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{username,password}` | `TokenResponse` |
| POST | `/auth/register` | public | `{username,email,password}` | `UserAccount` (role PATIENT) |
| POST | `/auth/refresh` | public | `{refreshToken}` | `TokenResponse` |
| POST | `/auth/logout` | public | `{refreshToken}` | 204 |
| GET | `/auth/me` | any | – | `UserAccount` |
| GET / POST | `/users` | A | – / `{username,email,password,role}` | `UserAccount[]` / `UserAccount` |
| PATCH | `/users/{id}/enabled` | A | `{enabled}` | `UserAccount` |

### Hospitals & departments
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/hospitals`, `/hospitals/{id}` | any | list is **not paged** (array) |
| POST / PUT | `/hospitals`, `/hospitals/{id}` | A | `{name,code,address?,city?,phone?,email?}`; 409 duplicate code |
| DELETE | `/hospitals/{id}` | A | deactivates (204) |
| GET / POST | `/hospitals/{id}/departments` | any / A | `{name,description?}` |
| GET / PUT / DELETE | `/departments/{id}` | any / A / A | |

### Patients
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/patients` | A, P | `{firstName,lastName,dateOfBirth,gender,email,phone,identityNumber?,bloodGroup?,address?,emergencyContactName?,emergencyContactPhone?,knownAllergies?}`; a PATIENT's profile is bound to the login; 409 duplicate e-mail/phone/identity |
| GET | `/patients?q=&page=&size=` | A, D, L, PH, B | search name/e-mail/phone |
| GET | `/patients/{id}`, `/patients/{id}/summary` | staff, P(own) / any | |
| GET | `/patients/by-user/{userId}/profile` | A, staff, P(own) | 404 = login without profile |
| PUT / DELETE | `/patients/{id}` | A, P(own) / A | DELETE = deactivate |

Response `Patient`: `id, userId, firstName, lastName, dateOfBirth, gender (MALE|FEMALE|OTHER), email, phone, identityNumber, bloodGroup (A+…O-), address, emergencyContactName, emergencyContactPhone, knownAllergies, status (ACTIVE|INACTIVE), createdAt, updatedAt`.

### Doctors
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST / PUT / DELETE | `/doctors`, `/doctors/{id}` | A | `{firstName,lastName,email,phone?,licenseNumber,specialization,qualification?,experienceYears?,consultationFee,hospitalId,departmentId?,userId?}` |
| GET | `/doctors?specialization=&hospitalId=&departmentId=&active=&page=&size=` | any | paged |
| GET | `/doctors/specializations`, `/doctors/available?date=&specialization=`, `/doctors/{id}`, `/doctors/{id}/slots?date=`, `/doctors/{id}/schedule`, `/doctors/{id}/unavailability` | any | |
| PUT | `/doctors/{id}/schedule` | A, D(own) | `{days:[{dayOfWeek,startTime,endTime,slotMinutes,breakStart?,breakEnd?}]}` replaces the template |
| POST / DELETE | `/doctors/{id}/unavailability[/{uid}]` | A, D(own) | `{date,reason?}` |

There is **no** "doctor by login" endpoint; the frontend resolves it from the doctor list (`doctor$` in `src/app/core/services/current-identity.service.ts`).

### Appointments
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/appointments/availability?doctorId=&date=` | any | `[{startTime,endTime,available}]` – booked slots are `available:false` |
| POST | `/appointments` | A, P(own) | `{patientId,doctorId,date,startTime,reason?}` → 201 `Appointment`; 400 invalid slot, 409 overlap |
| GET | `/appointments/{id}`, `/appointments/patient/{patientId}`, `/appointments/doctor/{doctorId}?date=` | role rules | arrays (not paged) |
| GET | `/appointments/my` | P | the caller's appointments (the UI uses the patient endpoint instead) |
| PUT | `/appointments/{id}/reschedule` `{date,startTime}`, `/cancel` `{reason?}`, `/complete` `{notes?}` | A / D / P(own) | complete only once the appointment time has started |

`Appointment`: `id, patientId, patientName, doctorId, doctorName, date, startTime, endTime, status (BOOKED|COMPLETED|CANCELLED|MISSED…), reason, cancelReason, notes, fee, paymentStatus (NOT_BILLED|PENDING|PAID|FAILED), billNumber, createdAt`.
**There is no endpoint that lists all appointments** – the frontend composes the admin view from `/appointments/doctor/{id}` for every doctor (`src/app/features/appointments/appointment-feed.facade.ts`).

### Medical records
| Method | Path | Roles |
|---|---|---|
| POST | `/records/entries` `{patientId,entryType,title,details?,doctorId?}` | A, D |
| PUT | `/records/entries/{id}` `{title,details?}` (manual entries only) | A, D |
| GET | `/records/entries/{id}` · `/records/patients/{patientId}/entries?type=&page=&size=` · `/records/patients/{patientId}/summary` | A, D (P own per backend docs) |
| PUT | `/records/patients/{patientId}/conditions` `{chronicConditions}` | A, D |

`entryType`: DIAGNOSIS, VISIT, LAB_REPORT, PRESCRIPTION, ALLERGY, NOTE. Entries with `source: "EVENT"` are generated from lab/prescription events and are read-only.

### Prescriptions
`POST /prescriptions` (A, D) `{patientId,doctorId,appointmentId?,diagnosis?,notes?,validDays,items:[{medicineName,dosage,frequency,durationDays,quantity,instructions?}]}` · `GET /prescriptions/{id}`, `/{id}/status` · `GET /prescriptions/patient/{patientId}` (A, D, PH, P own) · `GET /prescriptions/doctor/{doctorId}` (A, D) · `PUT /prescriptions/{id}/cancel` (A, D own). Status: ACTIVE → DISPENSED / CANCELLED / EXPIRED (set by pharmacy/cron events).

### Laboratory
`GET /lab/tests` · `POST /lab/tests` (A, L) · `POST /lab/requests` (A, D) `{patientId,doctorId,appointmentId?,testCode,priority ROUTINE|URGENT|STAT,clinicalNotes?}` · `GET /lab/requests?status=&page=&size=` (A, D, L) · `GET /lab/requests/{id}`, `/lab/requests/patient/{patientId}` (array) · `PUT /lab/requests/{id}/status {status}` (A, L; REQUESTED→SAMPLE_COLLECTED→IN_PROGRESS) · `PUT /lab/requests/{id}/cancel` · `POST /lab/requests/{id}/report` (A, L; request must be IN_PROGRESS) `{resultSummary,resultDetails?,referenceRange?,abnormal}` · `GET /lab/requests/{id}/report` · `POST /lab/requests/{id}/report/attachment` (multipart `file`, PDF/PNG/JPEG ≤ 5 MB) · `GET …/report/attachment` (binary download).

### Billing
`POST /bills` (A, B) `{patientId,billType APPOINTMENT|LAB|MEDICINE|OTHER,referenceId?,note?,items:[{description,quantity,unitPrice}]}` · `GET /bills?status=PENDING|PAID|OVERDUE|CANCELLED&page=&size=` (A, B) · `GET /bills/{id}`, `/bills/patient/{patientId}` (array) · `PUT /bills/{id}/cancel` · `POST /bills/{id}/payments {method CARD|UPI|NET_BANKING|CASH|INSURANCE, simulateOutcome?}` → `Payment{transactionRef,status PENDING|SUCCESS|FAILED,…}` · `GET /bills/{id}/payments` · `GET /payments/{transactionRef}` · `PUT /payments/{transactionRef}/status {status SUCCESS|FAILED,failureReason?}` (A, B – simulated gateway callback). No card data exists anywhere; only the method is sent.

### Pharmacy
`GET /pharmacy/medicines` (A, PH, D) – array · `POST/PUT /pharmacy/medicines[/{id}]`, `POST /pharmacy/medicines/{id}/restock {quantity}` (A, PH) · `GET /pharmacy/orders?status=&page=&size=`, `/orders/{id}` (A, PH) · `GET /pharmacy/orders/prescription/{prescriptionId}` (A, PH, D) · `POST /pharmacy/orders/{id}/dispense`, `/reject {reason}` (A, PH).

### Notifications
`GET /notifications?eventType=&email=&page=&size=`, `GET /notifications/{id}`, `POST /notifications/send {recipientEmail,recipientPhone?,subject,message}` (**A only**) · `GET /notifications/my?page=&size=` (any – messages addressed to the caller's e-mail). Fields: `id, recipientEmail, channel, subject, message, eventType, referenceId, status (QUEUED|SENT|FAILED), createdAt, sentAt`. Event types seen live: `APPOINTMENT_BOOKED|CANCELLED|RESCHEDULED`, `BILLING_GENERATED`, `PAYMENT_COMPLETED|FAILED|REMINDER`, `PRESCRIPTION_CREATED`, `MEDICINE_DISPENSED`, `LAB_REPORT_GENERATED`, `PATIENT_REGISTERED`.

### Role access matrix observed live (GET, HTTP status)
| Endpoint group | ADMIN | DOCTOR | LAB_STAFF | PHARMACIST | BILLING_STAFF |
|---|:-:|:-:|:-:|:-:|:-:|
| hospitals, departments, doctors (read), patients (read), availability | 200 | 200 | 200 | 200 | 200 |
| `/users` | 200 | 403 | 403 | 403 | 403 |
| `/appointments/doctor/{id}` | 200 | 200 | 403 | 403 | 403 |
| `/records/**` | 200 | 200 | 403 | 403 | 403 |
| `/prescriptions/patient/{id}` | 200 | 200 | 403 | 200 | 403 |
| `/prescriptions/doctor/{id}` | 200 | 200 | 403 | 403 | 403 |
| `/lab/**` | 200 | 200 | 200 | 403 | 403 |
| `/bills/**`, `/payments/**` | 200 | 403 | 403 | 403 | 200 |
| `/pharmacy/medicines`, `/orders/prescription/{id}` | 200 | 200 | 403 | 200 | 403 |
| `/pharmacy/orders` | 200 | 403 | 403 | 200 | 403 |
| `/notifications` (all) / `/notifications/{id}` | 200 | 403 | 403 | 403 | 403 |
| `/notifications/my` | 200 | 200 | 200 | 200 | 200 |

The frontend mirrors this table in `src/app/core/auth/permissions.ts` so users are not offered screens that would answer 403 (the backend stays the authority).

## API mapping to Angular modules

| Backend area | API service (`src/app/core/api`) | NgRx / state | Feature module(s) |
|---|---|---|---|
| auth, users | `auth-api.service.ts` (`UserApiService`) + `src/app/core/auth/auth.service.ts` | signals in `AuthService` | `src/app/features/authentication`, `src/app/features/admin` (NgModule), doctor form (create login) |
| patients | `patient-api.service.ts` | Store: `src/app/state/*/patients.*` | `src/app/features/patients`, patient picker used by prescriptions, lab, billing, appointments |
| doctors | `doctor-api.service.ts` | Store: `src/app/state/*/doctors.*` (functional effects) | `src/app/features/doctors`, appointments (available doctors, slots) |
| appointments | `appointment-api.service.ts` | Store: `src/app/state/*/appointments.*` | `src/app/features/appointments`, dashboard, doctor tabs |
| hospitals, departments | `hospital-api.service.ts` | Store: `src/app/state/*/hospitals.*` (normalised) | `src/app/features/hospitals` |
| records | `medical-record-api.service.ts` | `rxResource` | `src/app/features/medical-records`, patient tabs |
| prescriptions | `prescription-api.service.ts` (+ `pharmacy-api.service.ts` for the async validator) | local streams | `src/app/features/prescriptions` |
| laboratory | `laboratory-api.service.ts` (multipart, blob) | Component Store `LabRequestStore` | `src/app/features/laboratory`, records documents |
| billing | `billing-api.service.ts` | Store: `src/app/state/*/billing.*` (class effects) | `src/app/features/billing`, dashboard |
| pharmacy | `pharmacy-api.service.ts` | Signal Store `PharmacyStore` | `src/app/features/pharmacy` |
| notifications | `notification-api.service.ts` | `NotificationCenterService` (RxJS polling) | `src/app/features/notifications`, header bell |

All services extend `BaseApiService` (`src/app/core/api/base-api.service.ts`), which builds URLs against the gateway, converts parameter objects to `HttpParams` and offers typed `get/post/put/patch/remove`.

## Unavailable or missing APIs
These are **gaps in the backend contract**. Per the specification none of them was mocked or worked around by inventing endpoints; the UI states the limitation where relevant.

| Requirement in the prompt | Backend reality | What the frontend does |
|---|---|---|
| MFA, OAuth 2.0 / social login, forgot & reset password | No endpoints | Not offered (login page says so); documented only |
| HttpOnly refresh-token cookie | Refresh token is returned in the JSON body | Access token in memory, refresh token in `sessionStorage` (never `localStorage`) – `src/app/core/auth/token-store.service.ts` |
| Notification "mark as read", unread flag, push/real-time | Notification Service stores no read state; no WebSocket/SSE | Read state kept **locally per user in the browser** (`src/app/core/services/notification-center.service.ts`) and labelled as such; list polled every 30 s |
| Hospital branches, facilities | Only hospitals + departments exist | Facilities tab renders the hospital's departments with an explicit notice; branches = separate hospital records |
| Medicine categories | `Medicine` has no category field | Filter by stock level and generic-name search instead |
| Patient document upload / generic medical documents | Only lab-report attachments are stored | "Medical documents" lists/downloads/uploads exactly those (`src/app/features/medical-records/medical-documents.component.ts`) |
| Prescription update, printing/PDF | Create + cancel only; no PDF endpoint | Cancel supported; print/download built client-side from the API data (`src/app/features/prescriptions/prescription-export.ts`, loaded by dynamic `import()`) |
| Appointment "confirm" action | Bookings are created as `BOOKED` and move to COMPLETED/CANCELLED only | Confirmation is the booking response; status actions = reschedule, cancel, complete |
| List of **all** appointments / "appointments by status" | Only by patient or by doctor | Admin feed = one query per doctor (`forkJoin` in the feed facade); search/filter client-side |
| Doctor-by-login lookup | None | Doctor list searched for `userId` (`CurrentIdentityService.doctor$`) |
| Dashboard statistics endpoint | None | Figures derived from real list endpoints (`totalElements` of status-filtered pages, `forkJoin` in `src/app/features/dashboard/dashboard.service.ts`); a failing/forbidden widget shows "n/a" (`timeout` + `catchError`) |
| Payment gateway | Simulated by the backend (`simulateOutcome`, manual confirm) | Same flow, labelled "simulated"; no card data |
| Lab-test booking with schedule | Lab "request" only | Request form (multi-test, `src/app/features/laboratory/lab-request-new.component.ts`) |
| Server-side sorting | Not supported on list endpoints | Client-side sorting of the loaded page/collection (PrimeNG `p-table`, Material `matSort`, `PharmacyStore`) |
| Pagination on hospitals, medicines, appointments, bills-by-patient, lab-by-patient, doctors' schedule | Arrays | Client-side pagination/filtering |

Also noted while testing: `GET /api/appointments/my` returns 403 for every non-patient role, and `GET /api/appointments/patient/{id}` is readable by LAB/PHARMACIST/BILLING staff although the backend's own table lists only A, D, P(own). The frontend does not rely on either behaviour.

## API integration status

Legend: ✔ implemented and exercised against the live gateway through the Angular UI in headless Chrome · ◐ implemented but not exercised against the shared data (reason given).

| Area | Status | Evidence |
|---|---|---|
| Login / refresh / logout / me / register | ✔ | login for ADMIN + 4 staff roles + a freshly registered PATIENT; a forced 401 on `GET /patients` triggered one refresh and a transparent replay; logout redirects to login; anonymous access redirected by `authGuard` |
| Users create / list / enable-disable | ◐ | the NgModule admin page (`/admin/users`) loads and lists accounts; creating/disabling accounts was not executed to avoid polluting the identity data |
| Hospitals list/detail, departments | ✔ | list, card expansion, details tabs; create/edit/deactivate forms open and validate but were not submitted against shared data |
| Patients create/list/search/detail/update | ✔ | registration (account + login + profile, 3 sequential calls), edit (saved), search, detail tabs, unsaved-changes guard |
| Doctors list/filter/detail/schedule/availability/unavailability/slots | ✔ | compare dialog, schedule tab, day off added and removed, bookings blocked on the day off |
| Appointments availability / book / reschedule / cancel | ✔ | booked (#27), taken slot disabled, reschedule, optimistic cancel; **complete** ◐ (only allowed after the appointment time has started) |
| Records entries/summary/conditions/documents | ✔ | patient record opens for the owning patient, denied (403 page) for another patient; entry dialog opens; documents page renders |
| Prescriptions create/list/detail/status/cancel | ✔ | generated (async medicine validation, FormArray), detail opened, status polled |
| Laboratory tests/requests/status/report/attachment | ✔ | request created, status SAMPLE_COLLECTED → IN_PROGRESS, report submitted and shown; attachment upload/download implemented but not exercised (needs a file) |
| Billing bills/payments | ✔ | invoice generated with line items, payment initiated and confirmed → PAID, settlement console |
| Pharmacy medicines/orders/dispense/restock | ✔ | orders listed (auto-created from the prescription events), dialog, restock (optimistic), **dispense** executed as PHARMACIST (order → DISPENSED); reject wired but not executed |
| Notifications list/my/detail/send | ✔ | Kafka-generated notifications listed with categories; admin send form opens/validates (not submitted) |
| Role/permission enforcement | ✔ | LAB_STAFF, PHARMACIST, BILLING_STAFF, DOCTOR and PATIENT visited routes of other roles → 403 page; `/admin/users` is a 404 for non-admins (`canMatch`) |

Test data note: the verification created records in the shared development databases (patient `Nila Patel` and its user `ngpat…`, an appointment, a prescription, lab requests, bills/payments, net +10 stock on *Amoxicillin 500mg* (three restocks of +5, one order dispensed) and prescriptions #15–#17, notifications generated by events) in addition to the data created by the React verification. Nothing existing was removed; a temporary doctor day off was added and removed again.
