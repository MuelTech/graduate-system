-- DropForeignKey
ALTER TABLE `entrance_exam_scores` DROP FOREIGN KEY `entrance_exam_scores_graded_by_fkey`;

-- AlterTable
ALTER TABLE `entrance_exam_applications` MODIFY `status` ENUM('PENDING', 'APPROVED', 'TAKEN', 'PASSED', 'FAILED', 'DISQUALIFIED', 'APPEALED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `entrance_exam_scores` MODIFY `graded_by` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PASSED', 'FAILED', 'PENDING') NOT NULL;

-- AlterTable
ALTER TABLE `programs` ADD COLUMN `exam_essay_total` INTEGER NULL,
    ADD COLUMN `exam_mcq_total` INTEGER NULL,
    ADD COLUMN `exam_passing_score` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `entrance_exam_scores` ADD CONSTRAINT `entrance_exam_scores_graded_by_fkey` FOREIGN KEY (`graded_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
