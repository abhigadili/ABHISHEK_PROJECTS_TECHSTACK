-- Baseline schema of food_inventory_db generated from the JPA entities (scripts/gen-schema.sh). Owned by inventory-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `ingredients` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `low_stock_threshold` decimal(14,3) NOT NULL,
  `name` varchar(80) NOT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `restaurant_id` bigint NOT NULL,
  `unit` varchar(16) NOT NULL,
  `version` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ingredient_restaurant_name` (`restaurant_id`,`name`),
  KEY `idx_ingredient_restaurant` (`restaurant_id`)
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
CREATE TABLE IF NOT EXISTS `recipes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `menu_item_id` bigint NOT NULL,
  `quantity_per_portion` decimal(14,3) NOT NULL,
  `restaurant_id` bigint NOT NULL,
  `ingredient_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recipe_item_ingredient` (`menu_item_id`,`ingredient_id`),
  KEY `idx_recipe_item` (`menu_item_id`),
  KEY `FKp2d99nkbj5vqd7j48l47s55mp` (`ingredient_id`),
  CONSTRAINT `FKp2d99nkbj5vqd7j48l47s55mp` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `actor` varchar(100) DEFAULT NULL,
  `balance_after` decimal(14,3) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `delta` decimal(14,3) NOT NULL,
  `ingredient_id` bigint NOT NULL,
  `order_id` bigint DEFAULT NULL,
  `reason` varchar(200) DEFAULT NULL,
  `restaurant_id` bigint NOT NULL,
  `type` enum('ADJUSTMENT','CONSUMPTION','RESTOCK','RETURN') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_movement_ingredient` (`ingredient_id`,`created_at`),
  KEY `idx_movement_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
