-- Baseline schema of hr_reporting_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
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
CREATE TABLE `rpt_employees` (
  `employee_id` varchar(36) NOT NULL,
  `department_id` varchar(36) DEFAULT NULL,
  `designation_id` varchar(36) DEFAULT NULL,
  `employee_code` varchar(30) DEFAULT NULL,
  `exit_date` date DEFAULT NULL,
  `full_name` varchar(200) DEFAULT NULL,
  `joining_date` date DEFAULT NULL,
  `location_id` varchar(36) DEFAULT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `status` varchar(15) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`employee_id`),
  KEY `idx_rpt_emp_dept` (`department_id`,`status`),
  KEY `idx_rpt_emp_joining` (`joining_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `rpt_facts` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `category` varchar(80) DEFAULT NULL,
  `date_a` date DEFAULT NULL,
  `date_b` date DEFAULT NULL,
  `department_id` varchar(36) DEFAULT NULL,
  `employee_id` varchar(36) DEFAULT NULL,
  `fact_type` varchar(20) NOT NULL,
  `num_a` decimal(16,2) DEFAULT NULL,
  `num_b` decimal(16,2) DEFAULT NULL,
  `num_c` decimal(16,2) DEFAULT NULL,
  `occurred_at` datetime(6) NOT NULL,
  `period_key` varchar(40) DEFAULT NULL,
  `status` varchar(30) DEFAULT NULL,
  `subject_key` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fact` (`fact_type`,`subject_key`),
  KEY `idx_fact_type_period` (`fact_type`,`period_key`),
  KEY `idx_fact_employee` (`employee_id`,`fact_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS = 1;
