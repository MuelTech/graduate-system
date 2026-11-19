-- AlterTable: add Written Comprehensive Examination attempt tracking and certification foundation columns
ALTER TABLE `comp_exam_records`
  ADD COLUMN `attempt_number` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `exam_date` DATE NULL,
  ADD COLUMN `remarks` TEXT NULL,
  ADD COLUMN `recorded_by_id` VARCHAR(191) NULL,
  ADD COLUMN `certificate_number` VARCHAR(191) NULL,
  ADD COLUMN `certificate_issued_at` DATETIME(3) NULL,
  ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Backfill sequential attempt_number per student before adding the unique constraint
UPDATE `comp_exam_records` AS target
JOIN (
  SELECT
    `comp_exam_id`,
    ROW_NUMBER() OVER (PARTITION BY `student_id` ORDER BY `created_at` ASC, `comp_exam_id` ASC) AS seq
  FROM `comp_exam_records`
) AS numbered ON target.`comp_exam_id` = numbered.`comp_exam_id`
SET target.`attempt_number` = numbered.seq;

-- CreateIndex
CREATE UNIQUE INDEX `comp_exam_records_student_attempt_key` ON `comp_exam_records`(`student_id`, `attempt_number`);

-- CreateIndex
CREATE UNIQUE INDEX `comp_exam_records_certificate_number_key` ON `comp_exam_records`(`certificate_number`);

-- CreateIndex
CREATE INDEX `comp_exam_records_recorded_by_id_fkey` ON `comp_exam_records`(`recorded_by_id`);

-- AddForeignKey
ALTER TABLE `comp_exam_records` ADD CONSTRAINT `comp_exam_records_recorded_by_id_fkey` FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
