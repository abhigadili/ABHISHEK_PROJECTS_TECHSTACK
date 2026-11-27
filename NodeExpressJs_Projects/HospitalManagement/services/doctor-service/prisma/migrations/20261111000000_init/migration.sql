-- CreateTable
CREATE TABLE `hjs_doctors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `firstName` VARCHAR(60) NOT NULL,
    `lastName` VARCHAR(60) NOT NULL,
    `email` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `licenseNumber` VARCHAR(40) NOT NULL,
    `specialization` VARCHAR(80) NOT NULL,
    `qualification` VARCHAR(150) NULL,
    `experienceYears` INTEGER NULL,
    `consultationFee` DECIMAL(10, 2) NOT NULL,
    `hospitalId` INTEGER NOT NULL,
    `departmentId` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uk_doctor_user`(`userId`),
    UNIQUE INDEX `uk_doctor_email`(`email`),
    UNIQUE INDEX `uk_doctor_license`(`licenseNumber`),
    INDEX `idx_doctor_specialization`(`specialization`, `active`),
    INDEX `idx_doctor_hospital`(`hospitalId`, `departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_doctor_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `doctorId` INTEGER NOT NULL,
    `dayOfWeek` VARCHAR(10) NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `endTime` VARCHAR(5) NOT NULL,
    `slotMinutes` INTEGER NOT NULL,
    `breakStart` VARCHAR(5) NULL,
    `breakEnd` VARCHAR(5) NULL,

    UNIQUE INDEX `uk_schedule_doctor_day`(`doctorId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hjs_doctor_unavailability` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `doctorId` INTEGER NOT NULL,
    `unavailableDate` DATE NOT NULL,
    `reason` VARCHAR(200) NULL,

    UNIQUE INDEX `uk_unavailable_doctor_date`(`doctorId`, `unavailableDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `hjs_doctor_schedules` ADD CONSTRAINT `hjs_doctor_schedules_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `hjs_doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hjs_doctor_unavailability` ADD CONSTRAINT `hjs_doctor_unavailability_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `hjs_doctors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

