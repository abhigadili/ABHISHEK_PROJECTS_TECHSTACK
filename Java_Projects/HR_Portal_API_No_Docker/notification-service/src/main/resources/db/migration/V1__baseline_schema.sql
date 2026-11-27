-- Baseline schema of hr_notification_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
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
CREATE TABLE `email_settings` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `enabled` bit(1) NOT NULL,
  `from_address` varchar(150) NOT NULL,
  `host` varchar(150) DEFAULT NULL,
  `mode` enum('LOG','SMTP') NOT NULL,
  `port` int DEFAULT NULL,
  `start_tls` bit(1) NOT NULL,
  `username` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `employee_contacts` (
  `employee_id` varchar(36) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `full_name` varchar(200) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `event_history` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `correlation_id` varchar(64) DEFAULT NULL,
  `employee_id` varchar(36) DEFAULT NULL,
  `event_id` varchar(64) NOT NULL,
  `event_type` varchar(100) DEFAULT NULL,
  `occurred_at` datetime(6) NOT NULL,
  `offset_no` bigint NOT NULL,
  `partition_no` int NOT NULL,
  `payload` mediumtext,
  `source_service` varchar(60) DEFAULT NULL,
  `topic` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_history_event` (`event_id`),
  KEY `idx_event_topic` (`topic`,`occurred_at`),
  KEY `idx_event_employee` (`employee_id`,`occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `notification_templates` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `body_template` varchar(2000) NOT NULL,
  `code` varchar(60) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  `subject_template` varchar(200) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_template_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `notifications` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `body` varchar(2000) NOT NULL,
  `channel` enum('EMAIL','IN_APP') NOT NULL,
  `correlation_id` varchar(64) DEFAULT NULL,
  `error_message` varchar(200) DEFAULT NULL,
  `read_at` datetime(6) DEFAULT NULL,
  `recipient_email` varchar(150) DEFAULT NULL,
  `recipient_employee_id` varchar(36) DEFAULT NULL,
  `reference_id` varchar(64) DEFAULT NULL,
  `reference_type` varchar(40) DEFAULT NULL,
  `sent_at` datetime(6) DEFAULT NULL,
  `status` enum('FAILED','PENDING','SENT','SKIPPED') NOT NULL,
  `subject` varchar(200) NOT NULL,
  `type` varchar(60) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notification_recipient` (`recipient_employee_id`,`channel`,`read_at`,`created_at`),
  KEY `idx_notification_status` (`status`,`created_at`)
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
