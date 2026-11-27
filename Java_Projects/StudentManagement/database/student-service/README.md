# StudentDB – migrations owned by student-service
Flyway scripts (classpath `db/migration`): `V1__create_student_and_auth_tables.sql`, `V2__user_deleted_with_student.sql` – see `services/student-service/src/main/resources/db/migration/`.
Pre-existing tables (never touched): `Students`, `Student_Address`, `Student_Documents`, `Student_Login`.
New tables: `sms_students`, `sms_users`, `sms_refresh_tokens`. Details: Documentation/03-MySQL-Database-Configuration.md, Documentation/04-Student-Service.md.
Check: `scripts/verify-db.sh`.
