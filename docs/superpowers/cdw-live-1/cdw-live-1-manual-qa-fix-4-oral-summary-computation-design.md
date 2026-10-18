# CDW-LIVE-1 MANUAL-QA FIX-4 — Oral Examination Summary Computation Design

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** MuelTech/graduate-system  
**Branch:** `refactor/collaborative-defense-workspace`  
**Design baseline HEAD:** `7a3fe118e8c23cf1d4ab4dafde69fb6c7a4fa656`  
**Parent workflow authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Collaborative workspace authority:** `docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md`  
**Implementation plan:** `docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md`  
**Status:** CONFIRMED DESIGN — NOT IMPLEMENTED  
**Date:** 2026-10-18  
**Expected migration:** NONE unless implementation audit proves the current numeric column precision cannot represent two-decimal values safely  
**Expected document-processing work:** NONE  
**Expected academic verdict change:** NONE

---

## 0. Why FIX-4 exists

The current institutional evaluator flow correctly uses the EARIST matrix and already derives Group I / Group II averages.

However, current backend Summary generation intentionally rejects `INSTITUTIONAL_MATRIX_V2` rows because older implementation comments treated institutional Overall/Rating semantics as unconfirmed.

EARIST has now confirmed enough arithmetic to generate the Oral Examination Summary without inventing Rating/Remarks.

FIX-4 removes that workflow blocker.

It does **not** implement official PDF/form rendering.

---

## 1. Current institutional individual-evaluation arithmetic

Each evaluator completes the institutional criteria matrix.

For each finalized evaluator:

```text
Group I Average
= sum of all Group I criterion ratings
  / number of Group I criteria

Group II Average
= sum of all Group II criterion ratings
  / number of Group II criteria
```

Both official derived averages are rounded to **2 decimal places**.

Partial DRAFT criteria must not produce an official finalized group average. Finalization still requires every required criterion.

---

## 2. Oral Examination Summary row mapping

The supplied EARIST Oral Examination Summary Sheet contains:

- Panel of Examiners;
- Rating for Group A;
- Rating for Group B;
- Average.

For every required numerical evaluator:

```text
Panel of Examiners
= authoritative evaluator identity from the defense assignment

Rating for Group A
= finalized evaluator Group I Average

Rating for Group B
= finalized evaluator Group II Average

Average
= (Group A + Group B) / 2
```

The Summary must not recompute the underlying nine criteria differently from the individual evaluation. It consumes the finalized evaluator's canonical Group I / Group II values.

---

## 3. Required evaluator rows

The Summary includes the same numerical evaluators that own official individual evaluations:

- assigned Chairman;
- all assigned evaluator Panelists.

Do not add as numerical evaluator rows:

- Rapporteur;
- Adviser;
- Facilitator.

This follows the existing evaluator-authority policy.

---

## 4. Two-decimal rounding rule

All official derived averages in this path use **two decimal places**:

- finalized evaluator Group I Average;
- finalized evaluator Group II Average;
- Summary per-evaluator Average;
- internal Summary aggregate if the existing persistence field requires one.

Round to the nearest hundredth. Do not truncate.

Example:

```text
Group A = 1.20
Group B = 1.25

(1.20 + 1.25) / 2
= 1.225
= 1.23
```

The implementation should use a deterministic decimal-safe rounding helper appropriate for persisted academic values rather than relying on presentation formatting alone.

---

## 5. Rating and Remarks

For this package:

```text
Rating  = deferred / null
Remarks = deferred / null
```

They are not required to:

- create the Oral Examination Summary;
- freeze/prepare the Committee Report once other canonical prerequisites pass;
- collect required Committee Report signatures;
- reach conclusion readiness;
- record PASSED or REDEFENSE_REQUIRED.

Do not derive a Rating label from the numeric averages in FIX-4.

Do not infer Remarks from scores or verdict.

EARIST may define those fields later as a separate policy/document-processing clarification.

---

## 6. Automatic Summary generation

Once every required evaluator record for the exact defense attempt is FINALIZED:

```text
all required evaluations FINALIZED
  -> derive/reuse finalized Group I and Group II values
  -> build one Summary row per required evaluator
  -> calculate each row Average
  -> persist exactly one Oral Examination Summary
  -> Summary becomes available to authorized Admin read models
```

Generation must remain:

- server-side;
- authoritative;
- idempotent;
- race-safe;
- scoped to the exact defense schedule/attempt.

No Admin, Chairman, Panelist, or Rapporteur should manually re-key the same values.

The existing last-finalizer trigger and later self-healing/ensure path may both converge on the same single Summary record.

---

## 7. Internal `overallAverage` compatibility field

The supplied Summary Sheet does not visibly define an additional grand-average field below the examiner table.

If the existing database/API contract requires `OralExamSummary.overallAverage`, FIX-4 may populate it as:

```text
internal overallAverage
= arithmetic mean of all finalized evaluator Summary row Average values
→ round to 2 decimal places
```

This value is:

- an internal compatibility/read-model aggregate;
- not a new confirmed visible field on the supplied institutional form;
- not a Rating;
- not a verdict;
- never allowed to auto-decide PASSED or REDEFENSE_REQUIRED.

