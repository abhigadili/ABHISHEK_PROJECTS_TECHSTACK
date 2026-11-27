# 14. Server Components

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
In the App Router every component is a **Server Component by default**: it renders on the server, may be `async`, can read databases/APIs/cookies directly, and its code and dependencies are **not sent to the browser**. It cannot use state, effects, event handlers or browser APIs.

## 2. Syntax
```tsx
// no directive = Server Component
export default async function Page({ searchParams }: PageProps<'/employees'>) {
  const sp = await searchParams;
  const { items } = await listEmployees({ search: one(sp.search) });   // server-only data access
  return <DataTable rows={items} … />;
}
```

## 3. How Next.js implements it
The server renders RSC to an intermediate payload; HTML is produced from it and streamed. Props passed to Client Components must be serialisable. Server Components can `await` directly; independent awaits should be started in parallel (`Promise.all`) to avoid waterfalls.

## 4. Actual EMS implementation
Nearly the whole app: layouts, pages, `DataTable`, `Pagination`, `Avatar`, `PageHeader`, all `app/**/page.tsx`. Examples of server-only logic in components: `requirePermission('leave:approve')` at the top of the approvals page; role-gated buttons computed with `can(user.role, …)` *on the server* so unauthorised markup is never sent; `Promise.all([loadEmployee(id), requireSession()])`; `DataTable<Employee>` is generic and takes **render functions** as props — legal only because it stays a Server Component (functions cannot cross to the client).

## 5. Relevant file paths
- `src/app/(dashboard)/employees/page.tsx`
- `src/app/(dashboard)/leaves/approvals/page.tsx`
- `src/components/common/DataTable.tsx`
- `src/components/common/Pagination.tsx`
- `src/app/(dashboard)/employees/[id]/page.tsx`

## 6. Practical use case
The employees table with 15 rows ships **zero JavaScript for the table itself** — only the filter bar hydrates.

## 7. Why the concept is used
Smaller bundles, direct and secure data access, fewer round trips, better SEO.

## 8. Advantages
- No client JS for static UI.
- Secrets and API URLs stay server-side.
- Direct async data access.
- Streaming-friendly.

## 9. Limitations
- No interactivity/hooks.
- Cannot import client-only libraries that touch `window` at module scope.
- Serialisation limits on props.

## 10. Common mistakes
- Adding `use client` to a whole page "to make the button work".
- Passing functions/class instances to Client Components.
- Sequential awaits (waterfalls).

## 11. Interview-related considerations
- What can/can’t a Server Component do?
- What is the RSC payload?
- Why can’t a Server Component pass a callback prop to a Client Component?
