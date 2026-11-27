-- ============================================================
-- EnrollmentDB — owned exclusively by enrollment-service.
--
-- IMPORTANT: student_id and course_id below are references to rows that live
-- in StudentDB and CourseDB respectively — separate schemas owned by other
-- microservices. There is deliberately NO foreign key across those schemas
-- (MySQL can't enforce one anyway, and "database per service" means
-- enrollment-service must never reach into another service's tables).
--
-- Unlike the synchronous/OpenFeign version of this system, referential
-- integrity for student_id/course_id is NOT checked before the INSERT.
-- An Enrollment row is created immediately in PENDING_VALIDATION status,
-- and validity is confirmed asynchronously via the Kafka saga described in
-- the project README: enrollment-service publishes `enrollment.requested`,
-- then waits for `student.validation.result` and `course.validation.result`
-- events, tracking partial progress in Enrollment_Validation until both
-- have arrived. See EnrollmentSagaService.
-- ============================================================
DROP DATABASE IF EXISTS EnrollmentDB;
CREATE DATABASE EnrollmentDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE EnrollmentDB;

CREATE TABLE Enrollment_Status (
    status_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    status_name     VARCHAR(30) NOT NULL UNIQUE,
    description     VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE Enrollments (
    enrollment_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id       BIGINT NOT NULL,   -- reference to StudentDB.Students.student_id (no cross-DB FK)
    course_id        BIGINT NOT NULL,   -- reference to CourseDB.Courses.course_id (no cross-DB FK)
    status_id        BIGINT NOT NULL,
    enrollment_date  DATE DEFAULT (CURRENT_DATE),
    completion_date  DATE NULL,
    rejection_reason VARCHAR(255) NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_enrollment_status FOREIGN KEY (status_id) REFERENCES Enrollment_Status(status_id)
) ENGINE=InnoDB;

-- Tracks the two async validation replies (student-service, course-service)
-- for one enrollment request. NULL = "reply not received yet". The saga is
-- considered resolved only once both columns are non-NULL.
CREATE TABLE Enrollment_Validation (
    enrollment_id     BIGINT PRIMARY KEY,
    student_valid     BOOLEAN NULL,
    student_reason    VARCHAR(255) NULL,
    student_checked_at TIMESTAMP NULL,
    course_valid      BOOLEAN NULL,
    course_reason     VARCHAR(255) NULL,
    course_checked_at TIMESTAMP NULL,
    CONSTRAINT fk_validation_enrollment FOREIGN KEY (enrollment_id) REFERENCES Enrollments(enrollment_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Payments (
    payment_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id    BIGINT NOT NULL,
    amount           DECIMAL(10,2) NOT NULL,
    payment_method   VARCHAR(30),
    payment_status   VARCHAR(20) DEFAULT 'PENDING',
    transaction_ref  VARCHAR(100),
    payment_date     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_enrollment FOREIGN KEY (enrollment_id) REFERENCES Enrollments(enrollment_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- sample data ----
INSERT INTO Enrollment_Status (status_name, description) VALUES
('PENDING_VALIDATION', 'Enrollment created, waiting on student/course validation events'),
('CONFIRMED',          'Both student and course validated successfully'),
('REJECTED',           'Student and/or course failed validation'),
('COMPLETED',          'Course finished successfully'),
('CANCELLED',          'Enrollment cancelled by student or admin');

-- student_id / course_id values below line up with the sample rows inserted
-- by 01_student_db.sql and 02_course_db.sql. These are seeded as already
-- CONFIRMED/COMPLETED so GET endpoints have data to show without needing to
-- replay the saga first.
INSERT INTO Enrollments (student_id, course_id, status_id, enrollment_date) VALUES
(1, 1, 2, '2025-07-20'),
(1, 2, 2, '2025-07-20'),
(2, 3, 2, '2025-07-22'),
(3, 4, 4, '2025-06-15');

INSERT INTO Enrollment_Validation (enrollment_id, student_valid, student_reason, course_valid, course_reason) VALUES
(1, TRUE, 'Student exists', TRUE, 'Course exists'),
(2, TRUE, 'Student exists', TRUE, 'Course exists'),
(3, TRUE, 'Student exists', TRUE, 'Course exists'),
(4, TRUE, 'Student exists', TRUE, 'Course exists');

INSERT INTO Payments (enrollment_id, amount, payment_method, payment_status, transaction_ref) VALUES
(1, 15000.00, 'UPI',        'Success', 'TXN-100001'),
(2, 22000.00, 'Card',       'Success', 'TXN-100002'),
(3, 18000.00, 'NetBanking', 'Success', 'TXN-100003'),
(4, 25000.00, 'UPI',        'Success', 'TXN-100004');
