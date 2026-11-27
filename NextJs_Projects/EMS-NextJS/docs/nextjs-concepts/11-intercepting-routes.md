# 11. Intercepting routes

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
An intercepting route lets you **show another route’s UI in the current context** (typically a modal) on *soft* navigation, while a *hard* navigation (paste URL, refresh) renders the real page. Conventions: `(.)` same level · `(..)` one level up · `(..)(..)` two levels up · `(...)` from the app root. The levels refer to **route segments**, not folders (slots and groups do not count).

## 2. Syntax
```text
employees/@modal/(.)[id]/page.tsx       intercepts /employees/[id] from /employees
learn/deep/@modal/(.)photos/[id]        (.)
learn/deep/@modal/nested/(..)tools/[id] (..)
learn/deep/@modal/a/b/(..)(..)gallery/[id]  (..)(..)
learn/deep/@modal/(...)learn/root-demo/[id] (...)
```

## 3. How Next.js implements it
The interceptor must live inside a parallel-route slot of a layout that stays mounted. Soft navigation matches the interceptor first and fills the slot; hard navigation never runs it. Closing the modal with `router.back()` pops the history entry so the URL returns to the list.

## 4. Actual EMS implementation
**Production feature — employee modal.** From `/employees` clicking a name opens a dialog (`@modal/(.)[id]/page.tsx`) with a summary fetched by the same memoised `loadEmployee` and a link "Open full profile". Requirements verified live:
1. click → modal + URL becomes `/employees/42`;
2. **Esc / ✕ / backdrop / browser Back** all close it and restore the list (the shared `Modal` with `routeModal` uses `router.back()`);
3. **refresh** or direct navigation to `/employees/42` renders the full page (no dialog);
4. the "Open full profile" control is a plain `<a>` (hard navigation) because a `<Link>` to the current URL would stay intercepted.

**Isolated demonstration — all four conventions** under `/learn/deep` (public, no EMS data, clearly labelled): `(.)`, `(..)`, `(..)(..)`, `(...)`, each with the real target page so that direct navigation works.

## 5. Relevant file paths
- `src/app/(dashboard)/employees/@modal/(.)[id]/page.tsx`
- `src/app/(dashboard)/employees/@modal/default.tsx`
- `src/components/dialogs/Modal.tsx`
- `src/app/(public)/learn/deep/layout.tsx`
- `src/app/(public)/learn/deep/@modal/`
- `src/app/(public)/learn/deep/photos/[id]/page.tsx`

## 6. Practical use case
Quick-peek at an employee without losing your place in a filtered, paginated list — and a shareable URL that opens the full profile.

## 7. Why the concept is used
Preserves context (scroll position, filters) while still giving every item a canonical URL.

## 8. Advantages
- Shareable URLs for modal content.
- Back button behaves naturally.
- Same component tree reused for the full page.

## 9. Limitations
- Only soft navigation intercepts; middleware/`proxy.ts` redirects still apply to the URL.
- `(..)` counts segments, not folders — easy to miscount.
- Requires a parallel slot + `default.tsx`.

## 10. Common mistakes
- Using `<Link>` inside the modal to the *same* URL (stays in modal).
- Forgetting `default.tsx` (404 after refresh).
- Counting the `@slot` or `(group)` folders as levels.

## 11. Interview-related considerations
- How does Next know to intercept?
- Why does refresh show the full page?
- Explain `(..)(..)` and `(...)`.
