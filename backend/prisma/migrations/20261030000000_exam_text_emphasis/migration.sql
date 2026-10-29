-- Additive semantic annotations only. Canonical text and all existing identities remain unchanged.
ALTER TABLE `exam_questions` ADD COLUMN `question_text_emphasis` JSON NULL;
ALTER TABLE `exam_options` ADD COLUMN `option_text_emphasis` JSON NULL;
