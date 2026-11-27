-- Schema of DoctorDB (owned by the doctor service). Generated from the Hibernate mappings, idempotent (CREATE TABLE IF NOT EXISTS).
USE DoctorDB;
SET FOREIGN_KEY_CHECKS = 0;   -- tables are listed alphabetically, FKs resolve once all exist


CREATE TABLE IF NOT EXISTS `doctor_schedules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `break_end` time(6) DEFAULT NULL,
  `break_start` time(6) DEFAULT NULL,
  `day_of_week` enum('FRIDAY','MONDAY','SATURDAY','SUNDAY','THURSDAY','TUESDAY','WEDNESDAY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `end_time` time(6) NOT NULL,
  `slot_minutes` int NOT NULL,
  `start_time` time(6) NOT NULL,
  `doctor_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_schedule_doctor_day` (`doctor_id`,`day_of_week`),
  CONSTRAINT `fk_schedule_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `doctor_unavailability` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `reason` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unavailable_date` date NOT NULL,
  `doctor_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_unavailable_doctor_date` (`doctor_id`,`unavailable_date`),
  CONSTRAINT `fk_unavailable_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `doctors` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `consultation_fee` decimal(10,2) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `department_id` bigint DEFAULT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `experience_years` int DEFAULT NULL,
  `first_name` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hospital_id` bigint NOT NULL,
  `last_name` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `license_number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qualification` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `specialization` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_doctor_license` (`license_number`),
  UNIQUE KEY `uk_doctor_email` (`email`),
  UNIQUE KEY `uk_doctor_user` (`user_id`),
  KEY `idx_doctor_specialization` (`specialization`,`active`),
  KEY `idx_doctor_hospital` (`hospital_id`,`department_id`)
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
