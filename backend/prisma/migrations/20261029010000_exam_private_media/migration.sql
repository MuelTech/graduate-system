-- Immutable private media records; legacy nullable question/option IDs stay nullable.
CREATE TABLE `exam_media` (
    `media_id` VARCHAR(36) NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `storage_provider` VARCHAR(191) NOT NULL,
    `verified_mime_type` VARCHAR(191) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `checksum_algorithm` VARCHAR(191) NOT NULL DEFAULT 'sha256',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `exam_media_storage_key_key`(`storage_key`),
    PRIMARY KEY (`media_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `exam_questions_stimulus_media_id_idx` ON `exam_questions`(`stimulus_media_id`);
CREATE INDEX `exam_options_media_id_idx` ON `exam_options`(`media_id`);

-- Fail closed on dangling pre-existing media IDs; never fabricate or clear content.
ALTER TABLE `exam_questions` ADD CONSTRAINT `exam_questions_stimulus_media_id_fkey` FOREIGN KEY (`stimulus_media_id`) REFERENCES `exam_media`(`media_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `exam_options` ADD CONSTRAINT `exam_options_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `exam_media`(`media_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
