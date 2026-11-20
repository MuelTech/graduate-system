-- AlterTable: entrance_exam_applications — track 24h reminder deduplication
ALTER TABLE `entrance_exam_applications`
    ADD COLUMN `reminder_24h_sent_at` DATETIME(3) NULL;

-- AlterTable: email_logs — upgrade to durable MySQL persistent queue, retry, and idempotency store
ALTER TABLE `email_logs`
    MODIFY COLUMN `status` ENUM('QUEUED', 'PROCESSING', 'SENT', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    ADD COLUMN `recipient_name` VARCHAR(180) NULL,
    ADD COLUMN `category` VARCHAR(50) NULL,
    ADD COLUMN `batch_id` VARCHAR(64) NULL,
    ADD COLUMN `idempotency_key` VARCHAR(191) NULL,
    ADD COLUMN `html_body` LONGTEXT NULL,
    ADD COLUMN `text_body` LONGTEXT NULL,
    ADD COLUMN `attempt_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `max_attempts` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `next_attempt_at` DATETIME(3) NULL,
    ADD COLUMN `locked_at` DATETIME(3) NULL,
    ADD COLUMN `last_attempt_at` DATETIME(3) NULL,
    ADD COLUMN `triggered_by_id` VARCHAR(191) NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

CREATE UNIQUE INDEX `email_logs_idempotency_key_key` ON `email_logs`(`idempotency_key`);
CREATE INDEX `email_logs_status_next_attempt_idx` ON `email_logs`(`status`, `next_attempt_at`);
CREATE INDEX `email_logs_category_idx` ON `email_logs`(`category`);
CREATE INDEX `email_logs_batch_id_idx` ON `email_logs`(`batch_id`);
CREATE INDEX `email_logs_created_at_idx` ON `email_logs`(`created_at`);
CREATE INDEX `email_logs_triggered_by_fkey` ON `email_logs`(`triggered_by_id`);

ALTER TABLE `email_logs`
    ADD CONSTRAINT `email_logs_triggered_by_id_fkey`
    FOREIGN KEY (`triggered_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: password_reset_tokens — self-service forgot-password tokens (SHA-256 hash only)
CREATE TABLE `password_reset_tokens` (
    `token_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `requested_ip` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    INDEX `password_reset_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`token_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `password_reset_tokens`
    ADD CONSTRAINT `password_reset_tokens_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
