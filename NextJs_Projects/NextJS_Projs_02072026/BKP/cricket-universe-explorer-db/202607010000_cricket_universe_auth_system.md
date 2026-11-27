# Cricket Universe Explorer — Authentication System

**Date:** 2026-07-01  
**Project:** `cricket-universe-explorer-db`  
**Stack:** Next.js 16, React 19, MySQL 8, jose 6, bcryptjs 3, TypeScript

---

## Overview

This document covers the complete real-credential authentication system implemented for Cricket Universe Explorer. It replaces the previous mock auth (base64 tokens, hardcoded user) with a production-ready JWT flow backed by a MySQL `loginusers` table.

### Components Implemented

| Component | Description |
|---|---|
| `loginusers` MySQL table | Stores user accounts with bcrypt-hashed passwords and refresh token data |
| `src/lib/auth.ts` | Edge-safe JWT operations using `jose` (signing, verification) |
| `src/lib/auth-db.ts` | Node.js-only DB + bcrypt helpers |
| `POST /api/auth/register` | New user registration with immediate login |
| `POST /api/auth/login` | Real credential verification + dual-token issuance |
| `POST /api/auth/logout` | Token revocation + cookie deletion |
| `POST /api/auth/refresh` | Silent access token renewal + refresh token rotation |
| `GET /api/auth/me` | Return current user from access token cookie |
| `src/middleware.ts` | Edge-runtime JWT guard for protected routes |
| `src/app/(auth)/register/page.tsx` | Registration form UI |

---

## Database: `loginusers` Table

### Schema

```sql
CREATE TABLE loginusers (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,
    email                 VARCHAR(255) NOT NULL UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    role                  ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    is_active             TINYINT(1) NOT NULL DEFAULT 1,
    last_login            TIMESTAMP NULL DEFAULT NULL,
    refresh_token_hash    VARCHAR(64)  NULL DEFAULT NULL,
    refresh_token_expires TIMESTAMP    NULL DEFAULT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Column Explanations

| Column | Purpose |
|---|---|
| `password_hash` | bcrypt hash (cost=12) of the user's plain-text password |
| `is_active` | Soft-delete flag — deactivated accounts cannot log in |
| `last_login` | Updated on every successful login for auditing |
| `refresh_token_hash` | SHA-256 hash of the current refresh token's `jti` claim — used for revocation |
| `refresh_token_expires` | Expiry of the stored refresh token (DB-side safety check) |

### Default Seed User

| Field | Value |
|---|---|
| Email | `admin@cricket.com` |
| Password | `Cricket@123` |
| Role | `admin` |

---

## Token Architecture

The system uses **two JWTs**:

```
Browser             Server                          Database
  │                   │                                │
  │── POST /login ──→ │                                │
  │                   │── bcrypt.compare() ───────────→│
  │                   │←── user row ──────────────────│
  │                   │── signAccessToken() (15 min)   │
  │                   │── signRefreshToken(jti) (7d)   │
  │                   │── saveRefreshTokenHash(jti) ──→│
  │←─ Set-Cookie ─────│   (SHA-256 of jti stored)      │
  │   access_token    │                                │
  │   refresh_token   │                                │
