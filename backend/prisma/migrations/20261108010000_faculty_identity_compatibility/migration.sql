-- Expand account identity only. Existing enum ordinals/rows and all relations are preserved.
ALTER TABLE `users` MODIFY `role` ENUM('ADMIN', 'STUDENT', 'PANELIST', 'CUSTOM', 'APPLICANT', 'FACULTY') NOT NULL DEFAULT 'APPLICANT';
