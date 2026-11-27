# 02 - MySQL Database Configuration

## 1. Feature Overview
Each service connects to **its own existing MySQL database** with its own `DbContext` (Pomelo provider, Fluent API configuration, independent EF Core migrations).

| Service | Database | DbContext |
|---|---|---|
| Student | StudentDB | `StudentDbContext` (also Identity tables) |
| Course | CourseDB | `CourseDbContext` |
| Enrollment | EnrollmentDB | `EnrollmentDbContext` |
| Notification | NotificationDB | `NotificationDbContext` |

## 2. Purpose
Database-per-service ownership; non-destructive schema evolution next to pre-existing tables and data.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| Services/*/Data/*DbContext.cs | Created | DbContexts (timestamps set in `SaveChangesAsync`) |
| Services/*/Data/Configurations/EntityConfigurations.cs | Created | Fluent API: keys, lengths, column types, indexes, unique constraints |
| Services/*/Data/DesignTimeFactory.cs | Created | Lets `dotnet ef` run without starting the web host (so it never applies migrations by accident) |
| Services/StudentService/Data/Migrations/20261110130842_InitialCreate.cs (+Designer, Snapshot) | Created | StudentDB migration |
| Services/CourseService/Data/Migrations/20261110131336_InitialCreate.cs (+Designer, Snapshot) | Created | CourseDB migration |
| Services/NotificationService/Data/Migrations/20261110131534_InitialCreate.cs (+Designer, Snapshot) | Created | NotificationDB migration |
| Services/EnrollmentService/Data/Migrations/20261110133040_InitialCreate.cs (+Designer, Snapshot) | Created | EnrollmentDB migration |
| BuildingBlocks/Common/DbContextExtensions.cs | Created | `InTransactionAsync` (transaction inside EF's execution strategy) |

## 4. Files Modified
None.

## 5. Implementation Details
- **Table prefix `dn_`**: the four databases already contain tables (including `sms_*` tables created by the separate Java project and the original sample tables). Every table created here uses the `dn_` prefix so nothing can collide. EF's history table `__EFMigrationsHistory` is added (it did not exist before).
- Column types: `datetime(6)`, `date`, `decimal(10,2)`, `varchar(n)`, `text`, `longtext`, `bigint` keys with `AUTO_INCREMENT`, enums stored as **strings**.
- `MySqlServerVersion(8.0.36)` is set explicitly so the provider never opens a connection just to detect the server version.
- `EnableRetryOnFailure(3)`; explicit transactions therefore run through `InTransactionAsync` (execution strategy).
- Applying migrations: `Database:MigrateOnStartup` (default true) calls `Database.MigrateAsync()` at startup. Before the first run each migration was rendered with `dotnet ef migrations script` and checked: **0** occurrences of DROP / TRUNCATE / DELETE; only `CREATE TABLE`, `CREATE INDEX`.
- A pitfall found and fixed: Pomelo maps a `string` column declared as `char(36)` to its Guid mapping and throws `NullReferenceException` while building the model - `OutboxMessage.EventId` therefore uses `varchar(36)`.
- A pitfall found and fixed: the CHECK constraint on seats must use the real (PascalCase) column names - the first migration attempt failed on MySQL ("refers to non-existing column") and left an empty `dn_course_categories` table, which was dropped (it was created seconds earlier and was empty) before regenerating the migration.

## 6. Architecture Details
No cross-database foreign keys (`StudentId`/`CourseId`/`EnrollmentId` columns in other services are logical references). Never share a DbContext; services only talk REST/RabbitMQ.

## 7. Dependencies
Pomelo.EntityFrameworkCore.MySql 8.0.2, Microsoft.EntityFrameworkCore 8.0.10 (+ Design, tool `dotnet-ef` 8.0.10), MySqlConnector (transitive).

## 8. Configuration Changes
`ConnectionStrings:StudentDb | CourseDb | EnrollmentDb | NotificationDb` in each `appsettings.json` (local development default uses the existing MySQL login). Override with environment variables `ConnectionStrings__StudentDb` etc. (Docker/Kubernetes do this; credentials come from `.env` / a Kubernetes Secret). `Database:MigrateOnStartup`.

## 9. Database Changes
| Database | Tables added |
|---|---|
| StudentDB | dn_students, dn_users, dn_roles, dn_user_roles, dn_user_claims, dn_user_logins, dn_role_claims, dn_user_tokens, dn_refresh_tokens, __EFMigrationsHistory |
| CourseDB | dn_course_categories, dn_courses (CHECK `chk_dn_courses_seats`), dn_seat_reservations, __EFMigrationsHistory |
| EnrollmentDB | dn_enrollments (generated column `ActiveKey` + unique index), dn_saga_instances, dn_outbox_messages, __EFMigrationsHistory |
| NotificationDB | dn_notifications (unique EnrollmentId+Type), dn_inbox_messages (unique MessageId+ConsumerGroup), __EFMigrationsHistory |

Indexes/constraints are listed in the feature documents (03-06, 11, 12, 17).

## 10. API Changes
None.

## 11. Communication Changes
None.

## 12. Execution Instructions
```bash
export PATH=$PATH:$HOME/.dotnet:$HOME/.dotnet/tools
cd Services/StudentService
dotnet ef migrations add <Name> -o Data/Migrations      # new migration after a model change
dotnet ef migrations script -o /tmp/student.sql          # REVIEW the SQL first (must contain no DROP)
dotnet ef database update                                # or just start the service (MigrateOnStartup)
```
Set `ConnectionStrings__StudentDb` in the environment for `dotnet ef database update`.

## 13. Testing
Migrations are exercised for real by the integration tests (they migrate a Testcontainers MySQL 8) and by the live run against the four existing databases (`scripts/e2e.py`). The pre-existing tables were never modified.

## 14. Pending Items
- No down-migration was exercised (not needed; rollback = drop the `dn_*` tables manually after review).
