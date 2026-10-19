# CDW-LIVE-1 MANUAL-QA FIX-4 — Oral Examination Summary Computation Report

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `a84041ebe3fef78f7fa87a5009269abfeb5e372d`
- **Status:** IMPLEMENTED — PENDING INDEPENDENT REVIEW
- **Date:** 2026-10-18
- **Migration:** NONE
- **Schema change:** NONE
- **Document-processing work:** NONE

---

## 1. Scope

FIX-4 removes only the stale institutional Summary-generation blocker. It does not
change evaluator authority, report/RAP authority, signature requirements, conclusion
readiness, or verdict authority.

Implemented outcome:

- institutional `INSTITUTIONAL_MATRIX_V2` evaluations can now produce the numeric
  Oral Examination Summary;
- Group I and Group II averages are canonicalized to two decimal places;
- each Summary row has Group A, Group B, and a dedicated row Average;
- Rating and Remarks remain null/deferred;
- legacy `LEGACY_POINTS_V1` rows remain readable and are never reinterpreted;
- missing or mixed data fails closed instead of fabricating a value.

---

## 2. Canonical arithmetic

For each required finalized evaluator:

```text
Group I Average
  = arithmetic mean of the complete Group I criteria
  -> round to 2 decimal places

Group II Average
  = arithmetic mean of the complete Group II criteria
  -> round to 2 decimal places

Summary Group A
  = finalized Group I Average

Summary Group B
  = finalized Group II Average

Summary row Average
  = (Group A + Group B) / 2
  -> round to 2 decimal places
```

Explicit midpoint evidence:

```text
Group A = 1.20
Group B = 1.25

(1.20 + 1.25) / 2
= 1.225
-> 1.23
```

The implementation uses `Prisma.Decimal` with `ROUND_HALF_UP`, not binary
`Number(...).toFixed(2)` for the canonical calculation.

---

## 3. Rounding implementation

New shared helper:

    backend/src/services/academic-number.rules.ts

Responsibilities:

- `roundAcademicValue()` — rounds one value to exactly two decimals, half-up;
- `meanAcademicValues()` — sums and divides with decimal arithmetic, then rounds
  once at the end;
- returns `null` for missing or non-finite input so callers can fail closed.

`backend/src/services/oral-evaluation.institutional.rules.ts` now uses
`meanAcademicValues()` for complete Group I/II averages. The individual evaluation
still stores no V2 individual overall and no V2 rating.

---

## 4. Summary row shape

`SummaryEvaluatorRow` now carries an additive `averageValue` field:

```text
panelAssignmentId
userId
evaluatorName
functionalRole
groupIValue        -> Summary Group A
groupIIValue       -> Summary Group B
averageValue       -> canonical row Average
overallValue       -> legacy point total only; null for V2
rating             -> null for V2
recommendations
scoringVersion
```

`overallValue` is not reused for the V2 row Average because it has historical legacy
point-total meaning. Existing snapshots without `averageValue` remain readable; the
Admin UI shows `—` for an absent V2 row Average rather than inventing one.

---

## 5. Summary generation behavior

`OfficialDefenseRecordService.ensureOralExamSummary()` now:

1. verifies all required evaluator assignments are FINALIZED;
2. returns an existing Summary unchanged for idempotent callers;
3. rejects mixed legacy/V2 rows with a clear domain conflict;
4. for V2:
   - normalizes each stored Group I/II value to two decimals;
   - rejects missing or out-of-scale group values;
   - computes each row Average as `(A + B) / 2`, rounded half-up;
   - computes internal `overallAverage` as the mean of the finalized row Averages,
     rounded half-up;
   - persists `finalRating = null`, `finalRemarks = null`, and the frozen snapshot;
5. for legacy:
   - preserves the existing point-total behavior;
   - rejects a missing overall value instead of silently substituting zero;
6. keeps unique `scheduleId` convergence and the existing P2002 winner re-read.

The existing last-finalizer trigger in `OralEvaluationService.finalize()` and the
existing Chairman-side self-healing call to `ensureOralExamSummary()` remain in place.
Both converge on the same single Summary record.

