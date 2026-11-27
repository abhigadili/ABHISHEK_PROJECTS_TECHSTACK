-- CourseDB: NEW application tables only. Pre-existing tables (Courses, Course_Category, ...) are not touched.
CREATE TABLE IF NOT EXISTS sms_course_categories (
    category_id BIGINT       NOT NULL AUTO_INCREMENT,
    name        VARCHAR(80)  NOT NULL,
    description VARCHAR(255) NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (category_id),
    UNIQUE KEY uk_sms_course_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sms_courses (
    course_id       BIGINT        NOT NULL AUTO_INCREMENT,
    course_name     VARCHAR(120)  NOT NULL,
    course_code     VARCHAR(20)   NOT NULL,
    description     TEXT          NULL,
    category_id     BIGINT        NULL,
    duration_weeks  INT           NOT NULL,
    fees            DECIMAL(10,2) NOT NULL,
    total_seats     INT           NOT NULL,
    available_seats INT           NOT NULL,
    status          VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE',
    version         BIGINT        NOT NULL DEFAULT 0,
    created_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (course_id),
    UNIQUE KEY uk_sms_courses_code (course_code),
    KEY idx_sms_courses_status (status),
    KEY idx_sms_courses_category (category_id),
    CONSTRAINT fk_sms_courses_category FOREIGN KEY (category_id) REFERENCES sms_course_categories (category_id),
    -- last line of defence against overselling: seats can never go negative or exceed capacity
    CONSTRAINT chk_sms_courses_seats CHECK (available_seats >= 0 AND available_seats <= total_seats)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per enrollment that ever reserved a seat: makes reserve/release idempotent per enrollmentId.
CREATE TABLE IF NOT EXISTS sms_seat_reservations (
    reservation_id BIGINT      NOT NULL AUTO_INCREMENT,
    enrollment_id  BIGINT      NOT NULL,   -- logical reference to EnrollmentDB (no cross-database FK)
    course_id      BIGINT      NOT NULL,
    status         VARCHAR(10) NOT NULL,
    created_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (reservation_id),
    UNIQUE KEY uk_sms_seat_res_enrollment (enrollment_id),
    KEY idx_sms_seat_res_course (course_id, status),
    CONSTRAINT fk_sms_seat_res_course FOREIGN KEY (course_id) REFERENCES sms_courses (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
