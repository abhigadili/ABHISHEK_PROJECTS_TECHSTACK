# 15 - Authentication and Authorization

## 1. Feature Overview
ASP.NET Core Identity (users, roles, PBKDF2 password hashing) + JWT access tokens + rotating refresh tokens + role-based authorization (Admin, Staff, Student) + an internal Service role for service-to-service calls.

## 2. Purpose
Protect all endpoints; separate authentication responsibility from the other three business services.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| BuildingBlocks/Common/Security/JwtOptions.cs, JwtTokenService.cs, AuthExtensions.cs, Roles.cs | Created | Token creation (HS256), validation parameters, bearer setup with JSON 401/403, role constants, claim helpers |
| Services/StudentService/Entities/Identity.cs | Created | `AppUser`, `AppRole`, `RefreshToken` |
| Services/StudentService/Services/AuthService.cs | Created | register, login, refresh (rotation), logout, me |
| Services/StudentService/Services/AdminSeeder.cs | Created | Roles + first admin |
| Services/StudentService/Controllers/AuthController.cs, Dtos/AuthDtos.cs | Created | Endpoints/DTOs |

## 4. Files Modified
None.

## 5. Implementation Details
**Ownership decision (documented before introducing it, as required):** no fifth authentication service/database. Identity lives in the **Student Service / StudentDB** (tables `dn_users`, `dn_roles`, `dn_user_roles`, `dn_user_claims`, `dn_user_logins`, `dn_role_claims`, `dn_user_tokens`, `dn_refresh_tokens`). A Student-role `AppUser` links to `dn_students` by `StudentId` (real FK, `ON DELETE CASCADE`). Consequence: Student Service is the token issuer; every other component only *validates* tokens with the shared secret.
- Password rules: >= 8 chars with a digit and a lower-case letter; hashed by Identity (PBKDF2, per-user salt) - verified: stored hash starts `AQAAAA`, never the password. Lockout: 5 failed logins -> 5 minutes.
- Access token: 15 min, claims `sub`, `unique_name`, `jti`, `role`, `studentId` (students). Refresh token: 48 random bytes (Base64-URL), 7 days, only its **SHA-256** is stored; each refresh revokes the old token (rotation); logout revokes.
- Registration: anonymous -> Student (+ profile) only; Admin token -> Staff/Admin/Student.
- Authorization: `[Authorize(Roles = ...)]` per action + ownership checks (`ForbiddenException`) for Student users. Service token: role `Service`, 5 minutes, created by Enrollment's `ServiceAuthHandler`.
- The gateway validates the JWT (central authentication); services validate again (defence in depth). 401/403 bodies use the common JSON error shape.
- Role matrix: see `README.md` (API endpoints).

## 6. Architecture Details
Student Service issues; gateway + all services validate; Enrollment mints Service tokens.

## 7. Dependencies
`Microsoft.AspNetCore.Identity.EntityFrameworkCore 8.0.10`, `Microsoft.AspNetCore.Authentication.JwtBearer 8.0.10`.

## 8. Configuration Changes
`Jwt:Secret` (>= 32 chars, identical everywhere; env `Jwt__Secret`), `Jwt:Issuer|Audience|AccessTokenMinutes|RefreshTokenDays`, `Bootstrap:AdminUsername|AdminEmail|AdminPassword` (env `Bootstrap__AdminPassword`). A **development default** exists in each `appsettings.json` - override for any real deployment.

## 9. Database Changes
Identity tables + `dn_refresh_tokens` (unique `TokenHash`, FK to users cascade) in StudentDB.

## 10. API Changes
`POST /api/auth/register|login|refresh|logout` (public), `GET /api/auth/me`.

## 11. Communication Changes
`Authorization: Bearer` on every call; services call each other with Service tokens.

## 12. Execution Instructions
```bash
curl -XPOST localhost:8080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"<ADMIN password>"}'
```

## 13. Testing
Unit: JWT round trip/tamper/short secret, token hash. Integration (`StudentApiIntegrationTests`): signed JWT + role claim + hashed password in MySQL, lockout, missing/tampered/expired/foreign-secret tokens -> 401, role matrix (anonymous cannot create Admin; Staff can create but not delete; Student own-data only and cannot change status), refresh rotation + logout, health. E2E checks the same through the gateway.

## 14. Pending Items
No access-token revocation list, no MFA, no external identity provider. Default dev secrets must be replaced for production.
