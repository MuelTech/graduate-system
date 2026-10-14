-- CP3: Proposal Adviser review / certification lifecycle on AdviserCertification.
-- Existing PENDING / ISSUED rows remain valid (legacy PENDING ≈ pre-workflow).

-- AlterTable
ALTER TABLE `adviser_certifications`
  ADD COLUMN `review_remarks` TEXT NULL,
  ADD COLUMN `reviewed_document_id` VARCHAR(191) NULL,
  ADD COLUMN `signature_data` TEXT NULL,
  ADD COLUMN `signed_at` DATETIME(3) NULL,
  ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  MODIFY `status` ENUM('PENDING', 'AWAITING_REVIEW', 'CHANGES_REQUESTED', 'ISSUED') NOT NULL DEFAULT 'AWAITING_REVIEW';

-- CreateIndex
CREATE INDEX `adviser_certifications_reviewed_document_id_idx` ON `adviser_certifications`(`reviewed_document_id`);

-- AddForeignKey
ALTER TABLE `adviser_certifications` ADD CONSTRAINT `adviser_certifications_reviewed_document_id_fkey`
  FOREIGN KEY (`reviewed_document_id`) REFERENCES `thesis_documents`(`document_id`) ON DELETE SET NULL ON UPDATE CASCADE;
