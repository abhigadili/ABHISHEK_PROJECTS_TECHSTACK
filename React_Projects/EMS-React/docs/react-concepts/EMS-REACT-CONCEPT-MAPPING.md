# EMS-React — Concept → Implementation → Test mapping

Legend — **Where**: **App** = used in a real EMS screen · **Lab** = an isolated, clearly-labelled example under `/lab` (`src/features/lab/`) because no business
screen needs it · **Lib** = provided and used through a library API. Nothing is listed unless the code exists; the **Tests** column names the file that exercises it.
Test files: **P** `src/features/pages.test.tsx` · **H** `src/hooks/hooks.test.tsx` · **C** `src/components/components.test.tsx` · **X** `src/contexts/contexts.test.tsx` ·
**S** `src/store/slices/slices.test.ts` · **Q** `src/store/api/emsApi.test.tsx` · **A** `src/api/httpClient.test.ts` · **V** `src/services/services.test.ts` ·
**Z** `src/schemas/schemas.test.ts` · **L** `src/features/lab/lab.test.tsx` · **E** `e2e/ems.spec.ts` · **R** `e2e/routes.spec.ts` · **T** `e2e/refresh.spec.ts`.

## 4.1 JSX / TSX
| Concept | Where | Implementation | Tests |
|---|---|---|---|
| JSX & TSX syntax, expressions | App | all `*.tsx` | P |
| Conditional rendering | App | `DashboardPage.tsx`, `EmployeeSelfSummary`, `Can.tsx` | P, C |
| List rendering | App | `DataTable.tsx`, `OrgTree.tsx`, `Sidebar.tsx` | P, C |
| Dynamic attributes | App | `OrgTree.tsx` (`aria-current/expanded`), `NotificationMenu.tsx` | P |
| Fragments | App | `Sidebar.tsx` (`<Fragment key>`), many `<>…</>` | P |
| JSX event handling | App | `LeavePage.tsx`, `SearchBox.tsx` | C, P |
| Inline styles | Lab | `patterns/RenderProp.tsx`, `CompoundTabs.tsx`, `RenderingDemo.tsx` | L |
| Dynamic class names | App | `AttendanceCalendarPage.tsx`, `LeaveCalendarPage.tsx`, `HolidaysPage.tsx` (`classNames`) | R |
| Rendering components dynamically | App/Lab | `LabPage.tsx` (`SECTIONS[tab]`), `StatusBadge.tsx` | L |

## 4.2 Components · 4.3 Props
| Concept | Where | Implementation | Tests |
|---|---|---|---|
| Functional components, parent/child, composition | App | everywhere; `AppLayout`, `EmployeeLayout` | P |
| Presentational vs container | App | `StatusBadge`/`DataTable` vs `DashboardPage`/`EmployeeListPage` | C, P |
| Controlled / uncontrolled | App + Lab | `SearchBox`, `FileUpload` / `FormsDemo.tsx` | C, L |
| Children props | App | `Modal`, `Can`, `ErrorBoundary`, `AppLayout` | C |
| Component state | App | `useModal`, wizard step, view toggle | H, P |
| Reusable components (all 19 listed) | App | see doc 02 table | C, P |
| Props down / callbacks up / siblings via parent | App + Lab | `EmployeeCard.onSelect`, `EmployeeListPage`; `PatternsDemo` `Sibling` | C, L |
| Default / optional / required props, destructuring | App | `PageHeader`, `Modal`, `StatusBadge` | C |
| Spread props | App + Lab | `fields.tsx` (`{...field}`), `PatternsDemo` | L |
| Reusable generic components | App | `DataTable<T>`, `FormTextField<T>`, `List<T>` | C, L |

