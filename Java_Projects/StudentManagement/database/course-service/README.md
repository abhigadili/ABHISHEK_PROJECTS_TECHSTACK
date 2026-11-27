# CourseDB – migrations owned by course-service
Flyway: `services/course-service/src/main/resources/db/migration/V1__create_course_tables.sql`.
Pre-existing tables (never touched): `Courses`, `Course_Category`, `Course_Faculty`, `Course_Schedule`.
New tables: `sms_course_categories`, `sms_courses` (CHECK constraint on seats), `sms_seat_reservations`. Details: Documentation/05-Course-Service.md.
