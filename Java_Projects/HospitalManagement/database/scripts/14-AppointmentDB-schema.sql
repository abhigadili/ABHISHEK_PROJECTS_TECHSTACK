-- Schema of AppointmentDB (owned by the appointment service). Generated from the Hibernate mappings, idempotent (CREATE TABLE IF NOT EXISTS).
USE AppointmentDB;
SET FOREIGN_KEY_CHECKS = 0;   -- tables are listed alphabetically, FKs resolve once all exist


CREATE TABLE IF NOT EXISTS `appointments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `appointment_date` date NOT NULL,
  `bill_number` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancel_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `doctor_email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doctor_id` bigint NOT NULL,
  `doctor_name` varchar(125) COLLATE utf8mb4_unicode_ci NOT NULL,
  `end_time` time(6) NOT NULL,
  `fee` decimal(10,2) NOT NULL,
  `notes` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_id` bigint NOT NULL,
  `patient_name` varchar(121) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_status` enum('FAILED','NOT_BILLED','PAID','PENDING') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reminder_sent` bit(1) NOT NULL,
  `slot_key` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_time` time(6) NOT NULL,
  `status` enum('BOOKED','CANCELLED','COMPLETED','MISSED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `version` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_appointment_slot` (`slot_key`),
  KEY `idx_appt_doctor_date` (`doctor_id`,`appointment_date`,`status`),
  KEY `idx_appt_patient` (`patient_id`,`appointment_date`),
  KEY `idx_appt_reminder` (`status`,`reminder_sent`,`appointment_date`)
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
