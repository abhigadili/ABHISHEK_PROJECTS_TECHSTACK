-- Baseline schema of food_event_audit_db generated from the JPA entities (scripts/gen-schema.sh). Owned by event-audit-service only.

-- tables are listed alphabetically, so foreign keys may point at tables created later in this file
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `event_audit` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `attempts` int DEFAULT NULL,
  `consumer_class` varchar(100) DEFAULT NULL,
  `consumer_group` varchar(100) DEFAULT NULL,
  `consumer_service` varchar(60) DEFAULT NULL,
  `correlation_id` varchar(64) DEFAULT NULL,
  `dedupe_key` varchar(200) NOT NULL,
  `duration_ms` bigint DEFAULT NULL,
  `error_details` varchar(600) DEFAULT NULL,
  `event_id` varchar(36) DEFAULT NULL,
  `event_timestamp` datetime(6) DEFAULT NULL,
  `event_type` varchar(60) DEFAULT NULL,
  `headers_json` varchar(600) DEFAULT NULL,
  `last_replay_at` datetime(6) DEFAULT NULL,
  `msg_key` varchar(100) DEFAULT NULL,
  `offset_no` bigint DEFAULT NULL,
  `partition_no` int DEFAULT NULL,
  `payload_masked` text,
  `processed_at` datetime(6) DEFAULT NULL,
  `producer_service` varchar(60) DEFAULT NULL,
  `recorded_at` datetime(6) NOT NULL,
  `replay_count` int NOT NULL,
  `role` varchar(10) NOT NULL,
  `status` varchar(20) NOT NULL,
  `topic` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_audit_dedupe` (`dedupe_key`),
  KEY `idx_audit_topic_time` (`topic`,`event_timestamp`),
  KEY `idx_audit_event` (`event_id`),
  KEY `idx_audit_status` (`status`,`processed_at`),
  KEY `idx_audit_correlation` (`correlation_id`),
  KEY `idx_audit_type` (`event_type`),
  KEY `idx_audit_role_time` (`role`,`event_timestamp`)
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
CREATE TABLE IF NOT EXISTS `topology_edges` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `class_name` varchar(100) NOT NULL,
  `group_id` varchar(100) DEFAULT NULL,
  `last_seen` datetime(6) NOT NULL,
  `method` varchar(100) DEFAULT NULL,
  `role` varchar(10) NOT NULL,
  `service` varchar(60) NOT NULL,
  `topic` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_topology` (`service`,`role`,`topic`,`class_name`),
  KEY `idx_topology_topic` (`topic`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
