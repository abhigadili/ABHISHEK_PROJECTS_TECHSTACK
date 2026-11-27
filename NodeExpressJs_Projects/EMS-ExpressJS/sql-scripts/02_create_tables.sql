-- 02_create_tables.sql
-- Tables, primary keys, unique constraints and CHECK constraints.
-- Cross-table foreign keys and secondary indexes are added in 03 (several
-- tables reference each other circularly, e.g. employees <-> departments).
USE ems_expressjs;

CREATE TABLE IF NOT EXISTS roles (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(30)  NOT NULL,
  description VARCHAR(200) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS departments (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code             VARCHAR(20)  NOT NULL,
  name             VARCHAR(100) NOT NULL,
  description      VARCHAR(500) NULL,
  head_employee_id INT UNSIGNED NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_code (code),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teams (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id    INT UNSIGNED NOT NULL,
  name             VARCHAR(100) NOT NULL,
  description      VARCHAR(500) NULL,
  lead_employee_id INT UNSIGNED NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teams_department_name (department_id, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS designations (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  job_level   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_designations_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employees (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_code           VARCHAR(20)  NOT NULL,
  first_name              VARCHAR(60)  NOT NULL,
  middle_name             VARCHAR(60)  NULL,
  last_name               VARCHAR(60)  NOT NULL,
  work_email              VARCHAR(190) NOT NULL,
  personal_email          VARCHAR(190) NULL,
  phone                   VARCHAR(30)  NULL,
  date_of_birth           DATE         NULL,
  gender                  ENUM('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY') NULL,
  address_line            VARCHAR(255) NULL,
  city                    VARCHAR(100) NULL,
  state                   VARCHAR(100) NULL,
  country                 VARCHAR(100) NULL,
  postal_code             VARCHAR(20)  NULL,
  emergency_contact_name  VARCHAR(120) NULL,
  emergency_contact_phone VARCHAR(30)  NULL,
  emergency_contact_relation VARCHAR(50) NULL,
  joining_date            DATE         NOT NULL,
  probation_end_date      DATE         NULL,
  exit_date               DATE         NULL,
  status                  ENUM('ACTIVE','INACTIVE','TERMINATED') NOT NULL DEFAULT 'ACTIVE',
  employment_type         ENUM('FULL_TIME','PART_TIME','CONTRACT','INTERN') NOT NULL DEFAULT 'FULL_TIME',
  designation_id          INT UNSIGNED NULL,
  job_title               VARCHAR(120) NULL,
  department_id           INT UNSIGNED NULL,
  team_id                 INT UNSIGNED NULL,
  manager_id              INT UNSIGNED NULL,
  work_location           VARCHAR(100) NOT NULL DEFAULT 'HQ',
  salary                  DECIMAL(12,2) NULL,
  salary_currency         CHAR(3)      NULL,
  bonus_target            DECIMAL(12,2) NULL,
  created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_code (employee_code),
  UNIQUE KEY uq_employees_work_email (work_email),
  CONSTRAINT chk_employees_salary CHECK (salary IS NULL OR salary >= 0)
) ENGINE=InnoDB;

-- Profile pictures live in their own table so LONGBLOBs never bloat employee scans.
CREATE TABLE IF NOT EXISTS employee_profile_pictures (
  employee_id INT UNSIGNED NOT NULL,
  mime_type   VARCHAR(50)  NOT NULL,
  size_bytes  INT UNSIGNED NOT NULL,
  data        LONGBLOB     NOT NULL,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id)
) ENGINE=InnoDB;

-- A login account. employee_id is optional (service accounts) but unique when set.
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id    INT UNSIGNED NULL,
  username       VARCHAR(30)  NULL,
  email          VARCHAR(190) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  role_id        TINYINT UNSIGNED NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at  DATETIME     NULL,
  password_changed_at DATETIME NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_employee (employee_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  token_hash   CHAR(64)     NOT NULL,
  family_id    CHAR(36)     NOT NULL,
  expires_at   DATETIME     NOT NULL,
  revoked_at   DATETIME     NULL,
  replaced_by  BIGINT UNSIGNED NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_tokens_hash (token_hash)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  CHAR(64)     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used_at     DATETIME     NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_reset_hash (token_hash)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS job_history (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id         INT UNSIGNED NOT NULL,
  change_type         ENUM('JOINED','PROMOTION','TRANSFER','MANAGER_CHANGE','JOB_CHANGE','STATUS_CHANGE','PROBATION') NOT NULL,
  effective_date      DATE         NOT NULL,
  from_designation_id INT UNSIGNED NULL,
  to_designation_id   INT UNSIGNED NULL,
  from_department_id  INT UNSIGNED NULL,
  to_department_id    INT UNSIGNED NULL,
  from_manager_id     INT UNSIGNED NULL,
  to_manager_id       INT UNSIGNED NULL,
  from_job_title      VARCHAR(120) NULL,
  to_job_title        VARCHAR(120) NULL,
  notes               VARCHAR(500) NULL,
  created_by          INT UNSIGNED NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id       INT UNSIGNED NOT NULL,
  work_date         DATE         NOT NULL,
  check_in_at       DATETIME     NULL COMMENT 'UTC',
  check_out_at      DATETIME     NULL COMMENT 'UTC',
  working_hours     DECIMAL(5,2) NULL,
  status            ENUM('PRESENT','ABSENT','HALF_DAY','ON_LEAVE','HOLIDAY','WEEKLY_OFF') NOT NULL DEFAULT 'PRESENT',
  work_mode         ENUM('OFFICE','REMOTE','HYBRID') NOT NULL DEFAULT 'OFFICE',
  remarks           VARCHAR(500) NULL,
  corrected_by      INT UNSIGNED NULL,
  corrected_at      DATETIME     NULL,
  correction_reason VARCHAR(500) NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_employee_date (employee_id, work_date),
  CONSTRAINT chk_attendance_order CHECK (check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leave_types (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code              VARCHAR(20)  NOT NULL,
  name              VARCHAR(80)  NOT NULL,
  description       VARCHAR(300) NULL,
  is_paid           TINYINT(1)   NOT NULL DEFAULT 1,
  requires_document TINYINT(1)   NOT NULL DEFAULT 0,
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_types_code (code),
  UNIQUE KEY uq_leave_types_name (name)
) ENGINE=InnoDB;

-- One policy per leave type. Unpaid leave has no policy: it is not balance-limited.
CREATE TABLE IF NOT EXISTS leave_policies (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  leave_type_id       INT UNSIGNED NOT NULL,
  annual_entitlement  DECIMAL(5,1) NOT NULL,
  carry_forward_max   DECIMAL(5,1) NOT NULL DEFAULT 0,
  allow_half_day      TINYINT(1)   NOT NULL DEFAULT 1,
  max_consecutive_days SMALLINT UNSIGNED NULL,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_policies_type (leave_type_id),
  CONSTRAINT chk_leave_policies_entitlement CHECK (annual_entitlement >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leave_balances (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id   INT UNSIGNED NOT NULL,
  leave_type_id INT UNSIGNED NOT NULL,
  year          SMALLINT UNSIGNED NOT NULL,
  entitled      DECIMAL(6,1) NOT NULL DEFAULT 0,
  adjusted      DECIMAL(6,1) NOT NULL DEFAULT 0,
  used          DECIMAL(6,1) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_balances (employee_id, leave_type_id, year),
  CONSTRAINT chk_leave_balances_available CHECK (entitled + adjusted - used >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leave_requests (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id    INT UNSIGNED NOT NULL,
  leave_type_id  INT UNSIGNED NOT NULL,
  start_date     DATE         NOT NULL,
  end_date       DATE         NOT NULL,
  day_part       ENUM('FULL_DAY','FIRST_HALF','SECOND_HALF') NOT NULL DEFAULT 'FULL_DAY',
  days           DECIMAL(5,1) NOT NULL,
  reason         VARCHAR(1000) NOT NULL,
  status         ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  decided_by     INT UNSIGNED NULL COMMENT 'employee id of approver/rejector',
  decided_at     DATETIME     NULL,
  decision_note  VARCHAR(500) NULL,
  cancelled_at   DATETIME     NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_leave_requests_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_leave_requests_days CHECK (days > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leave_request_documents (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  leave_request_id BIGINT UNSIGNED NOT NULL,
  file_name        VARCHAR(255) NOT NULL,
  mime_type        VARCHAR(100) NOT NULL,
  size_bytes       INT UNSIGNED NOT NULL,
  data             LONGBLOB     NOT NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Ledger of every balance movement. The unique key (request, type) is what makes
-- approval/cancellation idempotent: a retried or concurrent deduction cannot insert twice.
CREATE TABLE IF NOT EXISTS leave_balance_transactions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  leave_balance_id BIGINT UNSIGNED NOT NULL,
  leave_request_id BIGINT UNSIGNED NULL,
  type             ENUM('ENTITLEMENT','DEDUCTION','REFUND','ADJUSTMENT') NOT NULL,
  amount           DECIMAL(6,1) NOT NULL COMMENT 'positive = adds to available, negative = removes',
  note             VARCHAR(300) NULL,
  created_by       INT UNSIGNED NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lbt_request_type (leave_request_id, type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS holidays (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  holiday_date DATE         NOT NULL,
  name         VARCHAR(120) NOT NULL,
  location     VARCHAR(100) NOT NULL DEFAULT 'ALL' COMMENT 'ALL or a work_location value',
  is_optional  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_holidays_date_location (holiday_date, location)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS weekly_offs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  location    VARCHAR(100) NOT NULL DEFAULT 'ALL',
  day_of_week TINYINT UNSIGNED NOT NULL COMMENT '0=Sunday .. 6=Saturday',
  PRIMARY KEY (id),
  UNIQUE KEY uq_weekly_offs (location, day_of_week),
  CONSTRAINT chk_weekly_offs_dow CHECK (day_of_week BETWEEN 0 AND 6)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  type       VARCHAR(40)  NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    VARCHAR(500) NOT NULL,
  ref_type   VARCHAR(40)  NULL,
  ref_id     BIGINT UNSIGNED NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  read_at    DATETIME     NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(60)  NOT NULL,
  entity_type VARCHAR(40)  NOT NULL,
  entity_id   VARCHAR(40)  NULL,
  details     JSON         NULL,
  ip_address  VARCHAR(45)  NULL,
  request_id  VARCHAR(40)  NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;
