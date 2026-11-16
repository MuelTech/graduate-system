-- Add stage-specific Official Receipt (O.R.) number columns to thesis_records
-- and widen system_settings.setting_value to LONGTEXT for base64 official signatures.

ALTER TABLE `thesis_records`
  ADD COLUMN `title_or_number` VARCHAR(64) NULL,
  ADD COLUMN `proposal_or_number` VARCHAR(64) NULL,
  ADD COLUMN `final_or_number` VARCHAR(64) NULL;

ALTER TABLE `system_settings`
  MODIFY COLUMN `setting_value` LONGTEXT NULL;
