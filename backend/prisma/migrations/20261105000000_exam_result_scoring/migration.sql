-- Additive evidence only. Historical settings, scores and statuses are unchanged.
ALTER TABLE `entrance_exam_scores`
  ADD COLUMN `scored_at` DATETIME(3) NULL,
  ADD COLUMN `scoring_basis` JSON NULL,
  ADD COLUMN `result_email_queued_at` DATETIME(3) NULL,
  ADD COLUMN `result_email_template_key` VARCHAR(64) NULL;
