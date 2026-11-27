# Server Actions and Backend (BFF)

## Division of responsibility — Node.js vs Next.js
| Concern | Node.js backend (unchanged) | Next.js (this project) |
|---|---|---|
| Business rules, validation of domain invariants (slot overlap, state transitions, ownership) | ✔ | ✘ (re-validates **input shape** only) |
| Persistence (10 MySQL databases), events (Kafka), JWT issuance | ✔ | ✘ |
| Rendering, routing, caching/ISR | ✘ | ✔ |
| Session cookies (HttpOnly), silent refresh, route protection | ✘ | ✔ |
| Aggregation (dashboard), file adaptation (download/upload/CSV), verb adaptation | ✘ | ✔ (thin BFF) |
| Preferences, notification read-state | ✘ | ✔ (cookies) |

## Server Actions (`src/actions/*.ts`, `'use server'`)
Common contract (`src/lib/actions/state.ts`): every action
1. calls **`authorize(permission)`** first (session cookie + permission table) — hiding a button is *not* authorization;
2. **validates** the payload with Zod (`safeParse`) — the same schema the browser used;
3. calls the backend through a server-only service;
4. **revalidates** (`updateTag`, `revalidateTag(tag,'max')`, `revalidatePath`);
5. returns a serialisable `ActionState<T> = { ok, message?, fieldErrors?, data? }`; backend validation `details` become `fieldErrors`; `redirect()`/`notFound()` control-flow errors are re-thrown by `failure()`.

| File | Actions | Invocation style |
|---|---|---|
| `auth.ts` | `loginAction`, `registerAccountAction`, `logoutAction` | `<form action>` + `useActionState` (progressive enhancement); sets HttpOnly cookies; `safeNext()` blocks open redirects |
| `patients.ts` | `registerPatientAction(values)`, `updatePatientAction(prev, FormData)`, `deactivatePatientAction(id)` | typed object from RHF; FormData + `useActionState`; direct call in a transition |
| `appointments.ts` | `bookAppointmentAction`, `cancelAppointmentAction`, `rescheduleAppointmentAction`, `completeAppointmentAction` | typed object; `useOptimistic` + transition; FormData |
| `doctors.ts` | `saveDoctorAction(id, values)`, `saveScheduleAction`, `addDayOffAction`, `removeDayOffAction` | typed object (RHF) |
| `hospitals.ts` | `saveHospitalAction`, `createDepartmentAction`, `deleteDepartmentAction` | **bound arguments**: `saveHospitalAction.bind(null, id)` |
| `prescriptions.ts` | `createPrescriptionAction(values)`, `cancelPrescriptionAction` | typed object (Formik) |
| `laboratory.ts` | `createLabRequestsAction`, `setLabStatusAction`, `createLabReportAction`, `cancelLabRequestAction` | typed object / FormData |
| `billing.ts` | `createBillAction`, `payBillAction`, `confirmPaymentAction`, `cancelBillAction` | typed object / FormData |
| `pharmacy.ts` | `dispenseOrderAction`, `rejectOrderAction`, `restockAction`, `createMedicineAction` | direct call / FormData |
| `notifications.ts` | `markNotificationsReadAction(ids)`, `sendNotificationAction` | direct call; FormData |
| `records.ts`, `users.ts` | `createRecordEntryAction`, `saveConditionsAction`, `setUserEnabledAction` | FormData / direct |
| *(inline)* `app/(dashboard)/notifications/page.tsx` | `markPageRead` | inline `'use server'` closure inside a Server Component |

**Server Functions** = the same functions when called from an event handler instead of a form (e.g. `restockAction(id, qty)` in `features/pharmacy/Dialogs.tsx`). Server Action arguments are untrusted input and validated; return values are plain JSON. Body limit: 6 MB (`next.config.ts`).

## Route Handlers (`src/app/api/**`)
| Route | Methods | Purpose | Auth |
|---|---|---|---|
| `/api/backend/[...path]` | GET POST PUT PATCH DELETE | Authenticated pass-through for browser Axios (token is HttpOnly); allow-list `patients, doctors, appointments, hospitals, departments, records, prescriptions, lab, bills, payments, pharmacy, notifications, auth/me`; streams body, preserves `content-type`/`content-disposition` | session |
| `/api/appointments/[appointmentId]` | GET PATCH PUT DELETE | Resource-style adapter over the backend's verb endpoints (`/reschedule`, `/complete`, `/cancel`) | session + permission |
| `/api/lab/requests/[requestId]/attachment` | GET POST | File **download** (stream) and **upload** (multipart; type + 5 MB validation → 415/413) | `lab:read` / `lab:process` |
| `/api/prescriptions/[prescriptionId]/download` | GET | Generated printable HTML as `attachment` | `prescriptions:read` |
| `/api/patients/export` | GET | Streaming CSV (pages pulled from the backend as the stream is consumed) | `patients:read` |
| `/api/dashboard/summary` | GET | Role-aware aggregation | session |
| `/api/dashboard/activity` | GET | NDJSON stream, metrics flushed as each finishes | session |
| `/api/preferences` | GET POST DELETE | Request cookies in / response cookies out (Zod-validated) | none (non-sensitive) |
| `/api/auth/session` | GET | Current user validated through `/auth/me` | session |
| `/api/auth/logout` | POST | Revoke refresh token, clear cookies (idle logout) | cookie |
| `/api/revalidate` | POST | On-demand ISR (`{tag}` or `{path}`), header `x-revalidate-secret` | secret |
| `/api/health` | GET | App + gateway health (public, `dynamic = 'force-dynamic'`) | none |

Why not mirror every backend endpoint? Only handlers that add value exist: token handling (pass-through), aggregation, file/stream adaptation, verb adaptation, cookies, revalidation. Everything else is called server-to-server from Server Components/Actions.

## Validation layers
Browser (Zod via RHF/Formik, HTML constraints) → **Server Action / Route Handler (Zod again)** → Node.js service (authoritative). Schemas live in `src/schemas/*.ts` and are shared by the first two.

## Server-side authentication & authorization
* `src/lib/auth/session.ts`: `getSession()` (cached per request), `requireSession()`, `requirePermission(permission)`, cookie helpers.
* `src/lib/auth/user.ts`: `getCurrentUser()` validates against `/auth/me` (disabled account → `/unauthorized`).
* `src/constants/permissions.ts`: permission → roles; mirrors the backend table (the backend remains the enforcement point).
* Pages call `requirePermission(...)`; actions call `authorize(...)`; handlers call `guard(...)` (`lib/api/route-helpers.ts`); `proxy.ts` adds a coarse route table.

## BFF architecture
Browser → (cookie) → Next.js → (Bearer JWT) → gateway. The gateway enforces role rules per prefix and rate limits; Next.js never accesses MySQL, Kafka or Redis.

## New Next.js endpoints and database
All endpoints above are **new Next.js endpoints** (no business duplication). **Database integration: none** — see [Database Architecture](NEXTJS_ARCHITECTURE.md#database-architecture). No tables, models or migrations were introduced; the existing databases were not touched.
