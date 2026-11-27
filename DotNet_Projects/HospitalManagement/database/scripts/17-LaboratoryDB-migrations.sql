-- EF Core migrations of the LaboratoryService (database LaboratoryDB). Idempotent: safe to run repeatedly. Only hdn_* tables + __hdn_migrations_history are touched.
USE LaboratoryDB;

CREATE TABLE IF NOT EXISTS `__hdn_migrations_history` (
    `MigrationId` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `ProductVersion` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK___hdn_migrations_history` PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;
START TRANSACTION;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE TABLE `hdn_inbox_messages` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `EventId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Consumer` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `ProcessedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_hdn_inbox_messages` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE TABLE `hdn_lab_tests` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `Code` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Name` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
        `SampleType` varchar(60) CHARACTER SET utf8mb4 NULL,
        `Price` decimal(10,2) NOT NULL,
        `TurnaroundHours` int NULL,
        `Active` tinyint(1) NOT NULL,
        CONSTRAINT `PK_hdn_lab_tests` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE TABLE `hdn_outbox_messages` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `Topic` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
        `Key` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `Payload` mediumtext CHARACTER SET utf8mb4 NOT NULL,
        `EventType` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `CorrelationId` varchar(64) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `SentAt` datetime(6) NULL,
        `Attempts` int NOT NULL,
        CONSTRAINT `PK_hdn_outbox_messages` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE TABLE `hdn_lab_requests` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `PatientId` bigint NOT NULL,
        `PatientName` varchar(121) CHARACTER SET utf8mb4 NOT NULL,
        `PatientEmail` varchar(120) CHARACTER SET utf8mb4 NULL,
        `DoctorId` bigint NOT NULL,
        `AppointmentId` bigint NULL,
        `TestId` bigint NOT NULL,
        `TestName` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
        `Price` decimal(10,2) NOT NULL,
        `Priority` varchar(10) CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
        `ClinicalNotes` varchar(500) CHARACTER SET utf8mb4 NULL,
        `AccessionNumber` varchar(40) CHARACTER SET utf8mb4 NULL,
        `QueuedAt` datetime(6) NULL,
        `RequestedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_hdn_lab_requests` PRIMARY KEY (`Id`),
        CONSTRAINT `fk_hdn_lab_request_test` FOREIGN KEY (`TestId`) REFERENCES `hdn_lab_tests` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE TABLE `hdn_lab_reports` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `RequestId` bigint NOT NULL,
        `ResultSummary` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
        `ResultDetails` varchar(4000) CHARACTER SET utf8mb4 NULL,
        `ReferenceRange` varchar(200) CHARACTER SET utf8mb4 NULL,
        `Abnormal` tinyint(1) NOT NULL,
        `ReportedBy` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `ReportedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_hdn_lab_reports` PRIMARY KEY (`Id`),
        CONSTRAINT `fk_hdn_report_request` FOREIGN KEY (`RequestId`) REFERENCES `hdn_lab_requests` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_inbox_event_consumer` ON `hdn_inbox_messages` (`EventId`, `Consumer`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_report_request` ON `hdn_lab_reports` (`RequestId`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE INDEX `IX_hdn_lab_requests_TestId` ON `hdn_lab_requests` (`TestId`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE INDEX `idx_lab_patient` ON `hdn_lab_requests` (`PatientId`, `RequestedAt`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE INDEX `idx_lab_status` ON `hdn_lab_requests` (`Status`, `Priority`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_lab_accession` ON `hdn_lab_requests` (`AccessionNumber`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_lab_test_code` ON `hdn_lab_tests` (`Code`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    CREATE INDEX `idx_outbox_unsent` ON `hdn_outbox_messages` (`SentAt`, `Id`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125212_InitialCreate') THEN
    INSERT INTO `__hdn_migrations_history` (`MigrationId`, `ProductVersion`)
    VALUES ('20261111125212_InitialCreate', '8.0.10');
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
COMMIT;
