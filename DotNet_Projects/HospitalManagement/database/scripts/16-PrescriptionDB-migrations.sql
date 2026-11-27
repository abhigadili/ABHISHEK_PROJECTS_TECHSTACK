-- EF Core migrations of the PrescriptionService (database PrescriptionDB). Idempotent: safe to run repeatedly. Only hdn_* tables + __hdn_migrations_history are touched.
USE PrescriptionDB;

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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125118_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125118_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125118_InitialCreate') THEN
    CREATE TABLE `hdn_prescriptions` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `PatientId` bigint NOT NULL,
        `DoctorId` bigint NOT NULL,
        `AppointmentId` bigint NULL,
        `PatientName` varchar(121) CHARACTER SET utf8mb4 NOT NULL,
        `PatientEmail` varchar(120) CHARACTER SET utf8mb4 NULL,
        `DoctorName` varchar(125) CHARACTER SET utf8mb4 NOT NULL,
        `Diagnosis` varchar(500) CHARACTER SET utf8mb4 NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `Status` varchar(12) CHARACTER SET utf8mb4 NOT NULL,
        `ValidUntil` date NOT NULL,
        `IssuedAt` datetime(6) NOT NULL,
        `StatusChangedAt` datetime(6) NULL,
        CONSTRAINT `PK_hdn_prescriptions` PRIMARY KEY (`Id`)
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125118_InitialCreate') THEN
    CREATE TABLE `hdn_prescription_items` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `PrescriptionId` bigint NOT NULL,
        `MedicineName` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
        `Dosage` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `Frequency` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `DurationDays` int NOT NULL,
        `Quantity` int NOT NULL,
        `Instructions` varchar(255) CHARACTER SET utf8mb4 NULL,
        CONSTRAINT `PK_hdn_prescription_items` PRIMARY KEY (`Id`),
        CONSTRAINT `fk_hdn_rx_item_prescription` FOREIGN KEY (`PrescriptionId`) REFERENCES `hdn_prescriptions` (`Id`) ON DELETE CASCADE
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125118_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125118_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125118_InitialCreate') THEN
    CREATE INDEX `IX_hdn_prescription_items_PrescriptionId` ON `hdn_prescription_items` (`PrescriptionId`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125118_InitialCreate') THEN
    CREATE INDEX `idx_rx_patient` ON `hdn_prescriptions` (`PatientId`, `IssuedAt`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125118_InitialCreate') THEN
    CREATE INDEX `idx_rx_status_valid` ON `hdn_prescriptions` (`Status`, `ValidUntil`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125118_InitialCreate') THEN
    INSERT INTO `__hdn_migrations_history` (`MigrationId`, `ProductVersion`)
    VALUES ('20261111125118_InitialCreate', '8.0.10');
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
COMMIT;
