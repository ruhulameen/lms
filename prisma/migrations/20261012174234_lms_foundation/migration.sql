-- AlterTable
ALTER TABLE `seo_data` MODIFY `entityType` ENUM('POST', 'COURSE') NOT NULL;

-- CreateTable
CREATE TABLE `course_category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `course_category_slug_key`(`slug`),
    INDEX `course_category_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_tag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `course_tag_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_tag_link` (
    `courseId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    INDEX `course_tag_link_tagId_idx`(`tagId`),
    PRIMARY KEY (`courseId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `subtitle` VARCHAR(255) NULL,
    `shortDescription` TEXT NULL,
    `description` JSON NULL,
    `thumbnailId` INTEGER NULL,
    `externalImageId` VARCHAR(100) NULL,
    `introVideoKey` VARCHAR(255) NULL,
    `introVideoName` VARCHAR(191) NULL,
    `introVideoMime` VARCHAR(100) NULL,
    `introVideoSize` BIGINT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `compareAtPrice` DECIMAL(10, 2) NULL,
    `level` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS') NOT NULL DEFAULT 'ALL_LEVELS',
    `language` VARCHAR(50) NOT NULL DEFAULT 'English',
    `durationMinutes` INTEGER NULL,
    `badge` VARCHAR(60) NULL,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `instructorId` INTEGER NULL,
    `categoryId` INTEGER NULL,
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `publishAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `course_slug_key`(`slug`),
    INDEX `course_thumbnailId_idx`(`thumbnailId`),
    INDEX `course_instructorId_idx`(`instructorId`),
    INDEX `course_createdById_idx`(`createdById`),
    INDEX `course_categoryId_idx`(`categoryId`),
    INDEX `course_status_publishAt_idx`(`status`, `publishAt`),
    INDEX `course_publishedAt_idx`(`publishedAt`),
    INDEX `course_featured_idx`(`featured`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_module` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `courseId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `course_module_courseId_position_idx`(`courseId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `moduleId` INTEGER NOT NULL,
    `courseId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `type` ENUM('VIDEO', 'TEXT', 'DOCUMENT', 'QUIZ') NOT NULL,
    `content` JSON NULL,
    `fileKey` VARCHAR(255) NULL,
    `fileName` VARCHAR(191) NULL,
    `fileMimeType` VARCHAR(100) NULL,
    `fileSize` BIGINT NULL,
    `durationSeconds` INTEGER NULL,
    `position` INTEGER NOT NULL,
    `isFreePreview` BOOLEAN NOT NULL DEFAULT false,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lesson_moduleId_position_idx`(`moduleId`, `position`),
    UNIQUE INDEX `lesson_courseId_slug_key`(`courseId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_resource` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lessonId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileKey` VARCHAR(255) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileMimeType` VARCHAR(100) NOT NULL,
    `fileSize` BIGINT NOT NULL,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lesson_resource_lessonId_position_idx`(`lessonId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrolment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `courseId` INTEGER NOT NULL,
    `source` ENUM('FREE', 'ADMIN', 'ORDER') NOT NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `lastLessonId` INTEGER NULL,
    `assignedById` INTEGER NULL,
    `progressPercent` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `enrolment_courseId_status_idx`(`courseId`, `status`),
    INDEX `enrolment_lastLessonId_idx`(`lastLessonId`),
    INDEX `enrolment_assignedById_idx`(`assignedById`),
    UNIQUE INDEX `enrolment_userId_courseId_key`(`userId`, `courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_progress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enrolmentId` INTEGER NOT NULL,
    `lessonId` INTEGER NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `lastPositionSeconds` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lesson_progress_lessonId_idx`(`lessonId`),
    UNIQUE INDEX `lesson_progress_enrolmentId_lessonId_key`(`enrolmentId`, `lessonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_review` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `courseId` INTEGER NOT NULL,
    `rating` INTEGER NOT NULL,
    `title` VARCHAR(150) NULL,
    `body` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `moderatedById` INTEGER NULL,
    `moderatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `course_review_courseId_status_idx`(`courseId`, `status`),
    INDEX `course_review_moderatedById_idx`(`moderatedById`),
    UNIQUE INDEX `course_review_userId_courseId_key`(`userId`, `courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quiz` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lessonId` INTEGER NOT NULL,
    `passingScore` INTEGER NOT NULL DEFAULT 70,
    `attemptLimit` INTEGER NULL,
    `timeLimitMinutes` INTEGER NULL,
    `passFeedback` TEXT NULL,
    `failFeedback` TEXT NULL,
    `shuffleQuestions` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quiz_lessonId_key`(`lessonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quizId` INTEGER NOT NULL,
    `type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE') NOT NULL,
    `text` TEXT NOT NULL,
    `explanation` TEXT NULL,
    `points` INTEGER NOT NULL DEFAULT 1,
    `position` INTEGER NOT NULL,
    `options` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `question_quizId_position_idx`(`quizId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quiz_attempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quizId` INTEGER NOT NULL,
    `enrolmentId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedAt` DATETIME(3) NULL,
    `score` INTEGER NULL,
    `maxScore` INTEGER NULL,
    `percent` DOUBLE NULL,
    `passed` BOOLEAN NULL,
    `answers` JSON NULL,

    INDEX `quiz_attempt_quizId_enrolmentId_idx`(`quizId`, `enrolmentId`),
    INDEX `quiz_attempt_enrolmentId_idx`(`enrolmentId`),
    INDEX `quiz_attempt_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enrolmentId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `courseId` INTEGER NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `revokedById` INTEGER NULL,
    `learnerName` VARCHAR(191) NOT NULL,
    `courseTitle` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `certificate_enrolmentId_key`(`enrolmentId`),
    UNIQUE INDEX `certificate_code_key`(`code`),
    INDEX `certificate_userId_idx`(`userId`),
    INDEX `certificate_courseId_idx`(`courseId`),
    INDEX `certificate_revokedById_idx`(`revokedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `course_tag_link` ADD CONSTRAINT `course_tag_link_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_tag_link` ADD CONSTRAINT `course_tag_link_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `course_tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course` ADD CONSTRAINT `course_thumbnailId_fkey` FOREIGN KEY (`thumbnailId`) REFERENCES `media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course` ADD CONSTRAINT `course_instructorId_fkey` FOREIGN KEY (`instructorId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course` ADD CONSTRAINT `course_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `course_category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course` ADD CONSTRAINT `course_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_module` ADD CONSTRAINT `course_module_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson` ADD CONSTRAINT `lesson_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `course_module`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson` ADD CONSTRAINT `lesson_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_resource` ADD CONSTRAINT `lesson_resource_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrolment` ADD CONSTRAINT `enrolment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrolment` ADD CONSTRAINT `enrolment_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrolment` ADD CONSTRAINT `enrolment_lastLessonId_fkey` FOREIGN KEY (`lastLessonId`) REFERENCES `lesson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrolment` ADD CONSTRAINT `enrolment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_enrolmentId_fkey` FOREIGN KEY (`enrolmentId`) REFERENCES `enrolment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_review` ADD CONSTRAINT `course_review_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_review` ADD CONSTRAINT `course_review_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_review` ADD CONSTRAINT `course_review_moderatedById_fkey` FOREIGN KEY (`moderatedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz` ADD CONSTRAINT `quiz_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question` ADD CONSTRAINT `question_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `quiz`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attempt` ADD CONSTRAINT `quiz_attempt_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `quiz`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attempt` ADD CONSTRAINT `quiz_attempt_enrolmentId_fkey` FOREIGN KEY (`enrolmentId`) REFERENCES `enrolment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attempt` ADD CONSTRAINT `quiz_attempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate` ADD CONSTRAINT `certificate_enrolmentId_fkey` FOREIGN KEY (`enrolmentId`) REFERENCES `enrolment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate` ADD CONSTRAINT `certificate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate` ADD CONSTRAINT `certificate_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate` ADD CONSTRAINT `certificate_revokedById_fkey` FOREIGN KEY (`revokedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
