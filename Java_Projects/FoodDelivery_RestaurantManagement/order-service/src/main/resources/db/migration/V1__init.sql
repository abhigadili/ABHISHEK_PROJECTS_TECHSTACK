-- Baseline schema of food_order_db generated from the JPA entities (scripts/gen-schema.sh). Owned by order-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `add_ons` varchar(300) DEFAULT NULL,
  `instructions` varchar(300) DEFAULT NULL,
  `line_total` decimal(12,2) NOT NULL,
  `menu_item_id` bigint NOT NULL,
  `name` varchar(120) NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `variant` varchar(40) DEFAULT NULL,
  `order_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  CONSTRAINT `FKbioxgbv59vetrxe0ejfubep1w` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `order_status_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `actor` varchar(100) NOT NULL,
  `changed_at` datetime(6) NOT NULL,
  `from_status` enum('CANCELLED','CONFIRMED','CREATED','DELIVERED','OUT_FOR_DELIVERY','PAYMENT_FAILED','PAYMENT_PENDING','PICKED_UP','PREPARING','READY_FOR_PICKUP','REFUNDED','REFUND_PENDING','REJECTED','RESTAURANT_ACCEPTED') DEFAULT NULL,
  `reason` varchar(300) DEFAULT NULL,
  `to_status` enum('CANCELLED','CONFIRMED','CREATED','DELIVERED','OUT_FOR_DELIVERY','PAYMENT_FAILED','PAYMENT_PENDING','PICKED_UP','PREPARING','READY_FOR_PICKUP','REFUNDED','REFUND_PENDING','REJECTED','RESTAURANT_ACCEPTED') NOT NULL,
  `order_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_history_order` (`order_id`),
  CONSTRAINT `FKnmcbg3mmbt8wfva97ra40nmp3` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `cancel_reason` varchar(300) DEFAULT NULL,
  `cancelled_by` varchar(40) DEFAULT NULL,
  `coupon_code` varchar(40) DEFAULT NULL,
  `customer_id` bigint NOT NULL,
  `customer_name` varchar(120) NOT NULL,
  `delivery_city` varchar(80) NOT NULL,
  `delivery_label` varchar(40) DEFAULT NULL,
  `delivery_lat` double DEFAULT NULL,
  `delivery_line1` varchar(200) NOT NULL,
  `delivery_line2` varchar(200) DEFAULT NULL,
  `delivery_lng` double DEFAULT NULL,
  `delivery_postal_code` varchar(12) DEFAULT NULL,
  `delivery_fee` decimal(12,2) NOT NULL,
  `discount_amount` decimal(12,2) NOT NULL,
  `estimated_prep_minutes` int NOT NULL,
  `idempotency_key` varchar(64) DEFAULT NULL,
  `order_number` varchar(30) NOT NULL,
  `payment_method` varchar(20) DEFAULT NULL,
  `pickup_address` varchar(300) NOT NULL,
  `restaurant_id` bigint NOT NULL,
  `restaurant_name` varchar(120) NOT NULL,
  `restaurant_owner_user_id` bigint NOT NULL,
  `special_instructions` varchar(500) DEFAULT NULL,
  `status` enum('CANCELLED','CONFIRMED','CREATED','DELIVERED','OUT_FOR_DELIVERY','PAYMENT_FAILED','PAYMENT_PENDING','PICKED_UP','PREPARING','READY_FOR_PICKUP','REFUNDED','REFUND_PENDING','REJECTED','RESTAURANT_ACCEPTED') NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `tax_amount` decimal(12,2) NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  `version` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_number` (`order_number`),
  UNIQUE KEY `uk_orders_idempotency` (`customer_id`,`idempotency_key`),
  KEY `idx_orders_customer_created` (`customer_id`,`created_at`),
  KEY `idx_orders_restaurant_status` (`restaurant_id`,`status`),
  KEY `idx_orders_status_created` (`status`,`created_at`)
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
