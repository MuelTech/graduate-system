-- FACULTY-17A: quiesce writers and verify a backup before this forward-only DDL.
-- Guard before permanent DDL. Never guess a collision's intended account/role.
CREATE TEMPORARY TABLE `_faculty17a_email_identity_requires_review` (`id` INT PRIMARY KEY);
INSERT INTO `_faculty17a_email_identity_requires_review` VALUES (1);
INSERT INTO `_faculty17a_email_identity_requires_review`
SELECT 1 WHERE EXISTS (
  SELECT 1 FROM `users` WHERE CHAR_LENGTH(TRIM(`email`)) = 0
) OR EXISTS (
  SELECT LOWER(TRIM(`email`)) FROM `users`
  GROUP BY LOWER(TRIM(`email`))
  HAVING SUM(`role` NOT IN ('FACULTY', 'PANELIST')) > 1
     OR SUM(`role` <> 'ADMIN') > 1
) OR NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'
    AND DATA_TYPE = 'varchar' AND CHARACTER_MAXIMUM_LENGTH = 191
    AND CHARACTER_SET_NAME = 'utf8mb4' AND COLLATION_NAME = 'utf8mb4_unicode_ci'
) OR EXISTS (
  SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
  WHERE REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'users' AND REFERENCED_COLUMN_NAME = 'email'
);

-- The old global index stays in force until all derived keys are protected.
ALTER TABLE `users`
  ADD COLUMN `email_admin_key` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  ADD COLUMN `email_faculty_key` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  ADD UNIQUE INDEX `users_email_admin_key` (`email_admin_key`),
  ADD UNIQUE INDEX `users_email_faculty_key` (`email_faculty_key`);

CREATE TRIGGER `users_email_identity_insert` BEFORE INSERT ON `users`
FOR EACH ROW SET
  NEW.`email_admin_key` = CASE WHEN NEW.`role` IN ('FACULTY', 'PANELIST') THEN NULL ELSE LOWER(TRIM(NEW.`email`)) END,
  NEW.`email_faculty_key` = CASE WHEN NEW.`role` = 'ADMIN' THEN NULL ELSE LOWER(TRIM(NEW.`email`)) END;

CREATE TRIGGER `users_email_identity_update` BEFORE UPDATE ON `users`
FOR EACH ROW SET
  NEW.`email_admin_key` = CASE WHEN NEW.`role` IN ('FACULTY', 'PANELIST') THEN NULL ELSE LOWER(TRIM(NEW.`email`)) END,
  NEW.`email_faculty_key` = CASE WHEN NEW.`role` = 'ADMIN' THEN NULL ELSE LOWER(TRIM(NEW.`email`)) END;

-- Only new columns change; raw email, IDs, roles, hashes and timestamps survive.
UPDATE `users` SET
  `email_admin_key` = CASE WHEN `role` IN ('FACULTY', 'PANELIST') THEN NULL ELSE LOWER(TRIM(`email`)) END,
  `email_faculty_key` = CASE WHEN `role` = 'ADMIN' THEN NULL ELSE LOWER(TRIM(`email`)) END;

INSERT INTO `_faculty17a_email_identity_requires_review`
SELECT 1 WHERE EXISTS (
  SELECT 1 FROM `users`
  WHERE NOT (`email_admin_key` <=> CASE WHEN `role` IN ('FACULTY', 'PANELIST') THEN NULL ELSE LOWER(TRIM(`email`)) END)
     OR NOT (`email_faculty_key` <=> CASE WHEN `role` = 'ADMIN' THEN NULL ELSE LOWER(TRIM(`email`)) END)
);
ALTER TABLE `users` DROP INDEX `users_email_key`;
DROP TEMPORARY TABLE `_faculty17a_email_identity_requires_review`;
