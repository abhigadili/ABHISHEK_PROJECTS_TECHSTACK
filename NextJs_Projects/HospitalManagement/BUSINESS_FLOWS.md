# Business Flows

Each flow was driven end-to-end in a real browser (system Chrome) against the production build and the live backend.

## 1. Patient Registration
1. **Anonymous visitor** → `/register` (`app/(auth)/register/page.tsx`, `features/authentication/RegisterAccountForm.tsx`): form `action` = `registerAccountAction` (`actions/auth.ts`) — Zod `accountSchema` (username/e-mail/password rules, cross-field confirm) → `authService.register` → `authService.login` → HttpOnly cookies → `redirect('/patients/register')`. (Staff skip this step and open `/patients/register` directly.)
2. `/patients/register` (`app/(dashboard)/patients/register/page.tsx`, Server Component): `requirePermission('patients:create')`; a PATIENT who already has a profile is redirected to it.
3. `features/patients/PatientRegisterWizard.tsx` (client, MUI): **React Hook Form + Zod** (`schemas/patient.ts`), three steps (personal → contact → review) with per-step `trigger()`, controlled MUI fields via `RhfTextField` (`useController`) / `RhfSelect` / `RhfDate` (`Controller`), live review with `useWatch`.
4. Submit → `registerPatientAction` (`actions/patients.ts`): `authorize('patients:create')` → **re-validate with the same schema** → `patientService.create` (`POST /api/patients`, backend binds a PATIENT's profile to the login and rejects duplicates with 409).
5. Loading: button disabled/"Registering…" (`useTransition`); errors: `ActionState.fieldErrors` → `setError()` and jump to the offending step; success: toast, `router.push('/patients/{id}')`.
6. Revalidation: `updateTag('patients')`, `revalidatePath('/patients')`, `revalidatePath('/dashboard')`.
7. Profile: `patients/[patientId]/layout.tsx` + `page.tsx` show the data; **Profile update** (`PatientEditForm.tsx`, `updatePatientAction`, FormData + `useActionState`) verified.
*State:* RHF form state + local step state. *API:* `POST /api/patients`, `GET /api/patients/{id}`.

## 2. Doctor Appointment Booking
1. `/appointments/book` (`appointments/book/page.tsx`): `requirePermission('appointments:book')`; resolves the patient for a PATIENT (`patientService.byUser`).
2. `features/appointments/BookingWizard.tsx` (client): doctors via TanStack `useDoctorList` (`GET /api/backend/doctors`) with search + specialization filter (`useSpecializations`); `?doctorId=` pre-selects.
3. Date input → `useSlots(doctorId, date)` (**dependent query**, `enabled` when both set, `keepPreviousData`) → `GET /api/appointments/availability`; slots grouped Morning/Afternoon/Evening by `groupSlots`; occupied slots disabled.
4. Patient: fixed for a PATIENT; staff search with `usePatientSearch` (debounced).
5. Submit → `bookAppointmentAction` (`actions/appointments.ts`): `authorize` → Zod → `POST /api/appointments`; the backend rejects overlaps (409) — the wizard shows the message, refetches slots and clears the selection.
6. Success panel (booking response = confirmation) with links; `qc.invalidateQueries(['appointments'])`, `router.refresh()`; server: `updateTag(appointments)`, `updateTag(availability-{doctorId})`, `revalidatePath('/appointments')`.
7. History: `/patients/{id}/appointments`, `/appointments` (list, calendar, **intercepting-route modal** detail). Backend Kafka creates the bill and notification a few seconds later.
*Live-verified:* booking as a patient, the appointment in the list, modal interception, occupied slot visible to admin, optimistic cancel.

## 3. Appointment Availability Management
1. `/doctors/[doctorId]/schedule` (`doctors/[doctorId]/schedule/page.tsx`): schedule + days off read in parallel (cached 60 s, tag `doctor-schedule-{id}`).
2. `features/doctors/ScheduleEditor.tsx`: RHF + `useFieldArray` + Zod `scheduleSchema` (end after start, break inside hours, unique weekday). Save → `saveScheduleAction` (`doctors:schedule`: ADMIN or the owning DOCTOR — backend re-checks ownership) → `PUT /api/doctors/{id}/schedule` → `updateTag(availability-{id})`, `bust(id)`.
3. Days off: `features/doctors/DaysOff.tsx` → `addDayOffAction/removeDayOffAction`.
4. Viewing: `/doctors/[id]/availability?date=` (URL state, free vs occupied) and `/appointments/availability?date=` (all available doctors, grids fetched in parallel).
5. Duplicate bookings are prevented by the **backend** (409), never by the UI.
*Live-verified:* schedule saved via the editor (backend returned 1 day), booked slot shown as occupied.

## 4. Lab Test Requests and Reports
1. `/laboratory/tests` (catalogue; promise passed to a client component and unwrapped with `use()`).
2. `/laboratory/request` → `features/laboratory/LabRequestForm.tsx` (RHF + `useFieldArray` + Zod; urgent/STAT need clinical notes) → `createLabRequestsAction`: one backend request per test via **`Promise.allSettled`** (partial success reported) → `POST /api/lab/requests`.
3. List: `/laboratory` (`LabRequestsInfinite`, `useInfiniteQuery`, IntersectionObserver) for staff; own history for a patient; detail `/laboratory/[requestId]` with status badge.
4. Processing (LAB_STAFF/ADMIN): `StatusAdvance` → `setLabStatusAction` (REQUESTED → SAMPLE_COLLECTED → IN_PROGRESS); `ReportForm` → `createLabReportAction`; attachment upload → `POST /api/lab/requests/{id}/attachment` (Route Handler validates type/size, forwards multipart).
5. Reports/download: `Report` (Suspense) + `GET /api/lab/requests/{id}/attachment` (streams the binary); patient history in `/patients/{id}/lab`; documents tab in medical records.
6. Revalidation: `updateTag(lab-reports)`, `revalidatePath('/laboratory…')`.
*Live-verified:* two-test request, full status workflow, report, upload, download as `image/png`, wrong type → 415.

## 5. Prescription Generation
1. `/prescriptions/generate` (`prescriptions/generate/page.tsx`): DOCTOR's own doctor profile is found by `userId` (a doctor without a profile gets an explanation instead of a broken form); ADMIN selects a doctor.
2. `features/prescriptions/PrescriptionForm.tsx`: **Formik + Zod** (`zodValidate`), `PatientPicker` (TanStack search), `FieldArray` medicine rows (datalist from the pharmacy list when the role may read it), dosage/frequency/duration validation, duplicate-medicine rule.
3. Submit → `createPrescriptionAction` → re-validation → `POST /api/prescriptions` → `updateTag(prescriptions)`, `updateTag(pharmacy)`.
4. `/prescriptions/[id]`: details, **print** (`window.print`), **download** (`/api/prescriptions/{id}/download`), cancel with `useOptimistic`, linked pharmacy order. The backend turns a prescription into a pharmacy order (Kafka).
*Live-verified:* nested field error ("Use a number and unit"), creation, download as attachment, order appeared and was dispensed by the pharmacist.

## 6. Billing and Payments
1. Bills appear automatically (appointments, prescriptions) or are generated manually at `/billing/generate` (`features/billing/BillForm.tsx`, **`useReducer`** form; Zod payload check; `createBillAction` → `POST /api/bills`).
2. `/billing` dashboard (outstanding, collected), `/billing/invoices` (status filter + pagination), `/billing/invoices/[invoiceId]` (SSR; bill, then payments — sequential), `/billing/payments` (payments of the latest 20 bills, fetched in parallel).
3. Pay: `features/billing/PaymentPanel.tsx` — `<form action>` + `payBillAction` (`POST /api/bills/{id}/payments`); staff may force the simulated outcome; the status badge flips optimistically (`useOptimistic`); pending payments can be confirmed by billing staff (`confirmPaymentAction` → `PUT /api/payments/{ref}/status`).
4. Revalidation: `updateTag(billing)`, `revalidatePath` for billing paths and the dashboard.
5. Authorization: `billing:read` (page), `billing:pay`/`billing:manage` (actions) + gateway role rule. No real payment gateway exists in the backend; none is faked.
*Live-verified:* manual bill → pay with simulated success → invoice shows **Paid**.
