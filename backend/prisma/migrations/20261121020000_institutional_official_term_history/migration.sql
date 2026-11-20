-- CreateTable: institutional_official_terms for effective office-holder history across Dean/VPAA/President term transitions
CREATE TABLE `institutional_official_terms` (
    `term_id` VARCHAR(191) NOT NULL,
    `role` ENUM('DEAN', 'VPAA', 'PRESIDENT') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `signature_data` LONGTEXT NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `created_by_id` VARCHAR(191) NULL,
    `updated_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `institutional_official_terms_role_from_idx`(`role`, `effective_from`),
    INDEX `institutional_official_terms_role_to_idx`(`role`, `effective_to`),
    INDEX `institutional_official_terms_created_by_fkey`(`created_by_id`),
    INDEX `institutional_official_terms_updated_by_fkey`(`updated_by_id`),
    PRIMARY KEY (`term_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `institutional_official_terms` ADD CONSTRAINT `institutional_official_terms_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `institutional_official_terms` ADD CONSTRAINT `institutional_official_terms_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
