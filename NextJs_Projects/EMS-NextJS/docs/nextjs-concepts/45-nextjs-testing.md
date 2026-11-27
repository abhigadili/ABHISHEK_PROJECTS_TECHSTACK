# 45. Testing Next.js applications

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Three layers: **unit/component** tests (fast, mocked boundaries), **server-side** tests (data access, actions, handlers, proxy with the backend mocked) and **end-to-end** tests (real browser, real server, real backend, isolated database).

## 2. Syntax
```bash
npm test                     # Vitest (node + jsdom): 146 tests in 16 files
npm run lint && npm run typecheck
E2E_BASE_URL=http://localhost:3100 E2E_CHANNEL=chrome npm run e2e    # Playwright: 48 specs
```

## 3. How Next.js implements it
Server Components that are `async` cannot be rendered by Testing Library — test the *data layer, actions, handlers and proxy* directly and cover pages end to end with Playwright. `server-only` is aliased to a stub in `vitest.config.ts`; `next/headers`, `next/cache`, `next/navigation` are mocked per test file.

## 4. Actual EMS implementation
| Area | Files |
|---|---|
| Utilities, validation schemas, permissions | `tests/utils.test.ts`, `tests/schemas.test.ts`, `tests/permissions.test.ts`, `tests/employee-payload.test.ts`, `tests/seo.test.ts`, `tests/organization.test.tsx` |
| API client behaviour & error mapping | `tests/api-client.test.ts` (envelope, auth header, caching options, 4xx/5xx/timeout/network, schema violations) |
| Authentication & session helpers, cookies | `tests/session.test.ts` |
| Authorization helpers & Route Handlers | `tests/handler.test.ts`, `tests/revalidate-route.test.ts` |
| Server Actions: validation, errors, auth, **cache invalidation matrix** | `tests/actions.test.ts` |
| Proxy: redirects, silent refresh, single-flight | `tests/proxy.test.ts` |
| Client components, forms, hooks, Redux store | `tests/components.test.tsx`, `tests/employee-form.test.tsx`, `tests/hooks.test.tsx`, `tests/store.test.ts` |
| E2E | `e2e/ems.spec.ts` (the 20 required scenarios + extras), `register.spec.ts`, `modules.spec.ts` (every other module against the real backend), `learn.spec.ts`, `uploads.spec.ts` |

**E2E isolation:** run against the backend’s dedicated test database (`NODE_ENV=test`, port 4101); `scripts/e2e-seed.mjs` refuses to run against `:4100`; Playwright does **not** auto-start a server (a reused dev server could point at the dev database). Credentials come from the environment — nothing is committed.

**Bugs the live tests caught (all fixed):** the registration username check was blocked for signed-out users by the proxy; the notification badge stayed stale after mark-as-read; department codes in lower case were rejected; the leave action capped uploads at 2 MB while the form allowed 5 MB; Server Action uploads > 1 MB need `bodySizeLimit`; `not-found.tsx` placement; the mocked `vi.fn` rejected-promise quirk (documented in the proxy test).

## 5. Relevant file paths
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/`
- `e2e/`
- `scripts/e2e-seed.mjs`
- `README.md`

## 6. Practical use case
Changing a Server Action’s invalidation (e.g. forgetting `updateTag('holidays')`) fails `tests/actions.test.ts` immediately.

## 7. Why the concept is used
Confidence at the right cost: pure logic in milliseconds, integration through a real browser.

## 8. Advantages
- Fast feedback.
- Real-world coverage of streaming/redirect behaviour.
- Documented isolation rules.

## 9. Limitations
- Async Server Components can’t be unit rendered.
- E2E needs a seeded test backend.
- Cache behaviour across instances is not covered.

## 10. Common mistakes
- Pointing E2E at the development database.
- Mocking so much that tests stop proving anything.
- Asserting HTTP status for late `notFound()` under PPR.

## 11. Interview-related considerations
- How do you test an async Server Component? (E2E or test its data layer)
- Mock vs real backend?
