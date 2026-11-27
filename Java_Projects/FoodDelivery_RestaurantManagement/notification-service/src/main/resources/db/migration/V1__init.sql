-- Baseline schema of food_notification_db generated from the JPA entities (scripts/gen-schema.sh). Owned by notification-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `channel` enum('EMAIL','IN_APP','SMS') NOT NULL,
  `correlation_id` varchar(64) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `error` varchar(300) DEFAULT NULL,
  `message` varchar(1000) NOT NULL,
  `provider_ref` varchar(60) DEFAULT NULL,
  `read_at` datetime(6) DEFAULT NULL,
  `read_flag` bit(1) NOT NULL,
  `reference_id` bigint DEFAULT NULL,
  `reference_type` varchar(20) DEFAULT NULL,
  `sent_at` datetime(6) DEFAULT NULL,
  `status` enum('FAILED','PENDING','SENT') NOT NULL,
  `title` varchar(150) NOT NULL,
  `type` varchar(40) NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user_read_created` (`user_id`,`read_flag`,`created_at`),
  KEY `idx_notif_reference` (`reference_type`,`reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `outbox_events` (
  `id` varchar(36) NOT NULL,
  `attempts` int NOT NULL,
  `correlation_id` varchar(64) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `envelope_json` mediumtext NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `last_error` varchar(500) DEFAULT NULL,
  `msg_key` varchar(100) NOT NULL,
  `published_at` datetime(6) DEFAULT NULL,
  `status` enum('FAILED','PENDING','PUBLISHED') NOT NULL,
  `topic` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_outbox_status_created` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `processed_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `consumer_group` varchar(100) NOT NULL,
  `event_id` varchar(36) NOT NULL,
  `processed_at` datetime(6) NOT NULL,
  `topic` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_processed_event_group` (`event_id`,`consumer_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
