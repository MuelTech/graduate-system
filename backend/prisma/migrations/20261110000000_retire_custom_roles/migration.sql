-- FACULTY-17. Deploy with application writers stopped and a verified backup.
-- Forward-only DDL (implicit commits); never converts or deletes users.
-- Duplicate-key guards fail even under non-strict MySQL/MariaDB sql_mode.
-- Every guard runs before the first permanent schema change. Failure requires
-- separate account disposition/dependency review, never automatic cleanup.
CREATE TEMPORARY TABLE `_faculty17_custom_users_require_separate_cleanup` (`id` INT PRIMARY KEY);
INSERT INTO `_faculty17_custom_users_require_separate_cleanup` VALUES (1);
INSERT INTO `_faculty17_custom_users_require_separate_cleanup`
SELECT 1 WHERE EXISTS (
  SELECT 1 FROM `users` WHERE `role` NOT IN ('ADMIN', 'STUDENT', 'PANELIST', 'APPLICANT', 'FACULTY')
);

CREATE TEMPORARY TABLE `_faculty17_unexpected_legacy_dependency` (`id` INT PRIMARY KEY);
INSERT INTO `_faculty17_unexpected_legacy_dependency` VALUES (1);
INSERT INTO `_faculty17_unexpected_legacy_dependency`
SELECT 1 WHERE EXISTS (
  SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
  WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
    AND (
      (REFERENCED_TABLE_NAME IN ('custom_roles', 'role_feature_access')
        AND NOT (TABLE_SCHEMA = DATABASE() AND (
          (TABLE_NAME = 'users' AND COLUMN_NAME = 'custom_role_id'
            AND REFERENCED_TABLE_NAME = 'custom_roles' AND REFERENCED_COLUMN_NAME = 'role_id'
            AND CONSTRAINT_NAME = 'users_custom_role_id_fkey')
          OR (TABLE_NAME = 'role_feature_access' AND COLUMN_NAME = 'role_id'
            AND REFERENCED_TABLE_NAME = 'custom_roles' AND REFERENCED_COLUMN_NAME = 'role_id'
            AND CONSTRAINT_NAME = 'role_feature_access_role_id_fkey')
        )))
      OR (REFERENCED_TABLE_NAME = 'users' AND REFERENCED_COLUMN_NAME = 'custom_role_id')
    )
);

-- Preserve remaining enum names/default and account IDs. No PanelRole change.
ALTER TABLE `users` MODIFY `role` ENUM('ADMIN', 'STUDENT', 'PANELIST', 'APPLICANT', 'FACULTY') NOT NULL DEFAULT 'APPLICANT';
ALTER TABLE `users` DROP FOREIGN KEY `users_custom_role_id_fkey`;
ALTER TABLE `users` DROP INDEX `users_custom_role_id_fkey`, DROP COLUMN `custom_role_id`;
DROP TABLE `role_feature_access`;
DROP TABLE `custom_roles`;
DROP TEMPORARY TABLE `_faculty17_unexpected_legacy_dependency`;
DROP TEMPORARY TABLE `_faculty17_custom_users_require_separate_cleanup`;
