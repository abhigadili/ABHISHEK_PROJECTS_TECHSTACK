-- ============================================================
-- NotificationDB — owned exclusively by notification-service.
--
-- `attempt_count` and `status` exist specifically to make the Retry +
-- Circuit Breaker combination on NotificationDispatchService observable in
-- the data, not just in logs: a row that needed 2 retries before succeeding
-- shows attempt_count=2/status=SENT; a row that exhausted every retry while
-- the simulated gateway was "down" shows status=FAILED.
-- ============================================================
DROP DATABASE IF EXISTS NotificationDB;
CREATE DATABASE NotificationDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE NotificationDB;

CREATE TABLE Notifications (
    notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id    BIGINT NOT NULL,   -- reference to EnrollmentDB.Enrollments.enrollment_id (no cross-DB FK)
    student_id       BIGINT NOT NULL,   -- reference to StudentDB.Students.student_id (no cross-DB FK)
    channel          ENUM('EMAIL','SMS') NOT NULL,
    message          VARCHAR(255) NOT NULL,
    status           ENUM('SENT','FAILED') NOT NULL,
    attempt_count    INT NOT NULL DEFAULT 1,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---- sample data ----
INSERT INTO Notifications (enrollment_id, student_id, channel, message, status, attempt_count) VALUES
(1, 1, 'EMAIL', 'Your enrollment in Data Structures & Algorithms is CONFIRMED.', 'SENT', 1),
(1, 1, 'SMS',   'Enrollment CONFIRMED: Data Structures & Algorithms.',           'SENT', 1),
(2, 1, 'EMAIL', 'Your enrollment in Spring Boot Microservices is CONFIRMED.',    'SENT', 2),
(3, 2, 'EMAIL', 'Your enrollment in Apache Kafka Essentials is CONFIRMED.',      'SENT', 1);
