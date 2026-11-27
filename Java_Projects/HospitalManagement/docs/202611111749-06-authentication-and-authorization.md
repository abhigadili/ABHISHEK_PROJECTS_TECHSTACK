# 6. Authentication and authorization

## Design
* **One identity authority:** the Hospital Service stores accounts (`users`: BCrypt hash, role, enabled flag) and is the only component that **signs** tokens. Nothing else implements login logic.
* **Token:** a signed JWT (OAuth2 resource-server style, Spring Security + Nimbus), algorithm HS256, default lifetime 120 min (`JWT_EXPIRY_MINUTES`). Claims: `iss=hospital-identity`, `sub=<username>`, `uid=<user id>`, `email`, `roles=["ADMIN"]`, `iat`, `exp`.
* **Shared key:** `hospital.security.jwt.secret` (env `JWT_SECRET`, >= 32 bytes). The local default is a development value - set `JWT_SECRET` anywhere else. Services and the gateway need the key only to *verify*.
* **Defence in depth:** the gateway validates the JWT at the edge **and** every service validates it again (stateless `oauth2ResourceServer().jwt()` filter chain from `common`), so a service port is never trusted blindly.
* **Roles:** `ADMIN, DOCTOR, PATIENT, LAB_STAFF, PHARMACIST, BILLING_STAFF` -> authorities `ROLE_<name>`.

## Login flow
```
POST /api/auth/login {username,password} ──► gateway (permitAll) ──► Hospital Service
      BCrypt check (same 401 for unknown user / wrong password / disabled account - no user enumeration)
      JwtTokenService.issue(user) ──► { accessToken, tokenType: "Bearer", expiresInSeconds, user }
subsequent calls: Authorization: Bearer <token> ──► gateway validates ──► routes ──► service validates again ──► @PreAuthorize
```

## Gateway (edge) rules - `GatewaySecurityConfig`
| Path | Rule |
|---|---|
| `/api/auth/login`, `/api/auth/register` | public |
| `/internal/**`, `/ping`, `/actuator/**` | denied (never exposed) |
| `/api/users/**` | ADMIN |
| `/api/pharmacy/**` | ADMIN, PHARMACIST, DOCTOR |
| `/api/lab/**` | ADMIN, DOCTOR, LAB_STAFF, PATIENT |
| `/api/bills/**`, `/api/payments/**` | ADMIN, BILLING_STAFF, PATIENT |
| any other `/api/**` | authenticated |
| everything else | denied |

Unauthenticated -> `401` JSON, authenticated-but-forbidden -> `403` JSON (custom `ServerAuthenticationEntryPoint` / `ServerAccessDeniedHandler`); unreachable service -> `503`, timeout -> `504` (`GatewayErrorHandler`). Internal service endpoints are not routed, and the service ports are meant to be reachable only from localhost / the private network.

## Service rules (fine-grained)
Controllers use `@PreAuthorize` (method security enabled in `common`); services add *ownership* rules the role alone cannot express. Roles per endpoint are listed in the REST API document; the matrix in short:

| Capability | ADMIN | DOCTOR | PATIENT | LAB_STAFF | PHARMACIST | BILLING_STAFF |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Manage users, hospitals, departments, doctors | ✔ | | | | | |
| Register / update patients | ✔ | | own | | | |
| Search patients | ✔ | ✔ | | ✔ | ✔ | ✔ |
| Manage doctor schedule / days off | ✔ | own | | | | |
| Book / reschedule / cancel appointments | ✔ | participant | own | | | |
| Complete appointment | ✔ | treating doctor | | | | |
| Medical record entries (write) | ✔ | ✔ | | | | |
| Medical record (read) | ✔ | ✔ | own | | | |
| Issue / cancel prescriptions | ✔ | own name | | | | |
| Read prescriptions | ✔ | ✔ | own | | ✔ (by patient) | |
| Request lab tests | ✔ | own name | | | | |
| Update lab status / submit report | ✔ | | | ✔ | | |
| Read lab reports | ✔ | ✔ | own | ✔ | | |
| Dispense / stock | ✔ | read stock | | | ✔ | |
| Create bills, confirm payments | ✔ | | | | | ✔ |
| Initiate payment, read bills | ✔ | | own | | | ✔ |
| Read all notifications | ✔ | | | | | |

**Ownership checks**
* Patient Service: a PATIENT may read/update only the profile whose `userId` equals the JWT `uid`.
* All other services resolve "does this patient belong to the caller?" through `PatientGateway.requireAccess(patientId)` (Feign, circuit-breaker protected): a PATIENT whose `uid` differs from the profile's `userId` receives **403**.
* A DOCTOR may issue prescriptions / lab requests only with their own `doctorId` (doctor profile `userId` == `uid`), change only their own schedule, and complete only their own appointments.
* A patient cannot confirm or fail payments (`PUT /api/payments/{ref}/status` is ADMIN/BILLING_STAFF only), nor read another patient's bills.

## Accounts
| Account | Created by | Role | Seed password |
|---|---|---|---|
| `admin` | first start (`DataSeeder`) | ADMIN | `Admin@123` (`SEED_ADMIN_PASSWORD`) |
| `doctor1`, `doctor2` | seed | DOCTOR | `Staff@123` (`SEED_STAFF_PASSWORD`) |
| `labstaff1` | seed | LAB_STAFF | `Staff@123` |
| `pharmacist1` | seed | PHARMACIST | `Staff@123` |
| `billing1` | seed | BILLING_STAFF | `Staff@123` |
| patients | self-registration `POST /api/auth/register` | PATIENT | chosen by the user |
Seed passwords are **local-development defaults** - override the env variables (or change them through the API) before any shared use. Passwords are stored only as BCrypt hashes; no secrets are logged.

## Other security properties
* No card data anywhere: payments store only the method and a transaction reference.
* Uniform error bodies never leak stack traces (`server.error.include-stacktrace: never`).
* Validation (Bean Validation) on every request DTO; SQL is only issued through JPA/JPQL with bind parameters.
* Disabled accounts cannot log in; an admin cannot disable their own account.
* Database credentials come from environment variables / the git-ignored `.env`, never from source.

## Trying it
```bash
TOKEN=$(curl -s -X POST localhost:18080/api/auth/login -H 'Content-Type: application/json' \
        -d '{"username":"admin","password":"Admin@123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
curl -s localhost:18080/api/hospitals -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w '%{http_code}\n' localhost:18080/api/hospitals          # 401
```
