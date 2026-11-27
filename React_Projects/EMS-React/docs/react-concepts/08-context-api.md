# 08 · Context API (and when Redux Toolkit is the better tool)

## 1. Concept explanation
Context lets a **Provider** make a value available to **any descendant** that calls `useContext`, skipping the components in
between (the cure for *prop drilling*). Every consumer re-renders when the Provider's `value` changes (by `Object.is`), which is
the central performance consideration.

Five contexts exist, deliberately small and single-purpose (no "one big AppContext"):

| Context | Purpose | File |
|---|---|---|
| `AuthenticationContext` | `useAuth()` façade over the Redux session: `user`, `login`, `logout`, `isAuthenticated`, `isBootstrapping` | `contexts/AuthenticationContext.tsx` |
| `UserContext` | Presentation data derived from auth: display name, initials, role label | `contexts/UserContext.tsx` |
| `ThemeContext` | light/dark mode (persisted) + builds the MUI theme | `contexts/ThemeContext.tsx` |
| `NotificationContext` | toast queue; **two** contexts (actions vs list) | `contexts/NotificationContext.tsx` |
| `AppConfigContext` | static configuration (app name, page sizes, poll interval) | `contexts/AppConfigContext.tsx` |

## 2. Syntax
```tsx
const Ctx = createContext<Value | null>(null);                 // createContext
export function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(init);
  const value = useMemo(() => ({ state, setState }), [state]);   // stable value → fewer re-renders
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useThing() { const c = useContext(Ctx); if (!c) throw new Error('inside <Provider>'); return c; }
```

## 3. Actual EMS implementation
* **Provider composition & nesting** — `app/providers/AppProviders.tsx`:
  `Redux ▸ AppConfig ▸ Theme ▸ Notification ▸ Authentication ▸ User ▸ Confirm (+ ToastHost)`. **Order matters**: each provider may use everything above it — Authentication reads Redux, `UserProvider` reads `useAuth()` (a *nested* provider deriving data from its parent), the global HTTP error notifier needs `NotificationProvider`, `ToastHost` needs the Notification contexts.
* **Context value updates** — `AuthenticationProvider` rebuilds its value with `useMemo` only when `user/profile/status/error/bootstrapped` change; `login/logout/clearError` are `useCallback`s.
* **Performance considerations**
  * `NotificationContext` is **split** into `ActionsContext` (stable functions) and `ToastsContext` (the changing list). Components that only *emit* toasts never re-render when a toast appears — proven by a render-count test in `contexts/contexts.test.tsx`.
  * `ThemeContext` memoises the MUI theme (`useMemo(() => buildTheme(mode), [mode])`), because rebuilding a theme re-styles the whole tree.
  * `AppConfigContext` is static, so it can never cause a re-render after mount.
* **Custom hooks over raw `useContext`** — `useAuth`, `useNotify`, `useThemeMode`, `useCurrentUser`, `useConfirm`, `useAppConfig` throw a helpful error outside their provider (tested).
* **Router context** — `useOutletContext` hands the loaded employee from `EmployeeLayout` to its child routes (`features/employees/useEmployeeContext.ts`), another form of context scoped to a route subtree.

## 4. Relevant file paths
`src/contexts/*.tsx`, `src/app/providers/AppProviders.tsx`, `src/hooks/useAuth.ts`, `src/contexts/contexts.test.tsx`.

## 5. Practical implementation — Context + Redux together
```tsx
// AuthenticationContext.tsx — Redux owns the transitions, Context is the tiny public API
const { user, profile, status, error, bootstrapped } = useAppSelector((s) => s.auth);
const login = useCallback(async (email, password) => loginThunk.fulfilled.match(await dispatch(loginThunk({ email, password }))), [dispatch]);
const value = useMemo(() => ({ user, profile, status, error, isAuthenticated: status === 'authenticated',
                               isBootstrapping: !bootstrapped, login, logout, clearError }), [...]);
```
Consumers (`LoginPage`, guards, `usePermissions`) don't know Redux exists; the HTTP layer reports "session expired" via a registered
callback that dispatches `sessionExpired()` (`registerSessionExpiredHandler`).

## 6. Why the concept is used (and the decision guide)
| Choose **Context** when… | Choose **Redux Toolkit** when… |
|---|---|
| value changes rarely (theme, locale, config, current user) | state changes often or in complex, ordered transitions |
| a handful of consumers, no devtools needed | many features read/write it; you want time-travel/DevTools and logging |
| no async orchestration | async workflows with pending/fulfilled/rejected (`createAsyncThunk`) |
| no need for selectors/memoisation | derived data needs memoised **selectors** (`createSelector`) |
| | cross-cutting middleware (reset on logout, logging) |

A Context re-renders **every** consumer on any change to its value — fine for a theme, wasteful for "the employee list".
That is why server data is in RTK Query and why Auth is Redux-backed with a Context façade.

## 7. Advantages and limitations
**+** Zero dependencies, trivial API, perfect for slow-changing globals. **−** No built-in selector granularity (any change re-renders all consumers); frequent updates → performance cliffs; nested provider "pyramids" (mitigated by one composition file); testing needs wrapping providers (`test/utils.tsx` does).

## 8. Interview-related considerations
* Context vs props vs Redux; "Is Context a state management tool?" (it is a *transport*; state still lives in `useState`/`useReducer`).
* Why can Context cause performance problems and how do you mitigate it? (split contexts, memoise value, selector libraries, move state down.)
* How to avoid the "undefined context" bug? (default `null` + a guard hook.)
* Provider order and why a provider can't consume a context defined below it.
* When does `value={{ a, b }}` (inline object) hurt? Every render creates a new object → all consumers re-render.
