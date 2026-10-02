-- DL-3: Applicant COR review/rejection metadata.
-- Forward-only, backward-compatible nullable additions. Existing rows remain
-- valid (no review history). The rejection reason is stored explicitly rather
-- than parsed from audit free-text. Historical migrations are not modified.

-- CorUpload: explicit review/rejection metadata + reviewer relation.
ALTER TABLE `cor_uploads` ADD COLUMN `rejection_reason` TEXT NULL,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL,
    ADD COLUMN `reviewed_by` VARCHAR(191) NULL;

CREATE INDEX `cor_uploads_reviewed_by_idx` ON `cor_uploads`(`reviewed_by`);

ALTER TABLE `cor_uploads` ADD CONSTRAINT `cor_uploads_reviewed_by_fkey`
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
