-- Baseline schema of hr_exit_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
SET FOREIGN_KEY_CHECKS = 0;
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
CREATE TABLE `exit_history` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `comment` varchar(500) DEFAULT NULL,
  `from_status` varchar(20) DEFAULT NULL,
  `resignation_id` varchar(36) NOT NULL,
  `to_status` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_exit_history` (`resignation_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `exit_interview_forms` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `name` varchar(120) NOT NULL,
  `questions` json NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `exit_interviews` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `answers` json DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `conducted_by` varchar(100) DEFAULT NULL,
  `feedback_summary` varchar(2000) DEFAULT NULL,
  `form_id` varchar(36) NOT NULL,
  `resignation_id` varchar(36) NOT NULL,
  `scheduled_at` datetime(6) DEFAULT NULL,
  `status` enum('COMPLETED','SCHEDULED') NOT NULL,
  `would_recommend` bit(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_interview_resignation` (`resignation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `exit_policy` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `default_notice_days` int NOT NULL,
  `max_waiver_days` int NOT NULL,
  `salary_days_per_month` int NOT NULL,
  `withdrawal_after_confirmation` bit(1) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `exit_tasks` (
  `task_type` varchar(12) NOT NULL,
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `completed_by` varchar(100) DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `remarks` varchar(500) DEFAULT NULL,
  `resignation_id` varchar(36) NOT NULL,
  `status` enum('DONE','PENDING') NOT NULL,
  `title` varchar(200) NOT NULL,
  `revoked_on` date DEFAULT NULL,
  `system_name` varchar(80) DEFAULT NULL,
  `asset_condition` varchar(40) DEFAULT NULL,
  `asset_tag` varchar(60) DEFAULT NULL,
  `returned_on` date DEFAULT NULL,
  `department` varchar(20) DEFAULT NULL,
  `kt_topic` varchar(200) DEFAULT NULL,
  `kt_transferee_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_task_resignation` (`resignation_id`,`status`)
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
CREATE TABLE `resignations` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `confirmed_last_working_day` date DEFAULT NULL,
  `department_id` varchar(36) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `employee_name` varchar(200) DEFAULT NULL,
  `hr_comment` varchar(500) DEFAULT NULL,
  `joining_date` date DEFAULT NULL,
  `manager_comment` varchar(500) DEFAULT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `notice_period_days` int NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `requested_last_working_day` date NOT NULL,
  `status` enum('CLEARED','COMPLETED','HR_CONFIRMED','INTERVIEW_DONE','MANAGER_APPROVED','MANAGER_REJECTED','SETTLEMENT_PENDING','SUBMITTED','WITHDRAWN') NOT NULL,
  `submitted_on` date NOT NULL,
  `version` bigint NOT NULL,
  `waiver_days` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_resignation_employee` (`employee_id`,`status`),
  KEY `idx_resignation_manager` (`manager_id`,`status`),
  KEY `idx_resignation_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `settlement_lines` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `code` varchar(40) NOT NULL,
  `description` varchar(200) NOT NULL,
  `settlement_id` varchar(36) NOT NULL,
  `type` enum('DEDUCTION','EARNING') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sline_settlement` (`settlement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `settlements` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `calculated_by` varchar(100) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `gross_payable` decimal(14,2) NOT NULL,
  `net_payable` decimal(14,2) NOT NULL,
  `paid_at` datetime(6) DEFAULT NULL,
  `payment_reference` varchar(80) DEFAULT NULL,
  `processed_by` varchar(100) DEFAULT NULL,
  `recoveries` decimal(14,2) NOT NULL,
  `resignation_id` varchar(36) NOT NULL,
  `status` enum('CALCULATED','PAID') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_settlement_resignation` (`resignation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS = 1;
