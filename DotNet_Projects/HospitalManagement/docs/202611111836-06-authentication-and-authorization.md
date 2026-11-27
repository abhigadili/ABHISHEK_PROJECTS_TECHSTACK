# 6. Authentication and authorization

## Design
* **One identity authority:** the Hospital Service hosts **ASP.NET Core Identity** (`UserManager<AppUser>`, `RoleManager<IdentityRole<long>>`, EF Core store in HospitalDB, tables `hdn_users`, `hdn_roles`, `hdn_user_roles`, ...). Registration, **password hashing (PBKDF2 via Identity's `PasswordHasher`)**, password policy (>= 8 chars, upper, lower, digit), e-mail uniqueness and lockout (8 failed attempts -> 5 min) come from Identity. Nothing else implements login logic.
* **Token:** a signed **JWT** (OAuth2 bearer-token concepts; no custom authorization server is needed), HS256, default lifetime 120 min (`Jwt:ExpiryMinutes`). Claims: `sub` (user id), `unique_name`, `email`, `role`, `jti`, `iss=hospital-identity`, `aud=hospital-api`, `nbf`, `exp`. Issued by `TokenService`.
* **Validation everywhere** (`AddHospitalJwt` in `Shared`): issuer, audience, signature, lifetime (`RequireExpirationTime`), clock skew 30 s, `MapInboundClaims=false` with `RoleClaimType="role"`. The signing key is `Jwt:Key` (env `Jwt__Key`, >= 32 bytes enforced at start-up). The default in `appsettings.json` is a local-development value - set `Jwt__Key` for any other use.
* **Defence in depth:** the **YARP gateway** validates the token at the edge **and** every service validates it again (including the gRPC endpoints), so a service port is never trusted blindly.
* **Roles:** `ADMIN, DOCTOR, PATIENT, LAB_STAFF, PHARMACIST, BILLING_STAFF` (ASP.NET Identity roles, seeded).
* **Challenges:** missing/invalid/expired token -> JSON `401`, role not allowed -> JSON `403` (`JwtBearerEvents.OnChallenge/OnForbidden`), identical shape at gateway and services.

## Login flow
```
POST /api/auth/login {username,password} ──► YARP (route policy "anonymous") ──► Hospital Service
      UserManager.CheckPasswordAsync  (same 401 for unknown user / wrong password / disabled or locked account - no user enumeration)
      TokenService.Issue(user, roles) ──► { accessToken, tokenType:"Bearer", expiresInSeconds, user }
next calls: Authorization: Bearer <token> ──► YARP validates + route role policy ──► service validates again ──► [Authorize(Roles=..)] + ownership rules
```

## Gateway (edge) policies - `src/ApiGateway`
Routes in `appsettings.json` name a policy; policies are registered in `Program.cs`:

| Route family | Policy | Roles |
|---|---|---|
| `/api/auth/**` | `anonymous` (YARP built-in) | public (the Hospital Service still protects `/api/auth/me`) |
| `/api/users/**` | `admin` | ADMIN |
| `/api/pharmacy/**` | `pharmacy` | ADMIN, PHARMACIST, DOCTOR |
| `/api/lab/**` | `lab` | ADMIN, DOCTOR, LAB_STAFF, PATIENT |
| `/api/bills/**`, `/api/payments/**` | `billing` | ADMIN, BILLING_STAFF, PATIENT |
| all other routed `/api/**` | `authenticated` | any valid token |
| anything not a route (`/ping`, `/internal/**`, unknown) | fallback, `RequireAuthorization` | never proxied: 401 without token, 404 with one |

Gateway errors: unreachable service -> JSON 503, timeout -> 504 (`IForwarderErrorFeature`). Internal endpoints are not exposed because there is no route for them.

## Service rules (fine-grained)
Controllers use `[Authorize(Roles=...)]`; services add *ownership* rules a role alone cannot express. Roles per endpoint are in the REST API document; summary matrix:

| Capability | ADMIN | DOCTOR | PATIENT | LAB_STAFF | PHARMACIST | BILLING_STAFF |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Manage users, hospitals, departments, doctors | ✔ | | | | | |
| Register / update patients | ✔ | | own | | | |
| Search patients | ✔ | ✔ | | ✔ | ✔ | ✔ |
| Manage doctor schedule / days off | ✔ | own | | | | |
| Book / reschedule / cancel appointments | ✔ | participant | own | | | |
| Complete appointment | ✔ | treating doctor | | | | |
| Medical record entries (write) / read | ✔ | ✔ | read own | | | |
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
* Patient Service: a PATIENT may read/update only the profile whose `UserId` equals the JWT `sub`.
* All other services resolve "does this patient belong to the caller?" through `IPatientDirectory.RequireAccessAsync` (**gRPC** to the Patient Service): a PATIENT whose `sub` differs from the profile's `UserId` receives **403**.
* A DOCTOR may issue prescriptions / lab requests only with their own `doctorId` (doctor profile `UserId == sub`), change only their own schedule, complete only their own appointments.
* A patient cannot confirm or fail payments (`PUT /api/payments/{ref}/status` is ADMIN/BILLING_STAFF only) nor read another patient's bills.
* **JWT forwarding:** the caller's token is copied onto every HttpClient/gRPC call, so the downstream service applies *its* role rules.

## Accounts
| Account | Created by | Role | Seed password |
|---|---|---|---|
| `admin` | first start (`DataSeeder`) | ADMIN | `Admin@123` (`Seed:AdminPassword`) |
| `doctor1`, `doctor2` | seed | DOCTOR | `Staff@123` (`Seed:StaffPassword`) |
| `labstaff1` | seed | LAB_STAFF | `Staff@123` |
| `pharmacist1` | seed | PHARMACIST | `Staff@123` |
| `billing1` | seed | BILLING_STAFF | `Staff@123` |
| patients | `POST /api/auth/register` (always role PATIENT) | PATIENT | chosen by the user |
The seed passwords are **local-development defaults** - override `Seed__AdminPassword` / `Seed__StaffPassword` (or change the passwords through the API) before any shared use. Passwords exist only as Identity hashes; they and tokens are never logged (verified: the logs contain no JWT or password text).

## Other security properties
* No card data anywhere: payments store only the method and a transaction reference.
* Uniform JSON errors without stack traces; validation on every request DTO; SQL only through EF Core (parameterised), plus one parameterised `FromSqlInterpolated` for `SELECT ... FOR UPDATE`.
* Disabled accounts cannot log in; an admin cannot disable their own account.
* Database credentials come from environment variables / the git-ignored `.env`, never from source.

## Trying it
```bash
TOKEN=$(curl -s -X POST localhost:28080/api/auth/login -H 'Content-Type: application/json' \
        -d '{"username":"admin","password":"Admin@123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
curl -s localhost:28080/api/hospitals -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w '%{http_code}\n' localhost:28080/api/hospitals          # 401
```
