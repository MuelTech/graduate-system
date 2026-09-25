-- AlterTable
-- Safe on clean replay AND on DBs that already have `required`:
-- - fresh shadow DB: column not created yet → no-op (created later by rap_signature_policy)
-- - existing DB with required: relax to nullable to match schema
SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `rap_report_signatures` MODIFY `required` BOOLEAN NULL DEFAULT true',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rap_report_signatures'
    AND COLUMN_NAME = 'required'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
