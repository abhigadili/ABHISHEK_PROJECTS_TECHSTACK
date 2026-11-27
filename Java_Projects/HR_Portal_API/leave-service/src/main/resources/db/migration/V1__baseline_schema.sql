-- Baseline schema of hr_leave_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
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
CREATE TABLE `leave_applications` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `applied_at` datetime(6) NOT NULL,
  `cancel_reason` varchar(300) DEFAULT NULL,
  `cancel_requested` bit(1) NOT NULL,
  `days` decimal(5,1) NOT NULL,
  `decided_at` datetime(6) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `employee_name` varchar(200) DEFAULT NULL,
  `from_date` date NOT NULL,
  `half_day_end` bit(1) NOT NULL,
  `half_day_start` bit(1) NOT NULL,
  `leave_type_id` varchar(36) NOT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `stage` enum('COMPLETE','HR','MANAGER') NOT NULL,
  `status` enum('APPROVED','CANCELLED','PENDING','REJECTED','WITHDRAWN') NOT NULL,
  `to_date` date NOT NULL,
  `version` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_leave_employee_dates` (`employee_id`,`from_date`,`to_date`),
  KEY `idx_leave_manager_status` (`manager_id`,`status`,`stage`),
  KEY `idx_leave_status_stage` (`status`,`stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_approvals` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `action` enum('CANCEL_APPROVED','CANCEL_REJECTED','CANCEL_REQUESTED','HR_APPROVED','MANAGER_APPROVED','REJECTED','SUBMITTED','UPDATED','WITHDRAWN') NOT NULL,
  `actor_id` varchar(36) DEFAULT NULL,
  `application_id` varchar(36) NOT NULL,
  `comment` varchar(500) DEFAULT NULL,
  `stage` enum('COMPLETE','HR','MANAGER') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_approval_application` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_attachments` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `application_id` varchar(36) NOT NULL,
  `document_id` varchar(36) NOT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_attachment_application` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_balance_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `balance_year` int NOT NULL,
  `changed_at` datetime(6) NOT NULL,
  `changed_by` varchar(100) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `leave_type_id` varchar(36) NOT NULL,
  `new_accrued` decimal(6,2) DEFAULT NULL,
  `new_carried` decimal(6,2) DEFAULT NULL,
  `new_encashed` decimal(6,2) DEFAULT NULL,
  `new_pending` decimal(6,2) DEFAULT NULL,
  `new_used` decimal(6,2) DEFAULT NULL,
  `old_accrued` decimal(6,2) DEFAULT NULL,
  `old_carried` decimal(6,2) DEFAULT NULL,
  `old_encashed` decimal(6,2) DEFAULT NULL,
  `old_pending` decimal(6,2) DEFAULT NULL,
  `old_used` decimal(6,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_balance_hist_emp` (`employee_id`,`balance_year`,`changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_balances` (
  `employee_id` varchar(36) NOT NULL,
  `leave_type_id` varchar(36) NOT NULL,
  `balance_year` int NOT NULL,
  `accrued` decimal(6,2) NOT NULL,
  `adjusted` decimal(6,2) NOT NULL,
  `carried_forward` decimal(6,2) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `encashed` decimal(6,2) NOT NULL,
  `opening` decimal(6,2) NOT NULL,
  `pending` decimal(6,2) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `used` decimal(6,2) NOT NULL,
  `version` bigint NOT NULL,
  PRIMARY KEY (`employee_id`,`leave_type_id`,`balance_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_comments` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `application_id` varchar(36) NOT NULL,
  `author_id` varchar(36) DEFAULT NULL,
  `comment` varchar(1000) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_comment_application` (`application_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_employees` (
  `employee_id` varchar(36) NOT NULL,
  `department_id` varchar(36) DEFAULT NULL,
  `full_name` varchar(200) DEFAULT NULL,
  `gender` varchar(15) DEFAULT NULL,
  `joining_date` date DEFAULT NULL,
  `location_id` varchar(36) DEFAULT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `status` varchar(15) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_policies` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `is_default` bit(1) NOT NULL,
  `description` varchar(300) DEFAULT NULL,
  `hr_approval_threshold_days` int NOT NULL,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_policy_entitlements` (
  `leave_type_id` varchar(36) NOT NULL,
  `policy_id` varchar(36) NOT NULL,
  `accrual_per_month` decimal(4,2) NOT NULL,
  `annual_days` decimal(5,1) NOT NULL,
  `carry_forward_max` decimal(5,1) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `encashable` bit(1) NOT NULL,
  `encashment_max_days` decimal(5,1) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`leave_type_id`,`policy_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_run_log` (
  `run_key` varchar(60) NOT NULL,
  `executed_at` datetime(6) NOT NULL,
  `executed_by` varchar(100) DEFAULT NULL,
  `records_processed` int NOT NULL,
  PRIMARY KEY (`run_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `leave_types` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `attachment_required_from_days` int DEFAULT NULL,
  `balance_tracked` bit(1) NOT NULL,
  `code` varchar(20) NOT NULL,
  `description` varchar(300) DEFAULT NULL,
  `gender_restriction` varchar(10) DEFAULT NULL,
  `half_day_allowed` bit(1) NOT NULL,
  `name` varchar(80) NOT NULL,
  `paid` bit(1) NOT NULL,
  `requires_hr_approval` bit(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_leave_type_code` (`code`)
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
SET FOREIGN_KEY_CHECKS = 1;
