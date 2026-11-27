-- Baseline schema of food_payment_db generated from the JPA entities (scripts/gen-schema.sh). Owned by payment-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

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
CREATE TABLE IF NOT EXISTS `payment_attempts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `customer_id` bigint NOT NULL,
  `idempotency_key` varchar(64) NOT NULL,
  `payment_id` bigint NOT NULL,
  `result_status` varchar(12) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_attempt_key` (`customer_id`,`idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `payment_callbacks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `outcome` varchar(12) NOT NULL,
  `provider_event_id` varchar(80) NOT NULL,
  `received_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_callback_event` (`provider_event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `payments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(3) NOT NULL,
  `customer_id` bigint NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `failure_reason` varchar(300) DEFAULT NULL,
  `method` varchar(20) NOT NULL,
  `order_id` bigint NOT NULL,
  `order_number` varchar(30) NOT NULL,
  `paid_at` datetime(6) DEFAULT NULL,
  `provider` varchar(24) NOT NULL,
  `provider_ref` varchar(60) DEFAULT NULL,
  `sandbox` bit(1) NOT NULL,
  `scenario` varchar(40) DEFAULT NULL,
  `status` enum('CANCELLED','FAILED','PENDING','REFUNDED','SUCCESS') NOT NULL,
  `version` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_order` (`order_id`),
  KEY `idx_payment_customer` (`customer_id`,`created_at`),
  KEY `idx_payment_status_expiry` (`status`,`expires_at`)
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
CREATE TABLE IF NOT EXISTS `refunds` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `amount` decimal(12,2) NOT NULL,
  `attempts` int NOT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `failure_reason` varchar(300) DEFAULT NULL,
  `order_id` bigint NOT NULL,
  `provider_ref` varchar(60) DEFAULT NULL,
  `reason` varchar(300) DEFAULT NULL,
  `status` enum('COMPLETED','FAILED','INITIATED') NOT NULL,
  `version` bigint DEFAULT NULL,
  `payment_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_payment` (`payment_id`),
  KEY `idx_refund_status` (`status`),
  CONSTRAINT `FKpt9ic0j1y6xwlej99wnynvnpy` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `saved_payment_methods` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL,
  `is_default` bit(1) NOT NULL,
  `label` varchar(60) NOT NULL,
  `masked_value` varchar(40) NOT NULL,
  `provider_token` varchar(80) NOT NULL,
  `type` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_saved_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
