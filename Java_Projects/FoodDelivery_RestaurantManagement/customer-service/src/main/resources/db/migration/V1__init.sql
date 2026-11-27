-- Baseline schema of food_customer_db generated from the JPA entities (scripts/gen-schema.sh). Owned by customer-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `addresses` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `city` varchar(80) NOT NULL,
  `is_default` bit(1) NOT NULL,
  `label` varchar(40) NOT NULL,
  `latitude` double DEFAULT NULL,
  `line1` varchar(200) NOT NULL,
  `line2` varchar(200) DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `postal_code` varchar(12) NOT NULL,
  `state` varchar(80) DEFAULT NULL,
  `customer_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_addresses_customer` (`customer_id`),
  CONSTRAINT `FKhrpf5e8dwasvdc5cticysrt2k` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `customer_activity` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `customer_id` bigint NOT NULL,
  `detail` varchar(300) DEFAULT NULL,
  `type` varchar(40) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_activity_customer_time` (`customer_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `customers` (
  `user_id` bigint NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `avatar_url` varchar(255) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `full_name` varchar(120) NOT NULL,
  `last_active_at` datetime(6) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `favourite_cuisines` varchar(255) DEFAULT NULL,
  `notify_email` bit(1) DEFAULT NULL,
  `notify_in_app` bit(1) DEFAULT NULL,
  `notify_sms` bit(1) DEFAULT NULL,
  `vegetarian_only` bit(1) DEFAULT NULL,
  `status` enum('ACTIVE','BLOCKED') NOT NULL,
  `version` bigint DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  KEY `idx_customers_status` (`status`),
  KEY `idx_customers_email` (`email`)
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
