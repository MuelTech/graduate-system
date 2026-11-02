-- Additive cutover only. Never infer historical starts or received content.
ALTER TABLE `entrance_exam_applications`
  ADD COLUMN `start_authorized_by_id` VARCHAR(191) NULL,
  ADD COLUMN `start_authorized_at` DATETIME(3) NULL,
  ADD COLUMN `actual_started_at` DATETIME(3) NULL,
  ADD COLUMN `deadline_at` DATETIME(3) NULL,
  ADD COLUMN `execution_configuration` JSON NULL,
  ADD COLUMN `content_revision_id` VARCHAR(36) NULL;

CREATE INDEX `entrance_exam_applications_start_authorized_by_id_idx` ON `entrance_exam_applications`(`start_authorized_by_id`);
CREATE INDEX `entrance_exam_applications_content_revision_id_idx` ON `entrance_exam_applications`(`content_revision_id`);
ALTER TABLE `entrance_exam_applications`
  ADD CONSTRAINT `entrance_exam_applications_start_authorized_by_id_fkey` FOREIGN KEY (`start_authorized_by_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `entrance_exam_applications_content_revision_id_fkey` FOREIGN KEY (`content_revision_id`) REFERENCES `exam_content_revisions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
