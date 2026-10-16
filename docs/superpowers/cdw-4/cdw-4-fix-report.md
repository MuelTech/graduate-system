# CDW-4 FIX — Faculty-friendly immersive UX + institutional Individual Evaluation matrix

**Branch:** `refactor/collaborative-defense-workspace`
**Scope:** CDW-4 correction only (no CDW-5, no RAP-C1).
**Status:** READY FOR USER REVIEW (manual visual QA is user-owned).

## 1. Decisions (user-confirmed 2026-10-16)

1. Legacy `LEGACY_POINTS_V1` rows render **read-only** in the workspace with an
   explicit compatibility notice; the matrix editor is used only for new
   `INSTITUTIONAL_MATRIX_V2` records. No reinterpretation.
2. **Additive migration** `20261018090000_oral_evaluation_scoring_version`
   (`OralEvaluationScoringVersion` enum + `OralExamScore.scoringVersion`, default
   `LEGACY_POINTS_V1`).
3. **Removed** the early actionable Formal Academic Result selector from the live
   Chairman rail; concluded attempts still show the recorded result read-only.

## 2. Backend

- New `oral-evaluation.institutional.rules.ts`: exact six-level matrix
  (1.00/1.25/1.50/1.75/2.00/2.50, **no 2.25**), per-criterion validation,
  Group I/II **averages** (complete-group only), completeness; **no Overall**, no
  Rating derivation.
- `OralEvaluationService`: a row's scoring version is immutable once created
  (existing rows ⇒ `LEGACY_POINTS_V1`; new rows ⇒ `INSTITUTIONAL_MATRIX_V2`).
  V2 drafts allow partial matrix selections; V2 finalize requires all nine +
  signature; groupA/B store institutional averages; `overallAverage` stays null;
  `rating` stays null. Legacy rows keep the 10/15-point path unchanged.
- `OfficialDefenseRecordService`: official snapshots record `scoringVersion`
  (missing ⇒ legacy); `ensureOralExamSummary` **fails closed** with a clear domain
  blocker when any finalized row is V2 / has a null overall — it never fabricates
  a `0` overall or a rating. Evaluator finalization is unaffected (summary
  generation is best-effort at finalize time).

## 3. Frontend

- New `institutional-evaluation-matrix.tsx`: Group I (5) + Group II (4) radio-cell
  matrix (whole cell is the hit target, one choice per row, accessible per-cell
  names `"<criterion> — <value> <code> <label>"`), always-visible Legend.
- `oral-evaluation-form.tsx`: matrix editor, server-authoritative Group I/II
  averages (labelled incomplete local preview otherwise), Recommendations,
  **sticky** Save Draft / Review & Finalize, no Overall, no Rating. Legacy rows are
  read-only with a clear notice.
- `role-rail.tsx`: Panelist sees only their own evaluation; Chairman adds a
  status-only `evaluation-completion-tracker.tsx`. The generic progress block, the
  live aggregate Summary, and the early Formal Result selector are removed.
  `chairman-conclusion-panel.tsx` is now a read-only concluded-result notice.
- `workspace-shell.tsx`: evaluation rail widened to `xl:w-[28rem] / 2xl:w-[32rem]`
  (drawer below `xl`); the PDF center pane fills the viewport (`flex-1 min-h-0`,
  page scrolls inside the viewer); icon-first, rail-local collapse controls
  (`@base-ui/react/tooltip` primitive, no new dependency); ~200ms ease-out motion
  with `motion-reduce:` fallbacks and edge reopen affordances.

## 4. Validation

Backend: `prisma validate`, `prisma generate`, `npm run build`, full suite
**134 files / 1384 passed / 5 skipped** (was 132/1362/5).

Frontend: **84** verify assertions across
`verify-pdf-anchors` (10), `verify-viewer-core` (13), `verify-cdw2-contracts` (11),
`verify-cdw3-collaboration` (24), `verify-cdw4-workspace` (9),
`verify-cdw4-matrix` (17); `tsc --noEmit` clean; scoped eslint clean (one
pre-existing `<img>` warning); `npm run build` exit 0.

## 5. Migration

DATABASE MIGRATION ADDED — `20261018090000_oral_evaluation_scoring_version`.

LOCAL ACTION REQUIRED:
```
cd backend
npx prisma migrate deploy
npx prisma generate
```
then restart the backend.

## 6. Remaining blocked institutional questions

- The final institutional **Overall** numeric formula (average of 9 criteria vs
  average of the two group averages vs another rule) — not implemented.
- Digital **Rating** semantics (E/HS/VS/S/BS/F derivation) — deferred.
- Digital **Remarks** semantics — deferred.
- The V2 **aggregate Oral Examination Summary** formula (depends on the above) —
  fails closed until confirmed.
