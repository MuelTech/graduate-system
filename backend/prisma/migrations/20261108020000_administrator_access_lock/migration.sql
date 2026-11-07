-- Transaction fence only. No User/access/grant bootstrap or conversion.
CREATE TABLE `administrator_access_lock` (
    `id` TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `administrator_access_lock_singleton` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `administrator_access_lock` (`id`) VALUES (1);
