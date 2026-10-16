-- AlterTable
ALTER TABLE `defense_schedules` ADD COLUMN `manuscript_document_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `defense_schedules_manuscript_document_id_fkey` ON `defense_schedules`(`manuscript_document_id`);

-- AddForeignKey
ALTER TABLE `defense_schedules` ADD CONSTRAINT `defense_schedules_manuscript_document_id_fkey` FOREIGN KEY (`manuscript_document_id`) REFERENCES `thesis_documents`(`document_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
