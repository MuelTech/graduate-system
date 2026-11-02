-- Zero is a technical concurrency baseline, not a historical edit count.
-- Preserve all answer values; no historical save timestamps are fabricated.
ALTER TABLE `applicant_answers` ADD COLUMN `draft_revision` INTEGER NOT NULL DEFAULT 0;
