-- ============================================================
-- NotificationDB — owned exclusively by notification-service.
--
-- CQRS: `Notifications` is the WRITE table (populated either by the internal
-- Kafka listener reacting to enrollment.confirmed/rejected, or by a manual
-- POST /api/notifications). `Notifications_View` is the READ table — a plain
-- mirror here, since there's no obvious denormalization target within this
-- one service (not every aggregate needs reshaping; this one just
-- demonstrates the mechanism).
-- ============================================================
DROP DATABASE IF EXISTS NotificationDB;
CREATE DATABASE NotificationDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE NotificationDB;

CREATE TABLE Notifications (
    notification_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id    BIGINT NULL,              -- reference to EnrollmentDB.Enrollments.enrollment_id
    recipient_id     BIGINT NOT NULL,          -- reference to StudentDB.Students.student_id
    recipient_type   VARCHAR(20) DEFAULT 'STUDENT',
    event_type       VARCHAR(30),              -- ENROLLMENT_CONFIRMED, ENROLLMENT_REJECTED
    channel          VARCHAR(20) NOT NULL,     -- EMAIL or SMS
    subject          VARCHAR(150),
    message          TEXT NOT NULL,
    status           VARCHAR(20) DEFAULT 'PENDING',   -- PENDING, SENT, FAILED
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at          TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE Notifications_View (
    notification_id  BIGINT PRIMARY KEY,
    enrollment_id    BIGINT NULL,
    recipient_id     BIGINT NOT NULL,
    recipient_type   VARCHAR(20),
    event_type       VARCHAR(30),
    channel          VARCHAR(20) NOT NULL,
    subject          VARCHAR(150),
    message          TEXT NOT NULL,
    status           VARCHAR(20),
    sent_at          TIMESTAMP NULL,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Email_Logs (
    email_log_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    notification_id  BIGINT NOT NULL,
    to_email         VARCHAR(150) NOT NULL,
    subject          VARCHAR(150),
    body             TEXT,
    status           VARCHAR(20) DEFAULT 'PENDING',
    sent_at          TIMESTAMP NULL,
    error_message    VARCHAR(255),
    CONSTRAINT fk_emaillog_notification FOREIGN KEY (notification_id) REFERENCES Notifications(notification_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE SMS_Logs (
    sms_log_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    notification_id  BIGINT NOT NULL,
    to_phone         VARCHAR(20) NOT NULL,
    message          VARCHAR(255),
    status           VARCHAR(20) DEFAULT 'PENDING',
    sent_at          TIMESTAMP NULL,
    error_message    VARCHAR(255),
    CONSTRAINT fk_smslog_notification FOREIGN KEY (notification_id) REFERENCES Notifications(notification_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- sample data (lines up with the seeded CONFIRMED enrollments in 03_enrollment_db.sql) ----
INSERT INTO Notifications (enrollment_id, recipient_id, recipient_type, event_type, channel, subject, message, status, sent_at) VALUES
(1, 1, 'STUDENT', 'ENROLLMENT_CONFIRMED', 'EMAIL', 'Enrollment Confirmed',  'Your enrollment in CS101 is confirmed.', 'SENT', '2025-07-20 10:05:00'),
(2, 1, 'STUDENT', 'ENROLLMENT_CONFIRMED', 'SMS',   NULL,                     'CS201 enrollment confirmed. Fee paid.',  'SENT', '2025-07-20 10:06:00'),
(3, 2, 'STUDENT', 'ENROLLMENT_CONFIRMED', 'EMAIL', 'Enrollment Confirmed',  'Your enrollment in DS101 is confirmed.', 'SENT', '2025-07-22 09:15:00');

INSERT INTO Notifications_View (notification_id, enrollment_id, recipient_id, recipient_type, event_type, channel, subject, message, status, sent_at) VALUES
(1, 1, 1, 'STUDENT', 'ENROLLMENT_CONFIRMED', 'EMAIL', 'Enrollment Confirmed',  'Your enrollment in CS101 is confirmed.', 'SENT', '2025-07-20 10:05:00'),
(2, 2, 1, 'STUDENT', 'ENROLLMENT_CONFIRMED', 'SMS',   NULL,                     'CS201 enrollment confirmed. Fee paid.',  'SENT', '2025-07-20 10:06:00'),
(3, 3, 2, 'STUDENT', 'ENROLLMENT_CONFIRMED', 'EMAIL', 'Enrollment Confirmed',  'Your enrollment in DS101 is confirmed.', 'SENT', '2025-07-22 09:15:00');

INSERT INTO Email_Logs (notification_id, to_email, subject, body, status, sent_at) VALUES
(1, 'aarav.sharma@example.com', 'Enrollment Confirmed', 'Your enrollment in CS101 is confirmed.', 'SENT', '2025-07-20 10:05:00'),
(3, 'diya.patel@example.com',   'Enrollment Confirmed', 'Your enrollment in DS101 is confirmed.', 'SENT', '2025-07-22 09:15:00');

INSERT INTO SMS_Logs (notification_id, to_phone, message, status, sent_at) VALUES
(2, '9876500001', 'CS201 enrollment confirmed. Fee paid.', 'SENT', '2025-07-20 10:06:00');
