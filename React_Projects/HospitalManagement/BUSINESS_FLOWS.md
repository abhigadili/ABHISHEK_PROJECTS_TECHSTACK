# Business Flows

The six scenarios of the specification, as implemented. Each section lists the **entry point**, the **steps**, the **frontend components/hooks/services**, the **API calls**, the **state management** involved and the **navigation**. All six were executed end-to-end in a real browser (headless Chrome) against the live gateway on 2026-11-12; the results are summarised at the end of each section.

Convention: `src/…` paths are relative to the project root; “Query” = TanStack Query; every API call goes through `src/services/axios/client.ts` (Axios) unless stated otherwise.

---

## Scenario 1 – Patient registration

**Entry:** `/register` (public, wizard) · `/patients/new` (staff/admin) · both render `src/features/patients/pages/PatientRegistrationPage.tsx`.

| # | Step (specification) | Implementation |
|---|---|---|
| 1 | Open the registration page | Route `register` in `src/app/router.tsx` (inside `AuthLayout`, wide column) |
| 2 | Enter patient information | Multi-step MUI form: **Account** (anonymous only) → **Personal** → **Contact & medical** → **Review**; date of birth via `@mui/x-date-pickers` `DatePicker` |
| 3 | Frontend validation | `zodErrors(schema, values)` (`src/utils/zodForm.ts`) with `accountSchema` (`src/schemas/auth.ts`), `personalSchema` / `contactSchema` (`src/schemas/patient.ts`). Field-level errors on *Next*, cross-field rule (password = confirmation), conditional rule (emergency contact name ⇒ emergency phone), date-of-birth not in the future |
| 4 | Validate with the selected form library + Zod | Plain `useState` controlled form (the “useState” demonstration of the Patient module) + Zod; the edit page uses Formik + Zod (`PatientEditPage.tsx`) |
| 5 | Submit to the Patient Service | **Sequential calls** for an anonymous visitor: `POST /auth/register` → `POST /auth/login` (`useAuthActions().login`) → `POST /patients` (`useCreatePatient` → `patientApi.create`). A signed-in PATIENT without profile or an ADMIN only does the last call |
| 6 | Loading / success / error | Submit button spinner, `formError` alert, 400 `details` and 409 duplicates mapped to the right field **and** the right wizard step (`FIELD_STEP`), partial-failure message when the account exists but the profile failed |
| 7 | Display registered patient details | Success view with `PatientDetailGrid` (`src/features/patients/components/PatientDetailGrid.tsx`) |
| 8 | Navigate to the patient profile | “Open patient profile” → `/profile` (patient) or `/patients/:id` (admin) |

**State:** local `useState` (wizard step, values, errors); `useRef` keeps the account step sticky when the automatic sign-in flips `status` mid-submit; Query cache is seeded on success (`setQueryData` for `patients.detail` and `patients.byUser`) so the profile page needs no refetch and does not show a stale 404; Auth context (`AuthProvider`) holds the new session.
**Backend rules surfaced:** username/e-mail uniqueness (409), phone/e-mail/identity uniqueness (409), field patterns (400 `details[]`).
**Verified:** wizard validation messages, registration of a new patient, profile page with the new data, no unexpected console/HTTP errors.

---

## Scenario 2 – Doctor appointment booking

**Entry:** `/appointments/book` (`?doctorId=&date=&time=` pre-fills from doctor pages) · `src/features/appointments/pages/BookAppointmentPage.tsx`.

