-- DropForeignKey
ALTER TABLE `thesis_records` DROP FOREIGN KEY `thesis_records_assignment_id_fkey`;

-- AddForeignKey
ALTER TABLE `thesis_records` ADD CONSTRAINT `thesis_records_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `adviser_assignments`(`assignment_id`) ON DELETE SET NULL ON UPDATE CASCADE;
