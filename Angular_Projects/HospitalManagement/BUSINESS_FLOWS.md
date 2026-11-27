# Business Flows

The six business scenarios of the specification, each traced from the user's action through the Angular code to the backend call and back. Every flow was executed against the live backend through the browser (headless Chrome) – results are in [IMPLEMENTATION_CHANGELOG.md](IMPLEMENTATION_CHANGELOG.md#verification-results). Backend endpoints are described in [API_INTEGRATION_DOCUMENTATION.md](API_INTEGRATION_DOCUMENTATION.md).

Cross-service effects are **asynchronous (Kafka)** in the backend: after the triggering call, bills, notifications, pharmacy orders, accession numbers and medical-record entries appear ~1–3 seconds later. The UI says so where it matters.

---

## 1. Patient registration
**UI:** Material · **Route:** `/auth/register` (also `/patients/new` for staff) · **Files:** `src/app/features/patients/patient-register.component.ts`, `src/app/features/patients/patient-form.component.ts`

1. The visitor fills one typed Reactive Form (nested groups *personal / contact / address / emergency*, account fields for anonymous visitors). Validators: required, e-mail, phone (`phoneValidator`), date of birth in the past (`pastDateValidator`), `strongPassword`, `matchFields('password','confirm')` – all in `src/app/shared/validators/validators.ts`. Errors are shown per field (`mat-error`) and after submit for the whole form; a "Show fewer fields" toggle collapses optional sections.
2. Submit pushes the value into a `Subject` guarded by **`exhaustMap`** (double-click safe).
3. Calls run **sequentially with `concatMap`**: `POST /api/auth/register` (PATIENT account) → `POST /api/auth/login` → `POST /api/patients` (profile bound to the login). A failure in step 3 keeps the account and signed-in session and tells the user to fix the data and resubmit (partial-success message) – no orphan state.
4. Backend `409` (duplicate e-mail/phone/identity) and `400 details[]` are mapped back onto the form fields (`serverErrors` input of the form).
5. Success card ("registered as patient #N") with a link to `/profile` (`src/app/features/patients/patient-profile.component.ts`); an event `patient-registered` goes onto the event bus (`src/app/core/services/event-bus.service.ts`). The backend asynchronously queues a welcome notification.
6. Staff can later edit (`/patients/:id/edit`, `src/app/features/patients/patient-edit.component.ts`; protected by `unsavedChangesGuard`), search (`src/app/features/patients/patient-list.component.ts`, Material table, server-side paging) and deactivate (admin).
**Verified:** empty submit shows errors; weak/mismatched password rejected client-side; registration creates the account, logs in and creates profile #13; profile page shows it.

## 2. Appointment booking
**UI:** Tailwind · **Route:** `/appointments/book` · **Files:** `src/app/features/appointments/appointment-book.component.ts`, `src/app/shared/components/slot-picker.component.ts`, `src/app/state/effects/appointments.effects.ts`

1. Choose **date** and optionally **specialization/doctor name** → `GET /api/doctors/available?date=&specialization=` (`switchMap` + `debounceTime` so typing cancels stale queries).
2. Choose a doctor → `GET /api/appointments/availability?doctorId=&date=`; slots are grouped Morning/Afternoon/Evening, **booked slots are disabled and struck through**. The selected time is a `linkedSignal` that resets when doctor or date change.
3. Patient: a PATIENT books for themself (profile resolved by `CurrentIdentityService`), staff pick a patient with the shared `PatientPicker`. Optional reason.
4. **Confirm** dispatches the NgRx action; the effect uses **`exhaustMap`** (`POST /api/appointments`). Errors: `409` slot taken/overlap, `400` invalid slot → shown inline and the availability is refreshed.
5. On success the entity is upserted into the store, a confirmation card is shown (appointment number, time, fee) with the notice that the **consultation bill and the confirmation e-mail are created asynchronously** (Billing and Notification services).
6. Afterwards: details page with lifecycle hooks demo and countdown (`appointment-details.component.ts`), **reschedule** (`appointment-reschedule.component.ts`, new slot, `PUT …/reschedule`), **cancel** with reason (optimistic update in the reducer + rollback on error), **complete** (doctor/admin; backend only allows it once the appointment has started).
**Verified:** a patient booked appointment #27; the same slot was then disabled; rescheduling moved it; cancelling flagged it immediately and reconciled with the server.

