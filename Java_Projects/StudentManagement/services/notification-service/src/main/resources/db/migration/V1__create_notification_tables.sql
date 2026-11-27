-- NotificationDB: NEW application tables only. Pre-existing tables (Notifications, Email_Logs, SMS_Logs) are not touched.
CREATE TABLE IF NOT EXISTS sms_notifications (
    notification_id   BIGINT       NOT NULL AUTO_INCREMENT,
    student_id        BIGINT       NULL,       -- logical reference to StudentDB (no cross-database FK)
    enrollment_id     BIGINT       NULL,       -- logical reference to EnrollmentDB
    notification_type VARCHAR(30)  NOT NULL,
    recipient_email   VARCHAR(100) NULL,
    message           TEXT         NOT NULL,
    status            VARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    retry_count       INT          NOT NULL DEFAULT 0,
    next_attempt_at   DATETIME(6)  NULL,
    last_error        VARCHAR(500) NULL,
    version           BIGINT       NOT NULL DEFAULT 0,
    created_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    processed_at      DATETIME(6)  NULL,
    PRIMARY KEY (notification_id),
    -- duplicate-notification guard: one notification per (enrollment, type); NULL enrollment ids are not constrained
    UNIQUE KEY uk_sms_notifications_enrollment_type (enrollment_id, notification_type),
    KEY idx_sms_notifications_due (status, next_attempt_at),
    KEY idx_sms_notifications_student (student_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inbox / processed-message table: one row per consumed event id -> duplicate Kafka deliveries are ignored.
CREATE TABLE IF NOT EXISTS sms_inbox_messages (
    inbox_id       BIGINT       NOT NULL AUTO_INCREMENT,
    message_id     VARCHAR(64)  NOT NULL,
    topic          VARCHAR(100) NOT NULL,
    consumer_group VARCHAR(100) NOT NULL,
    received_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (inbox_id),
    UNIQUE KEY uk_sms_inbox_message (message_id, consumer_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
