-- Baseline schema of hr_timesheet_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
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
CREATE TABLE `timesheet_employees` (
  `employee_id` varchar(36) NOT NULL,
  `full_name` varchar(200) DEFAULT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `status` varchar(15) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `timesheet_entries` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `billable` bit(1) NOT NULL,
  `description` varchar(300) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `hours` decimal(4,2) NOT NULL,
  `project_id` varchar(36) NOT NULL,
  `project_manager_id` varchar(36) DEFAULT NULL,
  `task_id` varchar(36) DEFAULT NULL,
  `task_key` varchar(36) NOT NULL,
  `timesheet_id` varchar(36) NOT NULL,
  `work_date` date NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_entry_unique` (`timesheet_id`,`project_id`,`task_key`,`work_date`),
  KEY `idx_entry_timesheet` (`timesheet_id`),
  KEY `idx_entry_project_date` (`project_id`,`work_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `timesheet_history` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `action` enum('APPROVED','CREATED','ENTRIES_SAVED','REJECTED','REOPENED','RESUBMITTED','SUBMITTED') NOT NULL,
  `actor_id` varchar(36) DEFAULT NULL,
  `comment` varchar(500) DEFAULT NULL,
  `timesheet_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ts_history` (`timesheet_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `timesheet_tasks` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `billable` bit(1) NOT NULL,
  `code` varchar(30) NOT NULL,
  `name` varchar(150) NOT NULL,
  `project_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_project_code` (`project_id`,`code`),
  KEY `idx_task_project` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `timesheets` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `approver_id` varchar(36) DEFAULT NULL,
  `billable_hours` decimal(6,2) NOT NULL,
  `decided_at` datetime(6) DEFAULT NULL,
  `decision_comment` varchar(500) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `employee_name` varchar(200) DEFAULT NULL,
  `resubmission_count` int NOT NULL,
  `status` enum('APPROVED','DRAFT','REJECTED','SUBMITTED') NOT NULL,
  `submitted_at` datetime(6) DEFAULT NULL,
  `total_hours` decimal(6,2) NOT NULL,
  `version` bigint NOT NULL,
  `week_start` date NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_timesheet_employee_week` (`employee_id`,`week_start`),
  KEY `idx_timesheet_status` (`status`,`approver_id`),
  KEY `idx_timesheet_week` (`week_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS = 1;
