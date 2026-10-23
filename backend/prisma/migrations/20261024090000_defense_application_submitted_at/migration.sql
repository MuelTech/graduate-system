-- AlterTable
ALTER TABLE `thesis_records` ADD COLUMN `title_application_submitted_at` DATETIME(3) NULL,
    ADD COLUMN `proposal_application_submitted_at` DATETIME(3) NULL,
    ADD COLUMN `final_application_submitted_at` DATETIME(3) NULL;
