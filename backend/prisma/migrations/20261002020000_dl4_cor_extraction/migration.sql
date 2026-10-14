-- DL-4: generic native PDF extraction result for COR uploads.
-- Forward-only, additive. Existing COR uploads remain valid (no extraction row
-- means "not processed"). Legacy `ocr_status` / `ocr_error_message` /
-- `processed_at` columns on cor_uploads are intentionally left untouched.
-- Historical migrations are not modified.

CREATE TABLE `cor_extractions` (
    `extraction_id` VARCHAR(191) NOT NULL,
    `cor_upload_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'MANUAL_REQUIRED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `method` ENUM('NATIVE_PDF', 'OCR', 'MANUAL') NULL,
    `extractor_version` VARCHAR(191) NULL,
    `page_count` INTEGER NULL,
    `text` LONGTEXT NULL,
    `pages` JSON NULL,
    `suggestions` JSON NULL,
    `diagnostic` TEXT NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cor_extractions_cor_upload_id_key`(`cor_upload_id`),
    PRIMARY KEY (`extraction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `cor_extractions` ADD CONSTRAINT `cor_extractions_cor_upload_id_fkey`
  FOREIGN KEY (`cor_upload_id`) REFERENCES `cor_uploads`(`cor_upload_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
