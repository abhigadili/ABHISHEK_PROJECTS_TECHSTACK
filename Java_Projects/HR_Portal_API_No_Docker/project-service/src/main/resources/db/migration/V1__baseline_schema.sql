-- Baseline schema of hr_project_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
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
CREATE TABLE `customer_contacts` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `customer_id` varchar(36) NOT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `phone` varchar(25) DEFAULT NULL,
  `is_primary` bit(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_contact_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `customers` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `billing_address` varchar(300) DEFAULT NULL,
  `billing_email` varchar(150) DEFAULT NULL,
  `code` varchar(30) NOT NULL,
  `credit_limit` decimal(16,2) DEFAULT NULL,
  `industry` varchar(80) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `payment_terms_days` int NOT NULL,
  `status` enum('ACTIVE','INACTIVE') NOT NULL,
  `tax_number` varchar(200) DEFAULT NULL,
  `website` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_code` (`code`)
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
CREATE TABLE `project_allocations` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `allocation_percent` decimal(5,2) NOT NULL,
  `billable` bit(1) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `employee_name` varchar(200) DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `project_id` varchar(36) NOT NULL,
  `role` varchar(80) NOT NULL,
  `start_date` date NOT NULL,
  `status` enum('ACTIVE','ENDED') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_alloc_project` (`project_id`,`status`),
  KEY `idx_alloc_employee` (`employee_id`,`start_date`,`end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `project_history` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `change_type` varchar(40) NOT NULL,
  `new_value` varchar(500) DEFAULT NULL,
  `old_value` varchar(500) DEFAULT NULL,
  `project_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_project_history` (`project_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `projects` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `billing_contact_id` varchar(36) DEFAULT NULL,
  `billing_model` enum('FIXED_PRICE','NON_BILLABLE','RETAINER','TIME_AND_MATERIAL') NOT NULL,
  `billing_notes` varchar(500) DEFAULT NULL,
  `billing_rate` decimal(12,2) DEFAULT NULL,
  `budget` decimal(16,2) DEFAULT NULL,
  `code` varchar(30) NOT NULL,
  `currency` varchar(3) DEFAULT NULL,
  `customer_id` varchar(36) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `project_manager_id` varchar(36) NOT NULL,
  `start_date` date NOT NULL,
  `status` enum('ACTIVE','CANCELLED','COMPLETED','ON_HOLD','PLANNED') NOT NULL,
  `version` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_project_code` (`code`),
  KEY `idx_project_customer` (`customer_id`),
  KEY `idx_project_manager` (`project_manager_id`),
  KEY `idx_project_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS = 1;
