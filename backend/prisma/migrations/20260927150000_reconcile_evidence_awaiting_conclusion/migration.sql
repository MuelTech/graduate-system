-- CP5-FIX1: data reconciliation only.
-- Proposal/Final sessions stuck in AWAITING_CONCLUSION after CP5 DRAFT backfill
-- are moved back to IN_PROGRESS when not all CHAIRMAN/PANELIST evaluations
-- are FINALIZED. Does not touch CONCLUDED, CANCELLED, or Title sessions.
-- Evaluator roles are historical data-correction only (app uses DefenseCommitteePolicy).

UPDATE `defense_schedules` ds
JOIN (
  SELECT
    ds2.schedule_id AS sid,
    (
      SELECT COUNT(*) FROM `panel_assignments` pa
      WHERE pa.schedule_id = ds2.schedule_id
        AND pa.role IN ('CHAIRMAN', 'PANELIST')
    ) AS required_evaluators,
    (
      SELECT COUNT(*) FROM `oral_exam_scores` oes
      WHERE oes.schedule_id = ds2.schedule_id
        AND oes.status = 'FINALIZED'
        AND oes.panel_id IN (
          SELECT pa2.panel_id FROM `panel_assignments` pa2
          WHERE pa2.schedule_id = ds2.schedule_id
            AND pa2.role IN ('CHAIRMAN', 'PANELIST')
        )
    ) AS finalized_evaluators
  FROM `defense_schedules` ds2
  WHERE ds2.session_status = 'AWAITING_CONCLUSION'
    AND ds2.defense_type IN ('PROPOSAL_DEFENSE', 'FINAL_DEFENSE')
) calc ON calc.sid = ds.schedule_id
SET ds.session_status = 'IN_PROGRESS'
WHERE calc.required_evaluators > 0
  AND calc.finalized_evaluators < calc.required_evaluators;
