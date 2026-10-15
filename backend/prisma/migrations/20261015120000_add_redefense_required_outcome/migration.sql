-- WF-C1a: add the canonical re-defense verdict to the defense outcome enum.
--
-- Additive only. Legacy values REVISION_REQUIRED and FAILED are RETAINED so
-- historical conclusions/records remain readable. No existing row is rewritten.
--
-- defense_conclusions.outcome  ENUM('PASSED','REVISION_REQUIRED','FAILED') NOT NULL
-- thesis_records.outcome       ENUM('PASSED','REVISION_REQUIRED','FAILED') NULL

-- AlterTable
ALTER TABLE `defense_conclusions` MODIFY `outcome` ENUM('PASSED', 'REVISION_REQUIRED', 'FAILED', 'REDEFENSE_REQUIRED') NOT NULL;

-- AlterTable
ALTER TABLE `thesis_records` MODIFY `outcome` ENUM('PASSED', 'REVISION_REQUIRED', 'FAILED', 'REDEFENSE_REQUIRED') NULL;
