-- EF Core migrations of the PharmacyService (database PharmacyDB). Idempotent: safe to run repeatedly. Only hdn_* tables + __hdn_migrations_history are touched.
USE PharmacyDB;

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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    CREATE TABLE `hdn_medicines` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `Sku` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Name` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
        `GenericName` varchar(150) CHARACTER SET utf8mb4 NULL,
        `UnitPrice` decimal(10,2) NOT NULL,
        `StockQuantity` int NOT NULL,
        `ReorderLevel` int NOT NULL,
        `Active` tinyint(1) NOT NULL,
        `LastLowStockAlertAt` datetime(6) NULL,
        CONSTRAINT `PK_hdn_medicines` PRIMARY KEY (`Id`)
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    CREATE TABLE `hdn_pharmacy_orders` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `PrescriptionId` bigint NOT NULL,
        `PatientId` bigint NOT NULL,
        `PatientName` varchar(121) CHARACTER SET utf8mb4 NOT NULL,
        `PatientEmail` varchar(120) CHARACTER SET utf8mb4 NULL,
        `DoctorName` varchar(125) CHARACTER SET utf8mb4 NULL,
        `Status` varchar(10) CHARACTER SET utf8mb4 NOT NULL,
        `TotalAmount` decimal(12,2) NOT NULL,
        `DispensedBy` varchar(60) CHARACTER SET utf8mb4 NULL,
        `DispensedAt` datetime(6) NULL,
        `RejectionReason` varchar(255) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_hdn_pharmacy_orders` PRIMARY KEY (`Id`)
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    CREATE TABLE `hdn_pharmacy_order_items` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `OrderId` bigint NOT NULL,
        `MedicineName` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
        `Dosage` varchar(60) CHARACTER SET utf8mb4 NULL,
        `Quantity` int NOT NULL,
        `MedicineId` bigint NULL,
        `UnitPrice` decimal(10,2) NULL,
        CONSTRAINT `PK_hdn_pharmacy_order_items` PRIMARY KEY (`Id`),
        CONSTRAINT `fk_hdn_order_item_medicine` FOREIGN KEY (`MedicineId`) REFERENCES `hdn_medicines` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `fk_hdn_order_item_order` FOREIGN KEY (`OrderId`) REFERENCES `hdn_pharmacy_orders` (`Id`) ON DELETE CASCADE
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    CREATE INDEX `idx_medicine_generic` ON `hdn_medicines` (`GenericName`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    CREATE INDEX `idx_medicine_name` ON `hdn_medicines` (`Name`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_medicine_sku` ON `hdn_medicines` (`Sku`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    CREATE INDEX `IX_hdn_pharmacy_order_items_MedicineId` ON `hdn_pharmacy_order_items` (`MedicineId`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    CREATE INDEX `IX_hdn_pharmacy_order_items_OrderId` ON `hdn_pharmacy_order_items` (`OrderId`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    CREATE INDEX `idx_order_status` ON `hdn_pharmacy_orders` (`Status`, `CreatedAt`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_order_prescription` ON `hdn_pharmacy_orders` (`PrescriptionId`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111125436_InitialCreate') THEN
    INSERT INTO `__hdn_migrations_history` (`MigrationId`, `ProductVersion`)
    VALUES ('20261111125436_InitialCreate', '8.0.10');
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
COMMIT;
