-- DL-9: Research Databank archive records are private by default.
--
-- Forward-only and non-destructive: this changes ONLY the column default for
-- future rows. Existing `e_library` rows (including legacy `is_public = true`)
-- are NOT updated, and no backfill is performed. Repository publication
-- (DL-10) remains a separate, explicit workflow.

ALTER TABLE `e_library` ALTER COLUMN `is_public` SET DEFAULT false;
