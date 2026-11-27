# 40. Environment variables

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Next.js loads `.env*` files into `process.env`. Variables are **server-only** unless prefixed with `NEXT_PUBLIC_`, in which case their value is **inlined into the client bundle at build time**.

## 2. Syntax
```bash
EMS_API_URL=http://localhost:4100/api/v1       # server only
EMS_REVALIDATE_SECRET=<long random>            # server only
NEXT_PUBLIC_APP_URL=http://localhost:3000      # public
```
```ts
import 'server-only'; export const env = schema.parse({ EMS_API_URL: process.env.EMS_API_URL, … });   // zod-validated
```

## 3. How Next.js implements it
`.env.local` is git-ignored; `.env.example` documents keys. Public values are baked at *build* time — changing them requires a rebuild. Server values are read at run time.

## 4. Actual EMS implementation
`src/lib/server/env.ts` validates the server variables with zod at start-up (URL shape, secret length ≥ 16, timeout bounds) and is `server-only`, so a client import is a **build error**. Only `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_URL` reach the browser (non-secret). The API URL, secret and timeout never do. `docs/deployment.md` lists every variable.

## 5. Relevant file paths
- `src/lib/server/env.ts`
- `.env.example`
- `docs/deployment.md`
- `src/app/layout.tsx`
- `src/app/api/revalidate/route.ts`

## 6. Practical use case
Rotating `EMS_REVALIDATE_SECRET` requires only a restart; changing the canonical origin requires a rebuild.

## 7. Why the concept is used
Separate config from code, keep secrets off the client.

## 8. Advantages
- Fail-fast validation.
- Clear public/private split.

## 9. Limitations
- `NEXT_PUBLIC_*` is frozen at build time.
- Edge/runtime differences for some APIs.

## 10. Common mistakes
- Prefixing a secret with `NEXT_PUBLIC_`.
- Committing `.env.local`.
- Reading `process.env` directly all over the code (validate once).

## 11. Interview-related considerations
- What exactly does `NEXT_PUBLIC_` do?
- Why validate env at start-up?
