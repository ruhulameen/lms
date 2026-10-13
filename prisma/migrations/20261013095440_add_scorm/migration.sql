-- AlterTable
ALTER TABLE `lesson` ADD COLUMN `scormEntry` VARCHAR(500) NULL,
    ADD COLUMN `scormLaunchData` TEXT NULL,
    ADD COLUMN `scormMastery` INTEGER NULL,
    ADD COLUMN `scormPrefix` VARCHAR(255) NULL,
    MODIFY `type` ENUM('VIDEO', 'TEXT', 'DOCUMENT', 'QUIZ', 'SCORM') NOT NULL;

-- CreateTable
CREATE TABLE `scorm_state` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enrolmentId` INTEGER NOT NULL,
    `lessonId` INTEGER NOT NULL,
    `lessonStatus` VARCHAR(20) NOT NULL DEFAULT 'not attempted',
    `lessonLocation` VARCHAR(1000) NULL,
    `scoreRaw` DOUBLE NULL,
    `scoreMin` DOUBLE NULL,
    `scoreMax` DOUBLE NULL,
    `suspendData` MEDIUMTEXT NULL,
    `totalTimeSeconds` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `scorm_state_lessonId_idx`(`lessonId`),
    UNIQUE INDEX `scorm_state_enrolmentId_lessonId_key`(`enrolmentId`, `lessonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scorm_state` ADD CONSTRAINT `scorm_state_enrolmentId_fkey` FOREIGN KEY (`enrolmentId`) REFERENCES `enrolment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scorm_state` ADD CONSTRAINT `scorm_state_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
