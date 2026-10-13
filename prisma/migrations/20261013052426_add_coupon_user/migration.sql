-- CreateTable
CREATE TABLE `coupon_user` (
    `couponId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `coupon_user_userId_idx`(`userId`),
    PRIMARY KEY (`couponId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `coupon_user` ADD CONSTRAINT `coupon_user_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_user` ADD CONSTRAINT `coupon_user_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
