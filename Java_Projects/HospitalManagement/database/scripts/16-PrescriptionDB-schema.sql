-- Schema of PrescriptionDB (owned by the prescription service). Generated from the Hibernate mappings, idempotent (CREATE TABLE IF NOT EXISTS).
USE PrescriptionDB;
SET FOREIGN_KEY_CHECKS = 0;   -- tables are listed alphabetically, FKs resolve once all exist


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

CREATE TABLE IF NOT EXISTS `prescription_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `dosage` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_days` int NOT NULL,
  `frequency` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instructions` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medicine_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `prescription_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_rx_item_prescription` (`prescription_id`),
  CONSTRAINT `fk_rx_item_prescription` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prescriptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `appointment_id` bigint DEFAULT NULL,
  `diagnosis` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doctor_id` bigint NOT NULL,
  `doctor_name` varchar(125) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issued_at` datetime(6) NOT NULL,
  `notes` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_id` bigint NOT NULL,
  `patient_name` varchar(121) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','CANCELLED','DISPENSED','EXPIRED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status_changed_at` datetime(6) DEFAULT NULL,
  `valid_until` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_rx_patient` (`patient_id`,`issued_at`),
  KEY `idx_rx_status_valid` (`status`,`valid_until`)
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
