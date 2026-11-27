-- Prisma init migration of the prescription-service (database PrescriptionDB): hjs_* tables only. Applied by scripts/create-databases.sh (baseline-safe) - do not run twice by hand.
USE PrescriptionDB;
-- CreateTable
CREATE TABLE `hjs_prescriptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `doctorId` INTEGER NOT NULL,
    `appointmentId` INTEGER NULL,
    `patientName` VARCHAR(121) NOT NULL,
    `patientEmail` VARCHAR(120) NULL,
    `doctorName` VARCHAR(125) NOT NULL,
    `diagnosis` VARCHAR(500) NULL,
    `notes` VARCHAR(1000) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
    `validUntil` DATE NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `statusChangedAt` DATETIME(3) NULL,

    INDEX `idx_rx_patient`(`patientId`, `issuedAt`),
    INDEX `idx_rx_status_valid`(`status`, `validUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_prescription_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `prescriptionId` INTEGER NOT NULL,
    `medicineName` VARCHAR(150) NOT NULL,
    `dosage` VARCHAR(60) NOT NULL,
    `frequency` VARCHAR(80) NOT NULL,
    `durationDays` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `instructions` VARCHAR(255) NULL,

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
ALTER TABLE `hjs_prescription_items` ADD CONSTRAINT `hjs_prescription_items_prescriptionId_fkey` FOREIGN KEY (`prescriptionId`) REFERENCES `hjs_prescriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

