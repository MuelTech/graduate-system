-- DropForeignKey
ALTER TABLE `student_graduation_milestones` DROP FOREIGN KEY `student_graduation_milestones_student_id_fkey`;

-- DropForeignKey
ALTER TABLE `student_graduation_milestones` DROP FOREIGN KEY `student_graduation_milestones_publication_verified_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `student_graduation_milestones` DROP FOREIGN KEY `student_graduation_milestones_updated_by_id_fkey`;

-- DropTable
DROP TABLE `student_graduation_milestones`;
