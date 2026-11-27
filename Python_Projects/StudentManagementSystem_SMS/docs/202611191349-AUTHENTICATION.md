# Authentication & Authorization

Three ideas, kept deliberately separate:

| Concept | What it is here |
|---|---|
| **JWT** | only the *token format*: a signed JSON document (`header.payload.signature`) that proves who the caller is and what they may do, without a database lookup. |
| **OAuth2** | the *protocol* that issues and uses bearer tokens: the **password grant** at `POST /auth/token` returns a token whose `scope` is negotiated; `OAuth2PasswordBearer` + `SecurityScopes` enforce scopes on routes. |
| **RBAC** | the *authorisation model*: users have roles (`ADMIN`, `TEACHER`, `STUDENT`); roles map to scopes; routes require roles and/or scopes, and ownership rules refine them. |

Code: `libs/sms_common/src/sms_common/security.py` (token + dependencies, shared), `services/auth/app/{services,passwords,deps,schemas,models}.py` and `api/v1/{auth,users,roles,oidc}.py`, gateway checks in `services/gateway/app/main.py::authenticate`.

## 1. Tokens

| | Access token | Refresh token |
|---|---|---|
| Purpose | call APIs | obtain a new pair |
| `type` claim | `access` | `refresh` |
| Lifetime | 15 min (`ACCESS_TOKEN_TTL_MINUTES`) | 7 days (`REFRESH_TOKEN_TTL_DAYS`) |
| Stored server-side | no (stateless) | **yes** — `refresh_tokens.jti`, expiry, `revoked_at`, `replaced_by_jti`, IP, user agent |
| Algorithm | HS256 (`JWT_ALGORITHM`), secret `JWT_SECRET` (no default; ≥ 32 random bytes recommended) | same |

Claims (decoded from a real token): 

```json
{"sub": "6", "type": "access", "email": "student…@example.com", "roles": ["STUDENT"],
 "scope": "courses:read enrollments:read enrollments:write files:read files:write profile:self",
 "jti": "b0e67ba6b7164a63a9b225f083a09fbc", "iss": "sms-auth-service", "iat": 1795074488, "exp": 1795075388}
```

### Validation (`decode_token`)

* signature with the **pinned algorithm list** `algorithms=[HS256]` (blocks `alg: none` and algorithm-confusion attacks — covered by a unit test),
* required claims `exp, iat, sub, jti, iss` (`options={"require": …}`), expiry, issuer,
* `type` must match what the endpoint expects (a refresh token is **rejected as an access token** — verified),
* claims parsed through the `TokenClaims` Pydantic model; subject must be an integer.

Failures are `401` with `WWW-Authenticate: Bearer`.

## 2. OAuth2 flow

`POST /api/v1/auth/token` (`application/x-www-form-urlencoded`, `OAuth2PasswordRequestForm`)

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/token \
  -d 'username=admin@sms.example.com' -d 'password=…' -d 'scope=students:read courses:read'
# → {"access_token":"eyJ…","refresh_token":"eyJ…","token_type":"bearer","expires_in":900,"scope":"courses:read students:read"}
```

* `username` is the account e-mail; `scope` is optional.
* Unknown scope → `400 invalid_scope`; none of the requested scopes allowed for the user's roles → `403`.
* Without `scope`, the token gets every scope the roles allow.
* **Enforcement** (`SecurityDeps.current_user`): `OAuth2PasswordBearer(tokenUrl=…, scopes=SCOPE_DESCRIPTIONS)` makes Swagger UI show the scope checkboxes; `SecurityScopes` hands the route's required scopes to the dependency, which returns `403` naming the missing scope. Verified: a token narrowed to `students:read` can list students but gets `403` on `POST /departments`.
* `POST /auth/login` is a JSON convenience wrapper (same result).
* OAuth2 Authorization-Code / client-credentials grants are **not** implemented by this service; the optional OpenID Connect login (§8) uses the code flow against an *external* provider.

### Scope catalogue and role matrix (`ROLE_SCOPES` in `security.py`)

| Scope | ADMIN | TEACHER | STUDENT |
|---|:-:|:-:|:-:|
| `profile:self` | ✔ | ✔ | ✔ |
| `students:read` / `students:write` | ✔ ✔ | ✔ ✔ | — |
| `courses:read` / `courses:write` | ✔ ✔ | ✔ ✔ | ✔ — |
| `enrollments:read` / `enrollments:write` | ✔ ✔ | ✔ ✔ | ✔ ✔ |
| `files:read` / `files:write` | ✔ ✔ | ✔ ✔ | ✔ ✔ |
| `notifications:read` / `notifications:write` | ✔ ✔ | ✔ — | — |
| `users:manage` | ✔ | — | — |

### Using it in a route

```python
# services/student/app/deps.py
StaffWriter = Annotated[CurrentUser, Depends(security.require(Role.ADMIN, Role.TEACHER, scopes=["students:write"]))]

