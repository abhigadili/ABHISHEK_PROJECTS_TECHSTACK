-- Baseline schema of hr_tax_db (tables, keys, indexes). Generated from the JPA model, then owned by Flyway.
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
CREATE TABLE `investment_declarations` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `approved_amount` decimal(14,2) NOT NULL,
  `declaration_id` varchar(36) NOT NULL,
  `declared_amount` decimal(14,2) NOT NULL,
  `description` varchar(200) NOT NULL,
  `section` varchar(20) NOT NULL,
  `status` enum('DECLARED','PROOF_SUBMITTED','REJECTED','VERIFIED') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_investment_declaration` (`declaration_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `monthly_tds` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `computed_at` datetime(6) NOT NULL,
  `declaration_approved` bit(1) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `financial_year` varchar(7) NOT NULL,
  `regime` varchar(3) NOT NULL,
  `tds` decimal(14,2) NOT NULL,
  `tds_month` varchar(7) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tds_employee_month` (`employee_id`,`tds_month`),
  KEY `idx_tds_fy` (`employee_id`,`financial_year`)
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
CREATE TABLE `processed_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `consumer` varchar(120) NOT NULL,
  `event_id` varchar(64) NOT NULL,
  `processed_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_processed_event_consumer` (`event_id`,`consumer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `tax_computations` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `cess` decimal(14,2) NOT NULL,
  `computed_at` datetime(6) NOT NULL,
  `declaration_approved` bit(1) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `financial_year` varchar(7) NOT NULL,
  `gross_income` decimal(14,2) NOT NULL,
  `rebate` decimal(14,2) NOT NULL,
  `regime` enum('NEW','OLD') NOT NULL,
  `slab_tax` decimal(14,2) NOT NULL,
  `standard_deduction` decimal(14,2) NOT NULL,
  `taxable_income` decimal(14,2) NOT NULL,
  `total_deductions` decimal(14,2) NOT NULL,
  `total_tax` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_computation_employee_fy` (`employee_id`,`financial_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `tax_declaration_history` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `action` varchar(30) NOT NULL,
  `comment` varchar(500) DEFAULT NULL,
  `declaration_id` varchar(36) NOT NULL,
  `status` varchar(12) DEFAULT NULL,
  `total_declared` decimal(14,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_declaration_history` (`declaration_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `tax_declarations` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `employee_name` varchar(200) DEFAULT NULL,
  `financial_year` varchar(7) NOT NULL,
  `regime` enum('NEW','OLD') NOT NULL,
  `review_comment` varchar(500) DEFAULT NULL,
  `reviewed_at` datetime(6) DEFAULT NULL,
  `reviewer_id` varchar(36) DEFAULT NULL,
  `status` enum('APPROVED','DRAFT','REJECTED','SUBMITTED','UNDER_REVIEW') NOT NULL,
  `submitted_at` datetime(6) DEFAULT NULL,
  `total_approved` decimal(14,2) NOT NULL,
  `total_declared` decimal(14,2) NOT NULL,
  `version` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_declaration_employee_fy` (`employee_id`,`financial_year`),
  KEY `idx_declaration_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `tax_documents` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `doc_type` enum('FORM16_PART_A','FORM16_PART_B','OTHER','TAX_STATEMENT') NOT NULL,
  `document_id` varchar(36) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `financial_year` varchar(7) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_taxdoc_employee` (`employee_id`,`financial_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `tax_employees` (
  `employee_id` varchar(36) NOT NULL,
  `full_name` varchar(200) DEFAULT NULL,
  `status` varchar(15) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `tax_proofs` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `attempt_number` int NOT NULL,
  `declaration_id` varchar(36) NOT NULL,
  `document_id` varchar(36) NOT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `investment_id` varchar(36) NOT NULL,
  `reviewed_at` datetime(6) DEFAULT NULL,
  `reviewer_comment` varchar(500) DEFAULT NULL,
  `reviewer_id` varchar(36) DEFAULT NULL,
  `status` enum('REJECTED','SUBMITTED','VERIFIED') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_proof_investment` (`investment_id`),
  KEY `idx_proof_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `tax_rules` (
  `id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `active` bit(1) NOT NULL,
  `cess_percent` decimal(5,2) NOT NULL,
  `financial_year` varchar(7) NOT NULL,
  `rebate_amount` decimal(14,2) NOT NULL,
  `rebate_limit` decimal(14,2) NOT NULL,
  `regime` enum('NEW','OLD') NOT NULL,
  `section_limits` json NOT NULL,
  `slabs` json NOT NULL,
  `standard_deduction` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tax_rule_fy_regime` (`financial_year`,`regime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS = 1;
