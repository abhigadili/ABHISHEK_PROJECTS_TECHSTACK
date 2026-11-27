# Implementation Changelog

Project: `NextJS_Projects/HospitalManagement` — built 2026-11-13 from `claude-prompts/promptdo-12112026n.md`. Next.js 16.4.6, React 19.3, TypeScript 5.9. Backend (`NodeJS_Projects/HospitalManagement`) **not modified**. 270 source files, ~7,079 lines in `src/`.

## Features implemented
* **Public site** (SSG/ISR): landing, hospitals (list + detail), doctors (directory + profile), info (optional catch-all) and help (catch-all) pages, `robots.ts`, `sitemap.ts`.
* **Authentication**: login/register Server Actions, HttpOnly cookie session, silent refresh in `proxy.ts`, redirect-after-login, idle logout, unauthorized/access-denied pages, RBAC permission table.
* **Dashboard**: role-aware figures, upcoming appointments, recent activity — three parallel-route slots with independent loading UI.
* **Patients**: list (server search + pagination, MUI table with client filter/sort, CSV export), 3-step registration wizard, profile, edit (FormData Server Action), deactivate, nested layout with tabs (overview, records, appointments, prescriptions, lab, billing).
* **Doctors**: Redux-driven board, shortlist (Zustand), profile, create/edit (RHF+Zod), weekly schedule editor (`useFieldArray`), days off, availability, doctor appointments.
* **Appointments**: list + calendar (Redux UI state + TanStack), booking wizard, detail page + intercepting modal, reschedule, optimistic cancel, complete, availability overview.
* **Hospitals**: Zustand browser, detail, create/edit, departments.
* **Medical records**: patient picker, timeline/conditions/documents (Radix tabs, Suspense), entry detail, add entry.
* **Prescriptions**: Formik+Zod generator, list/history, detail, print/download, cancel.
* **Laboratory**: catalogue (`use()`), multi-test request, infinite list, status workflow, report, attachment upload/download.
* **Billing**: dashboard, invoices, invoice detail + payment panel, `useReducer` bill generator, payment history.
* **Pharmacy**: catalogue (Zustand filters, debounced search, virtualised option), medicine detail, orders (infinite), order actions, restock/add dialogs (`next/dynamic`), prescription lookup.
* **Notifications**: list/unread/detail, Context+`useReducer` bell, inline Server Action, read-state cookie, admin send form.
* **Admin/profile**: users list with optimistic enable/disable, account & preferences.

## Next.js concepts implemented
All rows of [`NEXTJS_CONCEPTS_IMPLEMENTATION.md`](NEXTJS_CONCEPTS_IMPLEMENTATION.md). Deliberate non-uses (documented there): Cache Components / `'use cache'` (conflict with route-segment config), private folders, `useParams`, `router.forward`/navigation events (not provided by the App Router), `force-cache`, blur placeholders, Pages Router example, ORM/database.

## Components created (70 component files)
UI primitives `src/components/ui/*`, shell/layouts `src/components/layouts/*`, common `src/components/common/*`, forms `src/components/forms/RhfFields.tsx`, providers `src/components/providers/*`, plus feature components under `src/features/**`.

## Server Components created (94 app files, incl. layouts/pages)
All `page.tsx`, `layout.tsx` and `template.tsx` below `src/app` that are not `'use client'`, plus server-rendered feature parts (`features/appointments/AppointmentDetail.tsx`, `features/notifications/NotificationList.tsx`, `features/public/images.ts` helper).

