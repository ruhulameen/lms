-- AlterTable
ALTER TABLE `order` ADD COLUMN `attribution` JSON NULL,
    ADD COLUMN `purchaseTrackedAt` DATETIME(3) NULL,
    ADD COLUMN `trackingContext` JSON NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `attribution` JSON NULL;
