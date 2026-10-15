-- AlterTable
ALTER TABLE `rap_reports` ADD COLUMN `body_document` JSON NULL,
    ADD COLUMN `body_updated_at` DATETIME(3) NULL,
    ADD COLUMN `body_version` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `content_version` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `frozen_at` DATETIME(3) NULL,
    ADD COLUMN `frozen_by` VARCHAR(191) NULL,
    ADD COLUMN `frozen_content` JSON NULL,
    ADD COLUMN `frozen_content_hash` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `rap_report_signatures` ADD COLUMN `signed_content_hash` VARCHAR(191) NULL,
    ADD COLUMN `signed_content_version` INTEGER NULL;

-- CreateTable
CREATE TABLE `defense_annotations` (
    `annotation_id` VARCHAR(191) NOT NULL,
    `schedule_id` VARCHAR(191) NOT NULL,
    `thesis_document_id` VARCHAR(191) NOT NULL,
    `author_assignment_id` VARCHAR(191) NOT NULL,
    `page_number` INTEGER NOT NULL,
    `selected_text` TEXT NOT NULL,
    `anchor_data` JSON NOT NULL,
    `anchor_version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `defense_annotations_schedule_id_thesis_document_id_idx`(`schedule_id`, `thesis_document_id`),
    INDEX `defense_annotations_thesis_document_id_idx`(`thesis_document_id`),
    INDEX `defense_annotations_author_assignment_id_idx`(`author_assignment_id`),
    PRIMARY KEY (`annotation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `defense_annotation_comments` (
    `comment_id` VARCHAR(191) NOT NULL,
    `annotation_id` VARCHAR(191) NOT NULL,
    `author_assignment_id` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `parent_comment_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `defense_annotation_comments_annotation_id_idx`(`annotation_id`),
    INDEX `defense_annotation_comments_author_assignment_id_idx`(`author_assignment_id`),
    INDEX `defense_annotation_comments_parent_comment_id_idx`(`parent_comment_id`),
    PRIMARY KEY (`comment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `rap_reports_frozen_by_fkey` ON `rap_reports`(`frozen_by`);

-- AddForeignKey
ALTER TABLE `rap_reports` ADD CONSTRAINT `rap_reports_frozen_by_fkey` FOREIGN KEY (`frozen_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_annotations` ADD CONSTRAINT `defense_annotations_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `defense_schedules`(`schedule_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_annotations` ADD CONSTRAINT `defense_annotations_thesis_document_id_fkey` FOREIGN KEY (`thesis_document_id`) REFERENCES `thesis_documents`(`document_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_annotations` ADD CONSTRAINT `defense_annotations_author_assignment_id_fkey` FOREIGN KEY (`author_assignment_id`) REFERENCES `panel_assignments`(`panel_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_annotation_comments` ADD CONSTRAINT `defense_annotation_comments_annotation_id_fkey` FOREIGN KEY (`annotation_id`) REFERENCES `defense_annotations`(`annotation_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_annotation_comments` ADD CONSTRAINT `defense_annotation_comments_author_assignment_id_fkey` FOREIGN KEY (`author_assignment_id`) REFERENCES `panel_assignments`(`panel_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_annotation_comments` ADD CONSTRAINT `defense_annotation_comments_parent_comment_id_fkey` FOREIGN KEY (`parent_comment_id`) REFERENCES `defense_annotation_comments`(`comment_id`) ON DELETE SET NULL ON UPDATE CASCADE;
