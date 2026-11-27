# State Management

## Decision guide
| Kind of state | Use | Example here |
|---|---|---|
| **Server state** (data that lives on the backend) | Server Components for first paint; **TanStack Query** for client interaction | slots, appointments, lab, medicines (`features/appointments/hooks.ts`) |
| **URL state** (shareable, survives refresh, server-readable) | search params + `useUrlState` / `<form method=GET>` | patient search `?q=&page=`, billing `?status=`, availability `?date=` |
| **Local state** (one component) | `useState` | dialog open flags, patient edit/deactivate (`features/patients/*`) |
| **Complex local state / explicit transitions** | `useReducer` | billing form (`features/billing/BillForm.tsx`), toasts (`components/ui/toast.tsx`), notification read ids |
| **Cross-tree, rarely changing** | Context | auth snapshot (`AuthProvider`), notifications (`NotificationsProvider`), theme (`ThemeProvider`) |
| **Global client UI state with logic** | Redux Toolkit | doctor board, appointment filters/view/calendar |
| **Lightweight shared client state, persisted** | Zustand | hospital browser, pharmacy filters, doctor shortlist |
| **Browser-only external data** | `useSyncExternalStore` | theme, online/offline |

Rule applied: never keep the same server data in two stores. Redux holds the doctor list **for the management board only**; TanStack Query owns every other server read.

## useState
Patient forms: `features/patients/PatientEditForm.tsx` (uncontrolled), `DeactivatePatient.tsx`; booking wizard selections (`features/appointments/BookingWizard.tsx`). Derived state is computed with `useMemo`, not stored.

## useReducer
* `features/billing/BillForm.tsx` — `reducer` with actions `patient | field | line | addLine | removeLine | errors | reset`; totals derived.
* `components/ui/toast.tsx` — add/remove toasts.
* `components/providers/NotificationsProvider.tsx` — `hydrate | read` over the set of read ids.

## Context API
`components/providers/AuthProvider.tsx` (`useAuth()` → `{ user, can(permission) }`, serialisable snapshot from the server, no token), `NotificationsProvider.tsx` (items from TanStack Query + read ids reducer + Server Action), `ThemeProvider.tsx`. Custom hooks wrap each (`useAuth`, `useNotifications`, `useTheme`) and throw outside their provider.

## Redux Toolkit / React Redux
* `store/redux/store.ts` — `configureStore` factory `makeStore()` (per session, never a module singleton), custom logger middleware, DevTools enabled outside production.
* `store/slices/doctorsSlice.ts` — `createSlice`, `createEntityAdapter` (normalised), `createAsyncThunk` (`fetchDoctors`, abortable), `createSelector` (`selectVisibleDoctors`, `selectSpecializations` — memoised), extra reducers.
* `store/slices/appointmentsSlice.ts` — `createAction` + `createReducer` (builder) for view/status/month/selected date/search.
* `components/providers/ReduxProvider.tsx` (`Provider`), `store/redux/hooks.ts` (`useAppDispatch`, `useAppSelector`, `useAppStore`). `useStore` is used in `features/doctors/DoctorsBoard.tsx` to read the store imperatively inside an effect.
* Mounted in `(dashboard)/layout.tsx` only.

## Zustand
`store/zustand/hospitalStore.ts` (`persist` + `subscribeWithSelector`, actions, `partialize`), `pharmacyStore.ts` (`persist`, derived `deriveMedicines()` + `stockLevel()`), `shortlistStore.ts`. All use `skipHydration: true`; `DashboardShell` calls `persist.rehydrate()` once on the client so server and client markup match.

## TanStack Query
See [`DATA_FETCHING_AND_CACHING.md`](DATA_FETCHING_AND_CACHING.md#tanstack-query).

## Server state vs client state
Server state is owned by the backend; the browser holds a *cache* of it (TanStack) that is invalidated by mutations. Client state (filters, view mode, open dialogs) is owned by the browser and kept in the smallest scope that works.

## URL state
`hooks/useUrlState.ts` writes search params with `router.replace` inside `useTransition` (resets `page`); server pages read them from `searchParams`, so the same URL gives the same result on the server, on refresh and when shared.