@router.post("", response_model=StudentRead, status_code=201)
async def create_student(body: StudentCreate, _: StaffWriter, svc: StudentServiceDep): ...
```

`require()` returns a dependency that (1) validates the bearer token, (2) checks all scopes through `Security(current_user, scopes=[…])`, (3) checks *any of* the roles. The authenticated `CurrentUser` (id, roles, scopes, jti, exp, raw token for forwarding) is handed to the handler, and its id is put into the logging context (`user_id`).

## 3. Refresh tokens: rotation, reuse detection, revocation

```
POST /auth/refresh {refresh_token}
  verify JWT (type=refresh) ─▶ load row by jti FOR UPDATE
  row missing ............................ 401
  row.revoked_at set ..................... REUSE DETECTED ⇒ revoke ALL the user's refresh tokens ⇒ 401
  row expired / user inactive ............ 401
  otherwise: issue a NEW pair, mark old row revoked (replaced_by_jti = new jti)
```

Verified live: refresh → new pair; replaying the *old* refresh token → `401`; the *new* one is dead as well (the whole family is revoked); garbage → `401`.

Refresh tokens are also revoked: on logout, on password change/reset, on deactivation, on role change (old tokens carry old roles), and when deleting the user (`ON DELETE CASCADE`).

## 4. Logout and access-token revocation

An access token is stateless, so "logout" must tell the gateway. `POST /auth/logout`:

1. revokes the supplied refresh token (or all of the user's if none given),
2. writes `TokenRevoked {jti, exp}` to the **outbox** (same transaction),
3. the relay publishes it to `sms.auth.events`; **every gateway instance** consumes it into an in-memory `jti → exp` map (`gateway/app/revocations.py`); entries disappear at `exp`.

Result (verified): the same access token is accepted before logout and rejected with `401 "Token has been revoked"` within about a second after. A restarted gateway replays the topic from the beginning and rebuilds the map.

Limitation (by design, see ARCHITECTURE §7): a service called *directly* (bypassing the gateway) validates signature/expiry only, so a revoked token stays usable there until its ≤ 15-minute expiry.

## 5. Password security

| Aspect | Implementation |
|---|---|
| Hashing | **Argon2id** via `argon2-cffi` (`PasswordService`, library defaults ≈ RFC 9106 low-memory profile); random salt per hash, parameters embedded in the hash string (`$argon2id$v=19$m=…`) |
| Plain text | never stored, never logged (redaction filter), never echoed in validation errors |
| Upgrade path | `check_needs_rehash()` on every successful login → transparently re-hash if parameters changed |
| Timing | for unknown e-mails a dummy hash is verified (`burn_time`) so response time does not reveal whether an account exists; message is identical (`Invalid email or password`) |
| Complexity (`validate_password_strength`) | 10–128 chars, lower + upper + digit + special |
| Change | `POST /auth/change-password` needs the current password, new ≠ current (Pydantic `model_validator`), revokes all refresh tokens, notifies by e-mail |
| Lock-out | 5 consecutive failures lock the account for 5 min (`MAX_FAILED_LOGINS`, `LOCKOUT_MINUTES`) → `429` + `Retry-After`, even for the right password; the counter is committed *before* the 401 is raised. The gateway adds a per-IP limit on login endpoints (5/min). |
| CPU cost | hashing is deliberately expensive; all Auth endpoints are `def` so FastAPI runs them in its threadpool and the event loop never blocks |

### Forgot / reset password

```
POST /auth/forgot-password {email}     always 202 (never reveals whether the e-mail exists)
   └ if the account exists: invalidate older open tokens; token = secrets.token_urlsafe(32);
     store ONLY sha256(token) + expiry (30 min); outbox → NotificationRequested(password_reset)
