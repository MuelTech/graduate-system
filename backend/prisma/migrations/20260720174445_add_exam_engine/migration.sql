-- CreateTable
CREATE TABLE `exam_questions` (
    `question_id` VARCHAR(191) NOT NULL,
    `question_text` TEXT NOT NULL,
    `type` ENUM('MULTIPLE_CHOICE', 'ESSAY') NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    `order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`question_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_options` (
    `option_id` VARCHAR(191) NOT NULL,
    `question_id` VARCHAR(191) NOT NULL,
    `option_text` TEXT NOT NULL,
    `is_correct` BOOLEAN NOT NULL DEFAULT false,

    INDEX `exam_options_question_id_fkey`(`question_id`),
    PRIMARY KEY (`option_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applicant_answers` (
    `answer_id` VARCHAR(191) NOT NULL,
    `application_id` VARCHAR(191) NOT NULL,
    `question_id` VARCHAR(191) NOT NULL,
    `selected_option_id` VARCHAR(191) NULL,
    `essay_answer` TEXT NULL,

    INDEX `applicant_answers_question_id_fkey`(`question_id`),
    INDEX `applicant_answers_option_id_fkey`(`selected_option_id`),
    UNIQUE INDEX `unique_applicant_question_answer`(`application_id`, `question_id`),
    PRIMARY KEY (`answer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `exam_options` ADD CONSTRAINT `exam_options_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `exam_questions`(`question_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_answers` ADD CONSTRAINT `applicant_answers_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `entrance_exam_applications`(`application_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_answers` ADD CONSTRAINT `applicant_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `exam_questions`(`question_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_answers` ADD CONSTRAINT `applicant_answers_selected_option_id_fkey` FOREIGN KEY (`selected_option_id`) REFERENCES `exam_options`(`option_id`) ON DELETE SET NULL ON UPDATE CASCADE;
