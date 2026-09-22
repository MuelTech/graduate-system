-- RAP signature slots carry role + required flag (form-specific policy UNRESOLVED)
-- RAP status gains FOR_SIGNATURE / PARTIALLY_SIGNED for progression.

ALTER TABLE `rap_report_signatures`
  ADD COLUMN `role_at_defense` VARCHAR(191) NULL,
  ADD COLUMN `required` BOOLEAN NOT NULL DEFAULT true;

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