## Client Components created (61)
* `src/app/(dashboard)/error.tsx`
* `src/app/(dashboard)/patients/[patientId]/medical-records/error.tsx`
* `src/app/error.tsx`
* `src/app/global-error.tsx`
* `src/components/common/Avatar.tsx`
* `src/components/common/ThemeToggle.tsx`
* `src/components/common/VirtualList.tsx`
* `src/components/forms/RhfFields.tsx`
* `src/components/layouts/DashboardShell.tsx`
* `src/components/providers/AuthProvider.tsx`
* `src/components/providers/MuiProvider.tsx`
* `src/components/providers/NotificationsProvider.tsx`
* `src/components/providers/QueryProvider.tsx`
* `src/components/providers/ReduxProvider.tsx`
* `src/components/providers/ThemeProvider.tsx`
* `src/components/ui/dialog.tsx`
* `src/components/ui/dropdown.tsx`
* `src/components/ui/tabs.tsx`
* `src/components/ui/toast.tsx`
* `src/features/PreferencesForm.tsx`
* `src/features/SubmitButton.tsx`
* `src/features/UserToggle.tsx`
* `src/features/appointments/AppointmentActions.tsx`
* `src/features/appointments/AppointmentsBoard.tsx`
* `src/features/appointments/BookingWizard.tsx`
* `src/features/appointments/MonthCalendar.tsx`
* `src/features/appointments/RescheduleForm.tsx`
* `src/features/appointments/RouteModal.tsx`
* `src/features/authentication/LoginForm.tsx`
* `src/features/authentication/RegisterAccountForm.tsx`
* `src/features/billing/BillForm.tsx`
* `src/features/billing/PaymentPanel.tsx`
* `src/features/common/PatientPicker.tsx`
* `src/features/doctors/DatePickerBar.tsx`
* `src/features/doctors/DaysOff.tsx`
* `src/features/doctors/DoctorForm.tsx`
* `src/features/doctors/DoctorTabs.tsx`
* `src/features/doctors/DoctorsBoard.tsx`
* `src/features/doctors/ScheduleEditor.tsx`
* `src/features/hospitals/Departments.tsx`
* `src/features/hospitals/HospitalForm.tsx`
* `src/features/hospitals/HospitalsBrowser.tsx`
* `src/features/laboratory/LabRequestForm.tsx`
* `src/features/laboratory/LabRequestsInfinite.tsx`
* `src/features/laboratory/LabTestCatalogue.tsx`
* `src/features/laboratory/LabWorkflow.tsx`
* `src/features/notifications/NotificationActions.tsx`
* `src/features/patients/DeactivatePatient.tsx`
* `src/features/patients/PatientEditForm.tsx`
* `src/features/patients/PatientRegisterWizard.tsx`
* `src/features/patients/PatientTabs.tsx`
* `src/features/patients/PatientsTable.tsx`
* `src/features/pharmacy/Dialogs.tsx`
* `src/features/pharmacy/MedicineBrowser.tsx`
* `src/features/pharmacy/OrderActions.tsx`
* `src/features/pharmacy/OrdersInfinite.tsx`
* `src/features/prescriptions/PrescriptionActions.tsx`
* `src/features/prescriptions/PrescriptionForm.tsx`
* `src/features/public/DoctorDirectory.tsx`
* `src/features/records/RecordForms.tsx`
* `src/features/records/RecordsTabs.tsx`

## Server Actions created (36 exported actions in 12 files)
* `src/actions/appointments.ts` — `bookAppointmentAction`
* `src/actions/appointments.ts` — `cancelAppointmentAction`
* `src/actions/appointments.ts` — `rescheduleAppointmentAction`
* `src/actions/appointments.ts` — `completeAppointmentAction`
* `src/actions/auth.ts` — `loginAction`
* `src/actions/auth.ts` — `registerAccountAction`
* `src/actions/auth.ts` — `logoutAction`
* `src/actions/billing.ts` — `createBillAction`
* `src/actions/billing.ts` — `payBillAction`
* `src/actions/billing.ts` — `confirmPaymentAction`
* `src/actions/billing.ts` — `cancelBillAction`
* `src/actions/doctors.ts` — `saveDoctorAction`
* `src/actions/doctors.ts` — `saveScheduleAction`
* `src/actions/doctors.ts` — `addDayOffAction`
* `src/actions/doctors.ts` — `removeDayOffAction`
* `src/actions/hospitals.ts` — `saveHospitalAction`
* `src/actions/hospitals.ts` — `createDepartmentAction`
* `src/actions/hospitals.ts` — `deleteDepartmentAction`
* `src/actions/laboratory.ts` — `createLabRequestsAction`
* `src/actions/laboratory.ts` — `setLabStatusAction`
* `src/actions/laboratory.ts` — `createLabReportAction`
* `src/actions/laboratory.ts` — `cancelLabRequestAction`
* `src/actions/notifications.ts` — `markNotificationsReadAction`
* `src/actions/notifications.ts` — `sendNotificationAction`
* `src/actions/patients.ts` — `registerPatientAction`
* `src/actions/patients.ts` — `updatePatientAction`
* `src/actions/patients.ts` — `deactivatePatientAction`
* `src/actions/pharmacy.ts` — `dispenseOrderAction`
* `src/actions/pharmacy.ts` — `rejectOrderAction`
* `src/actions/pharmacy.ts` — `restockAction`
* `src/actions/pharmacy.ts` — `createMedicineAction`
* `src/actions/prescriptions.ts` — `createPrescriptionAction`
* `src/actions/prescriptions.ts` — `cancelPrescriptionAction`
* `src/actions/records.ts` — `createRecordEntryAction`
* `src/actions/records.ts` — `saveConditionsAction`
* `src/actions/users.ts` — `setUserEnabledAction`
* inline: `markPageRead` in `src/app/(dashboard)/notifications/page.tsx`

