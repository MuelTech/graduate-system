/*
  Warnings:

  - You are about to drop the column `application_date` on the `entrance_exam_applications` table. All the data in the column will be lost.
  - You are about to drop the column `strike_count` on the `entrance_exam_applications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `entrance_exam_applications` DROP COLUMN `application_date`,
    DROP COLUMN `strike_count`;
