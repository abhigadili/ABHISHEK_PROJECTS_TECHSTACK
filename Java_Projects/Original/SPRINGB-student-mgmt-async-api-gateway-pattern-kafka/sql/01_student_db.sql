-- ============================================================
-- StudentDB — owned exclusively by student-service.
-- No other microservice is allowed to connect to this schema directly;
-- everyone else reaches this data through student-service's REST API
-- (via the API Gateway), or (for the enrollment saga) through the Kafka
-- events student-service publishes in response to `enrollment.requested`.
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
    date_of_birth   DATE,
    gender          ENUM('Male','Female','Other') DEFAULT 'Other',
    enrollment_date DATE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Student_Address (
    address_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id      BIGINT NOT NULL,
    address_type    ENUM('Permanent','Current') DEFAULT 'Current',
    address_line1   VARCHAR(150),
    address_line2   VARCHAR(150),
    city            VARCHAR(50),
    state           VARCHAR(50),
    postal_code     VARCHAR(20),
    country         VARCHAR(50),
    CONSTRAINT fk_address_student FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Student_Documents (
    document_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id      BIGINT NOT NULL,
    document_type   VARCHAR(50) NOT NULL,
    document_number VARCHAR(100),
    file_path       VARCHAR(255),
    uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_document_student FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Student_Login (
    login_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id      BIGINT NOT NULL UNIQUE,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMP NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_login_student FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- sample data ----
INSERT INTO Students (first_name, last_name, email, phone, date_of_birth, gender, enrollment_date) VALUES
('Aarav', 'Sharma',  'aarav.sharma@example.com',  '9876500001', '2002-05-14', 'Male',   '2024-06-01'),
('Diya',  'Patel',   'diya.patel@example.com',    '9876500002', '2003-01-22', 'Female', '2024-06-01'),
('Kabir', 'Singh',   'kabir.singh@example.com',   '9876500003', '2001-11-09', 'Male',   '2024-06-15'),
('Ananya','Rao',     'ananya.rao@example.com',    '9876500004', '2002-08-30', 'Female', '2024-07-01'),
('Vihaan','Iyer',    'vihaan.iyer@example.com',   '9876500005', '2003-03-17', 'Male',   '2024-07-01');

INSERT INTO Student_Address (student_id, address_type, address_line1, city, state, postal_code, country) VALUES
(1, 'Permanent', '12 MG Road',        'Bengaluru', 'Karnataka',    '560001', 'India'),
(2, 'Permanent', '45 Park Street',    'Kolkata',   'West Bengal',  '700016', 'India'),
(3, 'Current',   '78 Anna Salai',     'Chennai',   'Tamil Nadu',   '600002', 'India'),
(4, 'Permanent', '23 Sector 15',      'Gurugram',  'Haryana',      '122001', 'India'),
(5, 'Current',   '9 FC Road',         'Pune',      'Maharashtra',  '411004', 'India');

INSERT INTO Student_Documents (student_id, document_type, document_number, file_path) VALUES
(1, 'Aadhar',    '1234-5678-9012', '/docs/1/aadhar.pdf'),
(2, 'Passport',  'P1234567',       '/docs/2/passport.pdf'),
(3, 'Aadhar',    '2345-6789-0123', '/docs/3/aadhar.pdf'),
(4, 'MarkSheet', 'MS-2024-004',    '/docs/4/marksheet.pdf'),
(5, 'Aadhar',    '3456-7890-1234', '/docs/5/aadhar.pdf');

INSERT INTO Student_Login (student_id, username, password_hash, is_active) VALUES
(1, 'aarav.sharma',  'hash_9f2b1c0a', TRUE),
(2, 'diya.patel',    'hash_7e4d3f2b', TRUE),
(3, 'kabir.singh',   'hash_5c1a9b8e', TRUE),
(4, 'ananya.rao',    'hash_3d8e7f6c', TRUE),
(5, 'vihaan.iyer',   'hash_1a2b3c4d', FALSE);
