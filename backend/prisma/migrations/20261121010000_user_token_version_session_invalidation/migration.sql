-- AlterTable: add token_version for immediate JWT & realtime session invalidation
ALTER TABLE `users` ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 1;
