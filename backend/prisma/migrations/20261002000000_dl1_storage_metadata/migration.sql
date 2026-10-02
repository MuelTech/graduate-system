-- DL-1: managed-document storage metadata foundation.
-- Forward-only, backward-compatible nullable additions. Existing rows keep
-- using `file_path`; no backfill or destructive change is performed here.
-- Historical migrations are not modified.

-- CorUpload: stable storage key/provider + integrity metadata.
-- (original_filename and detected_mime_type already exist on this table.)
ALTER TABLE `cor_uploads` ADD COLUMN `checksum` VARCHAR(191) NULL,
    ADD COLUMN `checksum_algorithm` VARCHAR(191) NULL,
    ADD COLUMN `size_bytes` INTEGER NULL,
    ADD COLUMN `storage_key` VARCHAR(191) NULL,
    ADD COLUMN `storage_provider` VARCHAR(191) NULL,
    ADD COLUMN `uploaded_by` VARCHAR(191) NULL;

-- ThesisDocument: stable storage key/provider + integrity metadata.
ALTER TABLE `thesis_documents` ADD COLUMN `checksum` VARCHAR(191) NULL,
    ADD COLUMN `checksum_algorithm` VARCHAR(191) NULL,
    ADD COLUMN `original_filename` VARCHAR(191) NULL,
    ADD COLUMN `size_bytes` INTEGER NULL,
    ADD COLUMN `storage_key` VARCHAR(191) NULL,
    ADD COLUMN `storage_provider` VARCHAR(191) NULL,
    ADD COLUMN `uploaded_by` VARCHAR(191) NULL,
    ADD COLUMN `verified_mime_type` VARCHAR(191) NULL;

-- Indexes for future storage-key lookups (maintenance/health in later packages).
CREATE INDEX `cor_uploads_storage_key_idx` ON `cor_uploads`(`storage_key`);
CREATE INDEX `thesis_documents_storage_key_idx` ON `thesis_documents`(`storage_key`);