Notification service → e-mail with  {FRONTEND_URL}/reset-password?token=<token>
POST /auth/reset-password {token, new_password}
   └ lookup by sha256, unused + unexpired → set password, mark token used, revoke all refresh tokens,
     e-mail "password changed"          (second use of the token → 400)
```

A database leak therefore cannot be used to reset accounts. There is no front-end in this project; the user (or Postman) posts the token from the link to `/auth/reset-password`.

## 6. RBAC and ownership

Role/scope checks live in dependencies; ownership rules live in the **service layer** where the data is known:

| Rule | Where |
|---|---|
| A student reads/edits only their own record, files and enrollments | `students.get_student` (`user.id == student.user_id`), `StudentFileService._student_for`, `EnrollmentService._authorize_view` (`enrollments.student_user_id`) |
| A student can enroll **only themselves** (student resolved from `GET /students/me` using *their* token) | `EnrollmentService.enroll` |
| A teacher edits only courses they created or teach | `CourseService._authorize_modify` |
| Student self-service cannot change status/GPA/department/e-mail | `StudentSelfPatch` schema (the fields do not exist) |
| Cannot delete yourself / remove or disable the last active admin | `AuthService.delete_user`, `_guard_last_admin` |
| Role change revokes the user's refresh tokens | `AuthService.set_roles` |

Bootstrap: roles are seeded at start-up; if `users` is empty and `BOOTSTRAP_ADMIN_EMAIL/PASSWORD` are set, the first administrator is created. Self-registration always yields `STUDENT`.

## 7. What the gateway does vs. what services do

| Check | Gateway | Service |
|---|---|---|
| Token present, signature, expiry, issuer, type | ✔ (early reject, saves a hop) | ✔ (defence in depth — services can be reached directly) |
| Revocation (`jti` cache) | ✔ | — |
| Public-path allow-list (`register`, `login`, `token`, `refresh`, `forgot/reset`, `oidc/*`) | ✔ | — |
| Roles, scopes, ownership | — | ✔ |
| Rate limits | ✔ | account lock-out only |

## 8. Optional OpenID Connect provider

Enabled only when `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (and `OIDC_REDIRECT_URI`) are set; otherwise both endpoints answer `501 OIDC_NOT_CONFIGURED`.

```
GET /auth/oidc/login     → discovery (/.well-known/openid-configuration) → 302 to authorization_endpoint
                           (response_type=code, scope="openid email profile", state=<signed 10-min JWT>)
GET /auth/oidc/callback  → verify state (CSRF) → POST token_endpoint (code, client secret)
                           → GET userinfo_endpoint → require sub + email + email_verified=true
                           → find user by (provider, subject) or create a STUDENT (unusable local password)
                           → issue OUR OWN access/refresh JWT pair
```

The routes are plain `def` handlers using the **synchronous** HTTPX client (`SyncServiceClient`). Safeguards: forged/expired `state` → 401; unverified e-mail → 400; e-mail already registered locally → 409 (no silent account takeover); OIDC users cannot log in with a password.

**Verification status:** exercised end-to-end against a *mock* OpenID provider (`scripts/verify_oidc.py`, 10 checks). It has **not** been tested against a real Google/Azure/Keycloak tenant. The implementation reads the profile from the userinfo endpoint over the TLS back-channel and does not validate an ID-token signature or use PKCE — add both for a public client or production use.

## 9. Verified behaviour (e2e suite)

Weak password → 422 without echoing it · duplicate e-mail (case-insensitive) → 409 · wrong password and unknown e-mail give identical 401 · JWT claims present · tampered token (`roles: ADMIN`) → 401 · refresh token as access token → 401 · scope narrowing and enforcement · invalid/forbidden scope → 400/403 · refresh rotation, reuse detection, family revocation · logout → gateway revocation within ~1 s · change-password revokes refresh tokens · reset e-mail delivered, token single-use · 5 failures → 429 lock-out · admin user CRUD + role replacement · last-admin and self-delete guards · RBAC matrix across Student/Teacher/Admin tokens.
