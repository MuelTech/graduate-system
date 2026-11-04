-- B7 completion evidence is unknown for historical evaluations. No backfill.
ALTER TABLE `entrance_exam_scores`
    ADD COLUMN `essay_evaluated_at` DATETIME(3) NULL;
