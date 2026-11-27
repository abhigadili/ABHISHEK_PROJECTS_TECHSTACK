# API Integration Documentation

Source of truth: the **running** backend (gateway at `http://localhost:30080`, per-service OpenAPI at `/docs-json/<service>`), the backend's own `routes.json`/docs under `NodeJS_Projects/HospitalManagement`, and live requests made on 2026-11-13. Nothing was invented and the backend was **not modified**.

## Existing Node.js backend location
`~/Documents/PROJECTS_TECKSTACK/NodeJS_Projects/HospitalManagement` — npm workspaces `api-gateway/`, `services/*-service`, `shared/`, `proto/`; Node 20, Express 5, Prisma 6 + MySQL (one database per service), Kafka, Redis, gRPC between services. Start: `docker compose up -d` then `scripts/start-all.sh` (it was **not running** at the start of this work; it was started and all 11 processes answered `/ping`).

## Backend API gateway information
A centralised gateway exists (Express + http-proxy-middleware, `api-gateway/config/routes.json`): validates the JWT, enforces role rules per prefix, rate-limits, adds correlation ids and returns JSON error bodies (401/403/404/429/503/504). **Every `/api/*` route except `/api/auth/login|register|refresh|logout` requires a Bearer JWT** — verified (`GET /api/hospitals` without a token → 401). Consequence for the public pages: a read-only server-side login (`PUBLIC_CATALOG_*`) is used by `src/lib/api/catalog.ts`.

| Prefix | Service (port) | Gateway role rule |
|---|---|---|
| `/api/auth`, `/api/hospitals`, `/api/departments` | Hospital (30104) | any authenticated |
| `/api/users` | Hospital | ADMIN |
| `/api/patients` | Patient (30101) | service-level |
| `/api/doctors` | Doctor (30102) | service-level |
| `/api/appointments` | Appointment (30103) | service-level |
| `/api/records` | Medical Records (30105) | service-level |
| `/api/prescriptions` | Prescription (30106) | service-level |
| `/api/lab` | Laboratory (30107) | ADMIN, DOCTOR, LAB_STAFF, PATIENT |
| `/api/bills`, `/api/payments` | Billing (30108) | ADMIN, BILLING_STAFF, PATIENT |
| `/api/pharmacy` | Pharmacy (30109) | ADMIN, PHARMACIST, DOCTOR |
| `/api/notifications` | Notification (30110) | service-level |

## Verified API base URLs
| What | Value | Verified |
|---|---|---|
| Gateway (only URL the Next.js server uses) | `http://localhost:30080` (`NODE_API_BASE_URL`) | ✔ `/gateway/ping`, login 200, list endpoints 200 |
| Service ports | 30101–30110 | ✔ listening — **not used** by Next.js |
| gRPC 30201/30202/30204, Kafka 39092, Redis 36379, MySQL 3306 | internal | not used by Next.js |

Configured vs operational: the table in "API integration status" lists what was actually exercised through this application; endpoints marked *wired* exist in code and the backend lists them, but were not executed during verification.

## Microservice and database information
| Service | Database (backend-owned) | Next.js module |
|---|---|---|
| Hospital (+ identity/JWT) | HospitalDB | hospitals, authentication, admin users |
| Patient | PatientDB | patients |
| Doctor | DoctorDB | doctors |
| Appointment | AppointmentDB | appointments |
| Medical Records | MedicalRecordsDB | medical records |
| Prescription | PrescriptionDB | prescriptions |
| Laboratory | LaboratoryDB | laboratory |
| Billing | BillingDB | billing |
| Pharmacy | PharmacyDB | pharmacy |
| Notification | NotificationDB | notifications |

Next.js accesses **none** of these databases directly.

## Authentication requirements
* `POST /api/auth/login {username,password}` → `{accessToken, refreshToken, tokenType:"Bearer", expiresInSeconds:900, user}`. Access token HS256 JWT, 15 min, claims include `sub`, `preferred_username`, `email`, `roles`, `exp`.
* Refresh token opaque, 7 days, **rotating** (`POST /api/auth/refresh`); reuse revokes the family. `POST /api/auth/logout {refreshToken}` → 204. `GET /api/auth/me`. `POST /api/auth/register {username,email,password}` → PATIENT account.
* **Not supported by the backend** (not implemented here): OAuth 2.0 / OIDC, MFA, password reset, HttpOnly refresh cookie, push/WebSocket notifications.
* Next.js stores the pair in HttpOnly cookies (`hms_at`, `hms_rt`) and sends `Authorization: Bearer` server-side.

