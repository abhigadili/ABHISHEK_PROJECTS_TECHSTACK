# LM Company Portal Backend

**Enterprise Node.js + Express.js + MongoDB + Redis + JWT + OAuth2 — Learning & Reference Project**

---

## Project Overview

A fully-featured backend portal for company management, built as a **deep learning reference** for Node.js, Express.js, MongoDB, Redis, JWT, OAuth2, RBAC, middleware, testing, and interview preparation.

---

## Folder Structure

```
lm-company-portal/
├── src/
│   ├── server/          ← Entry point (index.ts) + Express app (app.ts) + pure Node.js server
│   ├── config/          ← Environment config loader, Swagger config
│   ├── controllers/     ← HTTP request handlers — parse req, call service, send res
│   ├── routes/          ← Express Router definitions — verb + path → middleware → controller
│   ├── services/        ← Business logic — query DB, apply rules, invalidate cache
│   ├── repositories/    ← (extensible) Data access layer — raw queries
│   ├── middlewares/     ← Cross-cutting concerns: auth, authorize, validate, cache, error handler
│   ├── validators/      ← Joi schemas — input validation at system boundary
│   ├── schemas/         ← (extensible) Shared Joi schema fragments
│   ├── models/          ← Mongoose models with schemas, hooks, indexes
│   ├── interfaces/      ← TypeScript interfaces for service contracts
│   ├── types/           ← Shared TypeScript types + Express namespace augmentation
│   ├── constants/       ← Roles, permissions, HTTP status codes, cache keys
│   ├── helpers/         ← (extensible) Shared helper utilities
│   ├── utils/           ← Logger (Winston), JWT helper, response helper
│   ├── exceptions/      ← Custom error hierarchy: AppError → ValidationError, NotFoundError, etc.
│   ├── cache/           ← Redis client + cacheGet/cacheSet/cacheDel wrappers
│   ├── auth/            ← Auth factory + providers (jwt.provider, oauth.provider)
│   │   └── providers/
│   ├── oauth/           ← (extensible) OAuth2 callback handlers
│   └── database/        ← MongoDB connection manager
├── tests/
│   ├── unit/            ← Jest unit tests (no DB/HTTP)
│   └── integration/     ← Supertest integration tests (full HTTP cycle)
├── scripts/             ← Database seeder
├── logs/                ← Winston log files (auto-created)
├── docs/                ← (extensible) Architecture docs
├── .env                 ← Environment variables (never commit!)
├── .env.example         ← Template for team members
└── README.md
```

---

## Architecture

```
Client Request
     │
     ▼
Rate Limiter → CORS → Helmet → Body Parser → Morgan Logger → Request ID
     │
     ▼
   Router (Express)
     │
     ▼
authenticate middleware  ← verifies JWT, checks Redis blocklist
     │
     ▼
authorize middleware     ← RBAC: checks role/permissions
     │
     ▼
validate middleware      ← Joi schema validation
     │
     ▼
cache middleware (GET)   ← Redis: return cached response or proceed
     │
     ▼
  Controller             ← parse req.body/params/query, call service
     │
     ▼
  Service                ← business logic, cache invalidation
     │
     ▼
Mongoose Model           ← schema validation, hooks, DB query
     │
     ▼
  MongoDB                ← persists data
```

---

## How to Run

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Seed the database (requires MongoDB running)
npm run seed

# Development (hot reload)
npm run dev

# Production build
npm run build && npm start
```

**After starting:**
- Express API: `http://localhost:5000`
- Swagger docs: `http://localhost:5000/api-docs`
- Pure Node.js server: `http://localhost:5001` (GET /health, GET /about-company)
- Dashboard stats: `http://localhost:5000/api/dashboard/stats`

---

## Seeded Credentials

| Role       | Email          | Password    |
|------------|----------------|-------------|
| SuperAdmin | admin@lm.com   | Admin123!   |
| HR         | hr@lm.com      | Hr123456!   |

---

## How Authentication Works

### JWT (default — AUTH_PROVIDER=jwt)

```
1. POST /api/auth/register  → create account
2. POST /api/auth/login     → returns { accessToken, refreshToken }
3. GET  /api/companies      → Authorization: Bearer <accessToken>
4. POST /api/auth/refresh-token → send refreshToken, get new accessToken
5. POST /api/auth/logout    → blocklists the accessToken in Redis
```

**Access Token**: Short-lived (15m). Sent with every API call.
**Refresh Token**: Long-lived (7d). Only used to get a new access token.

### OAuth2 (ENABLE_OAUTH2=true)

```
1. GET /api/auth/google → redirect to Google login
2. Google redirects back → /api/auth/google/callback
3. Server upserts user → issues our own JWT access + refresh tokens
4. All subsequent API calls use Bearer <accessToken> (same as JWT mode)
```

---

## How Authorization Works (RBAC)

Roles: `SuperAdmin > Admin > HR > Manager > Employee > Guest`

Permission matrix defined in `src/constants/index.ts`:

```typescript
authorize(['Admin', 'SuperAdmin'])     // only Admin or SuperAdmin
authorize(['HR', 'Manager'])           // HR or Manager
authorizePermission('manage_employee') // permission-level check
```

The middleware reads `req.user.role` (set by `authenticate`) and compares against allowed roles.

---

## How MongoDB Works (Learning Module)

Every MongoDB operation has a dedicated endpoint under `/api/mongodb`:

| Endpoint                          | Concept             |
|-----------------------------------|---------------------|
| GET  /api/mongodb/find            | find, sort, skip, limit, projection |
| GET  /api/mongodb/query-operators | $eq, $gt, $in, $regex, $exists      |
| GET  /api/mongodb/logical-operators| $and, $or, $nor, $not              |
| GET  /api/mongodb/aggregation     | $match, $group, $project, $sort     |
| GET  /api/mongodb/lookup          | $lookup (JOIN equivalent)           |
| GET  /api/mongodb/facet           | $facet (parallel aggregations)      |
| GET  /api/mongodb/bucket          | $bucket (histogram)                 |
| GET  /api/mongodb/pagination      | skip + limit pagination             |

All endpoints include inline code comments explaining the **what**, **why**, and **interview tips**.

---

## How Redis Works

```
Request → cache middleware
  → cacheGet(key)
    → HIT:  return cached JSON immediately (no DB query)
    → MISS: run controller → DB query → cache result → return

Write operations: DELETE cache keys after create/update/delete
Logout:           blocklistToken(accessToken, ttl) in Redis
```

Cache TTL is configured via `REDIS_TTL` env var (default: 3600 seconds).

---

## How Middleware Works

Express middleware runs in registration order. Each calls `next()` to pass control:

```
authenticate → authorize → validate → cacheMiddleware → controller → errorHandler
```

- **authenticate**: extracts Bearer token, checks blocklist, verifies JWT
- **authorize**: RBAC role check (factory function returning a middleware)
- **validate**: Joi schema validation, strips unknown fields
- **cacheMiddleware**: Redis cache layer for GET requests
- **errorHandler**: 4-argument middleware — catches all `next(err)` calls

---

## How Logging Works

- **Morgan**: logs every HTTP request (method, URL, status, time) → piped to Winston
- **Winston**: structured logs with levels (error, warn, info, http, debug)
  - `logs/app-YYYY-MM-DD.log` — all info+ logs, rotated daily, kept 30 days
  - `logs/error-YYYY-MM-DD.log` — errors only
- **Request ID**: every log line includes `x-request-id` for correlation

---

## Three Implementation Types

### TYPE 1 — Pure Node.js (port 5001)
```typescript
http.createServer((req, res) => {
  // manual URL parsing, header setting, response writing
  res.writeHead(200);
  res.end(JSON.stringify({ status: 'ok' }));
})
```
**Use when**: learning HTTP internals, custom streaming, protocol upgrades.

### TYPE 2 — Express.js (port 5000, 90% of endpoints)
Standard Express routing with middleware, controllers, services.
**Use when**: any real API — Express handles routing, parsing, error propagation.

### TYPE 3 — Node.js + Express combined (GET /api/dashboard/*)
Express routes use Node.js built-in modules (`os`, `process`, `crypto`, `stream`).
**Use when**: you need Express routing + Node.js capabilities (system info, file streaming, events).

---

## API Endpoints Summary

| Method | Endpoint                          | Auth | Role           |
|--------|-----------------------------------|------|----------------|
| POST   | /api/auth/register                | No   | —              |
| POST   | /api/auth/login                   | No   | —              |
| POST   | /api/auth/logout                  | Yes  | Any            |
| POST   | /api/auth/refresh-token           | No   | —              |
| POST   | /api/auth/forgot-password         | No   | —              |
| POST   | /api/auth/reset-password          | No   | —              |
| POST   | /api/auth/change-password         | Yes  | Any            |
| GET    | /api/companies                    | Yes  | Any            |
| POST   | /api/companies                    | Yes  | Admin+         |
| PUT    | /api/companies/:id                | Yes  | Admin+         |
| DELETE | /api/companies/:id                | Yes  | SuperAdmin     |
| GET    | /api/departments                  | Yes  | Any            |
| POST   | /api/departments                  | Yes  | Admin/HR       |
| GET    | /api/employees                    | Yes  | Admin/HR/Mgr   |
| POST   | /api/employees                    | Yes  | Admin/HR       |
| GET    | /api/rooms                        | Yes  | Any            |
| POST   | /api/rooms                        | Yes  | Admin+         |
| GET    | /api/rooms/meeting-rooms/available| Yes  | Any            |
| POST   | /api/rooms/meeting-rooms/book     | Yes  | Any            |
| GET    | /api/mongodb/*                    | Yes  | Any (learning) |
| GET    | /api/dashboard/stats              | Yes  | Any            |
| GET    | /api/dashboard/system             | Yes  | Any            |
| GET    | /api-docs                         | No   | —              |

---

## Testing

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

- **Unit tests** (`tests/unit/`): JWT helpers, middleware — no DB, no HTTP
- **Integration tests** (`tests/integration/`): Supertest — real HTTP, mocked/real DB

---

## Interview Notes

| Topic | Key Points |
|-------|-----------|
| JWT   | Stateless, 3 parts (header.payload.signature), base64 not encrypted, use short expiry + refresh token |
| OAuth2 | Authorization protocol, OIDC adds identity (who you are), Passport.js implements strategies |
| RBAC  | Role-Based Access Control, authorize() factory pattern, separate from authentication |
| Redis | In-memory, O(1) reads, TTL-based expiry, blocklist for JWT revocation |
| Mongoose | Schema on top of schemaless MongoDB, populate() = second query not JOIN, pre/post hooks |
| Middleware | next() passes control, 4-arg = error handler, order matters |
| Event Loop | Non-blocking I/O, Promise.all for concurrent queries, single thread |
| process.env | Never hardcode secrets, 12-factor app config principle |
| CORS | Browser-only, not enforced by curl/Postman, credentials:true for cookies |
| Helmet | Sets 15 security headers, prevents XSS/clickjacking/MIME sniffing |