## 4.4 Hooks (see doc 05 for the full table)
| Hook | Where | Implementation | Tests |
|---|---|---|---|
| `useState` · `useEffect` · `useContext` · `useRef` | App | filters/modals · `DashboardPage`, `useNotifications` · `contexts/*` · `FileUpload`, `useApi` | H, X, C, L |
| `useReducer` | App + Lab | `NotificationContext.toastReducer`; `BasicHooksDemo` | X, L |
| `useMemo` · `useCallback` | App | `ThemeContext`, `Sidebar`, `EmployeeListPage` | L, X |
| `useLayoutEffect` | App + Lab | `OrgTree.tsx` (scroll before paint); `AdvancedHooksDemo` | P, L |
| `useImperativeHandle` | App + Lab | `FileUpload.tsx`; `AdvancedHooksDemo` | C, L |
| `useId` | App + Lab | `fields.tsx`, `FilterSelect.tsx` | L |
| `useTransition` · `useDeferredValue` | App | `EmployeeListPage`, `ReportsPage`, `OrganizationPage`, `LabPage` | P, L |
| `useSyncExternalStore` | App | `useLocalStorage`, `useOnlineStatus` | H |
| `useActionState` | App + Lab | `ForgotPasswordPage.tsx`; `AdvancedHooksDemo` | P, L |
| `useOptimistic` | App + Lab | `LeaveApprovalsPage.tsx`, `NotificationsPage.tsx` | P, L |
| `useDebugValue` | App | `useLocalStorage`, `useOnlineStatus` | — (DevTools-only; no observable DOM) |
| `useEffectEvent` | App + Lab | `useNotifications.ts`; `Ticker` | H |
| `useInsertionEffect` | **Lab only** (single genuine use case = CSS-in-JS injection) | `AdvancedHooksDemo.tsx#Injected` | L |

## 4.5 Custom Hooks (all 14 requested exist)
| Hook | Where used | Tests |
|---|---|---|
| `useAuth` `useEmployees` `useDepartments` `useAttendance` `useLeave` `useOrganization` `useNotifications` | App (pages listed in doc 09) | H, P |
| `usePagination` `useDebounce` `useLocalStorage` `useModal` `usePermissions` `useApi` `useFormValidation` | App | H |
| extras: `useProfilePicture`, `useOnlineStatus`, `useEmployeeContext` | App/Lab | P, H |

## 4.6 Context API
| Concept | Where | Tests |
|---|---|---|
| `createContext` / `useContext` / Provider | `contexts/*.tsx` | X |
| AuthenticationContext · UserContext · ThemeContext · NotificationContext · ApplicationConfigurationContext | `AuthenticationContext`, `UserContext`, `ThemeContext`, `NotificationContext`, `AppConfigContext` | X, H |
| Nested providers / provider composition | `app/providers/AppProviders.tsx` | X |
| Context value updates · performance (split contexts, memoised value) | `NotificationContext` (actions vs list), `AuthenticationContext` | X |
| Context vs Redux guidance | doc 08 | — |

## 4.7 Redux Toolkit · 4.8 RTK Query
| Concept | Where | Tests |
|---|---|---|
| `configureStore`, middleware, DevTools | `app/store/store.ts` | S |
| `createSlice` ×7 (auth, employee, department, attendance, leave, notification, dashboard) | `store/slices/*.ts` | S |
| `createAsyncThunk` + pending/fulfilled/rejected + loading/error | `authSlice`, `attendanceSlice`, `dashboardSlice`, `employeeSlice`, `notificationSlice` | S |
| `createSelector` | `store/selectors/dashboardSelectors.ts`, `employeeSelectors.ts` | S |
| Typed `useSelector`/`useDispatch` | `app/store/hooks.ts` | P, H |
| Normalised state (`createEntityAdapter`) | `employeeSlice.ts` | S |
| Immer immutability | `employeeSlice.toggleSelected` | S |
| `createApi` / `fetchBaseQuery` | `store/api/emsApi.ts`, `baseQuery.ts` | Q |
| Query + mutation endpoints, tags, invalidation, dedupe, polling, refetch | `emsApi.ts`; polling in `NotificationsPage` | Q, P |

## 4.9–4.11 Router, navigation, protection
| Concept | Where | Tests |
|---|---|---|
| Basic / nested / child / dynamic / index / layout / wildcard routes, redirects | `app/router/routes.tsx` | P, R |
| Route params, query/search params | `useParams`, `useSearchParams` (`useEmployees`, `AttendancePage`, `ResetPasswordPage`) | P, H |
| Loaders / actions / error boundaries / lazy | `loaders.ts`, `routes.tsx`, `StatusPages.tsx` | P |
| `useNavigate` `useLocation` `useOutletContext` `Outlet` `Link` `NavLink` | `EmployeeLayout`, `Sidebar`, `LoginPage`, guards | P |
| Navigation state | `guards.tsx` (`from`, `attempted`), `EmployeeListPage` (`fromList`) | P |
| Protected / role-based / guest-only routes, unauthorised page | `features/auth/guards.tsx` | P, R |
| Permission-based UI | `Can`, `usePermissions`, `Sidebar` | H, P |

