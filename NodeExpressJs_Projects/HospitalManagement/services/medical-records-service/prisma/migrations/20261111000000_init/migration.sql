-- CreateTable
CREATE TABLE `hjs_patient_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `patientName` VARCHAR(121) NOT NULL,
    `chronicConditions` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_record_patient`(`patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_record_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `recordId` INTEGER NOT NULL,
    `patientId` INTEGER NOT NULL,
    `entryType` VARCHAR(15) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `details` VARCHAR(4000) NULL,
    `doctorId` INTEGER NULL,
    `referenceType` VARCHAR(30) NULL,
    `referenceId` INTEGER NULL,
    `source` VARCHAR(10) NOT NULL DEFAULT 'MANUAL',
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_entry_patient_time`(`patientId`, `recordedAt`),
    UNIQUE INDEX `uk_entry_reference`(`entryType`, `referenceType`, `referenceId`),
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

-- AddForeignKey
ALTER TABLE `hjs_record_entries` ADD CONSTRAINT `hjs_record_entries_recordId_fkey` FOREIGN KEY (`recordId`) REFERENCES `hjs_patient_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

