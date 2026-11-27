# 03 - Student Service

## 1. Feature Overview
Student CRUD, search/filter/paging/sorting, status (Active/Inactive), eligibility check, plus the **authentication owner** (users, login, refresh tokens) - see `15-Authentication-and-Authorization.md`. Port 8081, database **StudentDB**.

## 2. Purpose
Own student master data; answer "is this student allowed to enrol?" for the Enrollment saga.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| Services/StudentService/Program.cs | Created | Composition root: Pomelo DbContext, Identity, JWT, Redis, controllers, health, migrate-on-start |
| Services/StudentService/Entities/Student.cs | Created | `Student` entity, `Gender`, `StudentStatus` enums |
| Services/StudentService/Entities/Identity.cs | Created | `AppUser : IdentityUser<long>`, `AppRole`, `RefreshToken` |
| Services/StudentService/Data/StudentDbContext.cs | Created | `IdentityDbContext<AppUser, AppRole, long>` with `dn_` table names + timestamps |
| Services/StudentService/Data/Configurations/EntityConfigurations.cs | Created | Fluent API for Student, AppUser (FK cascade to student), RefreshToken |
| Services/StudentService/Repositories/StudentRepository.cs | Created | `IStudentRepository` (search with filters + whitelisted sort) |
| Services/StudentService/Services/StudentAppService.cs | Created | Business logic + Redis cache-aside |
| Services/StudentService/Services/AuthService.cs | Created | register / login / refresh / logout / me |
| Services/StudentService/Services/AdminSeeder.cs | Created | Roles + first Admin on startup |
| Services/StudentService/Controllers/StudentsController.cs, AuthController.cs | Created | HTTP endpoints |
| Services/StudentService/Dtos/StudentDtos.cs, AuthDtos.cs | Created | Request/response records with validation attributes |
| Services/StudentService/Validation/PhoneNumberAttribute.cs | Created | Custom `[OptionalPhone]` rule |
| Services/StudentService/appsettings.json | Created | Connection strings, JWT, bootstrap admin, port 8081 |
| Services/StudentService/Data/Migrations/* | Created | `InitialCreate` |

## 4. Files Modified
None.

## 5. Implementation Details
- Student e-mail is trimmed, lower-cased, unique (`uk_dn_students_email`); duplicate -> 409 (case-insensitive check + unique index).
- `GET /api/students` supports `search` (first/last name, e-mail), `status`, `gender`, `page`, `size` (<=100), `sort=Field,asc|desc` from a whitelist (`StudentId, FirstName, LastName, Email, Status, Gender, EnrollmentDate, CreatedAt`; anything else -> 400).
- A Student-role user may read/update only their own profile and cannot change their own status.
- Deleting a student cascades to the linked login (FK `ON DELETE CASCADE`), which cascades to refresh tokens.
- Redis: `student:{id}` (10 min). Create/read -> cache-aside; update/status -> cache **updated**; delete -> **evicted**.

## 6. Architecture Details
Called synchronously by Enrollment Service: `GET /api/students/{id}/eligibility` and `GET /api/students/{id}` with a Service-role JWT. Publishes no events.

## 7. Dependencies
Pomelo MySQL, EF Core, `Microsoft.AspNetCore.Identity.EntityFrameworkCore 8.0.10`, Redis (`Microsoft.Extensions.Caching.StackExchangeRedis`), Common/Observability building blocks.

## 8. Configuration Changes
`appsettings.json`: `ConnectionStrings:StudentDb`, `ConnectionStrings:Redis`, `Jwt:*`, `Bootstrap:AdminUsername|AdminEmail|AdminPassword`, `Urls`. Env overrides: `ConnectionStrings__StudentDb`, `Jwt__Secret`, `Bootstrap__AdminPassword`.

## 9. Database Changes
StudentDB: `dn_students` (PK `StudentId`, unique email, indexes status and (LastName, FirstName)), Identity tables, `dn_refresh_tokens` (unique `TokenHash`). See `02`.

## 10. API Changes
`POST/GET /api/students`, `GET/PUT/DELETE /api/students/{id}`, `GET /api/students/{id}/eligibility`, `PATCH /api/students/{id}/status`, and the five `/api/auth/*` endpoints. Example create: `POST /api/students {"firstName":"Asha","lastName":"Rao","email":"asha.rao@example.com"}` -> `201` + `Location: /api/students/1`.

## 11. Communication Changes
Inbound REST from Enrollment Service. No messaging.

## 12. Execution Instructions
`scripts/start-local.sh`, then Swagger at `http://localhost:8080/swagger`. Verified manually with curl and by `scripts/e2e.py` (see `27`).

## 13. Testing
Unit: `Tests/UnitTests/Student/StudentTests.cs` (create normalisation, duplicate e-mail, cache use/update/evict, eligibility, phone rule, token hashing). Integration: `Tests/IntegrationTests/StudentApiIntegrationTests.cs` (real pipeline + MySQL + Redis).

## 14. Pending Items
Profile photo / bulk import not in scope. Student deletion does not cascade to other services' data (by design: no cross-database relations).
