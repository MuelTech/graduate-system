/*
  Warnings:

  - You are about to drop the column `approved_by_registrar` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `credit_memo` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `extracted_scholarship_discount` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `less_financial_aid` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `net_assessed` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `official_receipt_number` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `outstanding_balance` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `payment_1st_due` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `payment_2nd_due` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `payment_3rd_due` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `payment_validation_date` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `total_assessment` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `total_discount` on the `cor_records` table. All the data in the column will be lost.
  - You are about to drop the column `total_payment` on the `cor_records` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `cor_records` DROP COLUMN `approved_by_registrar`,
    DROP COLUMN `credit_memo`,
    DROP COLUMN `extracted_scholarship_discount`,
    DROP COLUMN `less_financial_aid`,
    DROP COLUMN `net_assessed`,
    DROP COLUMN `official_receipt_number`,
    DROP COLUMN `outstanding_balance`,
    DROP COLUMN `payment_1st_due`,
    DROP COLUMN `payment_2nd_due`,
    DROP COLUMN `payment_3rd_due`,
    DROP COLUMN `payment_validation_date`,
    DROP COLUMN `total_assessment`,
    DROP COLUMN `total_discount`,
    DROP COLUMN `total_payment`;

-- AlterTable
ALTER TABLE `cor_uploads` ADD COLUMN `detected_mime_type` VARCHAR(191) NULL,
    ADD COLUMN `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING';
