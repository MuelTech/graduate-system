-- CP7: Official defense records, Chairman conclusion, RAP lifecycle
-- Forward-only migration. Do not edit historical migrations.

-- OralExamSummary.finalRating becomes nullable (no confirmed average→rating formula)
ALTER TABLE `oral_exam_summary` MODIFY COLUMN `final_rating` ENUM('E', 'HS', 'VS', 'S', 'BS', 'F') NULL;

-- OralExamSummary persistent generated snapshot
ALTER TABLE `oral_exam_summary` ADD COLUMN `snapshot_data` JSON NULL;

-- DefenseSchedule Rapporteur notes finalization
ALTER TABLE `defense_schedules` ADD COLUMN `rapporteur_notes_finalized_at` DATETIME(3) NULL;
ALTER TABLE `defense_schedules` ADD COLUMN `rapporteur_notes_finalized_by` VARCHAR(191) NULL;
CREATE INDEX `defense_schedules_rapporteur_notes_finalized_by_idx` ON `defense_schedules`(`rapporteur_notes_finalized_by`);
ALTER TABLE `defense_schedules` ADD CONSTRAINT `defense_schedules_rapporteur_notes_finalized_by_fkey`
  FOREIGN KEY (`rapporteur_notes_finalized_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RapReport.finalizedAt (server-side when all required signatures complete)
ALTER TABLE `rap_reports` ADD COLUMN `finalized_at` DATETIME(3) NULL;

-- OralExamScore.officialSnapshot for reproducible Criteria identity metadata
ALTER TABLE `oral_exam_scores` ADD COLUMN `official_snapshot` JSON NULL;

-- One official RAP per defense session (preflight: development fixtures must not have duplicates)
CREATE UNIQUE INDEX `rap_reports_schedule_id_key` ON `rap_reports`(`schedule_id`);

-- One signature slot per (rap, user)
CREATE UNIQUE INDEX `rap_report_signatures_rap_id_user_id_key` ON `rap_report_signatures`(`rap_id`, `user_id`);
