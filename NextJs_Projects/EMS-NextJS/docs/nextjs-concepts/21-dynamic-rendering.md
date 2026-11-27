# 21. Dynamic rendering

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Dynamic rendering happens when a route (or part of it) depends on **request-time information**: `cookies()`, `headers()`, `searchParams`, un-pregenerated `params`, `connection()`, or uncached data. In this version dynamic parts must be inside `<Suspense>` (or the route must not need a static shell).

## 2. Syntax
```tsx
import { connection } from 'next/server';
async function Body() { await connection(); const today = new Date().toISOString().slice(0, 10); … }
```

## 3. How Next.js implements it
`connection()` explicitly opts a component into per-request rendering so non-deterministic values (time, randomness) are not frozen into the static shell. `new Date()` in a static context is a **build error**.

## 4. Actual EMS implementation
* Session/role: `getSession()` reads `cookies()` → every authenticated screen is dynamic.
* `connection()` + `new Date()`: `leaves/apply` (default date), `employees/new` (joining date), `attendance/calendar`, `holidays`, `leaves/calendar`, `reports`.
* Query-driven pages: `searchParams` awaited inside Suspense.
* `app/api/**` handlers are always dynamic.

## 5. Relevant file paths
- `src/app/(dashboard)/leaves/apply/page.tsx`
- `src/app/(dashboard)/employees/new/page.tsx`
- `src/app/(dashboard)/attendance/calendar/page.tsx`
- `src/lib/server/session.ts`

## 6. Practical use case
Applying for leave defaults the dates to *today* — computed per request, never a stale build-time date.

## 7. Why the concept is used
Correctness for time- and user-dependent output.

## 8. Advantages
- Always correct for the current request.

## 9. Limitations
- Costs server work per request.
- Must be isolated in Suspense to keep the shell static.

## 10. Common mistakes
- Using `Date.now()` / `Math.random()` in a static component.
- Forgetting Suspense around runtime reads.

## 11. Interview-related considerations
- What triggers dynamic rendering now?
- What does `connection()` do?
