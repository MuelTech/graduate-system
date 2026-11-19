-- DropForeignKey
ALTER TABLE `applicant_bridging_waivers` DROP FOREIGN KEY `applicant_bridging_waivers_intended_program_id_fkey`;
ALTER TABLE `applicant_bridging_waivers` DROP FOREIGN KEY `applicant_bridging_waivers_student_id_fkey`;
ALTER TABLE `applicant_bridging_waivers` DROP FOREIGN KEY `applicant_bridging_waivers_undergraduate_program_id_fkey`;
ALTER TABLE `applicant_bridging_waivers` DROP FOREIGN KEY `applicant_bridging_waivers_validated_by_fkey`;

-- DropForeignKey
ALTER TABLE `curriculum_waivers` DROP FOREIGN KEY `curriculum_waivers_approved_by_fkey`;
ALTER TABLE `curriculum_waivers` DROP FOREIGN KEY `curriculum_waivers_recommended_by_fkey`;
ALTER TABLE `curriculum_waivers` DROP FOREIGN KEY `curriculum_waivers_student_id_fkey`;

-- DropForeignKey
ALTER TABLE `students` DROP FOREIGN KEY `students_previous_masters_program_id_fkey`;
ALTER TABLE `students` DROP FOREIGN KEY `students_undergraduate_program_id_fkey`;

-- DropIndex
DROP INDEX `students_previous_masters_program_id_fkey` ON `students`;
DROP INDEX `students_undergraduate_program_id_fkey` ON `students`;

-- AlterTable
ALTER TABLE `students`
  DROP COLUMN `alignment_status`,
  DROP COLUMN `date_of_birth`,
  DROP COLUMN `is_program_aligned`,
  DROP COLUMN `previous_masters_program_id`,
  DROP COLUMN `undergraduate_program_id`;

-- DropTable
DROP TABLE `applicant_bridging_waivers`;

-- DropTable
DROP TABLE `curriculum_waivers`;

-- DropTable
DROP TABLE `undergraduate_programs`;
