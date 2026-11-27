-- CreateTable
CREATE TABLE `hjs_patients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `firstName` VARCHAR(60) NOT NULL,
    `lastName` VARCHAR(60) NOT NULL,
    `dateOfBirth` DATE NOT NULL,
    `gender` VARCHAR(10) NOT NULL,
    `email` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `identityNumber` VARCHAR(40) NULL,
    `bloodGroup` VARCHAR(5) NULL,
    `address` VARCHAR(255) NULL,
    `emergencyContactName` VARCHAR(100) NULL,
    `emergencyContactPhone` VARCHAR(20) NULL,
    `knownAllergies` VARCHAR(500) NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_patient_user`(`userId`),
    UNIQUE INDEX `uk_patient_email`(`email`),
    UNIQUE INDEX `uk_patient_phone`(`phone`),
    UNIQUE INDEX `uk_patient_identity`(`identityNumber`),
    INDEX `idx_patient_name`(`lastName`, `firstName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_outbox_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `topic` VARCHAR(150) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `payload` MEDIUMTEXT NOT NULL,
    `correlationId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,

    INDEX `idx_outbox_unsent`(`sentAt`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_processed_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` VARCHAR(64) NOT NULL,
    `consumer` VARCHAR(120) NOT NULL,
    `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uk_processed_event_consumer`(`eventId`, `consumer`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

