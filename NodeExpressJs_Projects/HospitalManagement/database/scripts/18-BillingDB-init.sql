-- Prisma init migration of the billing-service (database BillingDB): hjs_* tables only. Applied by scripts/create-databases.sh (baseline-safe) - do not run twice by hand.
USE BillingDB;
-- CreateTable
CREATE TABLE `hjs_bills` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `billNumber` VARCHAR(40) NOT NULL,
    `patientId` INTEGER NOT NULL,
    `patientName` VARCHAR(121) NOT NULL,
    `patientEmail` VARCHAR(120) NULL,
    `billType` VARCHAR(12) NOT NULL,
    `referenceType` VARCHAR(20) NULL,
    `referenceId` INTEGER NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `dueDate` DATE NOT NULL,
    `lastReminderAt` DATETIME(3) NULL,
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_bill_number`(`billNumber`),
    INDEX `idx_bill_patient`(`patientId`, `createdAt`),
    INDEX `idx_bill_status_due`(`status`, `dueDate`),
    UNIQUE INDEX `uk_bill_reference`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_bill_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `billId` INTEGER NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `billId` INTEGER NOT NULL,
    `transactionRef` VARCHAR(40) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` VARCHAR(15) NOT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    `activeBillId` INTEGER NULL,
    `failureReason` VARCHAR(255) NULL,
    `initiatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `uk_payment_txn`(`transactionRef`),
    UNIQUE INDEX `uk_payment_one_pending_per_bill`(`activeBillId`),
    INDEX `idx_payment_status`(`status`, `initiatedAt`),
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
ALTER TABLE `hjs_bill_items` ADD CONSTRAINT `hjs_bill_items_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `hjs_bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hjs_payments` ADD CONSTRAINT `hjs_payments_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `hjs_bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

