# 12. Navigation and route parameters

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Next.js offers declarative navigation (`<Link>`), imperative navigation (`useRouter`), URL readers (`usePathname`, `useSearchParams`, `useParams`, `useSelectedLayoutSegment(s)`), and server-side navigation helpers (`redirect`, `permanentRedirect`, `notFound`).

## 2. Syntax
```tsx
<Link href="/employees?page=2">Next</Link>
const router = useRouter(); router.push(url); router.replace(url); router.back(); router.refresh(); router.prefetch(url);
const pathname = usePathname();  const sp = useSearchParams();  const { id } = useParams<{ id: string }>();
const seg = useSelectedLayoutSegment();  const segs = useSelectedLayoutSegments();
redirect('/login');  permanentRedirect('/new');  notFound();
```

## 3. How Next.js implements it
`<Link>` prefetches the static part of the target and performs soft navigation. `useSearchParams()` makes the client component dynamic → wrap it in `<Suspense>`. `redirect()` throws a special error (307 for GET, or a client navigation inside actions/handlers); **never catch it** — rethrow with `unstable_rethrow`. `permanentRedirect()` answers 308.

## 4. Actual EMS implementation
| API | Where in EMS |
|---|---|
| `Link` | sidebar `NavLinks`, pagination (`Pagination`), tables, breadcrumbs |
| `useRouter` | `EmployeeFilters` (`replace`), `Modal` (`back`), `EmployeeForm` (`push`+`refresh`), `CheckCard` (`refresh`) |
| `usePathname` | `EmployeeFilters` (build URLs) |
| `useSearchParams` | `EmployeeFilters` (inside the page’s `<Suspense>`) |
| `useParams` | intercepted modals in `/learn/deep` |
| `useSelectedLayoutSegment` | `NavLinks` (active nav item), `EmployeeTabs` (active tab) |
| `useSelectedLayoutSegments` | `Breadcrumbs` in `Topbar` |
| `redirect` | `requireSession`/`requirePermission`/`loadEmployee`, login/logout/department/leave actions, `/learn/navigation/go` |
| `permanentRedirect` | `/learn/navigation/old-path` (demo, 308) |
| `notFound` | `loadEmployee`, detail pages with bad ids, `/learn/navigation/[topic]` |

**Query parameters** drive the employees list: `/employees?page=1&search=ann&department=IT&status=ALL&sort=name:desc`. They are parsed on the server with `int()`/`one()` (`lib/utils/search-params.ts`), preserved by `withParams()` in links, shareable, and updated by the filter bar with `startTransition(router.replace(...))`. The 350 ms debounce prevents a request per keystroke; back/forward re-syncs the box from the URL.

## 5. Relevant file paths
- `src/features/layout/NavLinks.tsx`
- `src/features/layout/Topbar.tsx`
- `src/features/employees/EmployeeFilters.tsx`
- `src/features/employees/EmployeeTabs.tsx`
- `src/lib/utils/search-params.ts`
- `src/lib/utils/safe-redirect.ts`
- `src/app/(public)/learn/navigation/NavDemo.tsx`

## 6. Practical use case
A manager filters by department, sorts by newest joiners, pages to page 3, copies the URL to a colleague — the colleague sees exactly the same list.

## 7. Why the concept is used
URL state is shareable, bookmarkable, back/forward-friendly and SSR-able, unlike component state.

## 8. Advantages
- Shareable state.
- Server can render filtered HTML.
- Back/forward just works.

## 9. Limitations
- The backend lacks an employee date-range filter, so that filter is offered on attendance/leave/reports instead.
- `useSearchParams` forces a dynamic client boundary.

## 10. Common mistakes
- Catching `redirect()` in try/catch.
- Open redirect via `?next=` (guarded by `safeNext`).
- Rendering `useSearchParams` without Suspense.

## 11. Interview-related considerations
- `push` vs `replace`?
- What does `router.refresh()` do (re-fetches server components, keeps client state)?
- Why is `redirect` implemented by throwing?
