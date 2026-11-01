-- DropForeignKey
ALTER TABLE `applicant_answers` DROP FOREIGN KEY `applicant_answers_question_id_fkey`;

-- DropForeignKey
ALTER TABLE `applicant_answers` DROP FOREIGN KEY `applicant_answers_selected_option_id_fkey`;

-- CreateTable
CREATE TABLE `exam_question_selection` (
    `question_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`question_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_content_revisions` (
    `id` VARCHAR(36) NOT NULL,
    `published_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `published_by_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_revision_questions` (
    `revision_id` VARCHAR(36) NOT NULL,
    `question_id` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `content` JSON NOT NULL,

    UNIQUE INDEX `exam_revision_questions_revision_id_position_key`(`revision_id`, `position`),
    PRIMARY KEY (`revision_id`, `question_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_revision_options` (
    `revision_id` VARCHAR(36) NOT NULL,
    `question_id` VARCHAR(191) NOT NULL,
    `option_id` VARCHAR(191) NOT NULL,

    INDEX `exam_revision_options_revision_id_question_id_idx`(`revision_id`, `question_id`),
    PRIMARY KEY (`revision_id`, `option_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_revision_media` (
    `revision_id` VARCHAR(36) NOT NULL,
    `media_id` VARCHAR(36) NOT NULL,

    PRIMARY KEY (`revision_id`, `media_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `applicant_answers` ADD CONSTRAINT `applicant_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `exam_questions`(`question_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_answers` ADD CONSTRAINT `applicant_answers_selected_option_id_fkey` FOREIGN KEY (`selected_option_id`) REFERENCES `exam_options`(`option_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_question_selection` ADD CONSTRAINT `exam_question_selection_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `exam_questions`(`question_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_content_revisions` ADD CONSTRAINT `exam_content_revisions_published_by_id_fkey` FOREIGN KEY (`published_by_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_revision_questions` ADD CONSTRAINT `exam_revision_questions_revision_id_fkey` FOREIGN KEY (`revision_id`) REFERENCES `exam_content_revisions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_revision_questions` ADD CONSTRAINT `exam_revision_questions_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `exam_questions`(`question_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_revision_options` ADD CONSTRAINT `exam_revision_options_revision_id_question_id_fkey` FOREIGN KEY (`revision_id`, `question_id`) REFERENCES `exam_revision_questions`(`revision_id`, `question_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_revision_options` ADD CONSTRAINT `exam_revision_options_option_id_fkey` FOREIGN KEY (`option_id`) REFERENCES `exam_options`(`option_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_revision_media` ADD CONSTRAINT `exam_revision_media_revision_id_fkey` FOREIGN KEY (`revision_id`) REFERENCES `exam_content_revisions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_revision_media` ADD CONSTRAINT `exam_revision_media_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `exam_media`(`media_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
