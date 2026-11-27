-- Baseline schema of food_menu_db generated from the JPA entities (scripts/gen-schema.sh). Owned by menu-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `item_addons` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `available` bit(1) NOT NULL,
  `name` varchar(60) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `item_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK1fvwx46sf1v1fvb3qs1xb1dut` (`item_id`),
  CONSTRAINT `FK1fvwx46sf1v1fvb3qs1xb1dut` FOREIGN KEY (`item_id`) REFERENCES `menu_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `item_popularity` (
  `menu_item_id` bigint NOT NULL,
  `ordered_quantity` bigint NOT NULL,
  `restaurant_id` bigint NOT NULL,
  PRIMARY KEY (`menu_item_id`),
  KEY `idx_popularity_restaurant` (`restaurant_id`,`ordered_quantity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `item_variants` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `extra_price` decimal(10,2) NOT NULL,
  `name` varchar(40) NOT NULL,
  `item_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_variant_item_name` (`item_id`,`name`),
  CONSTRAINT `FKo26wrkfilme23qx12y3xv633m` FOREIGN KEY (`item_id`) REFERENCES `menu_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `menu_categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  `display_order` int NOT NULL,
  `name` varchar(60) NOT NULL,
  `restaurant_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_restaurant_name` (`restaurant_id`,`name`),
  KEY `idx_category_restaurant` (`restaurant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `available` bit(1) NOT NULL,
  `base_price` decimal(10,2) NOT NULL,
  `description` varchar(600) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `prep_time_minutes` int NOT NULL,
  `restaurant_id` bigint NOT NULL,
  `tags` varchar(200) DEFAULT NULL,
  `vegetarian` bit(1) NOT NULL,
  `version` bigint DEFAULT NULL,
  `category_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_item_restaurant_active` (`restaurant_id`,`active`),
  KEY `idx_item_category` (`category_id`),
  KEY `idx_item_name` (`name`),
  CONSTRAINT `FK4pc1grgsms7nqm2i6oig37pro` FOREIGN KEY (`category_id`) REFERENCES `menu_categories` (`id`)
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
