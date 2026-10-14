-- RAP signature slots carry role + required flag (form-specific policy UNRESOLVED)
-- RAP status gains FOR_SIGNATURE / PARTIALLY_SIGNED for progression.
-- required is nullable (schema Boolean?) — default true.

-- role_at_defense
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `rap_report_signatures` ADD COLUMN `role_at_defense` VARCHAR(191) NULL',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rap_report_signatures'
    AND COLUMN_NAME = 'role_at_defense'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- required (nullable, default true) — add only if missing so both orderings work
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `rap_report_signatures` ADD COLUMN `required` BOOLEAN NULL DEFAULT true',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rap_report_signatures'
    AND COLUMN_NAME = 'required'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `rap_reports`
  MODIFY COLUMN `status` ENUM(
    'DRAFT',
    'FOR_SIGNATURE',
    'PARTIALLY_SIGNED',
    'DISTRIBUTED',
    'ALL_SIGNED',
    'FINALIZED'
  ) NOT NULL DEFAULT 'DRAFT';

-- Existing unsigned slots remain required=true (interim default until form policy is confirmed)
UPDATE `rap_report_signatures` SET `required` = true WHERE `required` IS NULL;
