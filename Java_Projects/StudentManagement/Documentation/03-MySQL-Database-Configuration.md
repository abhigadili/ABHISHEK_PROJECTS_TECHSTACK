# 03 – MySQL Database Configuration

## 1. Feature Overview
Each service owns one **existing** database on the existing MySQL 8.0 server (`localhost:3306`): StudentDB, CourseDB, EnrollmentDB, NotificationDB. Schema changes are made exclusively by Flyway migrations that only **add** tables; Hibernate runs with `ddl-auto: validate`.

## 2. Purpose
Database-per-service with zero risk to the data already in those databases.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| services/student-service/src/main/resources/db/migration/V1__create_student_and_auth_tables.sql | Created | `sms_students`, `sms_users`, `sms_refresh_tokens` |
| services/student-service/src/main/resources/db/migration/V2__user_deleted_with_student.sql | Created | FK `sms_users.student_id` → `ON DELETE CASCADE` (found by an integration test: deleting a student that had a login failed with 409) |
| services/course-service/src/main/resources/db/migration/V1__create_course_tables.sql | Created | `sms_course_categories`, `sms_courses` (+ CHECK), `sms_seat_reservations` |
| services/enrollment-service/src/main/resources/db/migration/V1__create_enrollment_tables.sql | Created | `sms_enrollments` (generated `active_key`), `sms_saga_instances`, `sms_outbox_events` |
| services/notification-service/src/main/resources/db/migration/V1__create_notification_tables.sql | Created | `sms_notifications`, `sms_inbox_messages` |
| scripts/verify-db.sh | Created | **Read-only** report of original tables (row counts), new tables and Flyway history |
| database/student-service/README.md, database/course-service/README.md, database/enrollment-service/README.md, database/notification-service/README.md | Created | Per-service schema notes |

## 4. Files Modified
None (the `application.yml` datasource blocks are documented in [28](28-Configuration-and-Environment-Variables.md)).

## 5. Implementation Details
* **Connection string** (each service, own DB name): `jdbc:mysql://${MYSQL_HOST:localhost}:${MYSQL_PORT:3306}/StudentDB?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`, driver `com.mysql.cj.jdbc.Driver`, user/password from `MYSQL_USER` / `MYSQL_PASSWORD`.
* **Credentials** – deviation, see §14: at the project owner's explicit request the *local-development defaults* `abhig` / the dev password set in `application.yml` are the fallback values of those placeholders in each `application.yml`. Real deployments override them via environment variables / Kubernetes Secret. Docker Compose reads them from `.env` (git-ignored).
* **Flyway**: `baseline-on-migrate: true`, `baseline-version: 0`, `clean-disabled: true`. The databases are not empty, so Flyway records a baseline (V0) and then runs V1+. Migrations use `CREATE TABLE IF NOT EXISTS`; there is no `DROP`/`TRUNCATE`/`ALTER` of pre-existing tables. (V2 alters only `sms_users`, a table created by V1.)
* **Hibernate**: `ddl-auto: validate`, `open-in-view: false`, `hibernate.jdbc.time_zone=UTC`.
* **No cross-database FKs**: `student_id`, `course_id`, `enrollment_id` columns in other services' tables are logical references only.
* **Why `sms_` prefix**: on Linux MySQL table names are case-sensitive (`lower_case_table_names=0`) but `Students` vs `students` would be confusing and unsafe; the prefix guarantees no collision with `Students`, `Courses`, `Enrollments`, `Notifications`.

