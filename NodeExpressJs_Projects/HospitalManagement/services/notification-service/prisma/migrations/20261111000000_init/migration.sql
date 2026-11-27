-- CreateTable
CREATE TABLE `hjs_notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `recipientEmail` VARCHAR(120) NOT NULL,
    `recipientPhone` VARCHAR(20) NULL,
    `channel` VARCHAR(6) NOT NULL DEFAULT 'EMAIL',
    `subject` VARCHAR(200) NOT NULL,
    `message` VARCHAR(2000) NOT NULL,
    `eventType` VARCHAR(40) NOT NULL,
    `referenceId` VARCHAR(40) NULL,
    `status` VARCHAR(8) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `failureReason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,

    INDEX `idx_notification_recipient`(`recipientEmail`, `createdAt`),
    INDEX `idx_notification_event`(`eventType`, `referenceId`),
    INDEX `idx_notification_status`(`status`, `id`),
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

