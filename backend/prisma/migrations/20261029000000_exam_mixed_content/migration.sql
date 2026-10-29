-- Additive content contract. Existing identities, text, order and answers stay intact.
ALTER TABLE `exam_questions`
    ADD COLUMN `stimulus_type` ENUM('NONE', 'IMAGE', 'STRUCTURED') NOT NULL DEFAULT 'NONE',
    ADD COLUMN `stimulus_media_id` VARCHAR(36) NULL,
    ADD COLUMN `structured_stimulus` JSON NULL;

-- NULL text permits image-only options; no fake text or fabricated source labels.
ALTER TABLE `exam_options`
    MODIFY `option_text` TEXT NULL,
    ADD COLUMN `label` VARCHAR(8) NULL,
    ADD COLUMN `media_id` VARCHAR(36) NULL;
