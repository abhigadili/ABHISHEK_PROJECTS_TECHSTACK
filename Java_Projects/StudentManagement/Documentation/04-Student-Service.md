# 04 – Student Service

## 1. Feature Overview
Student registration/profile CRUD, search/filter/paging, ACTIVE/INACTIVE status, enrollment-eligibility check, Redis caching, and the platform's authentication (register/login/refresh/logout/me – details in [17](17-Spring-Security-and-JWT.md)).

## 2. Purpose
System of record for students; answers "may this student enroll?" for the Enrollment saga.

## 3. Files Created
Base path `services/student-service/src/main/java/com/example/student/`:

| File Path | Change Type | Description |
|---|---|---|
| …/StudentServiceApplication.java | Created | `@SpringBootApplication` |
| …/controller/StudentController.java | Created | Student endpoints with `@PreAuthorize` rules and OpenAPI annotations |
| …/controller/AuthController.java | Created | `/api/auth/*` endpoints |
| …/service/StudentService.java | Created | CRUD, uniqueness check, status, eligibility; `@Cacheable/@CachePut/@CacheEvict` |
| …/service/AuthService.java | Created | Registration rules, BCrypt, JWT + refresh-token rotation |
| …/repository/StudentRepository.java | Created | Spring Data JPA + `JpaSpecificationExecutor` |
| …/repository/StudentSpecifications.java | Created | Dynamic filter (search text on first/last name & e-mail, status, gender) |
| …/repository/UserAccountRepository.java, RefreshTokenRepository.java | Created | Auth persistence |
| …/entity/Student.java, Gender.java, StudentStatus.java | Created | Entity + enums (`@CreationTimestamp/@UpdateTimestamp`) |
| …/entity/UserAccount.java, RefreshToken.java, Role.java | Created | Auth entities (ADMIN, STUDENT, STAFF) |
| …/dto/StudentRequest.java, StudentResponse.java, StatusUpdateRequest.java, EligibilityResponse.java, AuthDtos.java | Created | Records; entities are never exposed |
| …/mapper/StudentMapper.java | Created | Manual mapper (normalises e-mail to lower-case, defaults status ACTIVE / enrollment date today) |
| …/validation/ValidPhoneNumber.java, PhoneNumberValidator.java | Created | Custom Bean Validation constraint (optional, 7–15 digits) |
| …/config/SecurityConfig.java | Created | Stateless filter chain, BCrypt encoder, JSON 401/403 |
| …/config/CacheConfig.java | Created | `RedisCacheManager` (prefix `sms:`, TTL 10 min, JSON serializer for `StudentResponse`), cache-error handler |
| …/config/AdminBootstrap.java | Created | Seeds the first `admin` account |
| services/student-service/src/main/resources/application.yml | Created | Port 8081, StudentDB, Redis, Eureka, actuator, tracing |
| services/student-service/src/main/resources/db/migration/V1__…sql, V2__…sql | Created | [03](03-MySQL-Database-Configuration.md) |
| services/student-service/src/test/java/com/example/student/service/StudentServiceTest.java, AuthServiceTest.java | Created | Unit tests |
| services/student-service/src/test/java/com/example/student/validation/PhoneNumberValidatorTest.java | Created | Unit test |
| services/student-service/src/test/java/com/example/student/it/AbstractIT.java, StudentApiIT.java | Created | Integration tests (MySQL + Redis containers) |
| services/student-service/src/test/resources/db/existing-student-schema.sql | Created | Simulated pre-existing `Students` table for the preservation test |
| services/student-service/Dockerfile | Created | [24](24-Docker-and-Docker-Compose.md) |

## 4. Files Modified
| File Path | Change Type | Description |
|---|---|---|
| services/student-service/src/main/resources/application.yml | Modified | Added `server.forward-headers-strategy: framework` (Swagger behind the gateway) |
| services/student-service/src/main/java/com/example/student/controller/StudentController.java | Modified | Sort-field whitelist (arbitrary `sort=` values used to risk a 500) |

## 5. Implementation Details
* **Eligibility**: `GET /api/students/{id}/eligibility` → `{eligible, reason}`; eligible ⇔ status `ACTIVE`.
* **Uniqueness**: case-insensitive e-mail check in the service + DB unique index → 409.
* **Caching** (`students` cache): read → `@Cacheable`, update/status → `@CachePut`, delete → `@CacheEvict`. Redis failures are logged and bypassed (`CacheErrorHandler`), never fail the request.
* **Authorization**: staff/admin read & write; STUDENT may read/update only the own profile (`#user.studentId == #id`) and cannot change `status`; delete is ADMIN-only; `SERVICE` role (service tokens) may read and call eligibility.
* **Paging/sorting**: `page`, `size` (max 100), `sort=field,dir` restricted to `studentId, firstName, lastName, email, status, gender, enrollmentDate, createdAt`.

## 6. Architecture Details
Owns StudentDB and the auth tables; called by Enrollment Service via Feign (service token). Registers in Eureka as `student-service`.

## 7. Dependencies
Web, Validation, Security, Data JPA, Actuator, Redis+Cache, Flyway, MySQL, Eureka client, springdoc, Micrometer/OTel, Lombok, `common-web`.

## 8. Configuration Changes
`application.yml`: `app.cache.student-ttl`, `app.bootstrap.*`, `app.security.jwt.secret` – see [28](28-Configuration-and-Environment-Variables.md).

## 9. Database Changes
`sms_students`, `sms_users`, `sms_refresh_tokens` ([03](03-MySQL-Database-Configuration.md)).

## 10. API Changes
| Method & path | Roles | Notes |
|---|---|---|
| `POST /api/students` | ADMIN, STAFF | 201 / 400 / 409 |
| `GET /api/students?search&status&gender&page&size&sort` | ADMIN, STAFF | paged |
| `GET /api/students/{id}` | ADMIN, STAFF, SERVICE, STUDENT(own) | cached |
| `GET /api/students/{id}/eligibility` | ADMIN, STAFF, SERVICE | |
| `PUT /api/students/{id}` | ADMIN, STAFF, STUDENT(own) | |
| `PATCH /api/students/{id}/status` | ADMIN, STAFF | `{"status":"INACTIVE"}` |
| `DELETE /api/students/{id}` | ADMIN | also removes the linked login (cascade) |
| `POST /api/auth/register|login|refresh|logout`, `GET /api/auth/me` | see [17](17-Spring-Security-and-JWT.md) | |

Verified sample (through the gateway): `POST /api/students` → `201 {"studentId":1,"firstName":"Asha","lastName":"Rao","email":"asha.rao@example.com","status":"ACTIVE",…}`; duplicate e-mail → `409 {"status":409,"error":"Conflict","message":"A student with email 'asha.rao@example.com' already exists"}`; invalid body → `400` with `fieldErrors`.

## 11. Communication Changes
Inbound REST from Enrollment Service. No Kafka.

## 12. Execution Instructions
`scripts/start-local.sh`, then `curl localhost:8080/api/auth/login …` (see README). Swagger: `http://localhost:8081/swagger-ui.html` or via the gateway.

## 13. Testing
Unit: `StudentServiceTest` (7), `AuthServiceTest` (8), `PhoneNumberValidatorTest` (11). Integration `StudentApiIT` (7): Flyway + preserved data, token required, CRUD with Redis cache fill/update/evict, validation & duplicate errors, search/paging/sorting (+400 on bad sort), RBAC, BCrypt/refresh-token hashing & rotation. Results: [26](26-Unit-and-Integration-Testing.md).

## 14. Pending Items
Deleting a student does not notify other services (their `student_id` references are logical); no soft-delete.
