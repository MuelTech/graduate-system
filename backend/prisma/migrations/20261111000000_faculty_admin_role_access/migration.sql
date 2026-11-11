-- AlterTable: Add FACULTY to UserRole enum and add Administrator access level/capabilities on users
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('ADMIN', 'STUDENT', 'FACULTY', 'PANELIST', 'CUSTOM', 'APPLICANT') NOT NULL DEFAULT 'APPLICANT',
  ADD COLUMN `admin_access_level` ENUM('FULL', 'RESTRICTED') NULL DEFAULT 'FULL',
  ADD COLUMN `admin_capabilities` JSON NULL;

-- AlterTable: Add Essay Evaluation access flag on panelists (Faculty profile)
ALTER TABLE `panelists`
  ADD COLUMN `can_evaluate_essays` BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing PANELIST account roles to FACULTY
UPDATE `users` SET `role` = 'FACULTY' WHERE `role` = 'PANELIST';