| # | Step | Implementation |
|---|---|---|
| 1 | Search for available doctors | `GET /doctors/available?date=&specialization=` via `useQuery(queryKeys.doctors.available(date, spec))`, `placeholderData: prev => prev` keeps the previous list while the next loads |
| 2 | Filter by specialization (and department) | specialization `<select>` fed by `useSpecializations()` (`GET /doctors/specializations`, cached 10 min, `networkMode: 'offlineFirst'`); name filter is debounced (`useDebouncedValue`); department filtering is available in the Doctor directory (Redux filters) |
| 3 | Select a doctor | `role="radio"` cards (`LazyAvatar`, fee, slot count, first/last slot) |
| 4 | Retrieve available slots | **Dependent query** `useAvailability(doctorId, date)` → `GET /appointments/availability` (enabled only when both exist; the previous request is **cancelled** through the query `signal` when date/doctor change) rendered by `SlotPicker` (`select`-style grouping by morning/afternoon/evening) |
| 5 | Select date and time | date input (min = today) + slot buttons (occupied slots are disabled) |
| 6 | Retrieve patient details | PATIENT: own profile (`useCurrentPatient`); ADMIN: `PatientPicker` (debounced `GET /patients?q=`, cancellable) and then `usePatient(id)` (`GET /patients/{id}`) shows date of birth, phone, allergies and blocks inactive patients |
| 7 | Submit the booking | `useBookAppointment` → `POST /appointments`; reason read from an **uncontrolled** textarea (`ref`) |
| 8 | Booking confirmation | `AppointmentCard` **compound component** (`.Header/.Details/.Notes/.Actions`) |
| 9 | Refresh cached queries | `onSuccess` of the mutation: `setQueryData(appointments.detail)`, `invalidateQueries` for appointment lists, that doctor/date availability, doctor slots, available-doctors, dashboard; after 2.5 s again for billing and notifications (the bill and e-mail are created by Kafka consumers) |
| 10 | Appointment in the patient's history | Confirmation page runs `GET /appointments/patient/{id}` (`useQuery`) and marks the new row; `/appointments` (list) shows it too |

**Failure handling:** 409 (slot taken/overlap) and 400 (invalid slot) → inline error, the slot is cleared and availability refetched; the backend's unique-slot constraint is the authority (verified with a second booking of the same slot → HTTP 409).
**State:** local `useState` for the flow, Query for server state, Auth context for the role, uncontrolled `ref` for the reason.
**Navigation:** confirmation → appointment details (`/appointments/:id`), history (`/appointments` or `/patients/:id/appointments`), “Book another”.
**Verified:** doctor search, specialization filter, slot selection, booking, confirmation, history, duplicate rejection.

---

## Scenario 3 – Appointment availability management

**Entry:** `/appointments/availability` (`AppointmentAvailabilityPage.tsx`), `/doctors/:id/availability` (`DoctorTabs.tsx → DoctorAvailabilityTab`), `/doctors/:id/schedule` (weekly editor).

| # | Step | Implementation |
|---|---|---|
| 1 | Display doctor schedules | `useDoctorSchedule` → `GET /doctors/{id}/schedule`, read-only table for everybody, **editor** for ADMIN and the doctor themself |
| 2 | Retrieve availability | `GET /doctors/{id}/slots?date=` (schedule grid) and `GET /appointments/availability` (bookings) – both Query keys use short `staleTime` (5 s) + `refetchOnWindowFocus: 'always'` from `setQueryDefaults` in `src/app/queryClient.ts` |
| 3 | Show available / occupied | `SlotPicker` read-only mode, counts “n free / m occupied”, merged view in the doctor tab (`useMemo`) |
| 4 | Manage availability | Weekly schedule: React Hook Form + Zod + `useFieldArray` (`ScheduleEditor`), cross-field (end after start, break inside hours, both break times or none) and cross-row (weekday unique) validation → `PUT /doctors/{id}/schedule`. Days off: `POST/DELETE /doctors/{id}/unavailability` |
| 5 | Prevent duplicate bookings | Enforced by the backend (unique slot key + overlap check); the UI shows the 409 |
| 6 | Refresh queries | `useSaveSchedule` / `useUnavailabilityMutations` invalidate that doctor's slots, all appointment availability and the available-doctors lists |

**Authorization:** `canManageSchedule = canSchedule && (role === ADMIN || ownDoctorId === doctor.id)` (permission `doctors:schedule` + `useCurrentDoctor`).
**Verified:** a freshly created doctor got a weekly schedule through the UI, appeared in “available doctors” for that weekday, a booked slot showed as occupied in the availability page.