## Route Handlers created ({len(routes)})
* `src/app/api/appointments/[appointmentId]/route.ts`
* `src/app/api/auth/logout/route.ts`
* `src/app/api/auth/session/route.ts`
* `src/app/api/backend/[...path]/route.ts`
* `src/app/api/dashboard/activity/route.ts`
* `src/app/api/dashboard/summary/route.ts`
* `src/app/api/health/route.ts`
* `src/app/api/lab/requests/[requestId]/attachment/route.ts`
* `src/app/api/patients/export/route.ts`
* `src/app/api/preferences/route.ts`
* `src/app/api/prescriptions/[prescriptionId]/download/route.ts`
* `src/app/api/revalidate/route.ts`

## API integrations completed
All ten microservices through the gateway — see the status table in [`API_INTEGRATION_DOCUMENTATION.md`](API_INTEGRATION_DOCUMENTATION.md#api-integration-status).

## Database changes
**None.** No Next.js-owned database, ORM, tables, models or migrations. The existing databases were not accessed or modified by this project.

## Files created or modified
New project created at `NextJS_Projects/HospitalManagement` (`create-next-app@16.4.6 --ts --tailwind --app --src-dir --eslint`). Generated files replaced: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `next.config.ts`, `README.md`. No files outside the project were changed. Side effects on shared services: see test-data note in the API document; the backend stack (`docker compose up -d`, `scripts/start-all.sh`) was started because it was not running.

## Configuration changes
`next.config.ts` (images `remotePatterns`/`qualities`/formats, `headers()` Cache-Control + CDN, `experimental.serverActions.bodySizeLimit`, `optimizePackageImports`, `staleTimes`; `cacheComponents` **disabled** vs. the generated default), `.env.example`, `.env.local` (git-ignored), `tsconfig.json` (generated), `eslint.config.mjs` (generated).

## Verification performed
* Also verified: laboratory catalogue `use()` + search, pharmacy virtualised list, user-menu sign-out.
* `npx tsc --noEmit` clean; `npx eslint src` clean (0 errors, 0 warnings); `next build` succeeds (static ○, SSG ●, dynamic ƒ listed); `next dev` starts and serves `/` and `/public/hospitals`.
* Production server on :3200 exercised with Playwright + system Chrome: **29/29** checks (registration wizard, profile update, booking, intercepting modal, optimistic cancel, lab, Formik prescription, billing/payment, BFF endpoints) and **20/20** checks (lab workflow + upload/download, pharmacy dispense/restock/search, doctor create/edit/schedule, ISR revalidation of public pages, webhook, notifications, admin users, BFF allow-list), plus per-role navigation smoke tests (admin, doctor1, labstaff1, pharmacist1, billing1, a patient) and silent token refresh.
* Bugs the live tests caught and fixed: wizard Next/Submit buttons shared one DOM node so "Next" on step 2 submitted the form (keys added); breadcrumb parents `/admin` and `/pharmacy/medicines` returned 404 (redirect pages added); remote avatar failures now fall back to initials; "My profile" nav entry showed for admins; `readCookieName` exported from a `'use server'` file (build error) moved to a plain module; set-state-in-effect lint errors replaced with derived state/action wrappers.
* Not done by design: no automated test suites (per brief).

## Limitations and pending functionality
* Backend gaps (no MFA/OAuth/password reset, no notification read flag/push, no list-all-appointments, no dashboard statistics, hospitals/medicines un-paged, no PDF for prescriptions) are documented, not mocked.
* *Wired but not executed during verification:* idle-timeout logout, patient deactivate, days off, reschedule, complete appointment, record entry creation and conditions, prescription cancel, lab cancel, bill cancel and payment confirmation, order reject, medicine creation, user enable/disable.
* Public pages need the read-only catalogue login; without it they show an explanatory error (build still succeeds).
* `ui-avatars.com` is an external image service; offline, avatars degrade to initials.
* `useParams`, private folders, `force-cache`, Cache Components, blur placeholders and a Pages Router example are intentionally absent (reasons in the concepts document).
* `README` says production port 3200 — change `NEXT_PUBLIC_APP_URL` and the start port together.
