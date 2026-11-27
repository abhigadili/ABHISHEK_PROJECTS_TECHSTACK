# 6. Authentication and authorization

## Design
* **One identity authority:** the Hospital Service (`hjs_users`, `hjs_refresh_tokens`). It registers users, hashes passwords with **bcrypt** (cost 10), logs users in, signs tokens with **jose** and rotates refresh tokens. Nothing else implements login logic.
* **Passport.js** (`passport` + `passport-custom`) is the authentication framework in the gateway and every service: a custom strategy named `jwt` extracts the bearer token and verifies it with **jose** (`jwtVerify`): signature (HS256), **issuer** (`hospital-identity`), **audience** (`hospital-api`), expiry (30 s tolerance). One JWT library (jose) is used for signing and verifying; Passport supplies the strategy/middleware pipeline (no second JWT package).
* **Access token:** 15 min (`JWT_ACCESS_TTL`), claims `sub`, `preferred_username`, `email`, `roles`, `iss`, `aud`, `iat`, `exp`, `jti`. The signing key is `JWT_SECRET` (≥ 32 chars; the `.env`/default is for local development - change it elsewhere).
* **Refresh token:** opaque 64-char random string, 7 days (`JWT_REFRESH_TTL_DAYS`), **only its SHA-256 is stored**. `POST /api/auth/refresh` **rotates** it (old one revoked, new pair issued in the same *family*); presenting an already-used token is treated as theft: the **whole family is revoked** and 401 returned. `POST /api/auth/logout` revokes the family; disabling a user revokes all their tokens. (Verified live.)
* **No OAuth2 server** was built; if social/enterprise login is needed later, add an existing OIDC provider in front of `/api/auth/*` and keep this role model.
* **Defence in depth:** the gateway validates the token at the edge **and** every service (REST and gRPC) validates it again - a service port is never trusted blindly.
* **Roles:** `ADMIN, DOCTOR, PATIENT, LAB_STAFF, PHARMACIST, BILLING_STAFF`.
* **Never exposed:** password hashes, refresh-token values (after issue) and JWTs never appear in responses beyond the login reply, and are redacted from logs (Pino `redact` paths); verified by grepping the logs.
* Login anti-enumeration/brute force: identical `401` for unknown user / wrong password / disabled / locked account; 8 failures lock the account for 5 min; the gateway rate-limits `/api/auth/*`.

## Login flow
```
POST /api/auth/login {username,password} → gateway (public path, auth rate limit) → Hospital Service
      bcrypt.compare → SignJWT(HS256) + refresh token (hash stored) → { accessToken, refreshToken, tokenType, expiresInSeconds, user }
next calls: Authorization: Bearer <accessToken> → gateway: Passport/jose + route roles → service: Passport/jose again → requireRoles + ownership rules
```

## Gateway (edge) rules - `api-gateway/config/routes.json`
| Route family | Rule |
|---|---|
| `/api/auth/login|register|refresh|logout` | public (rate-limited: `AUTH_RATE_LIMIT_PER_MIN`) |
| other `/api/auth/*` | any valid token |
| `/api/users/**` | ADMIN |
| `/api/lab/**` | ADMIN, DOCTOR, LAB_STAFF, PATIENT |
| `/api/bills/**`, `/api/payments/**` | ADMIN, BILLING_STAFF, PATIENT |
| `/api/pharmacy/**` | ADMIN, PHARMACIST, DOCTOR |
| all other routed `/api/**` | any valid token |
| anything else (`/ping`, `/internal/**`, unknown) | never proxied: 401 without token, 404 with one |

Gateway errors are JSON: 401 (`authenticate` → `UnauthorizedError`), 403 (`requireRoles`), 429, 503 (target down), 504 (timeout). Every response carries `X-Correlation-Id`. `helmet` and `cors` (`CORS_ORIGINS`) are applied.

## Service rules (fine-grained)
A route declaration (`api.post(path, { roles, body, ... }, handler)`) wires `authenticate` + `requireRoles` + Zod validation; services add *ownership* rules a role cannot express:

| Capability | ADMIN | DOCTOR | PATIENT | LAB_STAFF | PHARMACIST | BILLING_STAFF |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Manage users, hospitals, departments, doctors | ✔ | | | | | |
| Register / update patients | ✔ | | own | | | |
| Search patients | ✔ | ✔ | | ✔ | ✔ | ✔ |
| Manage doctor schedule / days off | ✔ | own | | | | |
| Book / reschedule / cancel appointments | ✔ | participant | own | | | |
| Complete appointment | ✔ | treating doctor | | | | |
| Medical record write / read | ✔ | ✔ | read own | | | |
| Issue / cancel prescriptions | ✔ | own name | | | | |
| Read prescriptions | ✔ | ✔ | own | | ✔ (by patient) | |
| Request lab tests | ✔ | own name | | | | |
| Update lab status / submit report / upload attachment | ✔ | | | ✔ | | |
| Read lab reports + attachments | ✔ | ✔ | own | ✔ | | |
| Dispense / stock | ✔ | read stock | | | ✔ | |
| Create bills, confirm payments | ✔ | | | | | ✔ |
| Initiate payment, read bills | ✔ | | own | | | ✔ |
| Read all notifications | ✔ | | | | | |

**Ownership checks:** Patient Service (profile `userId` = JWT `sub`); everywhere else `patients.requireAccess(patientId, user)` over gRPC - a PATIENT whose `sub` differs from the profile's `userId` gets **403**; a DOCTOR may prescribe/request tests/complete appointments only as themself (doctor profile `userId` = `sub`) and edit only their own schedule; patients cannot confirm payments. The caller's token is forwarded on every HTTP/gRPC call so downstream role rules still apply.

## Accounts
| Account | Role | Seed password |
|---|---|---|
| `admin` | ADMIN | `Admin@123` (`SEED_ADMIN_PASSWORD`) |
| `doctor1`, `doctor2` | DOCTOR | `Staff@123` (`SEED_STAFF_PASSWORD`) |
| `labstaff1` / `pharmacist1` / `billing1` | LAB_STAFF / PHARMACIST / BILLING_STAFF | `Staff@123` |
| patients | PATIENT | self-registration `POST /api/auth/register` |
Seed passwords are **development defaults** - override via env or change them through the API. Password policy (Zod): 8-72 chars with upper, lower and a digit.

## Other security properties
Zod validation on every request body/query/param; Prisma parameterises all SQL (the two raw `FOR UPDATE` queries use tagged templates); no card data anywhere (payments accept only a method); uniform JSON errors without stack traces; upload filter (PDF/PNG/JPEG, 5 MB, random file names); database credentials only from environment / the git-ignored `.env`.