---

## Scenario 4 – Lab test requests and reports

**Entry:** `/lab/tests`, `/lab/requests/new`, `/lab/requests[/:id]`, `/lab/reports`, `/lab/history` (`src/features/laboratory/pages/*`, shadcn/ui).

| # | Step | Implementation |
|---|---|---|
| 1 | Search available tests | `LabTestListPage` – `useLabTests()` (`GET /lab/tests`), debounced search, sample-type filter, sort |
| 2 | Select required tests | `RequestLabTestPage` – React Hook Form + Zod + **`useFieldArray`** (one select per test, duplicate rows rejected, price estimate via `useMemo`), urgent/STAT requires clinical notes (conditional validation) |
| 3 | Submit requests | `useCreateLabRequests`: one `POST /lab/requests` per test fired **in parallel** with `Promise.allSettled`; per-test success/failure listed |
| 4 | Requested test details | `LabRequestDetailsPage` (`useLabRequest`, polls every 8 s until completed/cancelled because accession number/status change asynchronously) |
| 5 | Test status | progress badges; lab staff move REQUESTED → SAMPLE_COLLECTED → IN_PROGRESS with an **optimistic** mutation (`useSetLabStatus`: `onMutate` patches the cache, `onError` rolls back, `onSettled` invalidates) |
| 6 | Retrieve completed reports | `useLabReport` (`GET /lab/requests/{id}/report`) after the report form (`POST …/report`) completed the request; `LabReportsPage` lists completed requests with an **infinite query** and loads each row's report in parallel (`useQueries`) |
| 7 | Download reports | attachment upload (`POST …/report/attachment`, Axios multipart + progress) and download (`GET …/report/attachment`, `responseType: 'blob'` → `saveBlob`); the Medical Documents page downloads the same file with the **Fetch API** |
| 8 | Patient lab history | `LabHistoryPage` – infinite query for staff (throttled IntersectionObserver auto-load + “Load more”), patient endpoint (`GET /lab/requests/patient/{id}`) for patients |

**Pagination:** `LabRequestListPage` uses server pagination with status tabs (`keepPreviousData`).
**Roles:** doctors/admins request; lab staff/admin process; patients see their own (staff list endpoints are not called for patients).
**Verified:** two tests requested together, duplicate/urgent validation, status workflow, report with abnormal flag, PDF attachment upload, patient sees the report with summary, download (Axios and Fetch), medical-record timeline entry created by the event.

---

## Scenario 5 – Prescription generation

**Entry:** `/prescriptions/new` (`?patientId=&doctorId=&appointmentId=` from the appointment page) · `src/features/prescriptions/pages/GeneratePrescriptionPage.tsx`.

