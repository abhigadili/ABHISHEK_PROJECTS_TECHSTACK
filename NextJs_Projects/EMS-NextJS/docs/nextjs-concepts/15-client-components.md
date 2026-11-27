# 15. Client Components

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
A Client Component starts with the `'use client'` directive. It is rendered on the server for the first HTML **and** hydrated in the browser, so it can use state, effects, refs, event handlers and browser APIs. The directive marks a *boundary*: everything imported by that file becomes client code.

## 2. Syntax
```tsx
'use client';
import { useState } from 'react';
export function Counter() { const [n, setN] = useState(0); return <button onClick={() => setN(n + 1)}>{n}</button>; }
```

## 3. How Next.js implements it
Client Components are bundled and hydrated; hydration must produce the same markup as the server render (otherwise a *hydration mismatch*). Browser-only values (localStorage, `window`, `Date.now()`) must be read in effects or via `useSyncExternalStore` with a server snapshot.

## 4. Actual EMS implementation
Small **islands** only where interaction demands it: `EmployeeFilters`, `EmployeeForm` (React Hook Form), `OrgTree`, `CheckCard`, `Modal`/`ConfirmSubmit`, `ActionForm`/`SubmitButton`/`Field`, `Topbar` (bell, user menu), `Sidebar`, `NavLinks`, `EmployeeTabs`, `DashboardCharts` (lazy, `ssr:false`), contexts/providers, the hooks lab. Hydration safety examples: `ThemeContext` and `QualificationsView` use `useSyncExternalStore` with a server snapshot; `Modal` and the toast viewport render via portals only after mount; the avatar preview blob URL is created in an event handler, not render.

## 5. Relevant file paths
- `src/features/employees/EmployeeFilters.tsx`
- `src/features/employees/EmployeeForm.tsx`
- `src/features/departments/OrgTree.tsx`
- `src/features/attendance/CheckCard.tsx`
- `src/components/dialogs/Modal.tsx`
- `src/contexts/ThemeContext.tsx`
- `src/features/employees/QualificationsView.tsx`

## 6. Practical use case
The check-in card needs `useState`/`useTransition` and a fetch on mount, so it is a client island inside the otherwise server-rendered `/attendance` page.

## 7. Why the concept is used
Interactivity, local state, browser APIs.

## 8. Advantages
- Rich interactions.
- Access to browser APIs.
- Can be nested inside Server Components via `children` props.

## 9. Limitations
- Adds JS to the bundle and a hydration cost.
- Cannot use `server-only` modules.
- Props must be serialisable.

## 10. Common mistakes
- Marking big pages as client.
- Reading localStorage during render (mismatch).
- Putting secrets in a client file or a `NEXT_PUBLIC_` variable.

## 11. Interview-related considerations
- What does `use client` really mark? (the module graph boundary)
- Hydration mismatch causes?
