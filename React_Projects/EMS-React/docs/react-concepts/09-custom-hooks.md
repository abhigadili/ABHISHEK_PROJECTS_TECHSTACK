# 09 · Custom Hooks

## 1. Concept explanation
A custom Hook is a function starting with `use` that calls other Hooks. It extracts **stateful logic** (not UI) so several
components can reuse it, each getting its **own independent state**. They follow the Rules of Hooks and can return anything:
values, setters, objects, tuples, other Hooks' results.

## 2. Syntax
```ts
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const id = setTimeout(() => setDebounced(value), delayMs); return () => clearTimeout(id); }, [value, delayMs]);
  return debounced;
}
```

## 3. Actual EMS implementation (all required Hooks exist and are used)
| Hook | What it encapsulates | Used by |
|---|---|---|
| `useAuth` (`hooks/useAuth.ts` → `contexts/AuthenticationContext.tsx`) | session + login/logout | guards, `LoginPage`, `UserMenu`, `SettingsPage` |
| `useEmployees` | URL ⇄ filters ⇄ `useListEmployeesQuery`, "any filter change resets to page 1" | `EmployeeListPage` |
| `useDepartments` / `useDesignations` / `useDepartmentFilter` | select options + lookups from the RTK cache; the cross-screen filter | forms, filters, reports |
| `useAttendance` | today's record, check-in/out commands, toasts | `AttendanceWidget`, dashboard summary |
| `useLeave` | leave types + balances + `availableFor(typeId)` + year/status filter | `LeavePage`, `LeaveApplyPage`, dashboard |
| `useOrganization` | org chart load, expand/collapse set, debounced cancellable search, `reveal()` | `OrganizationPage` |
| `useNotifications` | unread count polling with cleanup (`useEffectEvent`) | `NotificationMenu` |
| `usePagination` | 1-based page/limit state; `setLimit` resets to page 1 | list pages |
| `useDebounce` | debounced value | employee search, org search, departments, users |
| `useLocalStorage` | `useSyncExternalStore`-based persistent state synced across components/tabs, `useDebugValue` | `ThemeContext` |
| `useModal<T>` | open/close + typed payload (the row being edited) | designations, holidays, users, job history |
| `usePermissions` | `can(permission)`, `hasRole(...)` | `Can`, `Sidebar`, pages |
| `useApi<T, A>` | generic async call with `AbortController`, stale-response guard, `run/reset` | `useOrganization`, department detail, reporting chain |
| `useFormValidation` | cached async "is this email taken?" + the async Zod schema | `EmployeeFormPage` |
| extras | `useProfilePicture` (Blob → object URL cache), `useOnlineStatus` (`useSyncExternalStore`), `useEmployeeContext` (typed `useOutletContext`) | avatars, lab, employee tabs |

Requirements satisfied: **loading/errors/cleanup** (`useApi`, `useNotifications`), **TypeScript generics** (`useApi<T,A>`, `useLocalStorage<T>`, `useModal<T>`), **naming convention** (`use*`), **no duplicated component logic** (the debounce→URL pattern is in one place), **reuse of API functionality** (`useEmployees` builds on the single RTK endpoint).

## 4. Relevant file paths
`src/hooks/*.ts`, `src/hooks/hooks.test.tsx` (unit tests with `renderHook`).

## 5. Practical implementation
`useFormValidation` caches network answers so React Hook Form re-validating on every blur doesn't spam the API, and degrades safely:
```ts
const isEmailTaken = useCallback(async (email: string) => {
  const key = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(key)) return false;         // sync rules report malformed emails
  const hit = cache.current.get(key); if (hit !== undefined) return hit;
  try { const res = await employeeApi.list({ q: key, status: 'ALL', limit: 20 });
        const taken = res.items.some((e) => e.workEmail.toLowerCase() === key && e.id !== opts.exceptEmployeeId);
        cache.current.set(key, taken); return taken; }
  catch { return false; }                                  // a lookup failure must not block the user; the server validates on submit
}, [opts.exceptEmployeeId]);
```
Tests (`hooks.test.tsx`): one backend call for two case-variants of the same email; editing excludes the employee themself; a 500 doesn't block.

## 6. Why the concept is used
Logic that is *about state and effects* (polling, debouncing, abortable requests, persistence) is the same in many screens; Hooks
let you name it once, test it once (without rendering a component), and keep components short and declarative.

## 7. Advantages and limitations
**+** Reuse without wrapper components (vs HOCs), independent state per call, trivially testable, composable (`useOrganization` uses `useApi` + `useDebounce`). **−** Hooks share *logic*, not *state* (two components calling `useModal` have separate modals — use Context/Redux to share); hiding too much behind a Hook makes data flow harder to trace; a Hook that returns a new object every render defeats `memo` (hence `useMemo` in `useModal`, `usePagination`).

## 8. Interview-related considerations
* "Does a custom Hook share state between components?" No — each call gets its own.
* Why must names start with `use`? Tooling/linters rely on it to enforce the Rules of Hooks.
* How do you test a Hook? `renderHook` + `act` (see `hooks.test.tsx`: fake timers for `useDebounce`, `StorageEvent` for `useLocalStorage`).
* Custom Hook vs HOC vs render prop vs utility function (a function with no Hook calls should stay a plain function — e.g. `utils/csv.ts`).
* Returning stable references (`useCallback`/`useMemo`) from Hooks, and generics for reuse.