| # | Step | Implementation |
|---|---|---|
| 1 | Search and select a patient | `PatientPicker` (debounced, cancellable `GET /patients?q=`) |
| 2 | Retrieve patient information | `usePatient(id)` – age, blood group and **known allergies** are shown while prescribing |
| 3 | Diagnosis and details | Formik + Zod (`zodToFormikValidate(prescriptionSchema)`), reusable `FormikInput/FormikTextarea/FormikSelect` (`src/components/forms/FormikFields.tsx`) |
| 4 | Add multiple medicines dynamically | Formik **`FieldArray`**; medicine-name suggestions from the pharmacy catalogue (`useMedicineSuggestions`, only for roles allowed to read it) |
| 5 | Medicine and dosage validation | Zod: dosage must be a number + unit (`500mg`, `5 ml`), 1–365 days, quantity 1–1000, duplicate medicine names across rows rejected (`superRefine`); array errors are converted to Formik's nested shape in `src/utils/zodForm.ts` |
| 6 | Submit | `useCreatePrescription` → `POST /prescriptions` (`doctorId` = the logged-in doctor's profile, admins choose a doctor) |
| 7 | Display the generated prescription | `PrescriptionView` **compound component** (`.Header/.Parties/.Diagnosis/.Items/.Footer`) |
| 8 | View / download | `/prescriptions/:id` (status polled from `GET /prescriptions/{id}/status` while ACTIVE); Print and Download use `usePrescriptionExport` which **dynamically imports** the HTML builder (`features/prescriptions/utils.ts`) – the backend offers no PDF endpoint |

**After the call:** `onSuccess` invalidates the patient's/doctor's prescription lists, the medical record (Kafka creates a timeline entry) and pharmacy queries (Kafka creates a pharmacy order).
**Verified:** patient selection, allergies displayed, dosage + duplicate validation messages, generation, download, details page, pharmacy order created and dispensed by a pharmacist.

---

## Scenario 6 – Billing and payments

**Entry:** `/billing`, `/billing/invoices[/:id]`, `/billing/generate`, `/billing/payments` (`src/features/billing/pages/*`; Tailwind; Redux Toolkit + `useReducer`).

| # | Step | Implementation |
|---|---|---|
| 1 | Retrieve patient billing information | Patients: `GET /bills/patient/{id}`; staff: `GET /bills?status=&page=&size=` (server pagination). Dashboard: four status queries in **parallel** (`useBillingStatusCounts`, `useQueries` + `combine`) |
| 2 | Outstanding invoices | status filter (Redux `billingUi.status`), dashboard cards (outstanding balance, overdue amount, “needs your attention” list) |
| 3 | Invoice details | `InvoiceDetailsPage` – items, totals, balance, payments (`GET /bills/{id}`, `/bills/{id}/payments`); `initialData` from cached lists |
| 4 | Generate bills | `GenerateBillPage` – **`useReducer`** form with a line-item array, derived total, Zod check of the assembled payload, server `details` mapped back by path → `POST /bills` (A, B). Bills for appointments/lab/medicine are created automatically by the backend from events |
| 5 | Submit payments | `PayDialog` (state machine in `useReducer`) → `usePayBill` → `POST /bills/{id}/payments {method, simulateOutcome?}`. “Pay selected” on the list dispatches the Redux thunk `settleSelectedBills` which settles the selected invoices **sequentially** (initiate → confirm when the caller may confirm) and then invalidates the billing, appointment and dashboard caches |
| 6 | Payment status | PENDING / SUCCESS / FAILED badges; billing staff/admin confirm or fail a pending payment (`PUT /payments/{ref}/status`, `useConfirmPayment`) |
| 7 | Payment history | `PaymentHistoryPage` – invoices first (dependent), then every invoice's payments in parallel (`useManyBillPayments`) merged newest first |
| 8 | Refresh billing and payment information | every billing mutation invalidates `queryKeys.billing.all`, appointments (payment status column) and the dashboard; notifications refreshed after 2.5 s |

**Redux slice:** `src/store/slices/billingUiSlice.ts` (filters, selection basket, method, settlement log, `settling` flag). Server data stays in Query (no duplicated state).
**Optimistic behaviour:** payment initiation cancels in-flight invoice queries and rolls back on error; invoice cancel is a mutation default (`['billing','cancel']`).
**No real gateway:** only the method is sent; “Simulated gateway result” (backend feature) can force success/failure for demonstrations.
**Verified:** invoices created by events (consultation, 2 lab, medicine) listed for the patient, “Pay selected” (sequential thunk) leaving payments pending, billing staff confirming one payment → invoice PAID, payment history with transaction references, manual 2-line bill (total 201) generated by billing staff, billing dashboard counts.

---

## Cross-cutting behaviours exercised during verification
* 401 handling: a protected request answered with 401 triggers exactly one refresh (`POST /auth/refresh`) and is transparently replayed (`src/services/axios/refresh.ts`).
* Redirect after login, logout, public-only login page, permission HOC redirects to `/access-denied`.
* Notifications: unread badge, “mark all read”, state survives reload (localStorage per user), admin message through the React 19 action form.
* All roles (ADMIN, DOCTOR, LAB_STAFF, PHARMACIST, BILLING_STAFF, PATIENT) were walked through their routes; no console errors, no unexpected 4xx/5xx.
