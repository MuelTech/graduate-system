-- AlterTable
ALTER TABLE `entrance_exam_applications` ADD COLUMN `seat_released_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('PENDING', 'APPROVED', 'TAKEN', 'PASSED', 'FAILED', 'DISQUALIFIED', 'APPEALED', 'MISSED', 'RESCHEDULED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `exam_schedule_amendments` (
    `amendment_id` VARCHAR(191) NOT NULL,
    `application_id` VARCHAR(191) NOT NULL,
    `type` ENUM('MISSED_APPEAL', 'ADMIN_RESCHEDULE', 'ADMIN_CANCELLATION') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL,
    `reason` TEXT NOT NULL,
    `requested_by_id` VARCHAR(191) NOT NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decision_reason` TEXT NULL,
    `decided_by_id` VARCHAR(191) NULL,
    `decided_at` DATETIME(3) NULL,
    `target_slot_id` VARCHAR(191) NULL,
    `replacement_application_id` VARCHAR(191) NULL,

    UNIQUE INDEX `exam_schedule_amendments_application_id_key`(`application_id`),
    UNIQUE INDEX `exam_schedule_amendments_replacement_application_id_key`(`replacement_application_id`),
    INDEX `exam_schedule_amendments_target_slot_id_idx`(`target_slot_id`),
    INDEX `exam_schedule_amendments_requested_by_id_idx`(`requested_by_id`),
    INDEX `exam_schedule_amendments_decided_by_id_idx`(`decided_by_id`),
    PRIMARY KEY (`amendment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_result_decisions` (
    `decision_id` VARCHAR(191) NOT NULL,
    `application_id` VARCHAR(191) NOT NULL,
    `score_id` VARCHAR(191) NOT NULL,
    `decision` ENUM('PASSED_RECONSIDERED') NOT NULL,
    `reason` TEXT NOT NULL,
    `decided_by_id` VARCHAR(191) NOT NULL,
    `decided_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `exam_result_decisions_application_id_key`(`application_id`),
    UNIQUE INDEX `exam_result_decisions_score_id_key`(`score_id`),
    INDEX `exam_result_decisions_decided_by_id_idx`(`decided_by_id`),
    PRIMARY KEY (`decision_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `exam_owned_seats` ON `entrance_exam_applications`(`slot_id`, `seat_released_at`);

-- AddForeignKey
ALTER TABLE `exam_schedule_amendments` ADD CONSTRAINT `exam_schedule_amendments_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `entrance_exam_applications`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_schedule_amendments` ADD CONSTRAINT `exam_schedule_amendments_replacement_application_id_fkey` FOREIGN KEY (`replacement_application_id`) REFERENCES `entrance_exam_applications`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_schedule_amendments` ADD CONSTRAINT `exam_schedule_amendments_target_slot_id_fkey` FOREIGN KEY (`target_slot_id`) REFERENCES `exam_slots`(`slot_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_schedule_amendments` ADD CONSTRAINT `exam_schedule_amendments_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_schedule_amendments` ADD CONSTRAINT `exam_schedule_amendments_decided_by_id_fkey` FOREIGN KEY (`decided_by_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_result_decisions` ADD CONSTRAINT `exam_result_decisions_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `entrance_exam_applications`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_result_decisions` ADD CONSTRAINT `exam_result_decisions_score_id_fkey` FOREIGN KEY (`score_id`) REFERENCES `entrance_exam_scores`(`score_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_result_decisions` ADD CONSTRAINT `exam_result_decisions_decided_by_id_fkey` FOREIGN KEY (`decided_by_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
