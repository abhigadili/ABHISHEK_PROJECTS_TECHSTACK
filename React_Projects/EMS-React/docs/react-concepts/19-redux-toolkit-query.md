# 19 · Redux Toolkit Query (RTK Query)

## 1. Concept explanation
RTK Query is a data-fetching and **server-state cache** built into Redux Toolkit. You *declare endpoints*; it generates hooks that
fetch, cache by arguments, **de-duplicate** identical in-flight requests, expose `isLoading/isFetching/isError`, re-fetch on
demand and **invalidate** cache entries via *tags* when mutations succeed. It replaces hand-written
`loading/error/data` slices and `useEffect + fetch` code.

**Server state vs client state:** server state is a *cached copy* of data owned by someone else (the database) that can go stale;
client state is owned by the UI. RTK Query owns the former; slices/Context/local state own the latter.

## 2. Syntax
```ts
export const emsApi = createApi({
  reducerPath: 'emsApi', baseQuery: baseQueryWithReauth, tagTypes: ['Employee', 'Department'], keepUnusedDataFor: 60,
  endpoints: (build) => ({
    listEmployees: build.query<Paged<Employee>, EmployeeListQuery | void>({
      query: (q) => ({ url: '/employees', params: params(q ?? {}) }),
      providesTags: (r) => [{ type: 'Employee', id: 'LIST' }, ...(r?.items ?? []).map((e) => ({ type: 'Employee' as const, id: e.id }))] }),
    createEmployee: build.mutation<Employee, EmployeePayload>({
      query: (body) => ({ url: '/employees', method: 'POST', body }), invalidatesTags: [{ type: 'Employee', id: 'LIST' }] }),
  }) });
const { data, isLoading, isFetching, isError, error, refetch } = useListEmployeesQuery(filters, { pollingInterval, skip });
```

## 3. Actual EMS implementation (every required item)
| Item | Where |
|---|---|
| `createApi` | `store/api/emsApi.ts` — **one** API: 52 endpoints = 27 queries + 25 mutations (employees, profile, departments, designations, attendance, leave, holidays, notifications, reports) |
| `fetchBaseQuery` | `store/api/baseQuery.ts` — wrapped by `baseQueryWithReauth` (adds Bearer header via `prepareHeaders`; on 401 awaits the **shared** `refreshSession()` and retries once; unwraps the backend envelope; keeps pagination `meta` beside `items`; normalises errors to a **serialisable** `QueryError`) |
| Query endpoints | `listEmployees`, `getEmployee`, `listDepartments`, `listLeaveRequests`, `leaveCalendar`, `monthlyAttendanceReport`, … |
| Mutation endpoints | `createEmployee`, `updateEmployee`, `decideLeave`, `setDepartmentActive`, `markNotificationsRead`, … |
| **Tags & automatic invalidation** | `tagTypes: Employee, JobHistory, Department, Designation, Attendance, LeaveRequest, LeaveBalance, LeaveType, Holiday, Notification, Profile`; e.g. `decideLeave` invalidates `{LeaveRequest, id}`, `{LeaveRequest, LIST}` and `LeaveBalance`, so the approvals list and the balances refetch themselves |
| Query loading states | `isLoading` (first load) vs `isFetching` (any load) — tables dim during refetch instead of flashing a skeleton |
| Error handling | `isError` / `error` (a `QueryError` with `status`, `code`, `message`, `details`) → `ErrorMessage` with **Retry** |
| **Request de-duplication** | many components call `useListDepartmentsQuery`; one request is made (test: two simultaneous `initiate()` → 1 call) |
| Cache lifetime | `keepUnusedDataFor: 60`; a repeat query is served from cache (test) |
| Refetching | `refetch()`, `refetchOnReconnect`, **polling** (`NotificationsPage` uses `pollingInterval`), `forceRefetch`, `util.invalidateTags` (called from the attendance thunk) |
| `skip` | the department filter isn't requested for roles that can't use it (`useDepartments({ skip })`) |
| Cross-cutting | `emsApi.middleware` in the store; `emsApi.reducer` is reset on logout |

**Single-owner rule:** an entity is never fetched through RTK Query *and* copied into a slice. The directory slice (pickers) and the
paged list are different projections with different purposes; the dashboard, session and attendance-today are *not* in RTK Query.

## 4. Relevant file paths
`src/store/api/emsApi.ts`, `src/store/api/baseQuery.ts`, `src/hooks/useEmployees.ts`, `src/hooks/useDepartments.ts`, `src/hooks/useLeave.ts`,
`src/features/notifications/NotificationsPage.tsx`, `src/store/api/emsApi.test.tsx`.

## 5. Practical implementation — mutation → tag → automatic refetch
`emsApi.test.tsx` proves the loop end to end:
```ts
const sub = store.dispatch(emsApi.endpoints.listDepartments.initiate());  await sub;     // 1st request
await store.dispatch(emsApi.endpoints.createDepartment.initiate({ code: 'NEW', name: 'Brand new' })).unwrap();
await new Promise((r) => setTimeout(r, 80));                                              // invalidation → refetch
expect(listCalls).toBe(2);
expect(select()(store.getState()).data?.items.map((d) => d.name)).toContain('Brand new');
```
In the UI, creating a department makes it appear in every dropdown (`useDepartments`) with **no** manual refresh code.
Loader integration: the `employees/:id` route loader calls `getEmployee.initiate(id)` then `unsubscribe()`, so the component's
`useGetEmployeeQuery(id)` finds a warm cache entry (doc 14).

## 6. Why the concept is used
52 endpoints × (loading + error + cache + invalidation) would be thousands of lines of slice boilerplate. RTK Query gives correct
cache semantics (dedupe, tags, polling) declaratively and keeps screens thin.

## 7. Advantages and limitations
**+** automatic caching/invalidation, generated typed hooks, less code, DevTools visibility, consistent loading/error shape. **−** tag design needs thought (too coarse = over-fetching, too fine = stale data); the backend envelope required a custom base-query wrapper; **optimistic** updates are done with React 19 `useOptimistic` in the UI (simpler here than `onQueryStarted` patches); mutation hooks are per-component (no shared "is any save running" without extra state); file downloads/uploads and one-off cancellable calls stay on Axios because they aren't cacheable server state.

## 8. Interview-related considerations
* RTK Query vs React Query vs SWR vs `useEffect+fetch`; what problem do tags solve?
* `isLoading` vs `isFetching`; `skip`; `refetchOnMountOrArgChange`; `keepUnusedDataFor`; polling.
* `providesTags`/`invalidatesTags` with ids and the `'LIST'` convention.
* Optimistic updates (`onQueryStarted` + `updateQueryData` vs React 19 `useOptimistic`).
* Why a custom `baseQuery`? (auth refresh, envelope, error normalisation.) Why must errors be serialisable?
