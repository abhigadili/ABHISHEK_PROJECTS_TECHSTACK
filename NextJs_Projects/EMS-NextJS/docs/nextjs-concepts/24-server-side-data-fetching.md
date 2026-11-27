# 24. Server-side data fetching

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Server Components fetch data by calling `fetch` or any async function directly. There is no `useEffect` fetch dance: the data is part of the render.

## 2. Syntax
```ts
const { data } = await apiFetch('/employees/42', { schema: employeeSchema });          // per request
const depts = await apiFetch('/departments', { cache: { revalidate: 300, tags: ['departments'] } }); // opt-in cache
const [a, b] = await Promise.all([getDepartments(), getDesignations()]);               // parallel
```

## 3. How Next.js implements it
`fetch` is extended with `next: { revalidate, tags }`. Identical `fetch` calls in one render are de-duplicated; custom async functions are memoised with `React.cache`. In this version fetches are **not cached by default**.

## 4. Actual EMS implementation
All server data goes through `apiFetch` (`src/lib/server/api-client.ts`): Bearer token from the HttpOnly cookie, JSON envelope unwrapping, zod validation of every response, safe error mapping, timeout + abort, optional cache metadata. **Waterfalls are avoided** (`Promise.all`); **duplicates are avoided** (`React.cache` on `getSession`, `loadEmployee`, `getDashboard`). **Parallel and sequential patterns**: dependent calls (resolve department code → id before listing) are sequential; independent ones parallel. **Error handling** for fetch failures is covered in docs 42-43.

## 5. Relevant file paths
- `src/lib/server/api-client.ts`
- `src/lib/server/employees.ts`
- `src/lib/server/session.ts`
- `src/lib/server/dashboard.ts`
- `src/schemas/api.ts`
- `tests/api-client.test.ts`

## 6. Practical use case
The employee detail layout loads the employee and the viewer’s session in parallel; the tab page reuses the same employee from the memoised loader.

## 7. Why the concept is used
Simplicity, security (token stays server-side) and performance (parallelism, no client waterfalls).

## 8. Advantages
- Fewer round trips.
- Typed, validated data.
- Co-located with UI.

## 9. Limitations
- Cache semantics must be understood.
- Server latency affects TTFB unless streamed.

## 10. Common mistakes
- Fetching in a Client Component what a Server Component could fetch.
- Skipping response validation.
- Forgetting `Promise.all`.

## 11. Interview-related considerations
- How do you de-duplicate requests?
- Default fetch caching in Next 16?
