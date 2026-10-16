-- CDW-4 FIX (additive): per-row scoring-version marker.
--
-- The institutional 1.00-2.50 Individual Evaluation matrix reuses the existing
-- Decimal criterion columns. A durable marker is therefore required so that
-- legacy 10/15-point rows keep their original meaning and are never
-- reinterpreted as institutional ratings.
--
-- Existing rows are untouched and default to LEGACY_POINTS_V1. New evaluations
-- created by the collaborative workspace are written as INSTITUTIONAL_MATRIX_V2.
--
-- Additive only: purely additive; no destructive statements and no data rewrite.

ALTER TABLE `oral_exam_scores`
  ADD COLUMN `scoring_version` ENUM('LEGACY_POINTS_V1', 'INSTITUTIONAL_MATRIX_V2') NOT NULL DEFAULT 'LEGACY_POINTS_V1';
