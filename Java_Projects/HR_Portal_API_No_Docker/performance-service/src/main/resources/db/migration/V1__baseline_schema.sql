-- Baseline schema of hr_performance_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
SET FOREIGN_KEY_CHECKS = 0;
CREATE TABLE `audit_history` (
  `id` varchar(36) NOT NULL,
  `action` varchar(60) NOT NULL,
  `correlation_id` varchar(64) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `entity_id` varchar(64) NOT NULL,
  `entity_type` varchar(80) NOT NULL,
  `new_value` mediumtext,
  `previous_value` mediumtext,
  `user_id` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `evaluation_forms` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `description` varchar(300) DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `feedback` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `comment` varchar(2000) NOT NULL,
  `from_employee_id` varchar(36) NOT NULL,
  `rating` decimal(3,1) DEFAULT NULL,
  `review_id` varchar(36) DEFAULT NULL,
  `to_employee_id` varchar(36) NOT NULL,
  `type` enum('MANAGER','PEER') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_feedback_to` (`to_employee_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `form_questions` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `form_id` varchar(36) NOT NULL,
  `order_no` int NOT NULL,
  `required` bit(1) NOT NULL,
  `section` varchar(80) NOT NULL,
  `text` varchar(500) NOT NULL,
  `type` enum('RATING','TEXT') NOT NULL,
  `weight` decimal(5,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_question_form` (`form_id`,`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `goals` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `deleted` bit(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `cycle_id` varchar(36) DEFAULT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `progress` int NOT NULL,
  `status` enum('CANCELLED','COMPLETED','IN_PROGRESS','NOT_STARTED') NOT NULL,
  `target_date` date DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `type` enum('GOAL','OKR') NOT NULL,
  `weight` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_goal_employee` (`employee_id`,`cycle_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `key_results` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `current_value` decimal(14,2) NOT NULL,
  `description` varchar(300) NOT NULL,
  `goal_id` varchar(36) NOT NULL,
  `target_value` decimal(14,2) NOT NULL,
  `unit` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_kr_goal` (`goal_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `outbox_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `attempts` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `event_key` varchar(100) DEFAULT NULL,
  `payload` mediumtext NOT NULL,
  `sent_at` datetime(6) DEFAULT NULL,
  `topic` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_outbox_unsent` (`sent_at`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `perf_employees` (
  `employee_id` varchar(36) NOT NULL,
  `department_id` varchar(36) DEFAULT NULL,
  `full_name` varchar(200) DEFAULT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `status` varchar(15) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `performance_reviews` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `achievements` varchar(2000) DEFAULT NULL,
  `approved_at` datetime(6) DEFAULT NULL,
  `cycle_id` varchar(36) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `employee_name` varchar(200) DEFAULT NULL,
  `final_rating` decimal(3,1) DEFAULT NULL,
  `form_id` varchar(36) NOT NULL,
  `hr_comment` varchar(1000) DEFAULT NULL,
  `improvement_areas` varchar(2000) DEFAULT NULL,
  `manager_feedback` varchar(2000) DEFAULT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `manager_rating` decimal(3,1) DEFAULT NULL,
  `manager_submitted_at` datetime(6) DEFAULT NULL,
  `self_rating` decimal(3,1) DEFAULT NULL,
  `self_submitted_at` datetime(6) DEFAULT NULL,
  `status` enum('APPROVED','MANAGER_SUBMITTED','SELF_PENDING','SELF_SUBMITTED') NOT NULL,
  `strengths` varchar(2000) DEFAULT NULL,
  `version` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_review_cycle_employee` (`cycle_id`,`employee_id`),
  KEY `idx_review_manager` (`manager_id`,`status`),
  KEY `idx_review_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `processed_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `consumer` varchar(120) NOT NULL,
  `event_id` varchar(64) NOT NULL,
  `processed_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_processed_event_consumer` (`event_id`,`consumer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `review_answers` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `answer_text` varchar(2000) DEFAULT NULL,
  `question_id` varchar(36) NOT NULL,
  `rating` decimal(3,1) DEFAULT NULL,
  `respondent` enum('MANAGER','SELF') NOT NULL,
  `review_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_answer` (`review_id`,`question_id`,`respondent`),
  KEY `idx_answer_review` (`review_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `review_cycles` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `form_id` varchar(36) NOT NULL,
  `manager_eval_deadline` date NOT NULL,
  `name` varchar(120) NOT NULL,
  `period_end` date NOT NULL,
  `period_start` date NOT NULL,
  `self_eval_deadline` date NOT NULL,
  `status` enum('ACTIVE','CLOSED','DRAFT') NOT NULL,
  `type` enum('ANNUAL','HALF_YEARLY','PROBATION','QUARTERLY') NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `review_history` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `action` varchar(30) NOT NULL,
  `comment` varchar(1000) DEFAULT NULL,
  `review_id` varchar(36) NOT NULL,
  `status` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_review_history` (`review_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS = 1;
