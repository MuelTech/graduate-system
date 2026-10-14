-- CP5: individual evaluator evaluation lifecycle (DRAFT / FINALIZED).
-- Existing unsigned score rows remain DRAFT (no fabricated signatures).

-- AlterTable
ALTER TABLE `oral_exam_scores`
  ADD COLUMN `finalized_at` DATETIME(3) NULL,
  ADD COLUMN `signature_data` TEXT NULL,
  ADD COLUMN `signed_at` DATETIME(3) NULL,
  ADD COLUMN `status` ENUM('DRAFT', 'FINALIZED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX `oral_exam_scores_schedule_id_panel_id_key` ON `oral_exam_scores`(`schedule_id`, `panel_id`);