---

## 8. Admin read model

After Summary generation, authorized Admin Defense Records may display/read the canonical data:

- examiner name;
- role if useful to the operational UI;
- Group A;
- Group B;
- per-examiner Average;
- generated timestamp;
- other already-authorized defense metadata.

Detailed Summary access remains Admin-side under the current policy.

This package does not grant committee users access to the detailed Admin Summary read model.

---

## 9. Official document processing is explicitly out of scope

FIX-4 does **not** generate the photographed/scanned EARIST form as a PDF.

Do not implement in this package:

- exact Oral Examination Summary Sheet geometry;
- exact Individual Evaluation form geometry;
- EARIST/Graduate School logos or letterhead placement;
- form code/revision footer reproduction;
- exact fonts/margins/table dimensions;
- signature placement on the official sheet;
- Adviser concurrence / Dean attestation document rendering;
- PDF generation;
- print CSS;
- Download / Print enablement;
- template versioning;
- image/template overlay rendering.

The Admin `Download / Print` control remains disabled/deferred until the dedicated Official Defense Forms / Document Processing phase.

Canonical structured records come first; future renderers consume those records.

---

## 10. No verdict automation

Numeric completion never determines the academic result.

Even after Summary generation:

- Chairman remains the sole formal verdict authority;
- canonical verdicts remain `PASSED` and `REDEFENSE_REQUIRED`;
- Committee Report/RAP lifecycle and required signatures still complete before verdict;
- `readyForConclusion` remains the authoritative conclusion gate.

---

## 11. Implementation expectations

Likely backend production areas:

- `backend/src/services/oral-evaluation.institutional.rules.ts`;
- `backend/src/services/oral-evaluation.service.ts`;
- `backend/src/services/official-defense-record.service.ts`;
- relevant conclusion/readiness or RAP-freeze tests only if needed.

Likely Admin/read-model/frontend areas:

- Admin Defense Records Summary presentation if it currently assumes `overallValue` from legacy rows;
- formatting helpers so official numeric values display at exactly two decimal places.

Prefer a shared server-side decimal rounding helper so persisted/snapshotted values are canonical and UI formatting is not the only rounding layer.

Expected schema change: **NONE**.

If current Prisma decimal precision is insufficient, STOP and report before adding a migration.

---

## 12. Backward compatibility

Do not reinterpret legacy `LEGACY_POINTS_V1` records as institutional matrix values.

Legacy concluded/readable records keep their historical semantics.

FIX-4 applies the newly confirmed computation to `INSTITUTIONAL_MATRIX_V2` records and new canonical Summary generation.

Do not fabricate missing historical Summary rows for old concluded attempts unless a separate safe backfill is explicitly designed.

---

## 13. Automated acceptance requirements

At minimum verify:

1. Group I institutional average is arithmetic mean of all required Group I criteria.
2. Group II institutional average is arithmetic mean of all required Group II criteria.
3. both finalized group averages normalize to two decimal places.
4. Summary Group A equals that evaluator's finalized Group I Average.
5. Summary Group B equals that evaluator's finalized Group II Average.
6. Summary row Average equals `(Group A + Group B) / 2`.
7. `1.225` rounds to `1.23`, not `1.22` or `1.225`.
8. exactly one Summary row exists per required evaluator assignment.
9. Rapporteur/Adviser/Facilitator are excluded from numerical evaluator rows.
10. all required evaluations must be FINALIZED before Summary creation.
11. institutional V2 Summary creation no longer rejects because Rating/Remarks are unresolved.
12. Rating remains null/deferred.
13. Remarks remains null/deferred.
14. concurrent/duplicate ensure calls converge to one Summary.
15. last-finalizer generation path works.
16. self-healing/ensure path works if first generation attempt transiently fails.
17. Summary existence allows the later canonical readiness flow to continue.
18. Summary arithmetic never auto-records a verdict.
19. legacy scoring behavior remains readable and unchanged.
20. no document/PDF rendering is introduced.
21. Admin Download / Print remains deferred/disabled.
22. no CDW-9 work.

---

## 14. Manual QA after implementation

Manual QA should confirm only product-visible behavior that automated tests cannot fully prove:

1. finalize the last required evaluator;
2. verify the workflow no longer stalls because Rating/Remarks are missing;
3. open Admin Defense Records;
4. verify each required evaluator row shows Group A, Group B, and Average with exactly two decimals;
5. verify a value such as `1.225` is shown as `1.23`;
6. verify no fabricated Rating/Remarks are presented;
7. verify Download / Print is still disabled/deferred;
8. continue to Committee Report/signature workflow.

The broader multi-user live-defense acceptance remains a separate subsequent gate.

---

## 15. Gate relative to final acceptance and CDW-9

```text
FIX-3 + FIX-3A BOUNDED UX ACCEPTED
  -> FIX-4 ORAL EXAMINATION SUMMARY COMPUTATION
  -> independent source review
  -> targeted Summary manual QA
  -> final end-to-end multi-user live-defense manual acceptance
  -> CDW-9
```

CDW-9 remains **NOT STARTED**.
