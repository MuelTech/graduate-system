-- DropForeignKey
ALTER TABLE `adviser_requests` DROP FOREIGN KEY `adviser_requests_approved_by_fkey`;

-- AlterTable
ALTER TABLE `adviser_requests` ADD COLUMN `adviser_remarks` TEXT NULL,
    ADD COLUMN `adviser_responded_at` DATETIME(3) NULL,
    ADD COLUMN `adviser_status` ENUM('PENDING', 'CONFORMED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `dean_remarks` TEXT NULL,
    ADD COLUMN `dean_reviewed_at` DATETIME(3) NULL,
    ADD COLUMN `dean_reviewed_by_id` VARCHAR(191) NULL,
    ADD COLUMN `dean_status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `source_defense_schedule_id` VARCHAR(191) NULL,
    MODIFY `approved_by` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `adviser_requests_dean_reviewed_by_id_fkey` ON `adviser_requests`(`dean_reviewed_by_id`);

-- CreateIndex
CREATE INDEX `adviser_requests_source_defense_schedule_id_fkey` ON `adviser_requests`(`source_defense_schedule_id`);

-- AddForeignKey
ALTER TABLE `adviser_requests` ADD CONSTRAINT `adviser_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adviser_requests` ADD CONSTRAINT `adviser_requests_dean_reviewed_by_id_fkey` FOREIGN KEY (`dean_reviewed_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adviser_requests` ADD CONSTRAINT `adviser_requests_source_defense_schedule_id_fkey` FOREIGN KEY (`source_defense_schedule_id`) REFERENCES `defense_schedules`(`schedule_id`) ON DELETE SET NULL ON UPDATE CASCADE;
