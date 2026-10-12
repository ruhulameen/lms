-- CreateTable
CREATE TABLE `rate_limit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(255) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `windowStart` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rate_limit_key_key`(`key`),
    INDEX `rate_limit_windowStart_idx`(`windowStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
