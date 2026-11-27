# 48. React concepts in Next.js

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Next.js is built on React: components/JSX, props/children, hooks, context, state management, forms, memoisation, Suspense, error boundaries, portals and patterns all apply — with the extra rule that **hooks and browser APIs only work in Client Components**.

## 2. Syntax
```tsx
'use client'; const [n, setN] = useState(0);                 // client-only: state/effects/refs/handlers
export default async function Page() { await …; return <Client prop={serializable} />; }   // server: async, no hooks
```

## 3. How Next.js implements it
React 19 features used: Actions (`useActionState`, `useFormStatus`), `useOptimistic`, `use` of Suspense data via the framework, `ref` as a prop (no `forwardRef` needed — see `Button`), improved hydration errors. **Which hooks are client-only?** All hooks that depend on state/effects/browser (`useState`, `useEffect`, `useLayoutEffect`, `useReducer`, `useRef`, `useImperativeHandle`, `useContext`, `useMemo`/`useCallback` (client usefulness), `useTransition`, `useDeferredValue`, `useSyncExternalStore`, `useActionState`, `useFormStatus`, `useOptimistic`, `useId` works in both but is used in client forms). Server Components can’t use them because they render once on the server with no re-render/lifecycle.

## 4. Actual EMS implementation
**Components & JSX:** everywhere; generics `DataTable<T>`; conditional/list rendering with stable `key`s; fragments; children/slots (layout slots, `Modal` children); controlled (`EmployeeFilters` search) and uncontrolled (RHF `register`, native forms) inputs.

**Hooks — production use vs isolated demo**

| Hook | Production use | Demo |
|---|---|---|
| `useState` | filters, modals, org-tree open set, forms | hooks lab |
| `useEffect` | `beforeunload` guard, Modal focus/Esc, polling, typeahead fetch (with cleanup/abort) | — |
| `useContext` | Auth, Theme, Toast, Config contexts | patterns lab |
| `useRef` | focus return in Modal, file input handle, abort controllers | hooks lab |
| `useReducer` | `ToastContext` (`toastReducer`) | todos in hooks lab |
| `useMemo` / `useCallback` | org tree filtering, context values, stable handlers | hooks lab |
| `useId` | `Field` label↔input↔message wiring, `FileUpload` | hooks lab |
| `useTransition` | `EmployeeFilters` (pending style), `EmployeeForm` submit, `CheckCard` | optimistic like |
| `useSyncExternalStore` | `ThemeContext`, `QualificationsView` (hydration-safe browser state) | — |
| `useActionState` / `useFormStatus` | `ActionForm`, `SubmitButton` | — |
| `useImperativeHandle` | `FileUpload` (`open`/`clear` handle) | hooks lab (`Box`) |
| `useDeferredValue` | org-chart search (`hooks/useOrganization.ts`) | hooks lab |
| `useLayoutEffect`, `useDebugValue`, `useOptimistic` | — (no EMS screen needs them) | **`/learn/hooks`** (isolated, labelled) |

**Custom hooks (all used by real screens):** `useAuth` (Topbar), `usePermissions` (OrgTree edit links), `useEmployeeSearch` (`EmployeePicker`), `useAttendanceToday` (`CheckCard`), `useLeaveBalances` (leave form balance hint), `useOrganization` (org chart expand/search/highlight), `useNotifications` (bell, polling), `useDebounce` (filters, typeahead), `useModal` (`ConfirmSubmit`) — in `src/hooks`. `useDepartments` and `usePagination` were created and then **removed**: no client island needs departments (Server Components pass them as props) and every list paginates through the URL, so they would have been dead code.

**Context API:** Auth (display user + `can`), Theme, Toast, App config. **Redux Toolkit — only where justified:** notification badge + mobile sidebar; per-mount `makeStore()` (no SSR leakage), `createEntityAdapter` normalisation, typed hooks, selectors (`createSelector`), async thunks, a custom middleware plus default middleware, Redux DevTools in dev. Server data is **not** mirrored.

**Forms (React Hook Form + zod):** `useForm`, `register`, `Controller` (the manager `EmployeePicker`), `useFieldArray` (education, experience, emergency contacts, skills, certifications), `useWatch` (conditional login fields), resolver, nested fields, server-side validation echoes (`setError`), async check (username availability on `/register`). `FormProvider`/`useFormContext`, nested fields and async validation are demonstrated in **`/learn/forms`** (isolated).

**Other concepts:** `React.memo` (`OrgTree` nodes), Suspense (docs 22), error boundaries (`error.tsx`; class boundary demo in `/learn/react`), portals (`Modal`, toasts), **HOC / render props / compound components / prop drilling vs context / state lifting / keys** — `/learn/react` (isolated, labelled), TypeScript generics (`DataTable<T>`, `apiFetch<T>`), reconciliation & keys (stable ids; reverse demo), StrictMode (`reactStrictMode: true` double-invokes effects in dev — cleanup functions are therefore mandatory and present).

## 5. Relevant file paths
- `src/hooks/`
- `src/contexts/`
- `src/store/`
- `src/features/employees/EmployeeForm.tsx`
- `src/components/forms/ActionForm.tsx`
- `src/components/dialogs/Modal.tsx`
- `src/features/departments/OrgTree.tsx`
- `src/app/(public)/learn/hooks/HooksLab.tsx`
- `src/app/(public)/learn/react/PatternsLab.tsx`
- `src/app/(public)/learn/forms/FormsLab.tsx`

## 6. Practical use case
The employee form combines RHF field arrays, `useWatch`, a zod resolver and a Server Action; the org tree combines `memo`, `useMemo`, state lifting and keys.

## 7. Why the concept is used
A shared mental model: what runs where, and which React tools belong to which side.

## 8. Advantages
- Clear client/server split of hooks.
- Isolated demos keep production code lean.

## 9. Limitations
- Some React features (e.g. `useOptimistic`, HOC) have no natural place in an HR CRUD app — documented as demos rather than forced in.

## 10. Common mistakes
- Calling a hook in a Server Component.
- Missing effect cleanup (breaks under StrictMode).
- Using Redux for server data that Server Components already fetch.

## 11. Interview-related considerations
- Which hooks can’t be used in Server Components and why?
- When context vs Redux?
- What does StrictMode do?
