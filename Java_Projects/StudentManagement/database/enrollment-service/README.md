# EnrollmentDB – migrations owned by enrollment-service
Flyway: `services/enrollment-service/src/main/resources/db/migration/V1__create_enrollment_tables.sql`.
Pre-existing tables (never touched): `Enrollments`, `Enrollment_Status`, `Enrollment_Validation`, `Payments`.
New tables: `sms_enrollments`, `sms_saga_instances`, `sms_outbox_events`. Details: Documentation/06-Enrollment-Service.md, 12, 13.
