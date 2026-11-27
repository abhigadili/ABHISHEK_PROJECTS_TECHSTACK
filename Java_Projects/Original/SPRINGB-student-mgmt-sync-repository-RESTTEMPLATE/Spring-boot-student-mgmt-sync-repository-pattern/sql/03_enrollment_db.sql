-- ============================================================
-- EnrollmentDB — owned exclusively by enrollment-service.
--
-- IMPORTANT: student_id and course_id below are references to rows that live
-- in StudentDB and CourseDB respectively — separate schemas owned by other
-- microservices. There is deliberately NO foreign key across those schemas
-- (MySQL can't enforce one anyway, and "database per service" means
-- enrollment-service must never reach into another service's tables).
-- Referential integrity for those two columns is enforced at the application
-- layer instead, via synchronous REST calls to student-service and
-- course-service before an Enrollment row is inserted. See EnrollmentService.
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
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_enrollment_status FOREIGN KEY (status_id) REFERENCES Enrollment_Status(status_id)
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
('Pending',   'Enrollment created, payment not yet confirmed'),
('Active',    'Enrollment confirmed and in progress'),
('Completed', 'Course finished successfully'),
('Cancelled', 'Enrollment cancelled by student or admin');

-- student_id / course_id values below line up with the sample rows inserted
-- by 01_student_db.sql and 02_course_db.sql.
INSERT INTO Enrollments (student_id, course_id, status_id, enrollment_date) VALUES
(1, 1, 2, '2025-07-20'),
(1, 2, 2, '2025-07-20'),
(2, 3, 2, '2025-07-22'),
(3, 4, 1, '2025-07-25'),
(4, 5, 3, '2025-06-15');

INSERT INTO Payments (enrollment_id, amount, payment_method, payment_status, transaction_ref) VALUES
(1, 15000.00, 'UPI',        'Success', 'TXN-100001'),
(2, 22000.00, 'Card',       'Success', 'TXN-100002'),
(3, 18000.00, 'NetBanking', 'Success', 'TXN-100003'),
(4, 25000.00, 'UPI',        'Pending', 'TXN-100004'),
(5, 12000.00, 'Card',       'Success', 'TXN-100005');
