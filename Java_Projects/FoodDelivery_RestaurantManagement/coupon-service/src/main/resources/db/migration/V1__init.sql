-- Baseline schema of food_coupon_db generated from the JPA entities (scripts/gen-schema.sh). Owned by coupon-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `banner_text` varchar(120) DEFAULT NULL,
  `description` varchar(400) DEFAULT NULL,
  `ends_at` datetime(6) NOT NULL,
  `name` varchar(100) NOT NULL,
  `starts_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `coupon_redemptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL,
  `discount_amount` decimal(10,2) NOT NULL,
  `order_id` bigint NOT NULL,
  `redeemed_at` datetime(6) NOT NULL,
  `coupon_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_redemption_order` (`order_id`),
  KEY `idx_redemption_coupon_customer` (`coupon_id`,`customer_id`),
  CONSTRAINT `FKh7aunv3i22if0uql8581xtrhw` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `campaign_id` bigint DEFAULT NULL,
  `code` varchar(40) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  `discount_type` enum('FIXED_AMOUNT','PERCENTAGE') NOT NULL,
  `discount_value` decimal(10,2) NOT NULL,
  `eligible_user_id` bigint DEFAULT NULL,
  `max_discount` decimal(10,2) DEFAULT NULL,
  `min_order_value` decimal(10,2) NOT NULL,
  `per_user_limit` int DEFAULT NULL,
  `restaurant_id` bigint DEFAULT NULL,
  `total_usage_limit` int DEFAULT NULL,
  `used_count` int NOT NULL,
  `valid_from` datetime(6) NOT NULL,
  `valid_to` datetime(6) NOT NULL,
  `version` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_coupon_code` (`code`),
  KEY `idx_coupon_active_dates` (`active`,`valid_from`,`valid_to`),
  KEY `idx_coupon_restaurant` (`restaurant_id`)
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
