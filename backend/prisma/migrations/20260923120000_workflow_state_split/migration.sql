-- Workflow-state split: separate academic outcome + session status + formal conclusion record
-- Application review stays on thesis_records.status (PENDING/APPROVED/REJECTED + compat denorm).

ALTER TABLE `thesis_records`
  ADD COLUMN `outcome` ENUM('PASSED', 'REVISION_REQUIRED', 'FAILED') NULL;

ALTER TABLE `defense_schedules`
  ADD COLUMN `session_status` ENUM('UNSCHEDULED', 'SCHEDULED', 'IN_PROGRESS', 'AWAITING_CONCLUSION', 'CONCLUDED', 'CANCELLED') NOT NULL DEFAULT 'UNSCHEDULED';

CREATE TABLE `defense_conclusions` (
  `conclusion_id` VARCHAR(191) NOT NULL,
  `schedule_id` VARCHAR(191) NOT NULL,
  `thesis_id` VARCHAR(191) NOT NULL,
  `outcome` ENUM('PASSED', 'REVISION_REQUIRED', 'FAILED') NOT NULL,
  `selected_title_id` VARCHAR(191) NULL,
  `final_remarks` TEXT NULL,
  `concluded_by` VARCHAR(191) NOT NULL,
  `concluded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`conclusion_id`),
  UNIQUE KEY `defense_conclusions_schedule_id_key` (`schedule_id`),
  KEY `defense_conclusions_concluded_by_fkey` (`concluded_by`),
  KEY `defense_conclusions_selected_title_id_fkey` (`selected_title_id`),
  KEY `defense_conclusions_thesis_id_fkey` (`thesis_id`),
  CONSTRAINT `defense_conclusions_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `defense_schedules` (`schedule_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `defense_conclusions_concluded_by_fkey` FOREIGN KEY (`concluded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `defense_conclusions_selected_title_id_fkey` FOREIGN KEY (`selected_title_id`) REFERENCES `thesis_titles` (`title_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `defense_conclusions_thesis_id_fkey` FOREIGN KEY (`thesis_id`) REFERENCES `thesis_records` (`thesis_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill outcome from overloaded thesis status (concluded academic results only)
UPDATE `thesis_records`
SET `outcome` = CASE `status`
  WHEN 'PASSED' THEN 'PASSED'
  WHEN 'FAILED' THEN 'FAILED'
  WHEN 'REVISION' THEN 'REVISION_REQUIRED'
  ELSE NULL
END
WHERE `status` IN ('PASSED', 'FAILED', 'REVISION');

-- Backfill session status from existing schedules
UPDATE `defense_schedules` s
JOIN `thesis_records` t ON t.`thesis_id` = s.`thesis_id`
SET s.`session_status` = CASE
  WHEN t.`status` IN ('PASSED', 'FAILED', 'REVISION') THEN 'CONCLUDED'
  ELSE 'SCHEDULED'
END;
