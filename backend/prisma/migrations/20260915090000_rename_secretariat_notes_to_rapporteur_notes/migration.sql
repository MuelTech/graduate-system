-- Rename secretariat_notes → rapporteur_notes (role is RAPPORTEUR, not "Secretariat")
-- MariaDB syntax: CHANGE COLUMN (RENAME COLUMN is MySQL 8.0.23+)
ALTER TABLE `defense_schedules`
  CHANGE COLUMN `secretariat_notes` `rapporteur_notes` TEXT NULL;
