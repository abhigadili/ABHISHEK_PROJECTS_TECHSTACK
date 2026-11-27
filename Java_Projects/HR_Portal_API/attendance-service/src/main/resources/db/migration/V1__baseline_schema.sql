-- Baseline schema of hr_attendance_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
SET FOREIGN_KEY_CHECKS = 0;
CREATE TABLE `approved_leave_days` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `application_id` varchar(36) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `leave_date` date NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_leave_day` (`employee_id`,`leave_date`,`application_id`),
  KEY `idx_leave_day_employee` (`employee_id`,`leave_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `attendance_corrections` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `employee_name` varchar(200) DEFAULT NULL,
  `escalated` bit(1) NOT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `reason` varchar(500) NOT NULL,
  `requested_check_in` datetime(6) NOT NULL,
  `requested_check_out` datetime(6) NOT NULL,
  `review_comment` varchar(500) DEFAULT NULL,
  `reviewed_at` datetime(6) DEFAULT NULL,
  `reviewer_id` varchar(36) DEFAULT NULL,
  `status` enum('APPROVED','CANCELLED','PENDING','REJECTED') NOT NULL,
  `work_date` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_correction_employee` (`employee_id`,`work_date`),
  KEY `idx_correction_status` (`status`,`manager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `attendance_employees` (
  `employee_id` varchar(36) NOT NULL,
  `department_id` varchar(36) DEFAULT NULL,
  `full_name` varchar(200) DEFAULT NULL,
  `joining_date` date DEFAULT NULL,
  `location_id` varchar(36) DEFAULT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `status` varchar(15) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `attendance_records` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `check_in` datetime(6) DEFAULT NULL,
  `check_out` datetime(6) DEFAULT NULL,
  `early_departure_minutes` int NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `late_minutes` int NOT NULL,
  `overtime_minutes` int NOT NULL,
  `remarks` varchar(300) DEFAULT NULL,
  `shift_id` varchar(36) DEFAULT NULL,
  `source` enum('CORRECTION','IMPORT','SYSTEM','WEB') NOT NULL,
  `status` enum('ABSENT','HALF_DAY','MISSING_PUNCH','PRESENT') NOT NULL,
  `version` bigint NOT NULL,
  `work_date` date NOT NULL,
  `work_mode` enum('OFFICE','WFH') NOT NULL,
  `worked_minutes` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_attendance_employee_date` (`employee_id`,`work_date`),
  KEY `idx_attendance_date` (`work_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `audit_history` (
  `id` varchar(36) NOT NULL,
  `action` varchar(60) NOT NULL,
  `correlation_id` varchar(64) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `entity_id` varchar(64) NOT NULL,
  `entity_type` varchar(80) NOT NULL,
  `new_value` mediumtext,
  `previous_value` mediumtext,
  `user_id` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `holiday_snapshots` (
  `holiday_id` varchar(36) NOT NULL,
  `holiday_date` date NOT NULL,
  `location_id` varchar(36) DEFAULT NULL,
  `name` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`holiday_id`),
  KEY `idx_holiday_snapshot_date` (`holiday_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `monthly_attendance_summary` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `absent_days` int NOT NULL,
  `early_count` int NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `generated_at` datetime(6) NOT NULL,
  `half_days` int NOT NULL,
  `holidays` int NOT NULL,
  `late_count` int NOT NULL,
  `late_minutes` int NOT NULL,
  `leave_days` int NOT NULL,
  `missing_punches` int NOT NULL,
  `overtime_minutes` int NOT NULL,
  `present_days` int NOT NULL,
  `summary_month` int NOT NULL,
  `summary_year` int NOT NULL,
  `total_days` int NOT NULL,
  `weekly_offs` int NOT NULL,
  `wfh_days` int NOT NULL,
  `worked_minutes` int NOT NULL,
  `working_days` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_summary_employee_month` (`employee_id`,`summary_year`,`summary_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `outbox_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `attempts` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `event_key` varchar(100) DEFAULT NULL,
  `payload` mediumtext NOT NULL,
  `sent_at` datetime(6) DEFAULT NULL,
  `topic` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_outbox_unsent` (`sent_at`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `processed_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `consumer` varchar(120) NOT NULL,
  `event_id` varchar(64) NOT NULL,
  `processed_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_processed_event_consumer` (`event_id`,`consumer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `shift_assignments` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `shift_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_assignment_employee` (`employee_id`,`effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `shifts` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `code` varchar(20) NOT NULL,
  `is_default` bit(1) NOT NULL,
  `end_time` time(6) NOT NULL,
  `full_day_minutes` int NOT NULL,
  `grace_minutes` int NOT NULL,
  `half_day_minutes` int NOT NULL,
  `name` varchar(80) NOT NULL,
  `overtime_threshold_minutes` int NOT NULL,
  `standard_minutes` int NOT NULL,
  `start_time` time(6) NOT NULL,
  `weekly_offs` varchar(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shift_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `wfh_requests` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `employee_name` varchar(200) DEFAULT NULL,
  `from_date` date NOT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `reason` varchar(500) NOT NULL,
  `review_comment` varchar(500) DEFAULT NULL,
  `reviewed_at` datetime(6) DEFAULT NULL,
  `reviewer_id` varchar(36) DEFAULT NULL,
  `status` enum('APPROVED','CANCELLED','PENDING','REJECTED') NOT NULL,
  `to_date` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wfh_employee` (`employee_id`,`from_date`),
  KEY `idx_wfh_status` (`status`,`manager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS = 1;
