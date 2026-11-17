-- CreateTable
CREATE TABLE `user_signatures` (
    `signature_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `signature_data` LONGTEXT NOT NULL,
    `signature_method` VARCHAR(191) NOT NULL DEFAULT 'DRAW',
    `signature_version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_signatures_user_id_key`(`user_id`),
    PRIMARY KEY (`signature_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_signatures` ADD CONSTRAINT `user_signatures_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
