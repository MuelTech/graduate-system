-- Stage-scoped requirement evidence + conditional Research Variables
-- STRIKE / statistician / instruments remain available but are NOT unconditional Final gates.

-- Stage discriminator on uploaded evidence (null = legacy unscoped row)
ALTER TABLE `thesis_documents`
  ADD COLUMN `defense_stage` ENUM('TITLE', 'PROPOSAL', 'FINAL') NULL;

-- Explicit Title proposal package type (was conflated with PROPOSAL_CHAPTERS)
ALTER TABLE `thesis_documents`
  MODIFY COLUMN `doc_type` ENUM(
    'TITLE_PROPOSAL',
    'PROPOSAL_CHAPTERS',
    'FINAL_MANUSCRIPT',
    'PLAGIARISM_REPORT',
    'RESPONDENT_DATA',
    'INSTRUMENTS',
    'COR',
    'RECEIPT'
  ) NOT NULL;

-- Best-effort backfill: tag evidence to the thesis record's current stage.
-- New writes always set defense_stage explicitly; legacy null only matches current stage.
UPDATE `thesis_documents` d
JOIN `thesis_records` t ON t.`thesis_id` = d.`thesis_id`
SET d.`defense_stage` = t.`stage`
WHERE d.`defense_stage` IS NULL
  AND d.`doc_type` IN ('TITLE_PROPOSAL', 'PROPOSAL_CHAPTERS', 'FINAL_MANUSCRIPT', 'INSTRUMENTS', 'COR', 'RECEIPT');

-- Historical Title package stored as PROPOSAL_CHAPTERS while thesis still on TITLE
UPDATE `thesis_documents` d
JOIN `thesis_records` t ON t.`thesis_id` = d.`thesis_id`
SET d.`doc_type` = 'TITLE_PROPOSAL'
WHERE d.`doc_type` = 'PROPOSAL_CHAPTERS'
  AND d.`defense_stage` = 'TITLE';

-- Research Variables are conditional ("Letter for Approval of the Variables IF ANY")
ALTER TABLE `research_variable_forms`
  MODIFY COLUMN `status` ENUM('PENDING', 'APPROVED_BY_PANEL', 'NOT_APPLICABLE') NOT NULL DEFAULT 'PENDING';
