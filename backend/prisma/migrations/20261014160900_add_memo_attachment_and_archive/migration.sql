-- AlterTable
ALTER TABLE `memos` ADD COLUMN `attachment_url` VARCHAR(191) NULL,
    ADD COLUMN `is_archived` BOOLEAN NOT NULL DEFAULT false;
