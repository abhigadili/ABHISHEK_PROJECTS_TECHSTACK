-- Baseline schema of hr_document_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
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
CREATE TABLE `document_categories` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `code` varchar(30) NOT NULL,
  `default_expiry_months` int DEFAULT NULL,
  `description` varchar(300) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `read_roles` varchar(200) NOT NULL,
  `requires_verification` bit(1) NOT NULL,
  `self_upload_allowed` bit(1) NOT NULL,
  `is_sensitive` bit(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_doc_category_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `document_history` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `action` varchar(30) NOT NULL,
  `detail` varchar(500) DEFAULT NULL,
  `document_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_doc_history` (`document_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `document_permissions` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `access_level` enum('DOWNLOAD','VIEW') NOT NULL,
  `document_id` varchar(36) NOT NULL,
  `expires_at` datetime(6) DEFAULT NULL,
  `grantee_id` varchar(60) NOT NULL,
  `grantee_type` enum('EMPLOYEE','ROLE') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_permission_document` (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `documents` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `category_id` varchar(36) NOT NULL,
  `content_type` varchar(100) NOT NULL,
  `current_version` bit(1) NOT NULL,
  `decided_at` datetime(6) DEFAULT NULL,
  `decided_by` varchar(100) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `file_name` varchar(255) NOT NULL,
  `optimistic_version` bigint NOT NULL,
  `owner_employee_id` varchar(36) NOT NULL,
  `previous_version_id` varchar(36) DEFAULT NULL,
  `rejection_reason` varchar(500) DEFAULT NULL,
  `sha256` varchar(64) NOT NULL,
  `size_bytes` bigint NOT NULL,
  `source` enum('EXIT','LEAVE','MANUAL','PAYSLIP','TAX') NOT NULL,
  `status` enum('APPROVED','REJECTED','UPLOADED','VERIFIED') NOT NULL,
  `storage_path` varchar(300) NOT NULL,
  `title` varchar(200) NOT NULL,
  `uploaded_by` varchar(100) DEFAULT NULL,
  `version_number` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_document_owner` (`owner_employee_id`,`category_id`,`current_version`),
  KEY `idx_document_expiry` (`expiry_date`),
  KEY `idx_document_status` (`status`)
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