## 3. Doctor availability management
**UI:** Material (doctor area) + Tailwind (appointments) · **Routes:** `/doctors/:doctorId/schedule`, `/doctors/:doctorId/availability`, `/appointments/availability` · **Files:** `src/app/features/doctors/doctor-tabs.component.ts`, `src/app/features/appointments/appointment-availability.component.ts`

1. **Weekly schedule** (ADMIN or the doctor themself): a typed `FormArray` of working-day rows (day, start, end, slot minutes, optional break) with a cross-field validator (`timeOrder`) – "Add working day", "Remove row n", Save → `PUT /api/doctors/{id}/schedule` (replaces the template).
2. **Days off:** `POST /api/doctors/{id}/unavailability {date, reason}` and `DELETE …/{uid}`; listed in the availability tab.
3. **Availability view:** two `resource()` loaders react to one signal request (`{doctorId, date}`): slots (`GET /doctors/{id}/slots`) and booked appointments (`GET /appointments/doctor/{id}?date=`), shown side by side; the picked slot is a `linkedSignal`.
4. The booking page immediately reflects the change (a day off removes the doctor from `available` for that date).
**Verified:** a day off was added in the UI → the doctor disappeared from booking for that date → the day off was removed again (confirmed via the API).

## 4. Lab request → report
**UI:** PrimeNG · **Routes:** `/laboratory`, `/laboratory/requests`, `/laboratory/requests/new`, `/laboratory/requests/:id`, `/laboratory/history` · **Files:** `src/app/features/laboratory/*`, `src/app/state/feature-stores/lab-request.store.ts`

1. **Catalogue** (`lab-catalogue.component.ts`): `GET /lab/tests` in a sortable/filterable/paged `p-table`.
2. **Request builder** (`lab-request-new.component.ts`): patient (shared picker), doctor, priority (ROUTINE/URGENT/STAT), **dynamic FormArray of tests** (options exclude tests already chosen), notes. State lives in the component-scoped **`LabRequestStore`** (NgRx Component Store, provided by the component). Submit → store effect: `exhaustMap` + `forkJoin` of one `POST /lab/requests` per test; each outcome (created / error) is listed, one failing test does not block the others. Accession numbers appear a moment later (Kafka).
3. **List** (`lab-requests.component.ts`): staff get a server-paged lazy `p-table` with status filter (`GET /lab/requests?status=&page=&size=`); a PATIENT sees their own requests (`/lab/requests/patient/{id}`) because the staff list is 403 for patients; the same component is the **history** page (staff pick a patient).
4. **Processing** (`lab-request-details.component.ts`, LAB_STAFF/ADMIN): `PUT …/status` REQUESTED → SAMPLE_COLLECTED → IN_PROGRESS; the report form (summary, details, reference range, abnormal flag; `POST …/report`, only valid while IN_PROGRESS) completes the request; optional attachment upload (PDF/PNG/JPEG ≤ 5 MB, progress bar from `HttpEventType.UploadProgress`) and blob download.
5. The report is fetched only once the request is COMPLETED (no probing 404). Backend events create a medical-record entry (`LAB_REPORT`) and a notification.
**Verified:** request created for patient #7, status progressed to IN_PROGRESS, report submitted and displayed.

## 5. Prescription generation
**UI:** Angular Material · **Routes:** `/prescriptions`, `/prescriptions/new`, `/prescriptions/:id` · **Files:** `src/app/features/prescriptions/*`

