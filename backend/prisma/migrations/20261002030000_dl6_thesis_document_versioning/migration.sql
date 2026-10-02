-- DL-6: explicit Defense supporting-evidence versioning/currentness.
-- Forward-only, additive. Existing ThesisDocument rows default to current
-- (is_current = true) so legacy single-per-slot evidence remains readable and
-- authoritative. Adviser-certified manuscript authority remains
-- AdviserCertification.reviewed_document_id and is unaffected.
-- Historical migrations are not modified.

ALTER TABLE `thesis_documents` ADD COLUMN `is_current` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `supersedes_document_id` VARCHAR(191) NULL;

CREATE INDEX `thesis_documents_supersedes_document_id_idx` ON `thesis_documents`(`supersedes_document_id`);
CREATE INDEX `thesis_documents_slot_current_idx` ON `thesis_documents`(`thesis_id`, `defense_stage`, `doc_type`, `is_current`);

ALTER TABLE `thesis_documents` ADD CONSTRAINT `thesis_documents_supersedes_document_id_fkey`
  FOREIGN KEY (`supersedes_document_id`) REFERENCES `thesis_documents`(`document_id`) ON DELETE SET NULL ON UPDATE CASCADE;
