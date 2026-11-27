-- EF Core migrations of the NotificationService (database NotificationDB). Idempotent: safe to run repeatedly. Only hdn_* tables + __hdn_migrations_history are touched.
USE NotificationDB;

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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125528_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125528_InitialCreate') THEN
    CREATE TABLE `hdn_notifications` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `RecipientEmail` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `RecipientPhone` varchar(20) CHARACTER SET utf8mb4 NULL,
        `Channel` varchar(6) CHARACTER SET utf8mb4 NOT NULL,
        `Subject` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
        `Message` varchar(2000) CHARACTER SET utf8mb4 NOT NULL,
        `EventType` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `ReferenceId` varchar(40) CHARACTER SET utf8mb4 NULL,
        `Status` varchar(8) CHARACTER SET utf8mb4 NOT NULL,
        `Attempts` int NOT NULL,
        `FailureReason` varchar(255) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `SentAt` datetime(6) NULL,
        CONSTRAINT `PK_hdn_notifications` PRIMARY KEY (`Id`)
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125528_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125528_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125528_InitialCreate') THEN
    CREATE INDEX `idx_notification_event` ON `hdn_notifications` (`EventType`, `ReferenceId`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125528_InitialCreate') THEN
    CREATE INDEX `idx_notification_recipient` ON `hdn_notifications` (`RecipientEmail`, `CreatedAt`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125528_InitialCreate') THEN
    CREATE INDEX `idx_notification_status` ON `hdn_notifications` (`Status`, `Id`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125528_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125528_InitialCreate') THEN
    INSERT INTO `__hdn_migrations_history` (`MigrationId`, `ProductVersion`)
    VALUES ('20261111125528_InitialCreate', '8.0.10');
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
COMMIT;
