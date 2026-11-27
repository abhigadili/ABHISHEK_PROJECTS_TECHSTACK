-- Baseline schema of food_restaurant_db generated from the JPA entities (scripts/gen-schema.sh). Owned by restaurant-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `inbox_orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL,
  `order_id` bigint NOT NULL,
  `order_number` varchar(30) NOT NULL,
  `received_at` datetime(6) NOT NULL,
  `restaurant_id` bigint NOT NULL,
  `status` varchar(30) NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inbox_order` (`order_id`),
  KEY `idx_inbox_restaurant_status` (`restaurant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `opening_hours` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `closed` bit(1) NOT NULL,
  `closes_at` time(6) DEFAULT NULL,
  `day_of_week` enum('FRIDAY','MONDAY','SATURDAY','SUNDAY','THURSDAY','TUESDAY','WEDNESDAY') NOT NULL,
  `opens_at` time(6) DEFAULT NULL,
  `restaurant_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hours_day` (`restaurant_id`,`day_of_week`),
  CONSTRAINT `FK5dgcr0nmedj2g2ru4lqdld48n` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`)
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
CREATE TABLE IF NOT EXISTS `restaurant_cuisines` (
  `restaurant_id` bigint NOT NULL,
  `cuisine` varchar(40) DEFAULT NULL,
  KEY `FKiy4gru65xwwesfbayg6e8p20m` (`restaurant_id`),
  CONSTRAINT `FKiy4gru65xwwesfbayg6e8p20m` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `restaurant_images` (
  `restaurant_id` bigint NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  KEY `FK714rhrkn3odt4ucjohgipd9h4` (`restaurant_id`),
  CONSTRAINT `FK714rhrkn3odt4ucjohgipd9h4` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `restaurants` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `address_line` varchar(200) NOT NULL,
  `approved_at` datetime(6) DEFAULT NULL,
  `approved_by` varchar(100) DEFAULT NULL,
  `avg_rating` decimal(3,2) NOT NULL,
  `category` varchar(40) DEFAULT NULL,
  `city` varchar(80) NOT NULL,
  `delivery_fee` decimal(10,2) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `min_order_amount` decimal(10,2) NOT NULL,
  `name` varchar(120) NOT NULL,
  `accepting_orders` bit(1) NOT NULL,
  `owner_user_id` bigint NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `postal_code` varchar(12) DEFAULT NULL,
  `prep_time_minutes` int NOT NULL,
  `pure_veg` bit(1) NOT NULL,
  `rating_count` bigint NOT NULL,
  `state` varchar(80) DEFAULT NULL,
  `status` enum('APPROVED','DEACTIVATED','PENDING','REJECTED','SUSPENDED') NOT NULL,
  `status_reason` varchar(300) DEFAULT NULL,
  `version` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_restaurants_owner` (`owner_user_id`),
  KEY `idx_restaurants_status_city` (`status`,`city`),
  KEY `idx_restaurants_geo` (`latitude`,`longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
