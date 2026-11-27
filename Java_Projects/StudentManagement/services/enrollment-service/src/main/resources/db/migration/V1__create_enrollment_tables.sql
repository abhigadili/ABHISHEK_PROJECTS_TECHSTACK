-- EnrollmentDB: NEW application tables only. Pre-existing tables (Enrollments, Payments, ...) are not touched.
-- student_id / course_id are LOGICAL references to other services' databases: no cross-database foreign keys.
CREATE TABLE IF NOT EXISTS sms_enrollments (
    enrollment_id   BIGINT       NOT NULL AUTO_INCREMENT,
    student_id      BIGINT       NOT NULL,
    course_id       BIGINT       NOT NULL,
    student_name    VARCHAR(120) NULL,    -- snapshots taken at enrollment time (used in events)
    student_email   VARCHAR(100) NULL,
    course_name     VARCHAR(120) NULL,
    enrollment_date DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    status          VARCHAR(10)  NOT NULL,
    idempotency_key VARCHAR(64)  NOT NULL,
    remarks         VARCHAR(500) NULL,
    -- duplicate-enrollment guard: only PENDING/CONFIRMED rows get a key; the UNIQUE index ignores NULLs
    active_key      VARCHAR(45)  GENERATED ALWAYS AS (CASE WHEN status IN ('PENDING','CONFIRMED') THEN CONCAT(student_id, '-', course_id) ELSE NULL END) STORED,
    version         BIGINT       NOT NULL DEFAULT 0,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (enrollment_id),
    UNIQUE KEY uk_sms_enrollments_idem (idempotency_key),
    UNIQUE KEY uk_sms_enrollments_active (active_key),
    KEY idx_sms_enrollments_student (student_id, created_at),
    KEY idx_sms_enrollments_course (course_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Persistent state of the orchestration saga (one row per enrollment request) -> recoverable after restarts.
CREATE TABLE IF NOT EXISTS sms_saga_instances (
    saga_id         BIGINT       NOT NULL AUTO_INCREMENT,
    idempotency_key VARCHAR(64)  NOT NULL,
    student_id      BIGINT       NOT NULL,
    course_id       BIGINT       NOT NULL,
    enrollment_id   BIGINT       NULL,
    state           VARCHAR(20)  NOT NULL,
    seat_reserved   TINYINT(1)   NOT NULL DEFAULT 0,
    failure_reason  VARCHAR(500) NULL,
    student_name    VARCHAR(120) NULL,
    student_email   VARCHAR(100) NULL,
    course_name     VARCHAR(120) NULL,
    correlation_id  VARCHAR(64)  NULL,
    attempts        INT          NOT NULL DEFAULT 0,
    version         BIGINT       NOT NULL DEFAULT 0,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (saga_id),
    UNIQUE KEY uk_sms_saga_idem (idempotency_key),
    KEY idx_sms_saga_state (state, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactional outbox: written in the same local transaction as the business change, published to Kafka by a poller.
CREATE TABLE IF NOT EXISTS sms_outbox_events (
    outbox_id       BIGINT       NOT NULL AUTO_INCREMENT,
    event_id        CHAR(36)     NOT NULL,
    aggregate_id    BIGINT       NOT NULL,
    event_type      VARCHAR(40)  NOT NULL,
    topic           VARCHAR(100) NOT NULL,
    event_key       VARCHAR(64)  NOT NULL,
    payload         LONGTEXT     NOT NULL,
    status          VARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    attempts        INT          NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_error      VARCHAR(500) NULL,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    published_at    DATETIME(6)  NULL,
    PRIMARY KEY (outbox_id),
    UNIQUE KEY uk_sms_outbox_event_id (event_id),
    KEY idx_sms_outbox_pending (status, next_attempt_at, outbox_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