### Schema (new tables)
| DB | Table | Key points |
|---|---|---|
| StudentDB | `sms_students` | PK `student_id`; UNIQUE `email`; idx `status`, `(last_name, first_name)` |
| StudentDB | `sms_users` | UNIQUE `username`, `email`; `role` ADMIN/STUDENT/STAFF; `student_id` FK (cascade) |
| StudentDB | `sms_refresh_tokens` | UNIQUE `token_hash` (SHA-256), `expires_at`, `revoked`; FK user (cascade) |
| CourseDB | `sms_course_categories` | UNIQUE `name` |
| CourseDB | `sms_courses` | UNIQUE `course_code`; `DECIMAL(10,2) fees`; `version` (optimistic lock); `CHECK (available_seats >= 0 AND available_seats <= total_seats)` |
| CourseDB | `sms_seat_reservations` | UNIQUE `enrollment_id` (idempotency key of seat operations); idx `(course_id, status)` |
| EnrollmentDB | `sms_enrollments` | UNIQUE `idempotency_key`; `active_key` = generated column `CONCAT(student_id,'-',course_id)` only while status ∈ (PENDING, CONFIRMED), **UNIQUE** → duplicate-enrollment guard |
| EnrollmentDB | `sms_saga_instances` | UNIQUE `idempotency_key`; `state`, `seat_reserved`, `attempts`, `version`; idx `(state, updated_at)` |
| EnrollmentDB | `sms_outbox_events` | UNIQUE `event_id`; `payload LONGTEXT`; idx `(status, next_attempt_at, outbox_id)` |
| NotificationDB | `sms_notifications` | UNIQUE `(enrollment_id, notification_type)`; idx `(status, next_attempt_at)` |
| NotificationDB | `sms_inbox_messages` | UNIQUE `(message_id, consumer_group)` |

## 6. Architecture Details
Each service has its own DataSource, entities, repositories and Flyway history table (`flyway_schema_history` inside *its* database). Nothing is shared.

## 7. Dependencies
`mysql-connector-j`, `flyway-core`, `flyway-mysql`, `spring-boot-starter-data-jpa`; Testcontainers `mysql` for tests.

## 8. Configuration Changes
`spring.datasource.*`, `spring.jpa.*`, `spring.flyway.*` in the four service `application.yml` files.

## 9. Database Changes
Verified with `scripts/verify-db.sh` after the full end-to-end run (original tables untouched):

| DB | Original tables (rows) | New tables |
|---|---|---|
| StudentDB | Student_Address 5, Student_Documents 5, Student_Login 5, Students 5 | flyway_schema_history (V0 baseline, V1, V2), sms_students, sms_users, sms_refresh_tokens |
| CourseDB | Course_Category 4, Course_Faculty 6, Course_Schedule 6, Courses 6 | flyway_schema_history, sms_course_categories, sms_courses, sms_seat_reservations |
| EnrollmentDB | Enrollment_Status 5, Enrollment_Validation 5, Enrollments 5, Payments 4 | flyway_schema_history, sms_enrollments, sms_saga_instances, sms_outbox_events |
| NotificationDB | Email_Logs 3, Notifications 5, SMS_Logs 2 | flyway_schema_history, sms_notifications, sms_inbox_messages |

(An early `information_schema.table_rows` read showed 4 for `Enrollment_Validation` and 2 for `Email_Logs`; that statistic is only an estimate for InnoDB. A code search confirms no application code or migration references the original tables, so the exact counts are what was already stored.)

The existing seed data (e.g. the 5 rows in `Students`) is **not** imported into `sms_students`; the new application starts with its own empty tables (plus the bootstrapped `admin` user).

## 10. API Changes
None.

## 11. Communication Changes
None.

## 12. Execution Instructions
```bash
scripts/verify-db.sh                 # read-only report
# migrations run automatically at service start; to see them:
mysql -uabhig -p -e "SELECT version,description,success FROM flyway_schema_history" StudentDB
```
Never run `flyway clean` (disabled). Add schema changes as new `V<n>__*.sql` files; never edit an applied migration (Flyway validates checksums).

## 13. Testing
`StudentApiIT.flywayAddedNewTablesAndPreservedExistingData` starts MySQL 8 in a container with a pre-existing `Students` table + row and asserts the row survives and the four new tables exist. All ITs run against Testcontainers databases – never the real ones.

## 14. Pending Items
* Default credentials in `application.yml` contradict the prompt's "do not expose credentials in source code"; kept on explicit user instruction – recommended to remove the defaults before sharing the repository.
* Existing legacy rows are not migrated into the new tables.
