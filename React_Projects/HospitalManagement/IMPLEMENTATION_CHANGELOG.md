# Implementation Changelog

Single release: **1.0.0 – 2026-11-12**, built from `claude-prompts/promptdo-12112026r.md`. The backend (`NodeJS_Projects/HospitalManagement`) was not modified. Entries are in the order the work was done (the specification's ten phases).

## Phase 1 – Backend discovery
* Inspected the backend README, ten API documents, `api-gateway/config/routes.json`, the gateway source and the per-service OpenAPI documents (`/docs-json/<service>`).
* Verified the gateway **is** running on `:30080` (all service ports 30101-30110 listening), CORS preflight works, JWT login for seeded accounts works.
* Exercised every read endpoint for five staff roles and recorded the allow/deny matrix (see `API_INTEGRATION_DOCUMENTATION.md`).
* Findings that shaped the design: no endpoint lists all appointments; no doctor-by-login lookup; no notification read flag; refresh token only in the JSON body; hospitals/medicines/bills-by-patient are un-paged arrays; `/appointments/my` is patient-only; lab/bills/pharmacy are role-restricted at the gateway.

## Phase 2 – Project setup
* Created the Vite + React 19 + TypeScript project **by hand** (the scaffolder is interactive); Node 20.11.1 ⇒ Vite 6.4, MUI 6.5, `@mui/x-date-pickers` 7, React Router 7, Zod 3.25 (newest majors supported on this Node).
* Config files: `package.json`, `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` (strict, `noUnusedLocals`, `verbatimModuleSyntax`, `@/*` alias), `vite.config.ts` (proxy to the gateway, vendor `manualChunks`, optional profiling build), `tailwind.config.js` (preflight disabled, `darkMode` class), `postcss.config.js`, `index.html`, `.env.example`, `.env`, `.gitignore`.

## Phase 3 – Core architecture (files created)
* **Types** `src/types/*` (12 files) – all API contracts.
* **HTTP layer** `src/services/axios/{client,refresh,tokenStore,errors,authEvents}.ts`, `src/services/api/{http,fetchClient}.ts`, `src/services/endpoints/*` (11 API modules + barrel), `src/services/queryKeys.ts`.
* **Auth** `src/contexts/AuthContext.tsx` (reducer, restore, renewal timer, idle logout, split contexts), `src/components/hoc/withAccess.tsx`, `src/constants/permissions.ts`, `src/features/authentication/*`.
* **Shell** `src/layouts/{AppLayout,AuthLayout}.tsx`, `src/components/layouts/*` (Sidebar, Header, Breadcrumbs, TopProgress, NetworkBanner), `src/constants/navigation.tsx`, `src/styles/global.css`.
* **Shared UI** `src/components/ui/*` (15 shadcn/ui-style primitives), `src/components/common/*` (15), `src/components/{forms,tables,dialogs,error-boundaries}/*`.
* **Hooks** `src/hooks/*` (8), **utils** `src/utils/*` (10).

## Phase 4 – State management and data fetching
* `src/app/queryClient.ts` – defaults, per-key query defaults, mutation defaults (optimistic appointment cancel, invoice cancel), global error/success toasts.
* Redux Toolkit: `src/app/store.ts`, `store/slices/{doctorFiltersSlice,billingUiSlice,layoutSlice}.ts`, `store/redux/{hooks,types}.ts`.
* Zustand: `store/zustand/{hospitalStore,pharmacyStore}.ts`.
* Context: `ThemeContext`, `HospitalContext`, `NotificationsContext`.

## Phase 5 / 6 – Feature modules and business scenarios
| Module | Pages / routes | Notes |
|---|---|---|
| Authentication | `/login`, `/register`, `/access-denied`, `/unauthorized`, `*` | RHF + Zod login, redirect after login, public-only HOC |
| Dashboard | `/dashboard` | 12 live stat cards (role aware), upcoming appointments, recent activity |
| Patients (MUI) | list, registration wizard, details (6 routed tabs), edit, `/profile` | useState + Zod wizard, Formik + Zod edit, React.memo rows, parallel overview queries |
| Doctors (MUI) | list, details (profile, schedule, availability, appointments), create/edit | Redux directory, compare dialog, RHF `useFieldArray` schedule editor, Formik + Yup form (+ create login) |
| Appointments (Tailwind) | list, book, details, reschedule, calendar, availability | scenarios 2 & 3, compound `AppointmentCard`, optimistic cancel, lazy calendar |
| Hospitals (MUI) | list, details (overview/departments/facilities), create/edit | Zustand + Context, department CRUD with hand-written validation |
| Medical records (Radix + CSS Modules) | home, patient record, entry details, documents | Fetch API, virtualised timeline, accordion/tabs/dialog/tooltip |
| Prescriptions | list/history, generate, details | scenario 5, Formik + Zod + FieldArray, compound `PrescriptionView`, dynamic-import export |
| Laboratory (shadcn) | catalogue, requests, request/details, reports, history | scenario 4, RHF + Zod dynamic rows, pagination + infinite queries, upload/download |
| Billing (Tailwind) | dashboard, invoices, details, generate, payments | scenario 6, Redux thunk (sequential), `useReducer` forms, optimistic payment |
| Pharmacy (shadcn) | medicines, details, availability, orders | Zustand, debounce + throttle, infinite orders, optimistic restock, prescription lookup |
| Notifications (Tailwind) | list, unread, details | Context + polling, local read state, React 19 `useActionState` form |
| System (ADMIN) | `/system/cache`, `/system/profiler` | live TanStack cache/mutation cache inspector, `<Profiler>` results |

## Phase 7 – Advanced React concepts
HOCs, compound components, render props, component factory, error boundaries, portals, refs/forwardRef/`useImperativeHandle`, `useSyncExternalStore`, React 19 `use()`, `useActionState`, `useFormStatus`, `useDeferredValue`, virtualisation, `React.memo`/`useMemo`/`useCallback`, lazy/Suspense/dynamic import, Profiler – locations in `REACT_CONCEPTS_IMPLEMENTATION.md`.

## Phase 8 – UI/UX
Responsive sidebar/drawer, header with theme toggle, notification bell and profile menu, breadcrumbs, dashboard cards, tables (MUI, Tailwind, shadcn), search/filter/sort/pagination, modals + confirmation dialogs, toasts (react-hot-toast), skeletons/loaders/empty/error states, date pickers (MUI), calendar (custom CSS Grid), file upload (drag & drop), profile cards, detail views, light/dark themes, global top progress bar, offline banner.

## Phase 9 – Documentation
`README.md`, `PROJECT_ARCHITECTURE.md`, `REACT_CONCEPTS_IMPLEMENTATION.md`, `API_INTEGRATION_DOCUMENTATION.md`, `BUSINESS_FLOWS.md`, `IMPLEMENTATION_CHANGELOG.md` (this file). The paths in the concept document were machine-checked against the file system.

## Phase 10 – Verification (all executed, results)
* `npm run build` (tsc project build + Vite) ✔ – 0 type errors, initial JS chunk 175 kB (58 kB gzip) + vendor chunks (react 247 kB, mui 534 kB, forms 177 kB, radix 111 kB, tanstack 82 kB, router 40 kB, state 32 kB), every page lazy-loaded (~60 route chunks).
* `npm run dev` ✔ (HMR server on :5180, proxy verified against the gateway), `npm run preview` ✔ (:5181).
* Browser verification with headless Google Chrome against the live gateway (throw-away driver script kept **outside** the project – no test suite was added to the repository, as required):
  * every route (≈ 60) visited as ADMIN, DOCTOR, LAB_STAFF, PHARMACIST, BILLING_STAFF – no crashes, no console errors, no unexpected 4xx/5xx; guards redirect unauthorised roles to the 403 page.
  * the six business scenarios end-to-end with a freshly registered patient and a freshly created doctor (72 assertions in one clean run from a brand-new patient + doctor, plus 14 directory-module checks – registration wizard, doctor creation + schedule, booking + duplicate rejection + availability, prescription + dispensing, lab request → report → download, billing + payment confirmation + manual bill, notifications, role guards, token refresh, logout/redirect, optimistic cancel/reschedule, directory modules). The Cache Monitor and Render Profiler pages were verified separately by navigating inside the single-page app (the cache is empty right after a hard reload): 24 cached queries listed, defaults tab rendered, profiler rows for PatientList / DoctorDirectory / DashboardStats appeared on the dev server.
* Screenshots reviewed in light, dark and mobile layouts.

### Defects found by the live verification (all fixed)
| # | Defect | Fix |
|---|---|---|
| 1 | After registering, `/profile` redirected back to `/register`: the profile query had cached the *404 "no profile yet"* seen right after the automatic login | `useCreatePatient` seeds `patients.byUser(userId)` with the new profile |
| 2 | Registration wizard could shift under the user mid-submit (auto-login flips `status`, removing the account step) | account step made sticky with a ref (`PatientRegistrationPage.tsx`) |
| 3 | Formik showed no messages for array fields (Zod reports `items.0.dosage`, Formik expects nested errors) – the form was blocked without explanation | `zodToFormikValidate` converts dotted paths with Formik's `setIn` |
| 4 | Patient lab pages called the staff-only `/lab/requests` list (403 in the console) | `enabled` flag on the lab list hooks, role-gated in the pages |
| 5 | Missing preflight (Tailwind preflight is off for MUI): bullet markers and default heading sizes leaked into the shell | restated the needed resets in `styles/global.css` |
| 6 | Medical-record timeline viewport cut rows | row estimate/height corrected |
| 7 | Profiler page empty in production builds | optional `VITE_PROFILING=true` build links `react-dom/profiling`; page text explains it |
| 8 | Concept audit gaps: `Promise.all`, `queryOptions`, explicit `AbortController`, `withRetry` unused | patient hover prefetch (`usePrefetchPatient`), `doctorQueryOptions`, cancellable downloads (`useFileDownload`), retry in downloads |

## Features implemented vs. specification
All ten service modules, all listed pages, all six scenarios and all documentation files. Concepts: every item of the specification's lists is implemented at least once except those the backend cannot support (below). The concept → file map is in `REACT_CONCEPTS_IMPLEMENTATION.md`.

## Limitations and pending functionality (honest list)
**Backend limitations (documented in detail in `API_INTEGRATION_DOCUMENTATION.md#unavailable-or-missing-apis`)** – MFA, OAuth 2.0, forgot/reset password, HttpOnly refresh cookie, notification read state/real-time push, hospital branches & facility inventory, medicine categories, patient-document upload, prescription update/PDF, appointment "confirm", list-all-appointments, dashboard statistics endpoint, server-side sorting.

**Frontend notes**
* Read/unread state of notifications is local to the browser (labelled in the UI).
* Admin "all appointments" and the dashboard's appointment figures are computed from one request per doctor (fine for a hospital-sized doctor list, not for thousands).
* Billing dashboard sums amounts over the 100 most recent invoices per status (counts are exact; the UI says so when truncated).
* Not executed against the shared data to keep it usable: deactivating patients/doctors/hospitals, rejecting pharmacy orders, completing appointments (only allowed once the appointment time has started), creating hospitals/medicines (the forms were opened and validated; one medicine restock and one department create/delete were executed).
* Idle-timeout logout and the proactive token-renewal timer are implemented but were not waited out in the browser (15 min / 30 min); the 401→refresh→replay path that they share was verified.
* The development server builds MUI modules on demand and is noticeably slower on first navigation than the production preview – use `npm run preview` for demos.
* No automated tests, linting, monitoring or infrastructure were added (explicitly out of scope).
* Bundle: `vendor-mui` is the largest chunk (534 kB, 161 kB gzip) because three modules use MUI; it is only fetched when one of those pages is opened.

## Configuration changes
New project only. Environment variables: `VITE_API_BASE_URL`, `VITE_USE_PROXY`, `VITE_API_TIMEOUT_MS`, `VITE_IDLE_LOGOUT_MINUTES`, `VITE_PROFILING`. Ports: dev 5180, preview 5181. No change to the backend project, its databases or its configuration.
