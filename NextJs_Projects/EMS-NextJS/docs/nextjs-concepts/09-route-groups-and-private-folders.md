# 9. Route groups and private folders

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
**Route groups** — a folder wrapped in parentheses, `(name)` — organise routes and let sibling groups have *different layouts* without adding a URL segment. **Private folders** — a folder prefixed with an underscore, `_name` — opt a folder and its children out of routing so implementation files can live next to routes.

## 2. Syntax
```text
app/(auth)/login/page.tsx            → /login           (auth layout: centred card)
app/(dashboard)/employees/page.tsx   → /employees       (app shell: sidebar + topbar)
app/(public)/help/…                  → /help            (public header/footer)
app/(public)/learn/_components/…     → NOT routable (private folder)
```

## 3. How Next.js implements it
Group names never appear in the URL. Each group can own `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`. Two groups must not resolve to the same URL. `_folder` is skipped by the router (use `%5Ffolder` if a literal underscore URL is needed).

## 4. Actual EMS implementation
* `(auth)` – `login`, `register`, `forgot-password`, `reset-password` with a minimal layout.
* `(dashboard)` – every authenticated page with the session-aware shell. Its `layout.tsx` also exports `metadata.robots = { index:false, follow:false }`, so **every page behind login is noindex** by inheritance.
* `(public)` – `docs`, `help`, `learn` with the public chrome.
* Private folder: `app/(public)/learn/_components/DemoBanner.tsx` is imported by the demo routes but can never be reached as `/learn/_components`.

## 5. Relevant file paths
- `src/app/(auth)/layout.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(public)/layout.tsx`
- `src/app/(public)/learn/_components/DemoBanner.tsx`

## 6. Practical use case
A signed-out visitor sees `/login` inside a clean card layout; the same URL space after login uses the sidebar shell — with no `/auth` or `/dashboard` prefix leaking into addresses.

## 7. Why the concept is used
Different chrome and different metadata/guard policy per area without URL pollution; co-located components without accidental routes.

## 8. Advantages
- Per-area layouts, loading and error UI.
- Area-wide metadata (noindex) set once.
- Safe co-location via `_`.

## 9. Limitations
- Groups can hide real URL collisions until build.
- Navigating between groups with different root layouts causes a full page load (EMS uses a single root layout to avoid that).

## 10. Common mistakes
- Expecting `(dashboard)` in the URL.
- Putting a `page.tsx` inside `_components` and wondering why it 404s.

## 11. Interview-related considerations
- What is the difference between a route group and a private folder?
- Can two groups define `/`?
