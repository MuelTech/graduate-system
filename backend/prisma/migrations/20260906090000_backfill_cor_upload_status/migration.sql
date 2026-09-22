-- Synchronize the new upload status with existing verified COR records.
UPDATE `cor_uploads` AS cu
INNER JOIN `cor_records` AS cr ON cr.`cor_upload_id` = cu.`cor_upload_id`
SET cu.`status` = 'VERIFIED'
WHERE cr.`is_admin_verified` = 1;