## 4.12 Forms (RHF + Zod)
| Concept | Where | Tests |
|---|---|---|
| `useForm`, `register`, `handleSubmit`, `Controller`, `useController`, `FormProvider`, `useFormContext`, `useWatch`, `watch`, `setValue`, `getValues`, `reset`, `resetField`, `setError`, `clearErrors`, `trigger`, `formState` | doc 11 table | P, E |
| `useFieldArray` + dynamic education/experience/contacts/skills; per-row validation | `FieldArraySections.tsx` | P, E |
| useState / useRef forms | `FormsDemo.tsx` | L |
| Zod schemas ×8 + rules (required, email, phone, password, confirm, date range, conditional, cross-field, async duplicate email) | `src/schemas/*.ts`, `useFormValidation.ts` | Z, H, P |

## 4.13–4.14 API, Axios
| Concept | Where | Tests |
|---|---|---|
| 11 service modules | `src/services/*Api.ts` | V |
| GET/POST/PUT/PATCH/DELETE, params, headers, bodies | `employeeApi.ts`, `departmentApi.ts` | V |
| Multipart / uploads / downloads / blobs | `employeeApi.uploadPicture`, `leaveApi`, `reportApi` | V, E |
| Error handling, cancellation, timeout | `errors.ts`, `useApi.ts`, `httpClient.ts` | A, H, V |
| Interceptors: auth, refresh (single-flight, no loops), global errors, dedupe, correlation id, logout on failure | `api/httpClient.ts`, `store/api/baseQuery.ts` | A, Q, T |

## 4.15–4.20 Lifecycle, refs, performance, boundaries, portals, patterns
| Concept | Where | Tests |
|---|---|---|
| Mount / update / unmount / cleanup / deps / StrictMode | `LifecycleDemo.tsx`, `main.tsx`, hooks | L, H |
| Class → Hooks mapping | doc 06; `LegacyCounter.tsx` | L |
| `useRef`, DOM refs, `forwardRef`, imperative handles, focus, scroll, file input | `FileUpload`, `OrgTree`, `PictureManager`, Lab | C, L |
| `React.memo` · `useMemo` · `useCallback` | `DataTable`, `EmployeeCard`, `OrgTree`, `DashboardCharts` | L |
| Lazy / Suspense / code splitting / dynamic import | `routes.tsx`, `AppLayout`, `LabPage` | P |
| Virtualised lists | `VirtualList.tsx` (leave-balance report, Lab) | C, L |
| Debounced search · deferred rendering | `useDebounce`, `EmployeeListPage`, `OrganizationPage` | H, P |
| Error boundaries (+ route-level) | `ErrorBoundary.tsx`, `AppLayout`, `StatusPages.tsx` | C, P |
| `createPortal`, modals, confirm dialogs, tooltip | `ToastHost.tsx`, `Modal`, `ConfirmDialog`, `RenderingDemo` | X, C, L |
| HOC | **Lab only** — `patterns/withLoading.tsx` (+ `memo`/`forwardRef`/`lazy` in App) | L |
| Render props | **Lab** (`RenderProp.tsx`) + **App** (`Controller render`, `ErrorBoundary fallback`, `DataTable render`) | L, C |
| Compound components | **Lab** (`CompoundTabs.tsx`) + MUI compound APIs in App | L |
| Prop drilling → Context / `useOutletContext` | `UserContext`, `EmployeeLayout` | X, P |
| State lifting / colocation | `PatternsDemo`, `EmployeeListPage` | L, P |
| Reconciliation, keys, Virtual DOM | `RenderingDemo.tsx` | L |
| Concurrent rendering, StrictMode | `useTransition`/`useDeferredValue`; `main.tsx` | P, L |
| Server state vs client state | docs 04, 19 | Q, S |
| TypeScript generics / reusable generic components | doc 28 | `npm run typecheck` |

## Items intentionally not present
* `useInsertionEffect`, HOC, standalone render-prop and compound-component implementations exist **only in the Lab** (no business screen has a genuine use).
* No WebSocket/SSE notifications (backend has none) → polling.
* No education/experience/skills **backend** persistence (no API) → browser-local with a visible banner.
* No `/users` endpoint on the backend → the Users screen composes the employee endpoints.
* No teams CRUD UI (teams are shown read-only on the department page); no audit-log viewer UI (the endpoint exists; out of the prompt's module list).
