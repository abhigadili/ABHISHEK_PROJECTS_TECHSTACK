-- EF Core migrations of the AppointmentService (database AppointmentDB). Idempotent: safe to run repeatedly. Only hdn_* tables + __hdn_migrations_history are touched.
USE AppointmentDB;

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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124951_InitialCreate') THEN
    CREATE TABLE `hdn_appointments` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `PatientId` bigint NOT NULL,
        `DoctorId` bigint NOT NULL,
        `AppointmentDate` date NOT NULL,
        `StartTime` time(6) NOT NULL,
        `EndTime` time(6) NOT NULL,
        `Status` varchar(12) CHARACTER SET utf8mb4 NOT NULL,
        `SlotKey` varchar(80) CHARACTER SET utf8mb4 NULL,
        `Reason` varchar(255) CHARACTER SET utf8mb4 NULL,
        `CancelReason` varchar(255) CHARACTER SET utf8mb4 NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `Fee` decimal(10,2) NOT NULL,
        `PaymentStatus` varchar(12) CHARACTER SET utf8mb4 NOT NULL,
        `BillNumber` varchar(40) CHARACTER SET utf8mb4 NULL,
        `PatientName` varchar(121) CHARACTER SET utf8mb4 NOT NULL,
        `PatientEmail` varchar(120) CHARACTER SET utf8mb4 NULL,
        `DoctorName` varchar(125) CHARACTER SET utf8mb4 NOT NULL,
        `DoctorEmail` varchar(120) CHARACTER SET utf8mb4 NULL,
        `ReminderSent` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_hdn_appointments` PRIMARY KEY (`Id`)
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124951_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124951_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124951_InitialCreate') THEN
    CREATE INDEX `idx_appt_doctor_date` ON `hdn_appointments` (`DoctorId`, `AppointmentDate`, `Status`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124951_InitialCreate') THEN
    CREATE INDEX `idx_appt_patient` ON `hdn_appointments` (`PatientId`, `AppointmentDate`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124951_InitialCreate') THEN
    CREATE INDEX `idx_appt_reminder` ON `hdn_appointments` (`Status`, `ReminderSent`, `AppointmentDate`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124951_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_appointment_slot` ON `hdn_appointments` (`SlotKey`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124951_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124951_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124951_InitialCreate') THEN
    INSERT INTO `__hdn_migrations_history` (`MigrationId`, `ProductVersion`)
    VALUES ('20261111124951_InitialCreate', '8.0.10');
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
COMMIT;
