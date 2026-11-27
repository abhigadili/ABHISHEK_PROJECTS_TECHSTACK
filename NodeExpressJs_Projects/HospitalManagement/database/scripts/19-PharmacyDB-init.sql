-- Prisma init migration of the pharmacy-service (database PharmacyDB): hjs_* tables only. Applied by scripts/create-databases.sh (baseline-safe) - do not run twice by hand.
USE PharmacyDB;
-- CreateTable
CREATE TABLE `hjs_medicines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(40) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `genericName` VARCHAR(150) NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `stockQuantity` INTEGER NOT NULL,
    `reorderLevel` INTEGER NOT NULL DEFAULT 20,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `lastLowStockAlertAt` DATETIME(3) NULL,

    UNIQUE INDEX `uk_medicine_sku`(`sku`),
    INDEX `idx_medicine_name`(`name`),
    INDEX `idx_medicine_generic`(`genericName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_pharmacy_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `prescriptionId` INTEGER NOT NULL,
    `patientId` INTEGER NOT NULL,
    `patientName` VARCHAR(121) NOT NULL,
    `patientEmail` VARCHAR(120) NULL,
    `doctorName` VARCHAR(125) NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `dispensedBy` VARCHAR(60) NULL,
    `dispensedAt` DATETIME(3) NULL,
    `rejectionReason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uk_order_prescription`(`prescriptionId`),
    INDEX `idx_order_status`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_pharmacy_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `medicineName` VARCHAR(150) NOT NULL,
    `dosage` VARCHAR(60) NULL,
    `quantity` INTEGER NOT NULL,
    `medicineId` INTEGER NULL,
    `unitPrice` DECIMAL(10, 2) NULL,

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
ALTER TABLE `hjs_pharmacy_order_items` ADD CONSTRAINT `hjs_pharmacy_order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `hjs_pharmacy_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hjs_pharmacy_order_items` ADD CONSTRAINT `hjs_pharmacy_order_items_medicineId_fkey` FOREIGN KEY (`medicineId`) REFERENCES `hjs_medicines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

