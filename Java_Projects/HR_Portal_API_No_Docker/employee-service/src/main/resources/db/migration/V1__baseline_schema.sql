-- Baseline schema of hr_employee_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
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
CREATE TABLE `emergency_contacts` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `alternate_phone` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `is_primary` bit(1) NOT NULL,
  `relationship` varchar(50) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKdllve8ih07ir0a3ng8o5ubj4w` (`employee_id`),
  CONSTRAINT `FKdllve8ih07ir0a3ng8o5ubj4w` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `employee_addresses` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `city` varchar(80) NOT NULL,
  `country` varchar(80) NOT NULL,
  `line1` varchar(150) NOT NULL,
  `line2` varchar(150) DEFAULT NULL,
  `postal_code` varchar(15) DEFAULT NULL,
  `is_primary` bit(1) NOT NULL,
  `state` varchar(80) DEFAULT NULL,
  `type` enum('CURRENT','MAILING','OFFICE','PERMANENT') NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK4kelvir0i8vgoydc61kl4jpgv` (`employee_id`),
  CONSTRAINT `FK4kelvir0i8vgoydc61kl4jpgv` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `employee_bank_details` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `account_holder_name` varchar(120) NOT NULL,
  `account_number` varchar(200) NOT NULL,
  `account_type` varchar(20) DEFAULT NULL,
  `bank_name` varchar(120) NOT NULL,
  `branch` varchar(120) DEFAULT NULL,
  `employee_id` varchar(36) DEFAULT NULL,
  `ifsc_code` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKlubeqplhmxo40vv4ao87yptj2` (`employee_id`),
  CONSTRAINT `FKlubeqplhmxo40vv4ao87yptj2` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `employee_education` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `degree` varchar(120) NOT NULL,
  `employee_id` varchar(36) DEFAULT NULL,
  `end_year` int DEFAULT NULL,
  `field_of_study` varchar(120) DEFAULT NULL,
  `grade` varchar(40) DEFAULT NULL,
  `institution` varchar(200) NOT NULL,
  `start_year` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKp4wlgwluyoknphmwhgn2o5pks` (`employee_id`),
  CONSTRAINT `FKp4wlgwluyoknphmwhgn2o5pks` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `employee_experience` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `company` varchar(150) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `end_date` date DEFAULT NULL,
  `job_title` varchar(120) NOT NULL,
  `start_date` date NOT NULL,
  `verified` bit(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_experience_employee` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `employee_sequence` (
  `id` int NOT NULL,
  `next_value` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `employee_status_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `changed_at` datetime(6) NOT NULL,
  `changed_by` varchar(100) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `new_status` varchar(15) NOT NULL,
  `old_status` varchar(15) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status_history_employee` (`employee_id`,`changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `employees` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `blood_group` varchar(5) DEFAULT NULL,
  `confirmation_date` date DEFAULT NULL,
  `alternate_phone` varchar(20) DEFAULT NULL,
  `personal_email` varchar(150) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `department_id` varchar(36) NOT NULL,
  `designation_id` varchar(36) NOT NULL,
  `employee_code` varchar(20) NOT NULL,
  `employment_type` enum('CONTRACT','FULL_TIME','INTERN','PART_TIME') NOT NULL,
  `exit_date` date DEFAULT NULL,
  `first_name` varchar(80) NOT NULL,
  `gender` enum('FEMALE','MALE','OTHER','UNDISCLOSED') DEFAULT NULL,
  `job_grade_id` varchar(36) DEFAULT NULL,
  `joining_date` date NOT NULL,
  `last_name` varchar(80) NOT NULL,
  `location_id` varchar(36) NOT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `marital_status` enum('DIVORCED','MARRIED','SINGLE','WIDOWED') DEFAULT NULL,
  `middle_name` varchar(80) DEFAULT NULL,
  `national_id` varchar(200) DEFAULT NULL,
  `nationality` varchar(60) DEFAULT NULL,
  `notice_period_days` int NOT NULL,
  `pan_number` varchar(200) DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','ON_NOTICE','RESIGNED','TERMINATED') NOT NULL,
  `version` bigint NOT NULL,
  `work_email` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_employee_code` (`employee_code`),
  UNIQUE KEY `uk_employee_work_email` (`work_email`),
  KEY `idx_employee_manager` (`manager_id`),
  KEY `idx_employee_department` (`department_id`),
  KEY `idx_employee_status` (`status`),
  KEY `idx_employee_name` (`last_name`,`first_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `employment_history` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `change_type` enum('DETAILS_UPDATE','JOINED','MANAGER_CHANGE','PROMOTION','STATUS_CHANGE','TRANSFER') NOT NULL,
  `effective_date` date NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `from_value` varchar(500) DEFAULT NULL,
  `reason` varchar(300) DEFAULT NULL,
  `to_value` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_history_employee` (`employee_id`,`effective_date`)
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
CREATE TABLE `profile_change_log` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `field_name` varchar(60) NOT NULL,
  `new_value` varchar(500) DEFAULT NULL,
  `old_value` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_profile_log_employee` (`employee_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS = 1;
