# 2. Project structure

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
A Next.js App Router project has a small set of *conventions* (special file names inside `app/`) and everything else is ordinary TypeScript you organise yourself. A good structure separates **routes** (thin, mostly composition) from **features** (UI + logic by domain), **server-only code** (data access, auth) and **shared** building blocks.

## 2. Syntax
```text
src/
├── app/          # routes only: layout/page/loading/error/not-found/route.ts, route groups, slots
├── features/     # client islands & feature UI per domain (employees, leaves, …)
├── components/   # shared UI (common/, forms/, dialogs/, layout/)
├── lib/server/   # server-only data-access layer (import 'server-only')
├── lib/client/   # browser helpers (fetch wrappers, local storage)
├── lib/utils/    # pure helpers (format, csv, search-params …)
├── actions/      # Server Actions ('use server')
├── schemas/      # zod schemas (API contract + forms)
├── contexts/ hooks/ store/ constants/ content/ types/
└── proxy.ts      # edge-of-request logic (the Next.js 16 name for middleware)
```

## 3. How Next.js implements it
Only files named `page`, `route`, `layout`, `template`, `loading`, `error`, `not-found`, `default`, `global-error`, `icon`, `manifest`, `robots`, `sitemap` have meaning inside `app/`. Any other file there (or in a `_private` folder) is never routable. `src/` is optional but keeps config files at the root clean. The import alias `@/*` → `src/*` is declared in `tsconfig.json`.

## 4. Actual EMS implementation
The folder list above is the real tree. Highlights:

* `src/lib/server/**` – every module starts with `import 'server-only'`, so importing it from a Client Component **fails the build** (secret protection by construction).
* `src/features/**` – client islands (forms, filters, charts, org tree) imported by Server Component pages.
* `src/actions/**` – one file per domain; `_shared.ts` holds the guard/validation/error helpers used by all of them.
* `src/app/(public)/learn/_components` – a **private folder** (see doc 09).
* `tests/` (Vitest), `e2e/` (Playwright), `scripts/e2e-seed.mjs`, `docs/`.

## 5. Relevant file paths
- `src/lib/server/`
- `src/features/`
- `src/actions/_shared.ts`
- `src/app/(public)/learn/_components/DemoBanner.tsx`
- `tsconfig.json`
- `vitest.config.ts`
- `playwright.config.ts`

## 6. Practical use case
A new developer adding "Work anniversaries" knows to put the route in `app/(dashboard)/…`, the API call in `lib/server/dashboard.ts`, the interactive part in `features/dashboard/`, and the test in `tests/`.

## 7. Why the concept is used
Predictable placement reduces review friction and prevents server code leaking into client bundles. Keeping `app/` thin keeps routing readable.

## 8. Advantages
- Server-only boundary is enforced by tooling, not discipline.
- Features can be deleted/moved as a unit.
- Pure utilities are trivially unit-testable.

## 9. Limitations
- Conventions are not enforced for non-special folders — structure erodes without review.
- Many small files in `app/` (one `page.tsx` per route) can feel noisy.

## 10. Common mistakes
- Putting data-fetching helpers inside `app/` next to pages and importing them from client code.
- Naming a folder `api` under `lib/` and confusing it with `app/api` route handlers.
- Forgetting `import "server-only"` on modules that read secrets.

## 11. Interview-related considerations
- What files are routable in `app/`?
- Why `src/`?
- How do you keep a server module out of the client bundle? (`server-only`).
