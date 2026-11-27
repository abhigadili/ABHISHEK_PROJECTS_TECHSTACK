-- Baseline schema of food_delivery_db generated from the JPA entities (scripts/gen-schema.sh). Owned by delivery-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `assignment_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `action` varchar(16) NOT NULL,
  `at` datetime(6) NOT NULL,
  `delivery_id` bigint NOT NULL,
  `note` varchar(200) DEFAULT NULL,
  `partner_user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_assignment_delivery` (`delivery_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `deliveries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `accepted_at` datetime(6) DEFAULT NULL,
  `assigned_at` datetime(6) DEFAULT NULL,
  `assignment_expires_at` datetime(6) DEFAULT NULL,
  `customer_id` bigint NOT NULL,
  `customer_name` varchar(120) DEFAULT NULL,
  `delivered_at` datetime(6) DEFAULT NULL,
  `delivery_address` varchar(300) NOT NULL,
  `delivery_city` varchar(80) DEFAULT NULL,
  `excluded_partners` varchar(400) DEFAULT NULL,
  `offer_count` int NOT NULL,
  `order_id` bigint NOT NULL,
  `order_number` varchar(30) NOT NULL,
  `partner_user_id` bigint DEFAULT NULL,
  `picked_up_at` datetime(6) DEFAULT NULL,
  `pickup_address` varchar(300) NOT NULL,
  `restaurant_id` bigint NOT NULL,
  `status` enum('ACCEPTED','ASSIGNED','CANCELLED','DELIVERED','PICKED_UP','UNASSIGNED') NOT NULL,
  `version` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_delivery_order` (`order_id`),
  KEY `idx_delivery_status` (`status`,`assignment_expires_at`),
  KEY `idx_delivery_partner` (`partner_user_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS `delivery_partners` (
  `user_id` bigint NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `busy` bit(1) NOT NULL,
  `completed_deliveries` int NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `last_assigned_at` datetime(6) DEFAULT NULL,
  `last_latitude` double DEFAULT NULL,
  `last_longitude` double DEFAULT NULL,
  `online` bit(1) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `rating_avg` decimal(3,2) NOT NULL,
  `rating_count` bigint NOT NULL,
  `rejected_offers` int NOT NULL,
  `suspended` bit(1) NOT NULL,
  `vehicle_number` varchar(20) DEFAULT NULL,
  `vehicle_type` varchar(20) DEFAULT NULL,
  `version` bigint DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  KEY `idx_partner_availability` (`online`,`busy`,`suspended`)
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
