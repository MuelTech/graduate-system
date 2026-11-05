-- Additive only: legacy terminal records keep NULL finalization evidence.
ALTER TABLE `entrance_exam_applications`
  ADD COLUMN `finalized_at` DATETIME(3) NULL,
  ADD COLUMN `finalization_reason` ENUM('APPLICANT_SUBMITTED', 'TIME_EXPIRED') NULL,
  ADD COLUMN `finalization_receipt_id` VARCHAR(36) NULL,
  ADD COLUMN `finalization_answered_count` INTEGER NULL,
  ADD COLUMN `finalization_question_count` INTEGER NULL;

CREATE UNIQUE INDEX `entrance_exam_applications_finalization_receipt_id_key`
  ON `entrance_exam_applications` (`finalization_receipt_id`);
CREATE INDEX `exam_expiry_candidates`
  ON `entrance_exam_applications` (`status`, `finalized_at`, `deadline_at`);
