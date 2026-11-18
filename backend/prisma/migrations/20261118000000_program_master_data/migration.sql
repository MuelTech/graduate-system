-- Add structured master-data fields and active status to programs
ALTER TABLE `programs`
  ADD COLUMN `degree_name` VARCHAR(191) NULL AFTER `program_name`,
  ADD COLUMN `major_name` VARCHAR(191) NULL AFTER `degree_name`,
  ADD COLUMN `program_code` VARCHAR(64) NULL AFTER `major_name`,
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true AFTER `max_residency_years`;