1. Doctor (or admin) opens **New prescription** (optionally prefilled from an appointment via `?patientId=&doctorId=&appointmentId=`, bound to inputs).
2. **Retrieve patient information:** choosing a patient triggers a fresh `GET /patients/{id}`; the **known allergies** are shown while prescribing. A DOCTOR prescribes as themself (profile resolved from the doctor list); an admin picks the doctor.
3. Diagnosis, notes, validity (1–365 days) and a **FormArray of medicines**: name (Material autocomplete from the live pharmacy catalogue), dosage (`dosageValidator`, e.g. `500mg`), frequency (OD/BD/TID/QID/HS/SOS/Weekly), days, quantity, instructions. Rows can be added/removed; a cross-row validator rejects duplicates.
4. **Async validator** `existsInCatalogue` checks the medicine against the cached catalogue (`GET /pharmacy/medicines`, `shareReplay`) and shows "checking inventory…" while pending; submit waits for pending validators.
5. Submit → **`exhaustMap`** → `POST /api/prescriptions`; the generated prescription is displayed (`prescription-view.component.ts`) with **Print** and **Download** (HTML built client-side by `prescription-export.ts`, loaded with a dynamic `import()` because the backend has no PDF endpoint).
6. Details (`prescription-details.component.ts`): live status polled every 10 s (`GET /prescriptions/{id}/status`), cancel (`PUT …/cancel`, confirmation dialog). The list (`prescription-list.component.ts`) is per patient / per doctor because the backend has no list-all.
7. Backend events: the Pharmacy Service creates an order (PENDING), a medical-record entry and a notification are created.
**Verified:** unknown medicine rejected by the async validator; add/remove rows; prescriptions #15–#17 created (one per run); details page; the pharmacy order appeared and a pharmacist dispensed it.

## 6. Billing and payment
**UI:** Bootstrap (scoped) · **Routes:** `/billing`, `/billing/invoices`, `/billing/invoices/:billId`, `/billing/payments`, `/billing/generate` · **Files:** `src/app/features/billing/*`, `src/app/state/{actions,reducers,selectors,effects}/billing.*`

1. **Invoices** are created by the backend automatically (appointment consultation, lab report, dispensed medicine – asynchronous) or manually by staff (`billing-generate.component.ts`: patient, type, FormArray of line items with the custom `QuantityStepper` form control, live total, `POST /bills`).
2. **Dashboard** (`billing-dashboard.component.ts`): counts per status, outstanding and collected amounts – NgRx memoised selectors over the loaded invoices.
3. **Invoice list** (`billing-invoices.component.ts`): status filter + paging (server-side), search (client-side); role-aware loading (staff `GET /bills?status=&page=&size=`, patient `GET /bills/patient/{id}`).
4. **Pay** (`billing-details.component.ts`): choose method (UPI/CARD/NET_BANKING/CASH/INSURANCE – **no card data exists anywhere**), `POST /bills/{id}/payments`. The effect uses **`exhaustMap`** (no double charge) and reloads the invoice. The payment gateway is **simulated by the backend**: payments start `PENDING`; ADMIN/BILLING_STAFF confirm (`PUT /payments/{ref}/status`) → invoice `PAID` (patients see "awaiting confirmation").
5. **Payment console** (`billing-payments.component.ts`): select several payable invoices and settle them with **`concatMap`** sequentially (pay → confirm per invoice, failures isolated, results table).
6. Cancel invoice (staff, confirmation dialog); payment completion emits an event on the event bus; the backend sends payment notifications.
**Verified:** the live total follows the quantity stepper (3 × $40 = $120); a $150 invoice was generated, redirected to its details, the payment was initiated and confirmed → status `PAID`; invoices list, dashboard and payment console load for ADMIN and BILLING_STAFF.

---

## Cross-cutting flows
| Flow | Behaviour | Files |
|---|---|---|
| Sign in / out | login, redirect back to the requested URL, session restore on reload, idle logout, token renewal | `src/app/features/authentication/login.component.ts`, `src/app/core/auth/auth.service.ts`, `src/app/core/services/session-manager.service.ts` |
| Token refresh | 401 → single refresh → replay | `src/app/core/interceptors/auth.interceptor.ts` |
| Authorization | permission guards, `*appHasPermission`, 403 page | `src/app/core/guards/auth.guards.ts`, `src/app/shared/directives/directives.ts` |
| Notifications | polling feed, categories, unread (local), details with deep-links, admin send | `src/app/features/notifications/*`, `src/app/core/services/notification-center.service.ts` |
| Medical record | timeline (virtual scroll), summary, entries, documents; patients may open only their own | `src/app/features/medical-records/*`, `src/app/core/guards/patient-ownership.guard.ts` |
| Loading / error / empty states | skeletons, error state with retry, empty state | `src/app/shared/components/state-views.component.ts` |
