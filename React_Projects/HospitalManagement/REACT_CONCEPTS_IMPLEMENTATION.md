# React Concepts Implementation

Every concept of the specification, mapped to **where it is implemented** in this application. Columns: **What it does** · **Why it is used here** · **Module** · **Exact file path** · **Component / hook** · **How it works in the app**.
Paths are relative to the project root. Concepts the backend cannot support (MFA, OAuth 2.0, …) are listed in the last section with the reason – they were deliberately **not** faked.

Contents: [1 Fundamentals](#1-react-fundamentals) · [2 Hooks](#2-hooks) · [3 Routing](#3-routing) · [4 State management](#4-state-management) · [5 API integration](#5-api-integration) · [6 TanStack Query](#6-tanstack-query) · [7 Forms](#7-forms) · [8 Validation](#8-validation) · [9 Component architecture](#9-component-architecture) · [10 Performance](#10-performance-optimisation) · [11 Authentication](#11-authentication) · [12 Authorization](#12-authorization) · [13 TypeScript](#13-typescript) · [14 UI libraries](#14-ui-libraries-and-styling) · [15 Not implemented](#15-concepts-not-implemented-and-why)

---

## 1. React fundamentals

| Concept | What it does | Why used here | Module | File path | Component / hook | How it works in the app |
|---|---|---|---|---|---|---|
| Functional components | Components as functions | Only style used (the sole class component is the error boundary, which React requires) | all | `src/features/**/pages/*.tsx` | e.g. `PatientListPage` | Every page/component is a function component with hooks |
| JSX / props / children | Declarative UI, data in via props | basic composition | all | `src/components/common/PageHeader.tsx` | `PageHeader({ title, subtitle, actions, icon })` | Pages pass strings, nodes and action buttons as props |
| Parent → child communication | Props flow down | pass entities to presentational rows/cards | Patients, Doctors | `src/features/patients/components/PatientRow.tsx` | `PatientRow` props `patient`, `canEdit` | `PatientListPage` renders one row per patient and passes data + flags |
| Child → parent communication | Callbacks flow up | rows report clicks without knowing routing | Patients, Doctors, Pharmacy | `src/features/doctors/components/DoctorCard.tsx` | `onOpen`, `onHover`, `onToggleCompare` | Card calls the callbacks; the parent decides (navigate / prefetch / dispatch) |
| Lifting state up | Shared state in the nearest common parent | booking wizard steps share date/doctor/slot | Appointments | `src/features/appointments/pages/BookAppointmentPage.tsx` | `BookingFlow` state (`date`, `doctorId`, `time`, `picked`) | The four step cards are children reading/writing parent state; `SlotPicker` is controlled by `value`/`onChange` |
| Prop drilling (and its cure) | Passing props through levels | shown in the booking steps / table rows; replaced by context where it would spread | Appointments, Auth | `src/features/appointments/pages/BookAppointmentPage.tsx`; `src/contexts/AuthContext.tsx` | `Step` → children; `useAuth()` | Local data is drilled one level; session/theme/permissions that every level needs come from Context instead |
| Conditional rendering | Different UI per state | loading/error/empty/data, role-dependent buttons | all | `src/components/common/QueryBoundary.tsx`, `src/components/common/Can.tsx` | `QueryBoundary`, `Can` | Skeleton → `ErrorState` → `EmptyState` → data; `<Can permission>` hides unauthorised controls |
| Lists and keys | Render collections efficiently | tables, cards, timelines | all | `src/features/doctors/pages/DoctorListPage.tsx` | `pageItems.map(<DoctorCard key={d.id}/>)` | Stable ids as keys; `Fragment key` in tables |
| Fragments | Group without extra DOM | table rows + expansion row, conditional siblings | shared | `src/components/tables/DataTable.tsx` | `<Fragment key=…>` | Row and optional expanded row returned together |
| Controlled components | Value owned by React state | wizard + hospital forms | Patients, Hospitals | `src/features/patients/pages/PatientRegistrationPage.tsx`, `src/features/hospitals/pages/HospitalFormPage.tsx` | `TextField value onChange` | Each input mirrors `useState` |
| Uncontrolled components | Value owned by the DOM | avoid per-keystroke renders | Auth, Records, Notifications, Appointments | `src/features/authentication/pages/LoginPage.tsx` (RHF `register`), `src/features/medical-records/components/AddEntryDialog.tsx` (`FormData`), `src/features/notifications/components/SendNotificationDialog.tsx` (action + `FormData`), `src/features/appointments/pages/BookAppointmentPage.tsx` (`reasonRef`) | – | Values are read on submit from refs/FormData |
| Context API | Value available to a subtree | session, theme, notifications, active hospital | Auth, Notifications, Hospitals | `src/contexts/*.tsx` | `AuthProvider`, `ThemeProvider`, `NotificationsProvider`, `HospitalProvider` | Providers composed in `AppProviders.tsx` / `AppLayout.tsx`, consumed with `use(Context)` hooks |
| Portals | Render outside the DOM parent | modals/menus above overflow/z-index | shared, MUI, Radix | `src/components/dialogs/Modal.tsx` (`createPortal`), Radix `Dialog.Portal` in `src/components/ui/dialog.tsx`, MUI `Dialog` | `Modal` | Content mounts under `<body>`; context/events still bubble through the React tree |
| Error boundaries | Contain render errors | one crashing page must not blank the app | App layout | `src/components/error-boundaries/ErrorBoundary.tsx` | `ErrorBoundary` (`getDerivedStateFromError`, `componentDidCatch`, `resetKey`) | Wraps the app, `AppLayout` content and `AuthLayout`; resets when the pathname changes |
| Refs | Imperative DOM access | focus, file input, uncontrolled values | shared | `src/components/common/SearchInput.tsx` (`inputRef`), `src/components/forms/FileDropzone.tsx` (`input`) | – | `/` focuses the search box; dropzone clicks the hidden input |
| Forwarding refs | Pass a ref to an inner element | reusable inputs/buttons | shared UI | `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/common/SearchInput.tsx` | `React.forwardRef` | Parents can focus/measure the underlying element |
| `useImperativeHandle` | Expose a small imperative API | open dialogs/clear inputs from event handlers | shared | `src/components/dialogs/ConfirmDialog.tsx` (`ask()`), `src/components/common/SearchInput.tsx` (`focus/clear`), `src/components/forms/FileDropzone.tsx` (`clear/openPicker/getFile`) | `ConfirmDialogHandle`, `SearchInputHandle`, `FileDropzoneHandle` | `ref.current.ask({...})` opens the confirmation from any handler |
| Smart & presentational components | Separate data from view | testable, reusable views | all | smart: `src/features/billing/pages/InvoiceListPage.tsx`; presentational: `src/features/pharmacy/components/MedicineRow.tsx`, `StockBadge.tsx` | – | Pages fetch/orchestrate, row/card components only render props |
| Reusable layout components | Shared page structure | consistent shell | all | `src/layouts/AppLayout.tsx`, `src/layouts/AuthLayout.tsx`, `src/components/common/PageHeader.tsx` | layout routes | `<Outlet/>` inside `Suspense` + `ErrorBoundary` |
| Component composition | Build UI by nesting | pages from small parts | all | `src/features/doctors/pages/DoctorDetailsPage.tsx` | header card + `Tabs` + `Outlet` | Layout route composes header, tabs and routed content |
| Feature-based architecture | Code grouped by business area | scalability | all | `src/features/*` | – | See `PROJECT_ARCHITECTURE.md` |
| Shared components | Reuse across features | no duplication | all | `src/components/common/*`, `src/components/ui/*` | – | e.g. `PatientPicker` used by booking, prescriptions, lab, billing, records |
| Component factories | Functions that create components | one definition per status enum | all | `src/components/common/StatusBadge.tsx` | `createStatusBadge<S>(map)` → `AppointmentStatusBadge`, `BillStatusBadge`, `LabStatusBadge`, … | Map status → badge variant once; returns a typed component |

## 2. Hooks

| Hook | What / why | Module | File path | Component / hook | How it works |
|---|---|---|---|---|---|
| `useState` | local state | Patients | `src/features/patients/pages/PatientRegistrationPage.tsx` | `PatientRegistrationPage` | wizard step, form values, errors, result are separate `useState`s |
| `useReducer` | state machines / complex forms | Auth, Billing | `src/contexts/AuthContext.tsx` (`reducer`), `src/features/billing/components/PayDialog.tsx`, `src/features/billing/pages/GenerateBillPage.tsx` | `AuthProvider`, `PayDialog`, `GenerateBillPage` | typed action unions; Generate-bill reducer owns line items, totals and errors |
| `useEffect` | side effects | shared | `src/hooks/useIdleTimer.ts`, `src/hooks/useDebounce.ts`, `src/contexts/ThemeContext.tsx` | – | subscriptions/timers with cleanup |
| `useRef` | mutable refs | shared | `src/hooks/useThrottle.ts`, `src/contexts/AuthContext.tsx` (`roleRef`) | – | latest-callback pattern, role snapshot for stable callbacks |
| `useMemo` | memoised derived data | Doctors, Lab, Pharmacy | `src/features/doctors/pages/DoctorListPage.tsx` (`visible`), `src/features/pharmacy/pages/MedicineListPage.tsx` (`filtered`) | – | filter + sort only recompute when inputs change |
| `useCallback` | stable handlers | Patients, Doctors, Pharmacy | `src/features/patients/pages/PatientListPage.tsx` (`open`, `edit`, `hover`), `src/features/doctors/hooks/useDoctors.ts` (`usePrefetchDoctor`) | – | keeps memoised children from re-rendering |
| `useContext` / `use()` (React 19) | read context | shared | `src/contexts/AuthContext.tsx` (`useAuth`, `useAuthActions`) | `use(AuthStateContext)` | `use` replaces `useContext` |
| `useId` | accessible ids | shared | `src/components/dialogs/Modal.tsx`, `src/components/common/PatientPicker.tsx` | – | label/`aria-labelledby` linking |
| `useDeferredValue` | keep typing responsive | Patients | `src/features/patients/pages/PatientListPage.tsx` | `rows = useDeferredValue(…)` | table content may lag behind the input |
| `useSyncExternalStore` | subscribe to external stores | shared, System | `src/hooks/useOnlineStatus.ts`, `src/features/system/pages/ProfilerPage.tsx`, `src/features/system/pages/CacheMonitorPage.tsx` | `useOnlineStatus`, profiler/cache snapshots | browser online events, profiler store, TanStack cache events |
| `useActionState`, `useFormStatus` (React 19) | form actions | Notifications | `src/features/notifications/components/SendNotificationDialog.tsx` | `SendNotificationDialog`, `SubmitButton` | `<form action>` + FormData, pending state from `useFormStatus` |
| `useTransition` | – | – | – | – | not needed – `useDeferredValue` covers the one case |
| `useImperativeHandle`, `forwardRef` | see §1 | shared | `ConfirmDialog.tsx`, `SearchInput.tsx`, `FileDropzone.tsx` | – | – |
| **Custom hooks** | reusable logic | shared | `src/hooks/useDebounce.ts` (`useDebouncedValue`, `useDebouncedCallback`), `useThrottle.ts` (`useThrottledCallback`), `useUrlState.ts`, `useDisclosure.ts`, `useIdleTimer.ts`, `useFileDownload.ts`, `useDocumentTitle.ts`, `useOnlineStatus.ts` | – | one concern each; feature hooks: `useCurrentPatient`, `useCurrentDoctor`, `useAppointmentFeed`, `usePrescriptionExport`, `useDashboardStats`, … |

## 3. Routing

| Concept | Module | File path | Component / hook | How it works |
|---|---|---|---|---|
| `BrowserRouter` | app | `src/app/App.tsx` | `App` | wraps the routes inside providers |
| `Routes` / `Route` | app | `src/app/router.tsx` | `AppRoutes` | declarative table of all ~60 routes |
| Nested routes | Patients, Doctors | `src/app/router.tsx` (`:patientId` / `:doctorId` with children) | – | tab pages as child routes |
| Layout routes | app | `src/app/router.tsx`, `src/layouts/AppLayout.tsx`, `src/layouts/AuthLayout.tsx` | `<Route element={<ProtectedLayout/>}>` | shell rendered once, pages in `<Outlet/>` |
| Dynamic routes + route parameters | all | `src/features/patients/pages/PatientDetailsPage.tsx` | `useParams()` → `patientId` | numeric ids parsed per page |
| Query parameters | Patients, Appointments, Lab, Notifications | `src/hooks/useUrlState.ts` | `useUrlState(keys, defaults)` (`useSearchParams`) | filters/sort/page live in the URL (shareable, back button works) |
| `useNavigate` | all | `src/features/appointments/pages/AppointmentListPage.tsx` | row click / action buttons | programmatic navigation, `replace` after login/logout |
| `useLocation` | shell, auth | `src/components/layouts/Breadcrumbs.tsx`, `src/features/authentication/pages/LoginPage.tsx` | breadcrumbs from the path; `location.state.from` | redirect back after login |
| `useSearchParams` | see query parameters | `src/hooks/useUrlState.ts`, `src/features/appointments/pages/BookAppointmentPage.tsx` | – | booking pre-fill `?doctorId=&date=&time=` |
| Protected routes | app | `src/components/hoc/withAccess.tsx` | `withAuth(AppLayout)` | anonymous → `/login` with `state.from` |
| Public routes | auth | `src/components/hoc/withAccess.tsx` | `withPublicOnly(LoginPage)` | signed-in users go to the dashboard |
| Lazy-loaded routes | app | `src/app/router.tsx` | `lazy(() => import(...))`, `named()` helper | one chunk per page |
| Outlet context | Patients, Doctors | `src/features/patients/pages/PatientDetailsPage.tsx`, `PatientTabs.tsx` | `<Outlet context>` / `useOutletContext` | loaded record shared with tab routes |
| Redirects / catch-all | app | `src/app/router.tsx` | `<Navigate>`, `path="*"` | `/` → dashboard, unknown → 404 |

## 4. State management

| Approach | Module | File path | Component / hook | How it works |
|---|---|---|---|---|
| `useState` | Patients, Hospitals, Appointments | `PatientRegistrationPage.tsx`, `HospitalFormPage.tsx`, `BookAppointmentPage.tsx` | – | local, per-form/per-flow state |
| `useReducer` | Billing, Auth | `src/features/billing/pages/GenerateBillPage.tsx`, `PayDialog.tsx`, `src/contexts/AuthContext.tsx` | reducers | explicit actions; impossible states avoided (e.g. no double submit) |
| Context API | Auth, Notifications, Theme, Hospital | `src/contexts/*` | `AuthProvider` (state + actions contexts), `NotificationsProvider` | memoised values, split contexts to limit re-renders |
| Redux Toolkit | Doctors, Billing, Layout | `src/store/slices/doctorFiltersSlice.ts`, `billingUiSlice.ts`, `layoutSlice.ts`, `src/app/store.ts` | `createSlice`, `createSelector`, `createAsyncThunk`, `configureStore` | filters/sort/compare tray, payable basket + sequential settlement thunk, sidebar |
| React Redux | Doctors, Billing, Shell | `src/store/redux/hooks.ts`, `src/app/providers/AppProviders.tsx` | `useAppDispatch`, `useAppSelector` (typed with `.withTypes`) | `DoctorListPage`, `InvoiceListPage`, `Sidebar` |
| Zustand | Hospitals, Pharmacy | `src/store/zustand/hospitalStore.ts`, `pharmacyStore.ts` | `useHospitalStore`, `usePharmacyStore` (`persist`) | one selector per value; non-React access via `getState()` |
| Server state | all | `src/app/queryClient.ts`, `src/features/*/hooks` | TanStack Query | never duplicated in Redux/Zustand |
| URL state | lists | `src/hooks/useUrlState.ts` | – | shareable filters/pages |
| Persistent preferences | theme, active hospital, notification read ids | `ThemeContext.tsx`, `HospitalContext.tsx`, `NotificationsContext.tsx`, `src/utils/storage.ts` | – | guarded `localStorage` (try/catch) |

## 5. API integration

| Concept | Module | File path | Component / hook | How it works |
|---|---|---|---|---|
| Axios instance | all | `src/services/axios/client.ts` | `apiClient` | base URL from env, timeout, JSON headers |
| Axios interceptors | API/Auth layer | `src/services/axios/client.ts` | request/response interceptors | request: bearer + `X-Correlation-Id`; response: GET retry, 401 refresh+replay, 403 event, `ApiError` |
| Fetch API | Medical Records | `src/services/api/fetchClient.ts`, `src/services/endpoints/recordsApi.ts` | `fetchJson`, `fetchBlob` | same auth/refresh contract, `AbortSignal.any` + timeout, blob/multipart |
| HTTP methods GET/POST/PUT/PATCH/DELETE | all | `src/services/api/http.ts`, `src/services/endpoints/*.ts` | `http.get/post/put/patch/delete` | e.g. PATCH `authApi.users.setEnabled`, DELETE `patientApi.deactivate` |
| Centralised API services | all | `src/services/endpoints/` | `patientApi`, `doctorApi`, … | one module per backend service; components never import Axios |
| Request/response handling, typing | all | `src/types/*.ts` | `Page<T>`, entities | generics end-to-end |
| API authentication / authorisation | API layer | `src/services/axios/client.ts`, `tokenStore.ts` | bearer header | see §11 |
| Global error handling | API layer | `src/services/axios/errors.ts`, `src/app/queryClient.ts` | `ApiError`, `toApiError`, `errorMessage`, Query/Mutation cache handlers | one normalised error type, toasts from `meta` |
| Loading / error / empty states | all | `src/components/common/QueryBoundary.tsx`, `ErrorState.tsx`, `EmptyState.tsx`, `Spinner.tsx` | render-prop boundary | uniform handling for every data view |
| Debouncing | search boxes | `src/hooks/useDebounce.ts`, `src/components/common/SearchInput.tsx` | `useDebouncedValue` | request fires 350 ms after typing stops |
| Throttling | Pharmacy, Lab | `src/hooks/useThrottle.ts`, `src/features/pharmacy/pages/MedicineListPage.tsx` (refresh), `PharmacyOrdersPage.tsx`, `src/features/laboratory/pages/LabHistoryPage.tsx` (auto-load) | `useThrottledCallback` | at most one refresh/page-load per interval |
| Server-side pagination | Patients, Lab, Billing, Notifications | `PatientListPage.tsx`, `LabRequestListPage.tsx`, `InvoiceListPage.tsx`, `NotificationListPage.tsx` | `?page=&size=` | `Page<T>` envelope, `keepPreviousData` |
| Client-side pagination | Doctors, Pharmacy, Appointments | `DoctorListPage.tsx`, `MedicineListPage.tsx`, `AppointmentListPage.tsx` | slice of the filtered array | endpoints return arrays |
| Filtering / sorting / searching | all lists | the list pages above; `src/components/tables/DataTable.tsx` | `useMemo` pipelines, sortable headers | server (`q`, `status`) or client side |
| Parallel API calls | Dashboard, Billing, Lab | `src/features/dashboard/hooks/useDashboardStats.ts`, `src/features/billing/hooks/useBilling.ts` (`useBillingStatusCounts`), `useLab.ts` (`useCreateLabRequests`) | `Promise.allSettled`, `useQueries` | independent widgets, one failure does not break the page |
| `Promise.all` | Patients | `src/features/patients/hooks/usePatients.ts` | `usePrefetchPatient` | detail + appointment history prefetched together on row hover |
| `Promise.allSettled` | Dashboard, Lab | `useDashboardStats.ts`, `useLab.ts`, `src/utils/promise.ts` (`allSettled`) | – | per-call success/failure |
| `Promise.race` | Dashboard | `src/utils/promise.ts` | `withTimeout` | each widget call capped at 6 s |
| Sequential API calls | Patients, Billing, Doctors | `PatientRegistrationPage.tsx` (register→login→create), `billingUiSlice.ts` (`settleSelectedBills` + `sequence`), `useDoctors.ts` (`useSaveDoctor`: user → doctor) | – | each step needs the previous result |
| Retry mechanism | API layer | `src/services/axios/client.ts` (GET back-off), `src/app/queryClient.ts` (`shouldRetry`, `retryDelay`), `src/utils/promise.ts` (`withRetry`, used by `useFileDownload`) | – | never retries 4xx |
| Request cancellation / `AbortController` | all queries, downloads | `src/services/api/http.ts` (signal), `src/services/api/fetchClient.ts`, `src/hooks/useFileDownload.ts` (`new AbortController`, `cancel`), `src/features/medical-records/pages/MedicalDocumentsPage.tsx` (Cancel download) | – | superseded searches/bookings are aborted; downloads can be cancelled |

## 6. TanStack Query

| # | Concept | File path | Component / hook | How it works |
|---|---|---|---|---|
| 1-2 | `QueryClient`, `QueryClientProvider` | `src/app/queryClient.ts`, `src/app/providers/AppProviders.tsx` | `queryClient` | single client for the app |
| 3 | `useQuery` | `src/features/doctors/hooks/useDoctors.ts` | `useDoctor`, `useDoctorSchedule`, … | declarative fetching |
| 4 | `useMutation` | `src/features/appointments/hooks/useAppointments.ts` | `useBookAppointment`, `useRescheduleAppointment` | writes + cache maintenance |
| 5-6 | Query keys, key factories | `src/services/queryKeys.ts` | `queryKeys.<service>.…` | hierarchical, typed |
| 7 | Query functions | `src/services/endpoints/*.ts` | `({ signal }) => api.x(…, signal)` | endpoint modules are the query functions |
| 8 | Query options | `src/features/doctors/hooks/useDoctors.ts` | `doctorQueryOptions`, `doctorScheduleQueryOptions` (`queryOptions()`) | shared by `useQuery` and `prefetchQuery` |
| 9 | Invalidation | `useAppointments.ts` (`useBookAppointment`), `useBilling.ts` | `invalidateQueries({ queryKey })` | after every mutation the dependent groups refetch |
| 10 | Refetching | `src/features/system/pages/CacheMonitorPage.tsx`, `ErrorState onRetry` | `query.refetch()` / `query.fetch()` | retry buttons, admin tools |
| 11-12 | Caching, gcTime | `src/app/queryClient.ts` | defaults `gcTime 5 min` (hospitals 30 min) | unused entries garbage-collected |
| 13 | staleTime | `src/app/queryClient.ts` | 30 s default; 10 min reference data; 5 s availability | per-key via `setQueryDefaults` |
| 14-15 | Refetch on window focus / reconnect | `src/app/queryClient.ts` | defaults; availability uses `'always'` | slot grids always revalidate on focus |
| 16-17 | Retry, retry delay | `src/app/queryClient.ts` | `shouldRetry`, `retryDelay` | no 4xx retries, exponential delay ≤ 10 s |
| 18 | Enabled queries | `src/features/hospitals/hooks/useHospitals.ts` (`useHospital`), `useAppointments.ts` (`useAvailability`) | `enabled` | wait for ids/dates/roles |
| 19 | Dependent queries | `src/features/appointments/hooks/useAppointments.ts` (`useAppointmentFeed`), `BookAppointmentPage.tsx`, `src/features/hospitals/hooks/useHospitals.ts` (`useDepartments`) | profile → appointments; doctor+date → slots | `enabled` chaining |
| 20 | Parallel queries | `src/features/patients/pages/PatientTabs.tsx` (`PatientOverviewTab`) | `useQueries` | 4 independent requests |
| 21-22 | Dynamic parallel queries, `useQueries` | `useHospitals.ts` (`useDepartmentDirectory`), `useAppointments.ts` (per-doctor), `useLab.ts` (`useLabReports`), `useBilling.ts` (`useManyBillPayments`) | list built at render time | count depends on data |
| 23-24 | Infinite queries | `src/features/laboratory/hooks/useLab.ts` (`useLabRequestsInfinite`), `src/features/pharmacy/hooks/usePharmacy.ts` (`useOrdersInfinite`) | `useInfiniteQuery` | `getNextPageParam`, “Load more” + auto-load |
| 25 | Pagination | `src/features/patients/hooks/usePatients.ts` (`usePatientList`), `useLab.ts` (`useLabRequestPage`) | page in key | per-page cache |
| 26 | Placeholder data | `usePatients.ts` / `useLab.ts` (`keepPreviousData`), `BookAppointmentPage.tsx`, `useDoctors.ts` (`useDoctor`) | `placeholderData` | no flicker between pages; list row as placeholder for detail |
| 27 | Initial data | `usePatients.ts` (`usePatient`), `useAppointments.ts` (`useAppointment`), `useBilling.ts` (`useBill`) | `initialData` + `initialDataUpdatedAt` | detail pages render instantly from cached lists |
| 28 | Prefetching | `useDoctors.ts` (`usePrefetchDoctor`), `usePatients.ts` (`usePrefetchPatient`) | `prefetchQuery` on hover | |
| 29 | Optimistic updates | `src/app/queryClient.ts` (cancel appointment), `useLab.ts` (`useSetLabStatus`), `usePharmacy.ts` (`useRestock`), `useBilling.ts` (`usePayBill`) | `onMutate` / rollback | UI updates before the server answers |
| 30 | Cache updates | `usePatients.ts`, `usePharmacy.ts` (`useSaveMedicine`), `queryClient.ts` | `setQueryData`, `setQueriesData` | patch rows instead of refetching |
| 31 | Query cancellation | `queryClient.ts` (`cancelQueries`), every `signal` | – | |
| 32-36 | Mutation lifecycle: `onMutate/onSuccess/onError/onSettled` | `src/app/queryClient.ts` (`setMutationDefaults(['appointments','cancel'])`), `useLab.ts` | – | snapshot → patch → rollback → invalidate |
| 37 | Query removal | `src/contexts/AuthContext.tsx` (`queryClient.clear()` on logout/login), `CacheMonitorPage.tsx` (`removeQueries`) | – | nothing of the previous user remains |
| 38 | Query reset | `CacheMonitorPage.tsx` | `resetQueries()` | |
| 39-40 | Query cache / mutation cache | `src/app/queryClient.ts` (`new QueryCache({onError})`, `new MutationCache({…})`), `CacheMonitorPage.tsx` (inspection) | global toasts | |
| 41-42 | Query / mutation defaults | `src/app/queryClient.ts` | `setQueryDefaults`, `setMutationDefaults` | |
| 43 | Network mode | `src/app/queryClient.ts` | `online` default, `offlineFirst` for reference data | |
| 44 | `select` / data transformation | `src/features/pharmacy/hooks/usePharmacy.ts` (`useMedicine`), `src/features/authentication/hooks/useCurrentIdentity.ts` (`useCurrentDoctor`), `src/features/prescriptions/hooks/usePrescriptions.ts` | `select` | derive one item from a cached list |
| 45 | Background refetching | `src/features/notifications/…`/`NotificationsContext.tsx`, `useDashboardStats.ts`, `useLabRequest`, `usePrescriptionStatus` | `refetchInterval` | polling where the backend has no push |
| 46 | Error handling | `src/app/queryClient.ts`, `QueryBoundary.tsx` | `meta.errorMessage` / `silent` | |
| – | `useIsFetching` / `useIsMutating` | `src/components/layouts/TopProgress.tsx` | – | global progress bar |
| – | DevTools (dev only, dynamic import) | `src/app/providers/AppProviders.tsx` | `ReactQueryDevtools` | |

## 7. Forms

| Approach | Module | File path | Notes |
|---|---|---|---|
| Controlled, `useState` | Patients, Hospitals | `PatientRegistrationPage.tsx`, `HospitalFormPage.tsx`, `HospitalDetailsPage.tsx` (`DepartmentDialog`) | |
| `useReducer` forms | Billing | `GenerateBillPage.tsx` (form array), `PayDialog.tsx` | |
| React Hook Form | Auth, Doctors, Lab, Pharmacy | `LoginPage.tsx`, `DoctorTabs.tsx` (`ScheduleEditor`), `RequestLabTestPage.tsx`, `LabRequestDetailsPage.tsx` (`ReportForm`), `LabTestListPage.tsx`, `MedicineDialogs.tsx` | `register` (uncontrolled) and `Controller` (for MUI/Radix selects) |
| Formik | Patients, Doctors, Prescriptions | `PatientEditPage.tsx`, `DoctorFormPage.tsx`, `GeneratePrescriptionPage.tsx`, `src/components/forms/FormikFields.tsx` | `useField` reusable fields |
| Formik + Zod | Patients, Prescriptions | `src/utils/zodForm.ts` (`zodToFormikValidate`) | adapter with nested-path conversion |
| Formik + Yup | Doctors | `src/schemas/doctor.ts` (`doctorYupSchema`), `DoctorFormPage.tsx` | `validationSchema` with `when()` |
| React Hook Form + Zod | Auth, Doctors, Lab, Pharmacy | `@hookform/resolvers/zod` in the files above | |
| Zod only (manual) | Patients, Billing | `zodErrors()` in `src/utils/zodForm.ts` | `useState`/`useReducer` forms |
| Custom form validation | Hospitals, Records, Notifications | `src/schemas/hospital.ts`, `AddEntryDialog.tsx`, `SendNotificationDialog.tsx` | plain functions |
| Field-level validation | all | blur/touched handling (Formik `touched`, RHF `errors`, `onBlur` in `HospitalFormPage.tsx`) | |
| Form-level / cross-field validation | Patients, Prescriptions, Doctors | `src/schemas/auth.ts` (password = confirmation), `src/schemas/doctor.ts` (`scheduleDaySchema`), `src/schemas/prescription.ts` (duplicate medicines) | `refine` / `superRefine` |
| Conditional validation | Patients, Doctors, Lab | `src/schemas/patient.ts` (emergency contact), `doctorYupSchema` (`createLogin`), `src/schemas/laboratory.ts` (urgent ⇒ notes) | |
| Dynamic forms / fields / form arrays | Prescriptions, Lab, Doctors, Billing | Formik `FieldArray` (`GeneratePrescriptionPage.tsx`), RHF `useFieldArray` (`RequestLabTestPage.tsx`, `DoctorTabs.tsx`), reducer array (`GenerateBillPage.tsx`) | add/remove rows with per-row errors |
| Nested forms / nested values | Prescriptions, Lab | `items.0.dosage`, `tests.1.testCode` paths | nested error objects |
| File upload forms | Lab, Records | `src/components/forms/FileDropzone.tsx`, `LabRequestDetailsPage.tsx`, `MedicalDocumentsPage.tsx` | client-side type/size checks, progress (Axios) |
| Multi-step forms | Patients | `PatientRegistrationPage.tsx` | MUI `Stepper`, per-step Zod |
| Form submission | all | each form's `onSubmit` | loading state, disabled button, server errors |
| Server-side validation errors | all | `ApiError.fieldErrors` (`src/services/axios/errors.ts`) → Formik `setErrors`, RHF `setError`, local state | 400 `details[]` → fields (and wizard step) |
| Reset and dirty state | Patients, Doctors | `PatientEditPage.tsx` (`dirty`, `resetForm`, `enableReinitialize`), `DoctorTabs.tsx` (`isDirty`, `reset`) | |
| React 19 form actions | Notifications | `SendNotificationDialog.tsx` | `useActionState` |

## 8. Validation
Schemas live in `src/schemas/`: `auth.ts` (login, account), `patient.ts` (personal/contact), `doctor.ts` (Yup doctor form, Zod schedule), `laboratory.ts` (request, report, test), `prescription.ts`, `pharmacy.ts`, `billing.ts`, `hospital.ts` (custom). They mirror the backend rules (patterns, lengths, enums) found in the OpenAPI documents, and the backend's own errors are rendered as a second layer.

## 9. Component architecture

| Pattern | File path | Component | How it works |
|---|---|---|---|
| Higher-order components | `src/components/hoc/withAccess.tsx` | `withAuth`, `withRoles`, `withPermission`, `withPublicOnly` | wrap a page, render redirect or the page; `displayName` set; used in `src/app/router.tsx` |
| Compound components | `src/features/appointments/components/AppointmentCard.tsx`, `src/features/prescriptions/components/PrescriptionView.tsx` | `AppointmentCard.Header/Details/Notes/Actions`, `PrescriptionView.Header/Parties/Diagnosis/Items/Item/Footer` | root provides data through context; static members consume it |
| Render props | `src/components/common/QueryBoundary.tsx`, `src/components/tables/DataTable.tsx` (`cell`, `renderExpanded`), `src/components/tables/VirtualList.tsx` (`renderItem`), `src/features/prescriptions/components/PrescriptionView.tsx` (`Items` children fn) | – | callers pass functions that receive the data |
| Children props | `Modal`, `PageHeader`, `Notice`, `Card*` | – | slot-like composition |
| Custom hooks | see §2 | – | – |
| Error boundaries, portals, refs | see §1 | – | – |
| Component factories | `StatusBadge.tsx` | `createStatusBadge` | – |
| Context optimisation | `src/contexts/AuthContext.tsx` | state context vs actions context, `useMemo`/`useCallback` values | action-only consumers do not re-render on user changes |

## 10. Performance optimisation

| Technique | File path | Component | How it works |
|---|---|---|---|
| `React.memo` | `src/features/patients/components/PatientRow.tsx`, `src/features/doctors/components/DoctorCard.tsx`, `src/features/pharmacy/components/MedicineRow.tsx`, `src/features/medical-records/components/EntryRow.tsx`, `src/features/hospitals/components/HospitalCard.tsx`, `src/features/appointments/components/SlotPicker.tsx` | – | rows/cards re-render only when their props change (stable callbacks) |
| `useMemo` | `DoctorListPage.tsx`, `MedicineListPage.tsx`, `AppointmentListPage.tsx`, `InvoiceListPage.tsx` | – | filtering/sorting/grouping |
| `useCallback` | `PatientListPage.tsx`, `DoctorListPage.tsx`, `MedicineListPage.tsx`, `src/hooks/*` | – | stable handlers for memoised children |
| `React.lazy`, `Suspense`, route-based code splitting | `src/app/router.tsx`, `src/layouts/AppLayout.tsx` | – | one chunk per page; Suspense fallback in the layout |
| Component-based code splitting | `src/features/appointments/pages/AppointmentCalendarPage.tsx` | `lazy(() => import('../components/CalendarMonth'))` | calendar grid downloaded on demand |
| Dynamic imports | `src/features/prescriptions/hooks/usePrescriptionExport.ts`, `src/app/providers/AppProviders.tsx` (devtools) | – | export code / devtools only when needed |
| Virtualisation | `src/components/tables/VirtualList.tsx` (`@tanstack/react-virtual`), `src/features/medical-records/pages/PatientRecordPage.tsx` | – | only visible timeline rows are mounted |
| Debouncing / throttling | `src/hooks/useDebounce.ts`, `useThrottle.ts` | – | see §5 |
| Avoiding unnecessary re-renders | `useDeferredValue` (`PatientListPage.tsx`), memoised rows, narrow Zustand selectors (`HospitalListPage.tsx`), memoised Redux selectors (`doctorFiltersSlice.ts`) | – | |
| State colocation | form state inside the page/dialog that owns it (e.g. `DepartmentDialog`), wizard state in `BookingFlow` | – | global stores hold only cross-component state |
| Optimising Context API | `src/contexts/AuthContext.tsx`, `NotificationsContext.tsx` | – | split contexts, memoised values |
| Optimising Redux selectors | `src/store/slices/doctorFiltersSlice.ts` | `createSelector` (`selectDoctorServerParams`, `selectCompareCount`, `selectHasActiveFilters`) | recompute only when inputs change |
| React Profiler | `src/components/common/ProfiledSection.tsx`, `src/utils/profilerStore.ts`, `src/features/system/pages/ProfilerPage.tsx` | `ProfiledSection id=…` around patient list, doctor directory, medicine table, record timeline, dashboard | admin page shows commits/actual/base durations |
| Bundle optimisation | `vite.config.ts` (`manualChunks`: react, router, tanstack, mui, radix, forms, state) | – | long-lived vendor chunks; ~60 lazy page chunks |
| Image lazy loading | `src/components/common/LazyAvatar.tsx` | `<img loading="lazy" decoding="async">` | doctor/patient avatars (generated SVG data URIs, `src/utils/avatar.ts`) |

## 11. Authentication

| Concept | File path | Component / hook | How it works |
|---|---|---|---|
| Login | `src/features/authentication/pages/LoginPage.tsx`, `src/services/endpoints/authApi.ts` | `LoginPage`, `authApi.login` | RHF + Zod, 401/429 messages, redirect to `state.from` |
| User registration | `src/features/patients/pages/PatientRegistrationPage.tsx` | wizard | `POST /auth/register` → login → `POST /patients` |
| Logout | `src/contexts/AuthContext.tsx`, `src/components/layouts/Header.tsx` | `logout()` | clears tokens + query cache, revokes the refresh-token family |
| JWT authentication, access token management | `src/services/axios/tokenStore.ts`, `src/utils/jwt.ts` | `tokenStore`, `decodeJwt` | token only in memory; `exp` read for renewal |
| Refresh token management | `src/services/axios/refresh.ts`, `tokenStore.ts` | `refreshSession()` | `sessionStorage`, **single-flight** because the backend rotates tokens and revokes the family on reuse |
| Token expiration / renewal | `src/contexts/AuthContext.tsx` | renewal `useEffect` | timer 60 s before expiry, re-armed after each renewal |
| Axios authentication interceptors | `src/services/axios/client.ts` | interceptors | bearer on every request, 401 → refresh → replay |
| Authentication context | `src/contexts/AuthContext.tsx` | `useAuth`, `useAuthActions`, `useCan` | status `loading/anonymous/authenticated`, session restore on reload |
| Session management | `AuthContext.tsx` | restore effect + `sessionExpiredChannel` | tab-scoped session |
| Unauthorized response handling | `src/services/axios/authEvents.ts`, `AuthContext.tsx`, `src/features/authentication/pages/AccessPages.tsx` | `UnauthorizedPage`, `AccessDeniedPage` | 401 → logout toast; 403 → toast / 403 page |
| Automatic logout | `src/hooks/useIdleTimer.ts`, `AuthContext.tsx` | `useIdleTimer(config.idleLogoutMinutes, …)` | inactivity (default 30 min) |
| Redirect after login | `LoginPage.tsx`, `withAccess.tsx` | `state.from` | return to the page that required login |
| Protected / public routes | `src/components/hoc/withAccess.tsx` | HOCs | see §3 |

## 12. Authorization
* **RBAC:** roles from the JWT/`/auth/me` (`src/types/common.ts → Role`), enforced for routes by `withRoles` and in the UI by `useAuth().role`.
* **Permission-based:** `src/constants/permissions.ts` (`PERMISSIONS`, `can`, `canAny`), `src/components/common/Can.tsx`, `withPermission`, `useCan`, sidebar filtering (`src/constants/navigation.tsx`, `src/components/layouts/Sidebar.tsx`), dashboard widgets (`DashboardPage.tsx`), per-action buttons (e.g. `AppointmentListPage.tsx`).
* **Ownership rules** (a doctor edits only their own schedule, a patient only their own data): `DoctorDetailsPage.tsx` (`manageSchedule`), `useCurrentPatient` / `useCurrentDoctor`.

## 13. TypeScript
Strict mode (`tsconfig.app.json`: `strict`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `isolatedModules`, `@/*` alias). Interfaces for every API entity (`src/types/*`), generics (`Page<T>`, `QueryBoundary<T>`, `DataTable<T>`, `VirtualList<T>`, `createStatusBadge<S>`, `MuiSimpleTable<T>`), discriminated unions (`AuthState` in `AuthContext.tsx`, `Settled<T>` in `utils/promise.ts`, reducer `Action` unions), utility types (`Partial`, `Pick`, `Omit`, `Record`, `satisfies`, `z.infer`, `yup.InferType`, `ReturnType<typeof store.getState>`), module augmentation (`@tanstack/react-query` `Register` for `meta`, axios `AxiosRequestConfig`), typed Redux hooks (`.withTypes`), typed thunk config (`src/store/redux/types.ts`), `as const` permission table with `satisfies Record<string, readonly Role[]>`.

## 14. UI libraries and styling

| Library / technique | Modules | Example files |
|---|---|---|
| Material UI | Patients, Doctors, Hospitals, shared theme | `PatientListPage.tsx`, `DoctorListPage.tsx`, `HospitalListPage.tsx`, `src/contexts/ThemeContext.tsx` (`createTheme`), MUI X date pickers (`PatientRegistrationPage.tsx`, `DoctorTabs.tsx`) |
| Tailwind CSS | shell, Appointments, Billing, Notifications, Dashboard, System | `tailwind.config.js`, `src/features/appointments/pages/*`, `src/components/layouts/*` |
| Radix UI | Medical Records (raw primitives), shell, shadcn | `AddEntryDialog.tsx` (Dialog), `PatientRecordPage.tsx` (Tabs, Tooltip), `RecordEntryPage.tsx` (Accordion), `src/components/ui/*` |
| shadcn/ui | Laboratory, Pharmacy, Prescriptions | `src/components/ui/*` + `LabTestListPage.tsx`, `MedicineListPage.tsx` |
| CSS Modules | Medical Records | `src/features/medical-records/records.module.css` |
| Global CSS | whole app | `src/styles/global.css` |
| Flexbox / CSS Grid | everywhere | `CalendarMonth.tsx` (7-column grid), `.hms-grid-auto`, `AuthLayout.tsx` |
| Responsive design | shell | `Sidebar.tsx` (drawer < lg), fluid grids, `Header.tsx` |
| Theme management, dark/light | `src/contexts/ThemeContext.tsx`, `global.css` variables, `Header.tsx` toggle | one source drives CSS variables, Tailwind `dark:` and the MUI theme |

## 15. Concepts not implemented and why
| Concept | Reason |
|---|---|
| MFA, OAuth 2.0, forgot/reset password | The backend exposes no such endpoints (see `API_INTEGRATION_DOCUMENTATION.md`); the specification forbids simulating them |
| HttpOnly refresh-token cookie | The backend returns the refresh token in the response body and sets no cookie; mitigated with memory-only access token + `sessionStorage` refresh token |
| Real-time notifications (WebSocket/SSE) | Backend has none; REST polling every 30 s is used |
| Mock-data mode | Not needed – no sample data is displayed anywhere |
| `useTransition` | No interaction needed a non-urgent transition beyond `useDeferredValue` |
