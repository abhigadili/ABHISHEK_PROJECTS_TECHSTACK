-- ============================================================
-- CourseDB — owned exclusively by course-service.
-- ============================================================
DROP DATABASE IF EXISTS CourseDB;
CREATE DATABASE CourseDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE CourseDB;

CREATE TABLE Courses (
    course_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_name     VARCHAR(100) NOT NULL,
    description     VARCHAR(255),
    credits         INT NOT NULL,
    duration_weeks  INT NOT NULL,
    fee             DECIMAL(10,2) NOT NULL,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---- sample data ----
INSERT INTO Courses (course_name, description, credits, duration_weeks, fee, active) VALUES
('Data Structures & Algorithms', 'Core CS fundamentals: arrays, trees, graphs, sorting', 4, 12, 15000.00, TRUE),
('Spring Boot Microservices',    'Building production microservices with Spring Boot', 4, 10, 22000.00, TRUE),
('Apache Kafka Essentials',      'Event-driven architecture and asynchronous messaging', 3, 8,  18000.00, TRUE),
('Database Systems',             'Relational modelling, SQL, transactions, indexing',   3, 10, 12000.00, TRUE),
('Distributed Systems Patterns', 'Circuit Breaker, Retry, Saga, CQRS, and friends',     3, 6,  25000.00, TRUE);
