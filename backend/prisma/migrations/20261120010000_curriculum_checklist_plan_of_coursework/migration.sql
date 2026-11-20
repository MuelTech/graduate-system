-- AlterTable
ALTER TABLE `students`
    ADD COLUMN `curriculum_version_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `curriculum_versions` (
    `curriculum_version_id` VARCHAR(191) NOT NULL,
    `program_id` VARCHAR(191) NOT NULL,
    `version_code` VARCHAR(64) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `curriculum_type` ENUM('OLD', 'NEW') NOT NULL DEFAULT 'NEW',
    `effective_school_year` VARCHAR(64) NULL,
    `total_required_units` INTEGER NOT NULL,
    `is_default_for_new_students` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `curriculum_versions_program_code_key`(`program_id`, `version_code`),
    INDEX `curriculum_versions_program_id_fkey`(`program_id`),
    PRIMARY KEY (`curriculum_version_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `curriculum_course_groups` (
    `course_group_id` VARCHAR(191) NOT NULL,
    `curriculum_version_id` VARCHAR(191) NOT NULL,
    `group_type` ENUM('FOUNDATION', 'MAJOR', 'COGNATE', 'THESIS', 'DISSERTATION', 'FOREIGN_LANGUAGE', 'BRIDGING', 'OTHER') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `required_units` INTEGER NOT NULL,
    `counts_toward_wce` BOOLEAN NOT NULL DEFAULT true,
    `selection_note` VARCHAR(191) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `curriculum_course_groups_version_id_fkey`(`curriculum_version_id`),
    PRIMARY KEY (`course_group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `curriculum_courses` (
    `curriculum_course_id` VARCHAR(191) NOT NULL,
    `course_group_id` VARCHAR(191) NOT NULL,
    `course_code` VARCHAR(32) NOT NULL,
    `course_title` VARCHAR(191) NOT NULL,
    `units` INTEGER NOT NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `prerequisite_note` VARCHAR(191) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `curriculum_courses_group_code_key`(`course_group_id`, `course_code`),
    INDEX `curriculum_courses_group_id_fkey`(`course_group_id`),
    PRIMARY KEY (`curriculum_course_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_course_progress` (
    `student_course_progress_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `curriculum_course_id` VARCHAR(191) NOT NULL,
    `status` ENUM('NOT_TAKEN', 'IN_PROGRESS', 'PASSED', 'FAILED', 'INCOMPLETE', 'DROPPED', 'CREDITED') NOT NULL DEFAULT 'NOT_TAKEN',
    `rating` VARCHAR(16) NULL,
    `semester` VARCHAR(32) NULL,
    `school_year` VARCHAR(32) NULL,
    `encoded_by_role` ENUM('STUDENT', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    `encoded_by_id` VARCHAR(191) NULL,
    `is_verified_by_admin` BOOLEAN NOT NULL DEFAULT false,
    `verified_by_id` VARCHAR(191) NULL,
    `verified_at` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `student_course_progress_student_course_key`(`student_id`, `curriculum_course_id`),
    INDEX `student_course_progress_student_id_fkey`(`student_id`),
    INDEX `student_course_progress_course_id_fkey`(`curriculum_course_id`),
    INDEX `student_course_progress_encoded_by_id_fkey`(`encoded_by_id`),
    INDEX `student_course_progress_verified_by_id_fkey`(`verified_by_id`),
    PRIMARY KEY (`student_course_progress_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_graduation_milestones` (
    `graduation_milestone_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `publication_status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED') NOT NULL DEFAULT 'NOT_STARTED',
    `publication_title` TEXT NULL,
    `publication_venue` VARCHAR(255) NULL,
    `publication_url` VARCHAR(500) NULL,
    `publication_year` VARCHAR(16) NULL,
    `publication_notes` TEXT NULL,
    `is_publication_verified` BOOLEAN NOT NULL DEFAULT false,
    `publication_verified_by_id` VARCHAR(191) NULL,
    `publication_verified_at` DATETIME(3) NULL,
    `updated_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `student_graduation_milestones_student_id_key`(`student_id`),
    INDEX `student_graduation_milestones_verified_by_fkey`(`publication_verified_by_id`),
    INDEX `student_graduation_milestones_updated_by_fkey`(`updated_by_id`),
    PRIMARY KEY (`graduation_milestone_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `students_curriculum_version_id_fkey` ON `students`(`curriculum_version_id`);

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_curriculum_version_id_fkey` FOREIGN KEY (`curriculum_version_id`) REFERENCES `curriculum_versions`(`curriculum_version_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_versions` ADD CONSTRAINT `curriculum_versions_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `programs`(`program_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_course_groups` ADD CONSTRAINT `curriculum_course_groups_curriculum_version_id_fkey` FOREIGN KEY (`curriculum_version_id`) REFERENCES `curriculum_versions`(`curriculum_version_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_courses` ADD CONSTRAINT `curriculum_courses_course_group_id_fkey` FOREIGN KEY (`course_group_id`) REFERENCES `curriculum_course_groups`(`course_group_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_course_progress` ADD CONSTRAINT `student_course_progress_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_course_progress` ADD CONSTRAINT `student_course_progress_curriculum_course_id_fkey` FOREIGN KEY (`curriculum_course_id`) REFERENCES `curriculum_courses`(`curriculum_course_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_course_progress` ADD CONSTRAINT `student_course_progress_encoded_by_id_fkey` FOREIGN KEY (`encoded_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_course_progress` ADD CONSTRAINT `student_course_progress_verified_by_id_fkey` FOREIGN KEY (`verified_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_graduation_milestones` ADD CONSTRAINT `student_graduation_milestones_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_graduation_milestones` ADD CONSTRAINT `student_graduation_milestones_publication_verified_by_id_fkey` FOREIGN KEY (`publication_verified_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_graduation_milestones` ADD CONSTRAINT `student_graduation_milestones_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
