-- ============================================================
-- StudentDB — owned exclusively by student-service.
-- No other microservice connects to this schema directly; everyone else
-- reaches this data through student-service's REST API (via the gateway),
-- or — for the enrollment saga — through the Kafka events student-service
-- publishes in response to `enrollment.requested`.
-- ============================================================
DROP DATABASE IF EXISTS StudentDB;
CREATE DATABASE StudentDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE StudentDB;

CREATE TABLE Students (
    student_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(50)  NOT NULL,
    last_name       VARCHAR(50)  NOT NULL,
    email           VARCHAR(100) NOT NULL UNIQUE,
    phone           VARCHAR(20),
    enrollment_date DATE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- `role` drives AUTHORIZATION at the gateway (see gateway's AuthorizationPolicy):
-- STUDENT can read everything and create enrollments for themselves; only
-- ADMIN may create/update/delete Students or Courses. This is a plain-text
-- password comparison for teaching clarity, exactly like the sibling
-- centralized-auth project — a real system must hash+salt this column and
-- compare with the same hashing scheme, never store or compare plain text.
CREATE TABLE Student_Login (
    login_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id      BIGINT NOT NULL UNIQUE,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('STUDENT','ADMIN') NOT NULL DEFAULT 'STUDENT',
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMP NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_login_student FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- sample data ----
INSERT INTO Students (first_name, last_name, email, phone, enrollment_date) VALUES
('Aarav',  'Sharma', 'aarav.sharma@example.com',  '9876500001', '2024-06-01'),
('Diya',   'Patel',  'diya.patel@example.com',    '9876500002', '2024-06-01'),
('Kabir',  'Singh',  'kabir.singh@example.com',   '9876500003', '2024-06-15'),
('Ananya', 'Rao',    'ananya.rao@example.com',    '9876500004', '2024-07-01'),
('Vihaan', 'Iyer',   'vihaan.iyer@example.com',   '9876500005', '2024-07-01');

-- 'admin' has no matching Students row on purpose — an ADMIN login is an
-- operator account, not a student — so student_id points at a harmless
-- placeholder row created just for this constraint (see below).
INSERT INTO Students (first_name, last_name, email, phone, enrollment_date) VALUES
('System', 'Admin', 'admin@example.com', NULL, NULL);

INSERT INTO Student_Login (student_id, username, password_hash, role, is_active) VALUES
(1, 'aarav.sharma', 'password123', 'STUDENT', TRUE),
(2, 'diya.patel',   'password123', 'STUDENT', TRUE),
(3, 'kabir.singh',  'password123', 'STUDENT', TRUE),
(4, 'ananya.rao',   'password123', 'STUDENT', TRUE),
(5, 'vihaan.iyer',  'password123', 'STUDENT', FALSE),
(6, 'admin',        'admin123',    'ADMIN',   TRUE);