```

### Access Token

- **Library:** `jose` (`SignJWT` / `jwtVerify`)
- **Algorithm:** HS256
- **Expiry:** 15 minutes
- **Secret:** `ACCESS_TOKEN_SECRET` environment variable
- **Cookie:** `access_token`, `httpOnly`, `sameSite=lax`, `path=/`
- **Payload:**
  ```json
  {
    "sub": "1",
    "email": "user@example.com",
    "name": "Cricket Fan",
    "role": "user",
    "type": "access",
    "iat": 1719820000,
    "exp": 1719820900
  }
  ```

### Refresh Token

- **Library:** `jose` (`SignJWT` / `jwtVerify`)
- **Algorithm:** HS256
- **Expiry:** 7 days
- **Secret:** `REFRESH_TOKEN_SECRET` environment variable (different from access secret)
- **Cookie:** `refresh_token`, `httpOnly`, `sameSite=lax`, `path=/api/auth`
- **Payload:**
  ```json
  {
    "sub": "1",
    "jti": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "type": "refresh",
    "iat": 1719820000,
    "exp": 1720424800
  }
  ```
- **Path restriction:** `path=/api/auth` means the browser only sends this cookie to endpoints under `/api/auth/*`, preventing it from being leaked to other API routes.

---

## Token Refresh Flow

The client silently refreshes the access token by calling `POST /api/auth/refresh`:

```
Browser                     /api/auth/refresh              DB
  │                                │                        │
  │── POST (refresh_token cookie)→ │                        │
  │                                │── verifyRefreshToken() │
  │                                │   (jose: verify sig + exp)
  │                                │── getUserById(sub) ───→│
  │                                │── getRefreshTokenData()→│
  │                                │   SHA-256(incoming_jti)
  │                                │   ↕ compare stored hash
  │                                │── signAccessToken() ←── if match
  │                                │── signRefreshToken(newJti)
  │                                │── saveRefreshTokenHash()→│
  │←── Set-Cookie: access_token ───│   (old jti hash replaced)
  │←── Set-Cookie: refresh_token ──│
```

**Refresh token rotation:** On every successful refresh, the server issues a new refresh token with a new `jti` and updates the stored hash in the DB. This means a stolen refresh token can only be used once before it's invalidated by the legitimate user's next refresh.

---

## Security Model

### Password Storage

- Passwords are never stored in plain text.
- `bcryptjs.hash(password, 12)` is used at registration and on password change.
- Cost factor 12 gives ~300ms hash time (good balance of security vs. UX).
- Comparison uses `bcrypt.compare(plain, hash)` which is constant-time (resistant to timing attacks).

### JWT Secrets

Two independent secrets (minimum 32 characters each) are required:

```env
ACCESS_TOKEN_SECRET=your-access-secret-here-min-32-chars
REFRESH_TOKEN_SECRET=your-refresh-secret-here-different-key
```

Using separate secrets means a compromised access secret cannot be used to forge refresh tokens, and vice versa.

### Cookie Security

| Attribute | Value | Reason |
|---|---|---|
| `httpOnly` | `true` | JavaScript cannot read the cookie — prevents XSS token theft |
| `secure` | `true` in production | Cookie is only sent over HTTPS |
| `sameSite` | `lax` | Prevents CSRF attacks on form submissions |
| `path` (refresh token) | `/api/auth` | Limits exposure of the long-lived token to only the auth endpoints |

### Refresh Token Revocation

The `jti` (JWT ID) stored in each refresh token is a random UUID. When a token is issued, its SHA-256 hash is stored in `loginusers.refresh_token_hash`. On logout:

1. The refresh token cookie is read.
2. The JWT is verified (signature + expiry).
3. `revokeRefreshToken(userId)` sets `refresh_token_hash = NULL` in the DB.
4. Both cookies are deleted from the browser.

Even if an attacker stole the refresh token cookie, it is immediately invalid after logout.

---

## API Reference

### `POST /api/auth/register`

Creates a new account and immediately logs the user in.

**Request body:**
```json
{
  "name": "Sachin Tendulkar",
  "email": "sachin@cricket.com",
  "password": "Cricket@123",
  "confirmPassword": "Cricket@123"
}
```

**Validation:**
- `name`: 2–100 characters
- `email`: valid format, must not already exist (409 Conflict if duplicate)
- `password`: min 8 chars, at least one uppercase letter, at least one digit
- `confirmPassword`: must match `password`

**Success (201):**
```json
{ "success": true, "user": { "id": "2", "name": "Sachin Tendulkar", "email": "sachin@cricket.com", "role": "user" } }
```

Sets `access_token` + `refresh_token` cookies.

---

### `POST /api/auth/login`

Verifies credentials and issues tokens.

**Request body:**
```json
{ "email": "admin@cricket.com", "password": "Cricket@123" }
```

**Flow:**
1. Normalise email (lowercase, trim).
2. `getUserByEmail` — returns `null` for unknown emails (same generic error to avoid user enumeration).
3. `bcrypt.compare(password, password_hash)`.
4. Generate `jti = crypto.randomUUID()`.
5. `signAccessToken(user)` + `signRefreshToken(userId, jti)`.
6. `SHA-256(jti)` → stored in DB with expiry.
7. `updateLastLogin(userId)`.
8. Set both cookies; return `{ success: true, user }`.

**Error (401):** `"Invalid email or password."` (generic — does not reveal which field is wrong).

---

### `POST /api/auth/logout`

Revokes refresh token and clears cookies.

**Response (200):** `{ "success": true }`

---

### `POST /api/auth/refresh`

Issues a new access token using the refresh token cookie.

**How the browser triggers this:**  
When a page load or API call returns 401, the client fetches `POST /api/auth/refresh`. If successful, it retries the original request. If not, it redirects to `/login`.

**Response (200):** `{ "success": true, "user": { ... } }`  
Sets new `access_token` + rotated `refresh_token` cookies.

**Errors:**
- `401` — missing, invalid, expired, or revoked refresh token

---

### `GET /api/auth/me`

Returns the current user from the access token cookie.

**Response (200):** `{ "success": true, "user": { "id": "1", "name": "Admin", "email": "admin@cricket.com", "role": "admin" } }`  
**Response (401):** `{ "success": false, "error": "Unauthorized — please log in." }`

---

## Middleware Route Protection

`src/middleware.ts` runs on the **Edge Runtime** (V8 isolates) before any page renders.

```typescript
// Verified with jose — Edge-safe, no Node.js APIs
await jwtVerify(accessToken, secret, { algorithms: ['HS256'] })
```

Protected paths: `/dashboard/*`, `/profile/*`

If the access token is missing or invalid, the user is redirected to `/login?callbackUrl=<original-path>`. The login page reads `callbackUrl` and redirects back after a successful login.

### Why Edge Runtime?

- Sub-millisecond cold start (vs. ~100ms for Node.js lambdas).
- Runs at CDN edge nodes geographically close to the user.
- Cannot use Node.js APIs (`fs`, `net`, `crypto` module) — only Web APIs.
- This is why `bcryptjs` lives in `auth-db.ts` (Node.js route handlers) and NOT in `auth.ts` (which is imported by middleware).

---

## Accessibility

### Login / Register Forms

- All form inputs have associated `<label>` elements linked by `htmlFor` / `id`.
- Error messages use `role="alert"` so screen readers announce them immediately.
- Password toggle button has `aria-label` ("Show password" / "Hide password").
- Submit buttons are disabled during loading and have visible disabled state (opacity-60, `cursor-not-allowed`).
- `noValidate` on forms prevents browser default validation popups (custom errors are shown inline).
- `autoComplete` attributes guide password managers: `"email"`, `"current-password"`, `"new-password"`.
- `<Link>` components for "Create account" / "Sign in" navigation are keyboard-accessible (Tab + Enter).
- Color contrast: error text is `red-300` on `red-950` background (passes WCAG AA for large text).

---

## File Structure

```
src/
├── lib/
│   ├── auth.ts          # JWT sign/verify (Edge-safe, jose only)
│   └── auth-db.ts       # DB + bcrypt operations (Node.js runtime)
├── middleware.ts         # Edge route guard (jose jwtVerify)
├── app/
│   ├── layout.tsx        # Root layout: reads auth cookie, passes isLoggedIn to Navbar
│   ├── (auth)/
│   │   ├── login/page.tsx     # Login form (updated: register link, callbackUrl)
│   │   └── register/page.tsx  # Registration form (new)
│   ├── profile/page.tsx       # Shows real DB user data (created_at, last_login)
│   └── api/auth/
│       ├── login/route.ts     # POST: bcrypt verify + issue AT + RT
│       ├── logout/route.ts    # POST: revoke RT + clear cookies
│       ├── me/route.ts        # GET: return user from AT cookie
│       ├── refresh/route.ts   # POST: validate RT + issue new AT + rotate RT
│       └── register/route.ts  # POST: create user + issue tokens
├── components/
│   └── Navbar.tsx             # Updated: isLoggedIn + userName props, Profile link
setup_db.py                    # Updated: loginusers table + admin seed user
.env.local                     # Updated: ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET
```

---

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=abhig
DB_PASSWORD=Pass@123
DB_NAME=cricket_universe

# JWT secrets (min 32 chars each, different values)
ACCESS_TOKEN_SECRET=cricket_universe_access_secret_key_2025_min32ch
REFRESH_TOKEN_SECRET=cricket_universe_refresh_secret_key_2025_min32c
```

---

## Libraries Used

| Library | Version | Runtime | Purpose |
|---|---|---|---|
| `jose` | 6.2.3 | Edge + Node.js | JWT signing and verification |
| `bcryptjs` | 3.0.3 | Node.js only | Password hashing and comparison |
| `mysql2` | 3.22.5 | Node.js only | MySQL connection pool |
| `crypto` (built-in) | — | Node.js only | SHA-256 hashing of jti, UUID generation |

---

## Token Lifecycle Summary

```
Register/Login
    │
    ├── bcrypt verify password
    ├── signAccessToken()   → 15 min JWT → access_token cookie (path: /)
    ├── signRefreshToken()  → 7 day JWT  → refresh_token cookie (path: /api/auth)
    └── SHA-256(jti) stored in DB

Protected Request
    │
    ├── Middleware reads access_token cookie
    ├── jwtVerify() → valid? allow through : redirect /login
    └── Route handler optionally re-verifies for API auth checks

Access Token Expires (15 min)
    │
    ├── Client POSTs /api/auth/refresh (refresh_token cookie auto-sent)
    ├── verifyRefreshToken() → check sig + exp
    ├── SHA-256(jti) compared to DB stored hash
    ├── Match? issue new AT + rotate RT (new jti, update DB)
    └── Client retries original request with new AT

Logout
    │
    ├── verifyRefreshToken() → get userId
    ├── revokeRefreshToken() → set refresh_token_hash = NULL in DB
    └── Delete both cookies from browser
```
