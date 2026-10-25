-- Widen the existing optional reason without rewriting historical requests.
ALTER TABLE `adviser_requests` MODIFY `reason` TEXT NULL;

CREATE TABLE `adviser_request_signed_states` (
    `request_id` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `signature_data` LONGTEXT NOT NULL,
    `evidence_hash` VARCHAR(64) NOT NULL,
    `signed_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `adviser_request_official_records` (
    `request_id` VARCHAR(191) NOT NULL,
    `student_user_id` VARCHAR(191) NOT NULL,
    `requested_adviser_id` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `signature_data` LONGTEXT NOT NULL,
    `evidence_hash` VARCHAR(64) NOT NULL,
    `finalized_at` DATETIME(3) NOT NULL,
    INDEX `adviser_request_official_records_student_user_id_idx` (`student_user_id`),
    INDEX `adviser_request_official_records_requested_adviser_id_idx` (`requested_adviser_id`),
    PRIMARY KEY (`request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `adviser_request_signed_states` ADD CONSTRAINT `adviser_request_signed_states_request_id_fkey`
    FOREIGN KEY (`request_id`) REFERENCES `adviser_requests`(`adviser_req_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `adviser_request_official_records` ADD CONSTRAINT `adviser_request_official_records_request_id_fkey`
    FOREIGN KEY (`request_id`) REFERENCES `adviser_requests`(`adviser_req_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
