# 46. Deployment

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Deploying Next.js means producing a build (`next build`) and running it on Node (`next start`), a container, or a platform. Self-hosting needs attention to HTTPS, environment, caching and multiple instances.

## 2. Syntax
```bash
npm ci && npm run build && npm start
```

## 3. How Next.js implements it
`next start` runs the built server with streaming, PPR, ISR and image optimisation. Static assets under `/_next/static` are immutable. Cache Components work in Node/Docker deployments (not CDN-only). Multi-instance setups need a shared cache handler and attention to **version skew**.

## 4. Actual EMS implementation
The complete, secret-free runbook is **`docs/deployment.md`**: build, environment variables, reverse proxy (nginx example), HTTPS and Secure cookies, static assets and image cache, health check `/api/health`, logging and monitoring hooks, Docker, multi-instance caveats (refresh single-flight, per-instance cache), and a release checklist.

## 5. Relevant file paths
- `docs/deployment.md`
- `next.config.ts`
- `src/app/api/health/route.ts`
- `.env.example`
- `package.json`

## 6. Practical use case
Behind nginx/Caddy with TLS, Next.js on a private port, Express on a private network.

## 7. Why the concept is used
A predictable, secure production setup.

## 8. Advantages
- Simple runtime model.
- No CORS needed.

## 9. Limitations
- Stateful per-instance caches; sticky sessions or shared handlers when scaled.

## 10. Common mistakes
- Forgetting HTTPS with `Secure` cookies.
- Baking `NEXT_PUBLIC_*` values at build for the wrong environment.

## 11. Interview-related considerations
- What is version skew?
- Why does streaming need `proxy_buffering off`?
