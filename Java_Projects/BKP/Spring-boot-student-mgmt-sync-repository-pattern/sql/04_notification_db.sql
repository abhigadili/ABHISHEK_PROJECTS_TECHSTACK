-- ============================================================
-- NotificationDB — owned exclusively by notification-service.
-- ============================================================
DROP DATABASE IF EXISTS NotificationDB;
CREATE DATABASE NotificationDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE NotificationDB;

CREATE TABLE Notifications (
    notification_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipient_id     BIGINT NOT NULL,          -- reference to StudentDB.Students.student_id
    recipient_type   VARCHAR(20) DEFAULT 'STUDENT',
    channel          VARCHAR(20) NOT NULL,     -- EMAIL or SMS
    subject          VARCHAR(150),
    message          TEXT NOT NULL,
    status           VARCHAR(20) DEFAULT 'PENDING',   -- PENDING, SENT, FAILED
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at          TIMESTAMP NULL
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

-- ---- sample data ----
INSERT INTO Notifications (recipient_id, recipient_type, channel, subject, message, status, sent_at) VALUES
(1, 'STUDENT', 'EMAIL', 'Enrollment Confirmed',  'Your enrollment in CS101 is confirmed.', 'SENT', '2025-07-20 10:05:00'),
(1, 'STUDENT', 'SMS',   NULL,                     'CS201 enrollment confirmed. Fee paid.',  'SENT', '2025-07-20 10:06:00'),
(2, 'STUDENT', 'EMAIL', 'Enrollment Confirmed',  'Your enrollment in DS101 is confirmed.', 'SENT', '2025-07-22 09:15:00'),
(3, 'STUDENT', 'EMAIL', 'Enrollment Pending',    'Your enrollment in DS201 is pending payment.', 'PENDING', NULL);

INSERT INTO Email_Logs (notification_id, to_email, subject, body, status, sent_at) VALUES
(1, 'aarav.sharma@example.com', 'Enrollment Confirmed', 'Your enrollment in CS101 is confirmed.', 'SENT', '2025-07-20 10:05:00'),
(3, 'diya.patel@example.com',   'Enrollment Confirmed', 'Your enrollment in DS101 is confirmed.', 'SENT', '2025-07-22 09:15:00'),
(4, 'kabir.singh@example.com',  'Enrollment Pending',   'Your enrollment in DS201 is pending payment.', 'PENDING', NULL);

INSERT INTO SMS_Logs (notification_id, to_phone, message, status, sent_at) VALUES
(2, '9876500001', 'CS201 enrollment confirmed. Fee paid.', 'SENT', '2025-07-20 10:06:00');
