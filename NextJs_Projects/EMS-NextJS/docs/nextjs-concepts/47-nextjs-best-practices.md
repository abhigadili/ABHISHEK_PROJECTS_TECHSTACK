# 47. Next.js best practices

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
A short list of habits that prevent the most common App Router problems.

## 2. Syntax
```text
Server by default · client islands · validate at every boundary · authorise on the server · cache explicitly · stream with Suspense
```

## 3. How Next.js implements it
Follow the framework’s current conventions (this project targets 16.4.5): async request APIs, `proxy.ts`, Cache Components, typed route helpers via `next typegen`.

## 4. Actual EMS implementation
Practices followed (and where):

1. Server Components by default; `use client` only for islands (doc 14–16).
2. One server-only data-access layer; validate API responses (doc 25).
3. Authorise in pages, actions and handlers; treat the proxy as UX (doc 35/36).
4. Cache explicitly with tags and a matching invalidation matrix; never cache per-user data in shared caches (docs 28–32).
5. Runtime data only inside `<Suspense>`; `connection()` for time-dependent values (doc 21/22).
6. Parallelise independent fetches; memoise with `React.cache` (doc 24/31).
7. Validate input twice (client UX + server truth) with the same zod schema (doc 26).
8. Uniform error model and safe messages (doc 42).
9. URL as the source of truth for filters/pagination (doc 12).
10. Accessibility: labelled controls (`useId`), `aria-invalid`/`aria-describedby`, roles on dialogs/tabs/alerts, keyboard Esc, focus return, `aria-busy`, skip-friendly semantics.
11. Types: strict TS, generics (`DataTable<T>`), no `any` in app code, route helper types.
12. Tests at three layers (doc 45).
13. Secrets only in server env (doc 40).

**Recommended next steps:** add a nonce-based CSP; shared cache handler + Redis lock for multi-instance refresh; `@next/bundle-analyzer` in CI; server-side employee date-range filter if the backend adds it.

## 5. Relevant file paths
- `docs/nextjs-concepts/`
- `README.md`
- `eslint.config.mjs`
- `tsconfig.json`

## 6. Practical use case
Code review checklist for new features.

## 7. Why the concept is used
Consistency and fewer production incidents.

## 8. Advantages
- Shared vocabulary.

## 9. Limitations
- Conventions evolve; re-check docs on upgrades (the bundled docs live in `node_modules/next/dist/docs`).

## 10. Common mistakes
- Copying old tutorials (Pages Router, pre-15 caching).
- Skipping authorization because "the page is hidden".

## 11. Interview-related considerations
- Name five App Router best practices.
