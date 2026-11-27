-- Schema of MedicalRecordsDB (owned by the medical-records service). Generated from the Hibernate mappings, idempotent (CREATE TABLE IF NOT EXISTS).
USE MedicalRecordsDB;
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

CREATE TABLE IF NOT EXISTS `patient_records` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `chronic_conditions` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `patient_id` bigint NOT NULL,
  `patient_name` varchar(121) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_record_patient` (`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `processed_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `consumer` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `processed_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_processed_event_consumer` (`event_id`,`consumer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `record_entries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `details` varchar(4000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doctor_id` bigint DEFAULT NULL,
  `entry_type` enum('ALLERGY','DIAGNOSIS','LAB_REPORT','NOTE','PRESCRIPTION','VISIT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` bigint NOT NULL,
  `recorded_at` datetime(6) NOT NULL,
  `reference_id` bigint DEFAULT NULL,
  `reference_type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_entry_reference` (`entry_type`,`reference_type`,`reference_id`),
  KEY `idx_entry_patient_time` (`patient_id`,`recorded_at`),
  KEY `fk_entry_record` (`record_id`),
  CONSTRAINT `fk_entry_record` FOREIGN KEY (`record_id`) REFERENCES `patient_records` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SET FOREIGN_KEY_CHECKS = 1;
