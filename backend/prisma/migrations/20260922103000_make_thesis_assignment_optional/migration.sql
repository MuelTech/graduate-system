-- Title Defense application does not require an adviser (client rule)
ALTER TABLE `thesis_records` MODIFY COLUMN `assignment_id` VARCHAR(191) NULL;
