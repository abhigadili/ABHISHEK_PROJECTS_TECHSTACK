# 17 – Spring Security and JWT

## 1. Feature Overview
User registration, login, BCrypt password hashing, HS256 JWT access tokens, opaque rotating refresh tokens, role-based authorisation (ADMIN, STAFF, STUDENT, plus internal SERVICE), enforced at the gateway (authentication) and at every service (authentication + roles).

## 2. Purpose
Protect every API and let services trust each other without a central call on the hot path.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| common/common-web/src/main/java/com/example/common/security/JwtTokenService.java | Created | Create/parse tokens (jjwt 0.12.6), service tokens (5 min, role SERVICE) |
| common/common-web/src/main/java/com/example/common/security/JwtProperties.java | Created | `app.security.jwt.*` (secret ≥ 32 chars, TTLs) |
| common/common-web/src/main/java/com/example/common/security/JwtAuthenticationFilter.java | Created | Bearer → `SecurityContext` (principal `AuthenticatedUser`) |
| common/common-web/src/main/java/com/example/common/security/AuthenticatedUser.java | Created | `userId, username, roles, studentId` |
| common/common-web/src/main/java/com/example/common/security/JsonSecurityHandlers.java | Created | JSON 401/403 |
| services/student-service/src/main/java/com/example/student/config/SecurityConfig.java | Created | Chain + BCrypt; public: login/register/refresh/logout, health, docs |
| services/{course,enrollment,notification}-service/src/main/java/com/example/{course,enrollment,notification}/config/SecurityConfig.java | Created | Same chain without auth endpoints |
| services/student-service/src/main/java/com/example/student/service/AuthService.java, controller/AuthController.java, entity/UserAccount.java, RefreshToken.java, Role.java, repository/UserAccountRepository.java, RefreshTokenRepository.java, dto/AuthDtos.java, config/AdminBootstrap.java | Created | Auth feature |
| api-gateway/src/main/java/com/example/gateway/filter/JwtAuthGlobalFilter.java | Created | Edge check |
| common/common-web/src/test/java/com/example/common/security/JwtTokenServiceTest.java | Created | |

## 4. Files Modified
`common/common-web/src/main/java/com/example/common/exception/GlobalExceptionHandler.java` – added a handler for the new `UnauthorizedException` (401, created as `common/common-web/src/main/java/com/example/common/exception/UnauthorizedException.java`).

## 5. Implementation Details
**Ownership / DB implication (as required by the prompt):** authentication is owned by **Student Service**; users (`sms_users`) and refresh tokens (`sms_refresh_tokens`) are two extra tables in StudentDB. No fifth service or database is introduced. Services verify tokens locally with the shared HMAC secret (`JWT_SECRET`).
* **Registration** `POST /api/auth/register`: anonymous → role STUDENT only (firstName/lastName required; a student profile is created and linked, `studentId` goes into the token); `role` ADMIN/STAFF only with an ADMIN token (otherwise 403).
* **Login** accepts username or e-mail; identical error for unknown user and wrong password (no user enumeration).
* **Access token** 15 min (`roles`, `studentId`, `username`, `iss`); **refresh token** 7 days, 48 random bytes, only its SHA-256 is stored; each refresh **rotates** (old token revoked; reuse → 401); logout revokes.
* **Bootstrap admin**: `admin` / `ADMIN_PASSWORD` (default `Admin@123`, local only) created at startup if missing (BCrypt).
* **Authorisation matrix** (summary): ADMIN everything; STAFF read/write students, courses, enrollments, notifications (no deletes); STUDENT: own profile, browse courses, own enrollments/notifications, enroll/cancel themselves; SERVICE: internal reads and seat reserve/release. Implemented with `@EnableMethodSecurity` + `@PreAuthorize`.

## 6. Architecture Details
Stateless sessions, CSRF disabled (token API). Gateway rejects unauthenticated traffic early; services re-validate (defence in depth, direct calls are still protected).

## 7. Dependencies
`spring-boot-starter-security`, `io.jsonwebtoken:jjwt-api|impl|jackson`, `spring-security-test`.

## 8. Configuration Changes
`app.security.jwt.secret` (`JWT_SECRET`, same value in all services + gateway), `app.bootstrap.admin-*` (`ADMIN_PASSWORD`).

## 9. Database Changes
`sms_users`, `sms_refresh_tokens` ([03](03-MySQL-Database-Configuration.md)).

## 10. API Changes
| Endpoint | Body → Response |
|---|---|
| `POST /api/auth/register` | `{username,email,password(8-72),role?,firstName,lastName,phoneNumber?}` → `201 {userId,username,email,role,studentId}` |
| `POST /api/auth/login` | `{username,password}` → `{accessToken,refreshToken,tokenType:"Bearer",expiresInSeconds,username,role,studentId}` |
| `POST /api/auth/refresh` | `{refreshToken}` → new pair |
| `POST /api/auth/logout` | `{refreshToken}` → 204 |
| `GET /api/auth/me` | → `{userId,username,email,role,studentId}` |

## 11. Communication Changes
`Authorization: Bearer <jwt>` on every call; Feign adds a SERVICE token.

## 12. Execution Instructions
```bash
T=$(curl -s -XPOST localhost:8080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@123"}' | jq -r .accessToken)
curl -s localhost:8080/api/auth/me -H "Authorization: Bearer $T"
```
In Swagger UI use **Authorize** and paste the access token.

## 13. Testing
Unit: `JwtTokenServiceTest` (4: round trip, service token, tamper/expiry/foreign-key rejection, short secret), `AuthServiceTest` (8), gateway filter test (3). Integration: `StudentApiIT` RBAC, BCrypt/refresh hash storage and rotation. E2E (15 assertions): 401 without token, login/refresh rotation/revoked reuse, anonymous ADMIN registration → 403, ADMIN creates STAFF, STUDENT forbidden to list/read others/create courses/enroll others.

## 14. Pending Items
HS256 shared secret (asymmetric keys / JWKS would remove secret sharing); no account lockout/rate limiting; no password-reset or e-mail verification; access tokens cannot be revoked before expiry (15 min).
