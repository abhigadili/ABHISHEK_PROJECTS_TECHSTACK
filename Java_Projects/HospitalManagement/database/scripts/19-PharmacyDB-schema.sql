-- Schema of PharmacyDB (owned by the pharmacy service). Generated from the Hibernate mappings, idempotent (CREATE TABLE IF NOT EXISTS).
USE PharmacyDB;
SET FOREIGN_KEY_CHECKS = 0;   -- tables are listed alphabetically, FKs resolve once all exist


CREATE TABLE IF NOT EXISTS `medicines` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `generic_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_low_stock_alert_at` datetime(6) DEFAULT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reorder_level` int NOT NULL,
  `sku` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stock_quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `version` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_medicine_sku` (`sku`),
  KEY `idx_medicine_name` (`name`),
  KEY `idx_medicine_generic` (`generic_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `outbox_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `attempts` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `event_key` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` datetime(6) DEFAULT NULL,
  `topic` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_outbox_unsent` (`sent_at`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_order_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `dosage` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medicine_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) DEFAULT NULL,
  `medicine_id` bigint DEFAULT NULL,
  `order_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_order_item_medicine` (`medicine_id`),
  KEY `fk_order_item_order` (`order_id`),
  CONSTRAINT `fk_order_item_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`),
  CONSTRAINT `fk_order_item_order` FOREIGN KEY (`order_id`) REFERENCES `pharmacy_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `dispensed_at` datetime(6) DEFAULT NULL,
  `dispensed_by` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doctor_name` varchar(125) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_id` bigint NOT NULL,
  `patient_name` varchar(121) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prescription_id` bigint NOT NULL,
  `rejection_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('DISPENSED','PENDING','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_prescription` (`prescription_id`),
  KEY `idx_order_status` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `processed_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `consumer` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `processed_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_processed_event_consumer` (`event_id`,`consumer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SET FOREIGN_KEY_CHECKS = 1;
