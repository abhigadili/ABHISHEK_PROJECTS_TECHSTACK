-- CreateTable
CREATE TABLE `hjs_appointments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `doctorId` INTEGER NOT NULL,
    `appointmentDate` DATE NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `endTime` VARCHAR(5) NOT NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'BOOKED',
    `slotKey` VARCHAR(80) NULL,
    `reason` VARCHAR(255) NULL,
    `cancelReason` VARCHAR(255) NULL,
    `notes` VARCHAR(1000) NULL,
    `fee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `paymentStatus` VARCHAR(12) NOT NULL DEFAULT 'NOT_BILLED',
    `billNumber` VARCHAR(40) NULL,
    `patientName` VARCHAR(121) NOT NULL,
    `patientEmail` VARCHAR(120) NULL,
    `doctorName` VARCHAR(125) NOT NULL,
    `doctorEmail` VARCHAR(120) NULL,
    `reminderSent` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_appointment_slot`(`slotKey`),
    INDEX `idx_appt_doctor_date`(`doctorId`, `appointmentDate`, `status`),
    INDEX `idx_appt_patient`(`patientId`, `appointmentDate`),
    INDEX `idx_appt_reminder`(`status`, `reminderSent`, `appointmentDate`),
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

