-- Schema of NotificationDB (owned by the notification service). Generated from the Hibernate mappings, idempotent (CREATE TABLE IF NOT EXISTS).
USE NotificationDB;
SET FOREIGN_KEY_CHECKS = 0;   -- tables are listed alphabetically, FKs resolve once all exist


CREATE TABLE IF NOT EXISTS `hms_notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `channel` enum('EMAIL','SMS') NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `event_type` varchar(40) NOT NULL,
  `failure_reason` varchar(255) DEFAULT NULL,
  `message` varchar(2000) NOT NULL,
  `recipient_email` varchar(120) NOT NULL,
  `recipient_phone` varchar(20) DEFAULT NULL,
  `reference_id` varchar(40) DEFAULT NULL,
  `sent_at` datetime(6) DEFAULT NULL,
  `status` enum('FAILED','SENT') NOT NULL,
  `subject` varchar(200) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notification_recipient` (`recipient_email`,`created_at`),
  KEY `idx_notification_event` (`event_type`,`reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `hms_outbox_events` (
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

CREATE TABLE IF NOT EXISTS `hms_processed_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `consumer` varchar(120) NOT NULL,
  `event_id` varchar(64) NOT NULL,
  `processed_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_processed_event_consumer` (`event_id`,`consumer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS = 1;
