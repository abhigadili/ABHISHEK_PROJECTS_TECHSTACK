-- StudentDB: NEW application tables only. Pre-existing tables (Students, Student_Address, ...) are not touched.
CREATE TABLE IF NOT EXISTS sms_students (
    student_id      BIGINT       NOT NULL AUTO_INCREMENT,
    first_name      VARCHAR(50)  NOT NULL,
    last_name       VARCHAR(50)  NOT NULL,
    email           VARCHAR(100) NOT NULL,
    phone_number    VARCHAR(20)  NULL,
    date_of_birth   DATE         NULL,
    gender          VARCHAR(10)  NULL,
    address         VARCHAR(255) NULL,
    enrollment_date DATE         NULL,
    status          VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (student_id),
    UNIQUE KEY uk_sms_students_email (email),
    KEY idx_sms_students_status (status),
    KEY idx_sms_students_name (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sms_users (
    user_id       BIGINT       NOT NULL AUTO_INCREMENT,
    username      VARCHAR(50)  NOT NULL,
    email         VARCHAR(100) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(10)  NOT NULL,
    student_id    BIGINT       NULL,
    enabled       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id),
    UNIQUE KEY uk_sms_users_username (username),
    UNIQUE KEY uk_sms_users_email (email),
    KEY idx_sms_users_student (student_id),
    CONSTRAINT fk_sms_users_student FOREIGN KEY (student_id) REFERENCES sms_students (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sms_refresh_tokens (
    token_id   BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    token_hash CHAR(64)    NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked    TINYINT(1)  NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (token_id),
    UNIQUE KEY uk_sms_refresh_token_hash (token_hash),
    KEY idx_sms_refresh_user (user_id),
    CONSTRAINT fk_sms_refresh_user FOREIGN KEY (user_id) REFERENCES sms_users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
