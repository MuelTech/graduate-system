-- Separate semantic metadata; canonical structured content stays unchanged.
ALTER TABLE `exam_questions` ADD COLUMN `structured_stimulus_emphasis` JSON NULL;
