-- Baseline schema of food_review_db generated from the JPA entities (scripts/gen-schema.sh). Owned by review-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `eligible_orders` (
  `order_id` bigint NOT NULL,
  `customer_id` bigint NOT NULL,
  `delivered_at` datetime(6) NOT NULL,
  `delivery_partner_id` bigint DEFAULT NULL,
  `restaurant_id` bigint NOT NULL,
  `reviewed` bit(1) NOT NULL,
  PRIMARY KEY (`order_id`),
  KEY `idx_eligible_customer` (`customer_id`,`reviewed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `item_ratings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `item_name` varchar(120) NOT NULL,
  `menu_item_id` bigint NOT NULL,
  `rating` int NOT NULL,
  `review_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_itemrating_item` (`menu_item_id`),
  KEY `FKqqa0od2gx5ygjyjwbbe4m51ec` (`review_id`),
  CONSTRAINT `FKqqa0od2gx5ygjyjwbbe4m51ec` FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `order_lines` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `menu_item_id` bigint NOT NULL,
  `name` varchar(120) NOT NULL,
  `order_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orderline` (`order_id`,`menu_item_id`),
  KEY `idx_orderline_order` (`order_id`)
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
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `comment` varchar(1000) DEFAULT NULL,
  `customer_id` bigint NOT NULL,
  `delivery_partner_id` bigint DEFAULT NULL,
  `delivery_rating` int DEFAULT NULL,
  `moderation_note` varchar(300) DEFAULT NULL,
  `order_id` bigint NOT NULL,
  `restaurant_id` bigint NOT NULL,
  `restaurant_rating` int NOT NULL,
  `reviewer_name` varchar(60) NOT NULL,
  `status` enum('HIDDEN','VISIBLE') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_review_order` (`order_id`),
  KEY `idx_review_restaurant_status` (`restaurant_id`,`status`,`created_at`),
  KEY `idx_review_partner` (`delivery_partner_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
