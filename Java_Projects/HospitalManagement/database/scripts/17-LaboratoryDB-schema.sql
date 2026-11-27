-- Schema of LaboratoryDB (owned by the laboratory service). Generated from the Hibernate mappings, idempotent (CREATE TABLE IF NOT EXISTS).
USE LaboratoryDB;
SET FOREIGN_KEY_CHECKS = 0;   -- tables are listed alphabetically, FKs resolve once all exist


CREATE TABLE IF NOT EXISTS `lab_reports` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `abnormal` bit(1) NOT NULL,
  `reference_range` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reported_at` datetime(6) NOT NULL,
  `reported_by` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `result_details` varchar(4000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result_summary` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_report_request` (`request_id`),
  CONSTRAINT `fk_report_request` FOREIGN KEY (`request_id`) REFERENCES `lab_requests` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lab_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `accession_number` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `appointment_id` bigint DEFAULT NULL,
  `clinical_notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doctor_id` bigint NOT NULL,
  `patient_email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_id` bigint NOT NULL,
  `patient_name` varchar(121) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `priority` enum('ROUTINE','STAT','URGENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `queued_at` datetime(6) DEFAULT NULL,
  `requested_at` datetime(6) NOT NULL,
  `status` enum('CANCELLED','COMPLETED','IN_PROGRESS','REQUESTED','SAMPLE_COLLECTED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `test_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `version` bigint DEFAULT NULL,
  `test_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_lab_accession` (`accession_number`),
  KEY `idx_lab_patient` (`patient_id`,`requested_at`),
  KEY `idx_lab_status` (`status`,`priority`),
  KEY `fk_lab_request_test` (`test_id`),
  CONSTRAINT `fk_lab_request_test` FOREIGN KEY (`test_id`) REFERENCES `lab_tests` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lab_tests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `sample_type` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `turnaround_hours` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_lab_test_code` (`code`)
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

CREATE TABLE IF NOT EXISTS `processed_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `consumer` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `processed_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_processed_event_consumer` (`event_id`,`consumer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SET FOREIGN_KEY_CHECKS = 1;