## Error handling
Every service and the gateway return `{timestamp, status, error, message, path, details: ["field: message", …]}`. `lib/utilities/api-error.ts` converts it to `ApiError(status, message, details, fieldErrors)` on the server (`backendFetch`), in Server Actions (`failure()` → `ActionState.fieldErrors`), in Route Handlers (`errorResponse()`), and in the browser (Axios interceptor). Network failure/timeouts → `ApiError(0, …, isNetworkError)`; 401 → refresh (proxy) or login; 403 → `/access-denied` or an inline message.

## API endpoints used
Paths are relative to the gateway. Pagination `?page=0&size=20` → `{content, page, size, totalElements, totalPages}`.

| Area | Method | Path | Used by (Next.js) |
|---|---|---|---|
| Auth | POST | `/api/auth/login`, `/register`, `/refresh`, `/logout` | `services/backend/auth.ts`, `actions/auth.ts`, `proxy.ts` |
| Auth | GET | `/api/auth/me` | `lib/auth/user.ts`, `api/auth/session` |
| Users | GET/POST/PATCH | `/api/users`, `/api/users/{id}/enabled` | admin users page, doctor creation with login |
| Hospitals | GET/POST/PUT | `/api/hospitals`, `/{id}` | `services/backend/hospitals.ts`, `lib/api/catalog.ts` |
| Departments | GET/POST/DELETE | `/api/hospitals/{id}/departments`, `/api/departments/{id}` | hospital page |
| Patients | POST/GET/PUT/DELETE | `/api/patients`, `?q=&page=&size=`, `/{id}`, `/by-user/{userId}/profile` | `services/backend/patients.ts` |
| Doctors | GET | `/api/doctors?specialization&hospitalId&departmentId&active&page&size`, `/specializations`, `/available?date`, `/{id}`, `/{id}/slots`, `/{id}/schedule`, `/{id}/unavailability` | `services/backend/doctors.ts`, Axios |
| Doctors | POST/PUT/DELETE | `/api/doctors`, `/{id}`, `/{id}/schedule` (`{days:[…]}`), `/{id}/unavailability[/{uid}]` | `actions/doctors.ts` |
| Appointments | GET | `/api/appointments/availability?doctorId&date`, `/patient/{id}`, `/doctor/{id}?date`, `/{id}` | services + Axios |
| Appointments | POST/PUT | `/api/appointments`, `/{id}/reschedule`, `/{id}/cancel`, `/{id}/complete` | `actions/appointments.ts`, `api/appointments/[id]` |
| Records | GET/POST/PUT | `/api/records/patients/{id}/entries`, `/summary`, `/entries/{id}`, `/entries`, `/patients/{id}/conditions` | `services/backend/records.ts` |
| Prescriptions | POST/GET/PUT | `/api/prescriptions`, `/{id}`, `/patient/{id}`, `/doctor/{id}`, `/{id}/cancel` | `services/backend/prescriptions.ts` |
| Laboratory | GET/POST/PUT | `/api/lab/tests`, `/requests`, `/requests/{id}`, `/requests/patient/{id}`, `/{id}/status`, `/{id}/cancel`, `/{id}/report`, `/{id}/report/attachment` (multipart / binary) | `services/backend/laboratory.ts`, `api/lab/**` |
| Billing | GET/POST/PUT | `/api/bills`, `/{id}`, `/patient/{id}`, `/{id}/payments`, `/{id}/cancel`, `/api/payments/{ref}/status` | `services/backend/billing.ts` |
| Pharmacy | GET/POST | `/api/pharmacy/medicines`, `/medicines/{id}/restock`, `/orders`, `/orders/{id}`, `/orders/prescription/{id}`, `/orders/{id}/dispense`, `/reject` | `services/backend/pharmacy.ts` |
| Notifications | GET/POST | `/api/notifications/my`, `/api/notifications`, `/{id}`, `/send` | `services/backend/notifications.ts` |

Request payload and response field definitions are typed in `src/types/*.ts` (copied from the contract verified against the gateway) and validated on input by `src/schemas/*.ts`.

