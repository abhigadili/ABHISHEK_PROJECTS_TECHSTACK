# 10. Parallel routes

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Parallel routes render **several independent route trees at the same time inside one layout** using *named slots* (`@name`). Each slot has its own loading, error and navigation state, and the layout receives it as a prop next to `children`.

## 2. Syntax
```text
app/(dashboard)/dashboard/
├── layout.tsx            ← ({ children, kpis, charts, events })
├── page.tsx
├── @kpis/page.tsx    @kpis/loading.tsx    @kpis/default.tsx
├── @charts/page.tsx  @charts/loading.tsx  @charts/error.tsx  @charts/default.tsx
└── @events/page.tsx  @events/default.tsx
```
```tsx
export default function Layout({ children, kpis, charts, events }: LayoutProps<'/dashboard'>) { … }
```

## 3. How Next.js implements it
Slots are *not* URL segments. During soft navigation Next.js keeps each slot’s previously active state; on a hard load an unmatched slot renders `default.tsx` (without it → 404). Each slot streams independently, so a slow slot never blocks the others, and `error.tsx` inside a slot contains failures to that slot.

## 4. Actual EMS implementation
* **Dashboard:** `@kpis` (counts/attendance today), `@charts` (headcount, attendance, leave; Recharts via `next/dynamic`), `@events` (birthdays/anniversaries). Their data comes from the *same* `GET /dashboard` call, memoised with `React.cache` (`getDashboard`), so three slots cost one backend request. For an `EMPLOYEE` (backend answers 403) the `@kpis` slot renders a personal summary instead.
* **Employees:** the `@modal` slot of `employees/layout.tsx` (see doc 11) — `default.tsx` returns `null`.
* **Slot navigation behaviour** is exercised live: closing the modal via Back restores the list; refreshing renders the full page, because the slot falls back to `default.tsx`.

## 5. Relevant file paths
- `src/app/(dashboard)/dashboard/layout.tsx`
- `src/app/(dashboard)/dashboard/@kpis/page.tsx`
- `src/app/(dashboard)/dashboard/@charts/error.tsx`
- `src/app/(dashboard)/dashboard/@events/page.tsx`
- `src/app/(dashboard)/employees/layout.tsx`
- `src/app/(dashboard)/employees/@modal/default.tsx`
- `src/lib/server/dashboard.ts`

## 6. Practical use case
If the chart service is slow, managers still see headcount and pending approvals instantly; if charts throw, only the chart card shows "Retry".

## 7. Why the concept is used
Resilience and perceived performance: independent data regions, independent failure domains, co-located code per region.

## 8. Advantages
- Independent streaming, loading and errors.
- Slots can be conditionally rendered by role/state.
- Enable modals (doc 11).

## 9. Limitations
- `default.tsx` is required for every slot that may be unmatched on hard navigation.
- Slot state is retained on soft navigation but lost on refresh.
- More files than a plain component split.

## 10. Common mistakes
- Missing `default.tsx` → 404 after refresh.
- Using slots when a plain `<Suspense>` boundary would do.
- Calling the backend once per slot instead of memoising.

## 11. Interview-related considerations
- Parallel route vs Suspense boundary?
- What is `default.tsx` for?
