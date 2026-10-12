-- DropForeignKey
ALTER TABLE `menu_item` DROP FOREIGN KEY `menu_item_menuId_fkey`;
-- DropForeignKey
ALTER TABLE `menu_item` DROP FOREIGN KEY `menu_item_pageId_fkey`;
-- DropForeignKey
ALTER TABLE `menu_item` DROP FOREIGN KEY `menu_item_parentId_fkey`;
-- DropForeignKey
ALTER TABLE `menu_item` DROP FOREIGN KEY `menu_item_postId_fkey`;
-- DropForeignKey
ALTER TABLE `page` DROP FOREIGN KEY `page_authorId_fkey`;
-- DropForeignKey
ALTER TABLE `page` DROP FOREIGN KEY `page_featuredImageId_fkey`;
-- DropForeignKey
ALTER TABLE `page_revision` DROP FOREIGN KEY `page_revision_createdById_fkey`;
-- DropForeignKey
ALTER TABLE `page_revision` DROP FOREIGN KEY `page_revision_pageId_fkey`;
-- DropForeignKey
ALTER TABLE `template` DROP FOREIGN KEY `template_createdById_fkey`;
-- AlterTable
ALTER TABLE `seo_data` MODIFY `entityType` ENUM('POST') NOT NULL;
-- DropTable
DROP TABLE `menu`;
-- DropTable
DROP TABLE `menu_item`;
-- DropTable
DROP TABLE `page`;
-- DropTable
DROP TABLE `page_revision`;
-- DropTable
DROP TABLE `site_setting`;
-- DropTable
DROP TABLE `template`;
