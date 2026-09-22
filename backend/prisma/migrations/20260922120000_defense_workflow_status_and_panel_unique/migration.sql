-- Defense workflow refactor: REJECTED status + rejection reason + unique panel seat
ALTER TABLE `thesis_records` MODIFY COLUMN `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SCHEDULED', 'PASSED', 'FAILED', 'REVISION') NOT NULL DEFAULT 'PENDING';

ALTER TABLE `thesis_records` ADD COLUMN `rejection_reason` TEXT NULL;

-- One user cannot hold two seats on the same defense
ALTER TABLE `panel_assignments` ADD UNIQUE INDEX `panel_assignments_schedule_id_user_id_key` (`schedule_id`, `user_id`);
