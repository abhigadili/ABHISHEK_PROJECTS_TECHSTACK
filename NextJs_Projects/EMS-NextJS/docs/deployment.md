# Deployment and production readiness

No secret appears in this document; every value below is a placeholder.

## 1. Build and run

```bash
npm ci
npm run lint && npm run typecheck && npm test        # quality gates
npm run build                                        # next build (Turbopack) → .next/
EMS_API_URL=https://api.internal.example/api/v1 \
EMS_REVALIDATE_SECRET='<long random value>' \
NEXT_PUBLIC_APP_URL=https://ems.example.com \
npm start                                            # next start -p 3000
```

Requires **Node ≥ 20.11** (developed on 20.11.1). If `npm install` brings an ESM-only `magic-string` 1.x, Tailwind's CommonJS loader fails on Node < 20.19 — `package.json` pins `overrides.magic-string = 0.30.21` for that reason.

## 2. Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `EMS_API_URL` | **server only** | Express API base URL (`…/api/v1`). Validated by zod in `src/lib/server/env.ts` at start-up. |
| `EMS_REVALIDATE_SECRET` | **server only** | ≥ 16 chars; protects `POST /api/revalidate`. Without it the endpoint always answers 403. |
| `EMS_API_TIMEOUT_MS` | server only | per-request timeout to Express (default 10000). |
| `NEXT_PUBLIC_APP_NAME` | public | display name. |
| `NEXT_PUBLIC_APP_URL` | public | canonical origin for metadata, sitemap and robots. **Set it per environment** (it is baked into prerendered HTML at build time). |

Only `NEXT_PUBLIC_*` values reach the browser; `src/lib/server/**` is `import 'server-only'`, so an accidental client import fails the build. `.env.local` is git-ignored; `.env.example` documents the keys.

## 3. Topology and reverse proxy

```text
Internet ─HTTPS─▶ reverse proxy (nginx/Caddy/ALB) ─HTTP─▶ Next.js :3000 ─private network─▶ Express :4100 ─▶ MySQL
```

* Terminate **TLS at the proxy**; forward `Host` and `X-Forwarded-Proto: https`. The session cookies are `Secure` in production, so the site **must** be served over HTTPS.
* Express need not be reachable from the internet at all — only from the Next.js hosts. This also removes any CORS requirement.
* Server Actions verify the `Origin` against the host; keep `Host`/`X-Forwarded-Host` correct, or list the public host in `experimental.serverActions.allowedOrigins` if an intermediary rewrites it.
* nginx example:

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_buffering off;            # keeps streamed (Suspense) responses streaming
}
```

## 4. Cookies, headers and HTTPS

HttpOnly + SameSite=Lax + `Secure` (production) session cookies (`src/lib/server/cookies.ts`). `next.config.ts` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and `Strict-Transport-Security` (two years, includeSubDomains) and disables `X-Powered-By`. HSTS is only honoured by browsers over HTTPS — make sure the HTTPS site is final before relying on it, because browsers will refuse plain HTTP for two years.

## 5. Static assets and images

`/_next/static/**` is content-hashed and immutable — serve it with long-lived caching (Next sends the headers; a CDN may sit in front). Public images (`public/images`) go through `next/image`'s optimizer (formats `avif`/`webp`); **private employee pictures are not optimised** (they stream through `/api/employees/[id]/picture` with `Cache-Control: private`). The optimizer cache lives in `.next/cache`; persist it between deployments or accept a cold cache.

## 6. Multiple instances (important caveats)

* **Refresh single-flight** (`src/proxy.ts`) is per process. With several instances, two instances may refresh the same token simultaneously → the backend revokes the token family → the user is asked to sign in again. Use **sticky sessions** (by the `ems_rt` cookie) or run one instance until a shared lock (e.g. Redis) is added.
* **Data/Full-Route cache** is per instance (disk). `revalidateTag` called on one instance does not reach the others; fan the webhook out to every instance or configure a shared cache handler (`cacheHandlers`; implement `refreshTags()` so every instance learns about invalidations — see the bundled `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`).
* `generateStaticParams` pages are prerendered at build time; rebuild/redeploy to change `DOCS`.

## 7. Health, logging and monitoring

* `GET /api/health` → `{"status":"ok","upstream":"up"}` (checks Express); use it for the load-balancer probe. It is public and returns no data.
* Server logs: `[api] request failed|upstream error|response failed validation` carry the path/status/`requestId` only — never tokens, cookies or bodies. Ship stdout to your log platform.
* Error-monitoring integration points: `src/app/error.tsx`, `global-error.tsx`, and the `errorResponse()` helper in `src/lib/server/handler.ts` (add Sentry/OpenTelemetry there — `instrumentation.ts` is the Next.js hook for server-side tracing). The browser error boundaries show the error `digest` only.

## 8. Docker (optional)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "start"]
```

(Pass the variables of §2 at run time; `NEXT_PUBLIC_APP_URL` must also be present at **build** time.)

## 9. Release checklist

1. `EMS_API_URL` points at the private API; HTTPS is on; `NEXT_PUBLIC_APP_URL` is the public origin.
2. `EMS_REVALIDATE_SECRET` is set and stored in the secret manager.
3. Login rate limits on the backend are enabled (they are by default).
4. `npm run lint && npm run typecheck && npm test` pass; `npm run build` is green; e2e passed against the **test** backend (never the production database).
5. `/api/health` returns `up`; `/robots.txt` disallows the authenticated areas; `/sitemap.xml` lists only public pages.
