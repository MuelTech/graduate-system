-- Nullable source identity leaves every existing user-authored question intact.
ALTER TABLE `exam_questions` ADD COLUMN `source_import_id` VARCHAR(64) NULL,
    ADD COLUMN `source_question_number` INTEGER NULL;

CREATE TABLE `exam_content_imports` (
    `id` VARCHAR(64) NOT NULL,
    `fingerprint` VARCHAR(64) NOT NULL,
    `question_count` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `exam_questions_source_import_id_source_question_number_key` ON `exam_questions`(`source_import_id`, `source_question_number`);
ALTER TABLE `exam_questions` ADD CONSTRAINT `exam_questions_source_import_id_fkey` FOREIGN KEY (`source_import_id`) REFERENCES `exam_content_imports`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
