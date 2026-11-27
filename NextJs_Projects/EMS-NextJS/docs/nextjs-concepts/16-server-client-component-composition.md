# 16. Server and Client Component composition

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Server and Client Components can be interleaved: a Server Component can render a Client Component and pass it serialisable props **or other server-rendered React nodes as `children`/slots**; a Client Component cannot import a Server Component (but can render one it receives as a prop).

## 2. Syntax
```tsx
// Server
export default async function Page() {
  const departments = await getDepartments();           // server data
  return <EmployeeFilters departments={departments.map(d => ({ value: d.code, label: d.name }))} />;  // client island, plain props
}
// Client wrapper keeps children server-rendered
'use client'; export function Providers({ children }: { children: ReactNode }) { … <Ctx.Provider>{children}</Ctx.Provider> }
```

## 3. How Next.js implements it
The "donut pattern": client providers wrap `children`, which remain server output. Only data that is already public to the signed-in user crosses the boundary, as plain JSON props.

## 4. Actual EMS implementation
* Root layout renders `<ConfigProvider><ThemeProvider><ToastProvider>{children}` — three small client providers, pages stay server components.
* `(dashboard)/layout.tsx` resolves the session on the server and passes **only display fields** (`id`, `name`, `email`, `role`, …) to `<AuthProvider>`; the token never crosses.
* Pages pass plain option lists to client forms (`EmployeeForm departments={…}`), never entire API responses or functions.
* Server Actions are passed from server modules to client forms as props/imports (`ActionForm action={…}`).
* `DataTable` (server) receives render functions from the *page* (also server) — if a client component needed them, `use client` would break the generic design, so interactive row actions are separate islands (`StatusSwitch`, `DecisionForm`).

## 5. Relevant file paths
- `src/app/layout.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/contexts/AuthContext.tsx`
- `src/app/(dashboard)/employees/new/page.tsx`
- `src/features/employees/EmployeeForm.tsx`
- `src/components/common/DataTable.tsx`

## 6. Practical use case
The edit page loads the employee and reference lists on the server, hands serialisable defaults to the RHF form, and the form calls the Server Action — no client-side API URL, no token.

## 7. Why the concept is used
Keep data access and secrets on the server while delivering interactivity in small, well-bounded islands.

## 8. Advantages
- Minimal client JS.
- Clear security boundary.
- Composable UI.

## 9. Limitations
- Props must be serialisable (no Dates as objects you rely on, no functions).
- Over-fragmentation into many tiny islands can hurt readability.

## 10. Common mistakes
- Exporting a non-serialisable default (e.g. functions) from a plain module used by both sides — keep such modules free of `use client` if the server needs the values (`employee-defaults.ts` is deliberately a *plain* module so the server can read `emptyEmployee`).
- Passing the raw API object to a client component (leaks fields).

## 11. Interview-related considerations
- Why can a client component render `children` that are server components?
- How do you prevent a server-only module from being imported on the client?
