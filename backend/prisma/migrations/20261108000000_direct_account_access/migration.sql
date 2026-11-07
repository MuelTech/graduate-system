-- FACULTY-1: additive storage only. No account/grant bootstrap or legacy data rewrite.
CREATE TABLE `administrator_access` (
    `user_id` VARCHAR(191) NOT NULL,
    `level` VARCHAR(16) NOT NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `updated_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `administrator_access_created_by_id_idx`(`created_by_id`),
    INDEX `administrator_access_updated_by_id_idx`(`updated_by_id`),
    PRIMARY KEY (`user_id`),
    CONSTRAINT `administrator_access_level_check` CHECK (BINARY `level` IN ('FULL', 'RESTRICTED'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `account_capability_grants` (
    `grant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `capability_key` VARCHAR(96) NOT NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `updated_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `account_capability_grants_user_id_capability_key_key`(`user_id`, `capability_key`),
    INDEX `account_capability_grants_created_by_id_idx`(`created_by_id`),
    INDEX `account_capability_grants_updated_by_id_idx`(`updated_by_id`),
    PRIMARY KEY (`grant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `administrator_access` ADD CONSTRAINT `administrator_access_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `administrator_access` ADD CONSTRAINT `administrator_access_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `administrator_access` ADD CONSTRAINT `administrator_access_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `account_capability_grants` ADD CONSTRAINT `account_capability_grants_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `account_capability_grants` ADD CONSTRAINT `account_capability_grants_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `account_capability_grants` ADD CONSTRAINT `account_capability_grants_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
