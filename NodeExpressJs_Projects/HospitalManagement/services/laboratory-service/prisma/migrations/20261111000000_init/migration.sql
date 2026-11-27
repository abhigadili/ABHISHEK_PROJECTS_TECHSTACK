-- CreateTable
CREATE TABLE `hjs_lab_tests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `sampleType` VARCHAR(60) NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `turnaroundHours` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uk_lab_test_code`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_lab_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `patientName` VARCHAR(121) NOT NULL,
    `patientEmail` VARCHAR(120) NULL,
    `doctorId` INTEGER NOT NULL,
    `appointmentId` INTEGER NULL,
    `testId` INTEGER NOT NULL,
    `testName` VARCHAR(150) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `priority` VARCHAR(10) NOT NULL DEFAULT 'ROUTINE',
    `status` VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    `clinicalNotes` VARCHAR(500) NULL,
    `accessionNumber` VARCHAR(40) NULL,
    `queuedAt` DATETIME(3) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_lab_accession`(`accessionNumber`),
    INDEX `idx_lab_patient`(`patientId`, `requestedAt`),
    INDEX `idx_lab_status`(`status`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_lab_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestId` INTEGER NOT NULL,
    `resultSummary` VARCHAR(1000) NOT NULL,
    `resultDetails` VARCHAR(4000) NULL,
    `referenceRange` VARCHAR(200) NULL,
    `abnormal` BOOLEAN NOT NULL DEFAULT false,
    `reportedBy` VARCHAR(60) NOT NULL,
    `reportedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `attachmentName` VARCHAR(200) NULL,
    `attachmentPath` VARCHAR(300) NULL,
    `attachmentMime` VARCHAR(80) NULL,
    `attachmentSize` INTEGER NULL,

    UNIQUE INDEX `uk_report_request`(`requestId`),
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
ALTER TABLE `hjs_lab_requests` ADD CONSTRAINT `hjs_lab_requests_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `hjs_lab_tests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hjs_lab_reports` ADD CONSTRAINT `hjs_lab_reports_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `hjs_lab_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

