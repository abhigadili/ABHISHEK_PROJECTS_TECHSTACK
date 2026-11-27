-- EF Core migrations of the DoctorService (database DoctorDB). Idempotent: safe to run repeatedly. Only hdn_* tables + __hdn_migrations_history are touched.
USE DoctorDB;

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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    CREATE TABLE `hdn_doctors` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `UserId` bigint NULL,
        `FirstName` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `LastName` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `Email` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `Phone` varchar(20) CHARACTER SET utf8mb4 NULL,
        `LicenseNumber` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Specialization` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Qualification` varchar(150) CHARACTER SET utf8mb4 NULL,
        `ExperienceYears` int NULL,
        `ConsultationFee` decimal(10,2) NOT NULL,
        `HospitalId` bigint NOT NULL,
        `DepartmentId` bigint NULL,
        `Active` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_hdn_doctors` PRIMARY KEY (`Id`)
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    CREATE TABLE `hdn_doctor_schedules` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `DoctorId` bigint NOT NULL,
        `DayOfWeek` varchar(10) CHARACTER SET utf8mb4 NOT NULL,
        `StartTime` time(6) NOT NULL,
        `EndTime` time(6) NOT NULL,
        `SlotMinutes` int NOT NULL,
        `BreakStart` time(6) NULL,
        `BreakEnd` time(6) NULL,
        CONSTRAINT `PK_hdn_doctor_schedules` PRIMARY KEY (`Id`),
        CONSTRAINT `fk_hdn_schedule_doctor` FOREIGN KEY (`DoctorId`) REFERENCES `hdn_doctors` (`Id`) ON DELETE CASCADE
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    CREATE TABLE `hdn_doctor_unavailability` (
        `Id` bigint NOT NULL AUTO_INCREMENT,
        `DoctorId` bigint NOT NULL,
        `UnavailableDate` date NOT NULL,
        `Reason` varchar(200) CHARACTER SET utf8mb4 NULL,
        CONSTRAINT `PK_hdn_doctor_unavailability` PRIMARY KEY (`Id`),
        CONSTRAINT `fk_hdn_unavailable_doctor` FOREIGN KEY (`DoctorId`) REFERENCES `hdn_doctors` (`Id`) ON DELETE CASCADE
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
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_schedule_doctor_day` ON `hdn_doctor_schedules` (`DoctorId`, `DayOfWeek`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_unavailable_doctor_date` ON `hdn_doctor_unavailability` (`DoctorId`, `UnavailableDate`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    CREATE INDEX `idx_doctor_hospital` ON `hdn_doctors` (`HospitalId`, `DepartmentId`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    CREATE INDEX `idx_doctor_specialization` ON `hdn_doctors` (`Specialization`, `Active`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_doctor_email` ON `hdn_doctors` (`Email`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_doctor_license` ON `hdn_doctors` (`LicenseNumber`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    CREATE UNIQUE INDEX `uk_doctor_user` ON `hdn_doctors` (`UserId`);
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__hdn_migrations_history` WHERE `MigrationId` = '20261111124824_InitialCreate') THEN
    INSERT INTO `__hdn_migrations_history` (`MigrationId`, `ProductVersion`)
    VALUES ('20261111124824_InitialCreate', '8.0.10');
    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;
COMMIT;
