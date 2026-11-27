-- Baseline schema of food_search_db generated from the JPA entities (scripts/gen-schema.sh). Owned by search-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `indexed_foods` (
  `menu_item_id` bigint NOT NULL,
  `available` bit(1) NOT NULL,
  `category` varchar(60) DEFAULT NULL,
  `description` varchar(600) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `restaurant_id` bigint NOT NULL,
  `vegetarian` bit(1) NOT NULL,
  PRIMARY KEY (`menu_item_id`),
  KEY `idx_if_restaurant` (`restaurant_id`),
  KEY `idx_if_name` (`name`),
  KEY `idx_if_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `indexed_restaurants` (
  `restaurant_id` bigint NOT NULL,
  `accepting_orders` bit(1) NOT NULL,
  `active` bit(1) NOT NULL,
  `address` varchar(200) DEFAULT NULL,
  `city` varchar(80) DEFAULT NULL,
  `cuisines` varchar(300) DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `rating` decimal(3,2) NOT NULL,
  `rating_count` bigint NOT NULL,
  PRIMARY KEY (`restaurant_id`),
  KEY `idx_ir_active_city` (`active`,`city`),
  KEY `idx_ir_name` (`name`)
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
