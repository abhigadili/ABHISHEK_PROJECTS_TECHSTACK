# API Integration Documentation

Everything in this document was taken from the **running** backend (OpenAPI documents served at `http://localhost:30080/docs-json/<service>`, the backend's own docs under `NodeJS_Projects/HospitalManagement/docs`, and live requests made on 2026-11-12). Nothing was invented and the backend was **not modified**.

## Contents
1. [Backend project location](#backend-project-location) · 2. [Gateway information](#backend-api-gateway-information) · 3. [Verified base URLs](#verified-api-base-urls) · 4. [Microservices](#microservice-information) · 5. [Authentication](#authentication-requirements) · 6. [Error handling](#error-handling) · 7. [Endpoints](#api-endpoints) · 8. [Mapping to React modules](#api-mapping-to-react-modules) · 9. [Unavailable or missing APIs](#unavailable-or-missing-apis) · 10. [Integration status](#api-integration-status)

## Backend project location
`~/Documents/PROJECTS_TECKSTACK/NodeJS_Projects/HospitalManagement` (npm workspaces: `api-gateway/`, `services/*-service`, `shared/`, `proto/`). Node 20, Express 5, Prisma 6 + MySQL (one database per service), Kafka, Redis, gRPC between services. The React project only ever talks HTTP to the gateway – never to MySQL, Kafka, Redis, gRPC or a service port.

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
| Frontend → gateway | `VITE_API_BASE_URL=http://localhost:30080` (+ `VITE_USE_PROXY=true`: browser calls `/api/*` on the Vite origin, Vite proxies to the gateway) | ✔ (proxy and direct mode both work; CORS preflight returns 204) |

Configured vs. operational: the endpoint inventory below was exercised live per role (`GET` on every read endpoint for ADMIN, DOCTOR, LAB_STAFF, PHARMACIST, BILLING_STAFF; all write endpoints used by the UI were exercised through the browser, see [integration status](#api-integration-status)). Every configured endpoint listed answered; the 403s in the matrix are role restrictions, not outages.

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

Events between services (Kafka) are asynchronous: e.g. a booked appointment creates a bill and a notification a moment later, a report creates a medical-record entry, a prescription creates a pharmacy order. The frontend therefore re-invalidates the affected query groups again after ~2.5 s (see `useBookAppointment`, `useCreateLabRequests`, `useDispatchOrder`, `useConfirmPayment`).

## Authentication requirements
* `POST /api/auth/login {username, password}` → `{accessToken, refreshToken, tokenType:"Bearer", expiresInSeconds:900, user:{id,username,email,role,enabled}}`.
* Access token: HS256 JWT, 15 minutes, claims `sub, preferred_username, email, roles, iss=hospital-identity, aud=hospital-api, iat, exp, jti`.
* Refresh token: opaque, 7 days, **rotating**; `POST /api/auth/refresh {refreshToken}` returns a new pair and revokes the old one; re-using an old token revokes the whole family (401).
* `POST /api/auth/logout {refreshToken}` → 204. `GET /api/auth/me`. `POST /api/auth/register {username,email,password}` → PATIENT account (username 4–60 `[A-Za-z0-9._-]`, password 8–72 with upper, lower, digit).
* Login lock-out: 8 failures lock the account for 5 minutes; `/api/auth/*` is rate-limited (429).
* **No** OAuth 2 / OIDC, **no** MFA, **no** HttpOnly cookie, **no** password reset – see [missing APIs](#unavailable-or-missing-apis).
* Frontend contract: `Authorization: Bearer <accessToken>` on every call except login/register/refresh/logout (`src/services/axios/client.ts`, `src/services/api/fetchClient.ts`); tokens in `src/services/axios/tokenStore.ts`.

## Error handling
Every service and the gateway return the same body:
```json
{ "timestamp": "...", "status": 400, "error": "Bad Request", "message": "Validation failed", "path": "/api/patients", "details": ["email: must be a well-formed email address"] }
```
`400` validation (details = `field: message`) · `401` missing/expired token or bad credentials · `403` role/ownership · `404` · `409` duplicate / invalid state / slot taken / payment in progress · `429` rate limit · `503` dependency down (circuit breaker) · `504` gateway timeout.

Frontend handling (single implementation, `src/services/axios/errors.ts`): every failure becomes an `ApiError` (`status`, `message`, `details[]`, `fieldErrors{}`, `isNetworkError`, `isTimeout`, `correlationId`). `fieldErrors` is parsed from `details` and mapped back onto form fields (Formik `setErrors`, RHF `setError`, local state); 401 → single-flight refresh + replay, otherwise session-expired logout; 403 → toast + `/access-denied` for route-level violations; network/timeout → friendly message with retry; GET requests are retried automatically (network, 502/503/504); `QueryCache`/`MutationCache` in `src/app/queryClient.ts` turn failures into toasts.

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

There is **no** "doctor by login" endpoint; the frontend resolves it from the doctor list (`useCurrentDoctor`).

### Appointments
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/appointments/availability?doctorId=&date=` | any | `[{startTime,endTime,available}]` – booked slots are `available:false` |
| POST | `/appointments` | A, P(own) | `{patientId,doctorId,date,startTime,reason?}` → 201 `Appointment`; 400 invalid slot, 409 overlap |
| GET | `/appointments/{id}`, `/appointments/patient/{patientId}`, `/appointments/doctor/{doctorId}?date=` | role rules | arrays (not paged) |
| GET | `/appointments/my` | P | the caller's appointments (the UI uses the patient endpoint instead) |
| PUT | `/appointments/{id}/reschedule` `{date,startTime}`, `/cancel` `{reason?}`, `/complete` `{notes?}` | A / D / P(own) | complete only once the appointment time has started |

`Appointment`: `id, patientId, patientName, doctorId, doctorName, date, startTime, endTime, status (BOOKED|COMPLETED|CANCELLED|MISSED…), reason, cancelReason, notes, fee, paymentStatus (NOT_BILLED|PENDING|PAID|FAILED), billNumber, createdAt`.
**There is no endpoint that lists all appointments** – the frontend composes the admin view from `/appointments/doctor/{id}` for every doctor.

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

The frontend mirrors this table in `src/constants/permissions.ts` so users are not offered screens that would answer 403.

## API mapping to React modules

| Backend area | API module (`src/services/endpoints`) | Query keys (`src/services/queryKeys.ts`) | Feature module(s) |
|---|---|---|---|
| auth, users | `authApi.ts` | `auth` | `features/authentication`, `contexts/AuthContext.tsx`, doctor form (create login) |
| patients | `patientApi.ts` (Axios) | `patients` | `features/patients`, appointments, prescriptions, lab, billing (patient picker) |
| doctors | `doctorApi.ts` (Axios) | `doctors` | `features/doctors`, appointments (available doctors, slots) |
| appointments | `appointmentApi.ts` | `appointments` | `features/appointments`, dashboard, doctors tabs |
| hospitals, departments | `hospitalApi.ts` | `hospitals` | `features/hospitals`, doctor filters/forms |
| records | `recordsApi.ts` (**Fetch API**) | `records` | `features/medical-records`, patient tabs |
| prescriptions | `prescriptionApi.ts` | `prescriptions` | `features/prescriptions`, pharmacy lookup |
| laboratory | `laboratoryApi.ts` (Axios; multipart, blob) | `laboratory` | `features/laboratory`, records documents (Fetch) |
| billing | `billingApi.ts` | `billing` | `features/billing` (+ Redux thunk), dashboard |
| pharmacy | `pharmacyApi.ts` | `pharmacy` | `features/pharmacy` |
| notifications | `notificationApi.ts` | `notifications` | `contexts/NotificationsContext.tsx`, `features/notifications` |

## Unavailable or missing APIs
These are **gaps in the backend contract**. Per the specification none of them was mocked or worked around by inventing endpoints; the UI states the limitation where relevant.

| Requirement in the prompt | Backend reality | What the frontend does |
|---|---|---|
| MFA, OAuth 2.0 / social login, forgot & reset password | No endpoints | Not offered (login page says so); documented only |
| HttpOnly refresh-token cookie | Refresh token is returned in the JSON body | Access token in memory, refresh token in `sessionStorage` (never `localStorage`) |
| Notification "mark as read", unread flag, push/real-time | Notification Service stores no read state; no WebSocket/SSE | Read state kept **locally per user in the browser** and labelled as such; list polled every 30 s |
| Hospital branches, facilities | Only hospitals + departments exist | Facilities tab renders the hospital's departments with an explicit notice; branches = separate hospital records |
| Medicine categories | `Medicine` has no category field | Filter by stock level and generic-name search instead |
| Patient document upload / generic medical documents | Only lab-report attachments are stored | "Medical documents" lists/downloads/uploads exactly those (Fetch API) |
| Prescription update, printing/PDF | Create + cancel only; no PDF endpoint | Cancel supported; print/download built client-side from the API data |
| Appointment "confirm" action | Bookings are created as `BOOKED` and move to COMPLETED/CANCELLED only | Confirmation is the booking response; status actions = reschedule, cancel, complete |
| List of **all** appointments / "appointments by status" | Only by patient or by doctor | Admin feed = one query per doctor (`useQueries`); search/filter client-side |
| Doctor-by-login lookup | None | Doctor list searched for `userId` (`useCurrentDoctor`) |
| Dashboard statistics endpoint | None | Figures derived from real list endpoints (`totalElements` of size-1 pages, status-filtered lists); unreadable figures show "n/a" |
| Payment gateway | Simulated by the backend (`simulateOutcome`, manual confirm) | Same flow, labelled "simulated"; no card data |
| Lab-test booking with schedule | Lab "request" only | Request form (multi-test) |
| Server-side sorting | Not supported on list endpoints | Client-side sorting of the loaded page/collection |
| Pagination on hospitals, medicines, appointments, bills-by-patient, lab-by-patient, doctors' schedule | Arrays | Client-side pagination/filtering |

Also noted while testing: `GET /api/appointments/my` returns 403 for every non-patient role, and `GET /api/appointments/patient/{id}` is readable by LAB/PHARMACIST/BILLING staff although the backend's own table lists only A, D, P(own). The frontend does not rely on either behaviour.

## API integration status

Legend: ✔ implemented and exercised against the live gateway (browser-driven) · ◐ implemented, exercised through code paths that are not reachable for the seeded data (see note) · – not applicable.

| Area | Status | Evidence |
|---|---|---|
| Login / refresh / logout / me / register | ✔ | login for 6 roles, 401→refresh→replay (intercepted 401), logout, redirect-after-login, registration wizard |
| Users create (doctor with login) | ✔ | doctor registration with login (2 sequential calls) |
| Users list / enable-disable | ◐ | client function exists (`authApi.users`), no screen requested by the specification |
| Hospitals list/detail/update/deactivate, departments CRUD | ✔ | department create + delete exercised; hospital create/edit forms load, deactivate not executed against shared data |
| Patients create/list/search/detail/update | ✔ | registration, edit (Formik), search; deactivate wired (confirmation dialog) but not executed to keep the shared data usable |
| Doctors create/list/filter/detail/schedule/unavailability/slots/available | ✔ | doctor + schedule created in the UI, availability views, days-off controls |
| Appointments availability/book/list/detail/reschedule/cancel | ✔ | booking, duplicate booking (409), reschedule, optimistic cancel + slot release |
| Appointments complete | ◐ | only allowed after the appointment starts; all test bookings are in the future |
| Records entries/summary/conditions/documents | ✔ | timeline, summary, event entry details, document download (Fetch); create-entry dialog and condition edit wired |
| Prescriptions create/list/detail/status/cancel | ✔ | generation with validation, details, download; pharmacy order created by event |
| Laboratory tests/requests/status workflow/report/attachment | ✔ | 2 parallel requests, status transitions, report, upload, download |
| Billing bills/payments | ✔ | event-created bills, sequential settlement thunk, staff confirmation, simulated forced success, manual bill |
| Pharmacy medicines/orders/dispense/restock | ✔ | dispense, restock (optimistic), search, availability lookup; reject dialog wired |
| Notifications list/my/detail/send | ✔ | patient list + read tracking, admin send (React 19 action) |
| Role/permission enforcement | ✔ | 5 staff roles smoke-tested over their routes; patient blocked from staff routes (403 page) |

Test data note: the verification created records in the shared development databases (patients/doctors named `Meera Nair…` / `Sunil Verma…`, their appointments, prescriptions, lab requests, bills). Nothing existing was changed or removed except a test department that was created and deleted again and +10 stock on *Paracetamol 500mg*.