## Role access matrix (observed GET statuses)
| Endpoint group | ADMIN | DOCTOR | LAB_STAFF | PHARMACIST | BILLING_STAFF | PATIENT |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| hospitals, departments, doctors, availability | 200 | 200 | 200 | 200 | 200 | 200 |
| patients (list) | 200 | 200 | 200 | 200 | 200 | 403 |
| `/users` | 200 | 403 | 403 | 403 | 403 | 403 |
| `/records/**` | 200 | 200 | 403 | 403 | 403 | own |
| `/lab/**` | 200 | 200 | 200 | 403 | 403 | own |
| `/bills/**` | 200 | 403 | 403 | 403 | 200 | own |
| `/pharmacy/**` | 200 | meds only | 403 | 200 | 403 | 403 |
| `/notifications/my` | 200 | 200 | 200 | 200 | 200 | 200 |

The PATIENT column follows the backend documentation and the ownership rules enforced by the services (the staff columns were observed live). The UI and `proxy.ts` mirror this in `src/constants/permissions.ts`; verified by navigating every route per role (denied routes land on `/access-denied`).

## API mapping to Next.js modules
See the "Next.js module" column above and `src/services/backend/<service>.ts` (server) / `src/services/api/clientApis.ts` (browser via BFF).

## Unavailable or missing APIs (documented, not mocked)
| Brief requirement | Backend reality | What the app does |
|---|---|---|
| MFA, OAuth 2.0, forgot/reset password | No endpoints | Not offered; notice on the login page |
| HttpOnly refresh cookie from backend | Refresh token only in JSON | Next.js stores it in an HttpOnly cookie itself |
| Notification read flag / push / real time | None | Read ids in a cookie written by a Server Action; 30 s polling |
| Hospital branches / facilities | Only hospitals + departments | Departments shown as facilities; generic facility list labelled as such on the public page |
| Medicine categories | No field | Filter by stock level / name |
| Patient document upload, generic documents | Only lab-report attachments | Documents tab lists/downloads those |
| Prescription update, PDF | Create + cancel only | Print + generated downloadable HTML |
| Appointment "confirm" | Created as BOOKED | Confirmation = booking response |
| List all appointments | Only by patient or doctor | Aggregated per doctor (`useQueries` / `getAppointmentStats`) |
| Doctor by login | None | List searched by `userId` |
| Dashboard statistics | None | Derived from real list endpoints (`n/a` when a role cannot read) |
| Payment gateway | Simulated by backend | Same flow, labelled simulated |
| Server-side sorting | Not supported | Client-side sorting |
| Hospitals/medicines/bills-by-patient arrays | Un-paged | Client-side pagination |

## API integration status
✔ = exercised through this application against the live backend on 2026-11-13; *wired* = implemented but not executed.

| Area | Status | Evidence |
|---|---|---|
| Login, register, silent refresh | ✔ | browser login for 6 roles; registration → auto login; expired-token refresh by deleting `hms_at` |
| Logout | ✔ (user menu → Sign out → `/login`); idle logout *wired* | `logoutAction` (revokes the refresh token), `/api/auth/logout` |
| Patients create/list/search/detail/update | ✔ | registration wizard, edit form, CSV export; deactivate *wired* |
| Doctors list/detail/create/update/schedule | ✔ | created + edited + schedule saved; days off *wired* |
| Appointments availability/book/list/detail/cancel | ✔ | booked as patient, intercepting modal, optimistic cancel, occupied slot shown; reschedule/complete *wired* |
| Medical records read | ✔ | pages load for all permitted roles; add entry / conditions *wired* |
| Prescriptions create/detail/download | ✔ | Formik form with validation errors, created, downloaded; cancel *wired* |
| Laboratory | ✔ | 2-test request, status workflow, report, attachment upload/download, wrong type rejected |
| Billing | ✔ | manual bill, payment with simulated success → Paid; confirm/cancel *wired* |
| Pharmacy | ✔ | prescription → order → dispense, restock; reject/create medicine *wired* |
| Notifications | ✔ | admin send, patient unread/mark-all-read |
| Users | ✔ list / *wired* toggle | `/admin/users` |
| Role matrix | ✔ | smoke navigation as admin, doctor1, labstaff1, pharmacist1, billing1 and a self-registered patient |

Test-data side effects in the shared dev databases: test patients (`Test Patient…`, `E2E Patient…`), their appointments/lab requests/prescriptions/bills, doctors `Zed Tester…`, a `hms-public-catalog` PATIENT account (used by the public pages) and `pat_*`/`e2e_pat_*` accounts; one department was created and deleted; +5 stock on one medicine.