---

## 6. Rating and Remarks

For FIX-4:

```text
Rating  = null / deferred
Remarks = null / deferred
```

No Rating label is derived from the group averages, row Average, internal
`overallAverage`, or verdict. Remarks are not inferred from scores or outcome.
Neither field blocks Summary creation, report freeze, signatures, readiness, or the
formal verdict.

---

## 7. Internal `overallAverage`

`OralExamSummary.overallAverage` remains populated for compatibility:

```text
overallAverage
  = arithmetic mean of finalized evaluator Summary row Averages
  -> round to 2 decimal places
```

It is an internal read-model aggregate. It is not a formal Rating, not a verdict, and
not added as a new visible field to the future official form.

---

## 8. Required evaluator rows

Rows remain limited to the exact stage-aware evaluator assignments:

- assigned Chairman;
- assigned evaluator Panelists.

Rapporteur, Adviser, and Facilitator are excluded. No fixed evaluator count is
hard-coded.

---

## 9. Legacy compatibility

- `LEGACY_POINTS_V1` values are not converted to institutional values.
- Institutional V2 values are not converted to legacy points.
- Old concluded records remain readable.
- No historical Summary is fabricated or backfilled.
- If an attempt somehow contains mixed scoring versions, generation fails closed.
- Existing V2 rows with unrounded stored group averages are normalized only in the
  new Summary snapshot; the historical individual row is not rewritten.

---

## 10. Admin Defense Records

The Admin read-only Summary now renders:

- `Group A`, `Group B`, `Average` for institutional V2 rows;
- exactly two decimals for V2 values;
- `Group I`, `Group II`, `Overall` for legacy rows;
- `Internal Average` for the V2 compatibility aggregate;
- `Not assigned` for the deferred Rating.

No Download / Print behavior was added. The existing button remains disabled and has
no PDF, `window.print()`, or fake output path.

---

## 11. Explicit non-goals preserved

- No official Oral Examination Summary Sheet PDF.
- No official Individual Evaluation form renderer.
- No Committee Report/RAP PDF.
- No institutional header/logo/geometry/font/pagination work.
- No signature-image placement on an official form.
- No template versioning.
- No Download / Print enablement.
- No automatic verdict.
- No tenth realtime event.
- No CDW-9 work.

---

## 12. Schema and migration

Inspected storage:

- `OralExamScore.groupAAverage`, `groupBAverage`, `overallAverage`:
  `DECIMAL(65, 30)`;
- `OralExamSummary.overallAverage`: `DECIMAL(65, 30)`.

This precision safely represents the confirmed two-decimal values. No migration was
added.

---

## 13. Verification

Focused backend set:

- 10 files / 228 tests passed.

Full backend suite:

- 159 files / 1850 passed / 5 skipped / 0 failed.

Frontend verification:

- 20 scripts / 405 tests passed.

Static/build:

- backend `npx tsc --noEmit` — clean;
- backend `npm run build` — pass;
- frontend `npx tsc --noEmit` — clean;
- scoped frontend `npx eslint` — clean;
- frontend `npm run build` — pass;
- `npx prisma validate` — valid;
- `git diff --check` — clean (line-ending notices only).

Two existing FIX-3/FIX-3A verifiers contained stale documentation-status assertions
from before commit `7a3fe11`; those assertions were reconciled to the current accepted
FIX-3 status. No production behavior was weakened.

---

## 14. Manual QA

**NOT EXECUTED — ENVIRONMENT LIMITATION.**

No independent authenticated committee contexts were available for a targeted
last-finalizer/Admin Summary browser pass. Automated backend tests cover the numeric
generation, row mapping, rounding, idempotency, race convergence, and read-model
fallbacks. Manual multi-user live-defense acceptance remains user-owned and is not
claimed as passed.

---

## 15. Recommendation

**READY FOR INDEPENDENT REVIEW.**

FIX-4 must not be marked ACCEPTED by this report. Final end-to-end multi-user
acceptance and CDW-9 remain separate gates.
