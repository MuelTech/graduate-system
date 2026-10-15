# CDW-0B — Individual Evaluation scoring audit

**Package:** CDW-0 (semantic audit), part B
**Date:** 2026-10-16
**Branch:** `refactor/collaborative-defense-workspace`
**Baseline:** `origin/main` @ `68f58b9`
**Reference evidence:** supplied EARIST Individual Evaluation form (image) — present
**Outcome:** explicit direction recorded (**Option B**); legacy conversion **BLOCKED / NEEDS INSTITUTIONAL CONFIRMATION**

---

## 1. Current persisted scoring semantics (verified in code)

Source: `backend/src/services/oral-evaluation.rules.ts`, `oral-evaluation.service.ts`, `official-defense-record.service.ts`, `backend/prisma/schema.prisma`.

- **Per-criterion values are raw points** with these limits (`oral-evaluation.rules.ts:83-93`):
  - Group I: Timeliness/Relevance 10, Organization 10, Depth/Comprehensiveness 15, Relevance of Conclusions 10, Evidence of Original Thinking 15 → **max subtotal 60**.
  - Group II: Presentation 10, Mastery of Subject 10, Communication Skill 10, Attitude 10 → **max subtotal 40**.
- **Derivation** (`calculateEvaluationScores`, `:171-196`): Group I = sum of the five Group I points; Group II = sum of the four Group II points; Overall = Group I + Group II → **max 100**. These are **sums/totals**, not averages.
- **Persistence**: the nine criterion columns store points; the columns named `groupAAverage` / `groupBAverage` / `overallAverage` are **legacy names holding point sums/totals** (`oral-evaluation.service.ts:310-327, 504-506`; comment at `oral-evaluation.rules.ts:167-170`).
- **Categorical rating**: `OralExamScore.rating` is an `OralRating?` enum (`E, HS, VS, S, BS, F`; `schema.prisma:676, 1452-1461`). It is stored **independently**, validated on save/finalize (`isValidOralRating`), and **never derived** from points. There is no points→rating formula anywhere.
- **Summary**: `OralExamSummary.overallAverage` = **mean across evaluators of their point totals** (`official-defense-record.service.ts:230-236`); `finalRating` is **always `null`** (`:264-268`). The official snapshot (`OralExamScoreOfficialSnapshot`) records criteria, `groupIValue/groupIIValue/overallValue`, and `rating`.
- **No auto-verdict**: outcome is explicit and validity-checked; the system never maps scores → PASSED/REDEFENSE_REQUIRED (`defense-conclusion.service.ts:147-156`; `assertOutcomeIndependentOfScore`).

## 2. Current frontend semantics

Source: `frontend/src/components/defense-workspace/oral-evaluation-form.tsx`.

- Hard-coded `GROUP_I` / `GROUP_II` arrays mirror the backend limits (`:20-35`).
- Each criterion is a **plain numeric `<input type="number" min=0 max=limit>`** (`:212-236`).
- Group I/II/Overall are shown as **point totals** (server value preferred, local preview otherwise).
- The scale array `["E","HS","VS","S","BS","F"]` exists (`:35`) and is exposed as a bare `<select>` labelled "Rating (optional)" (`:297-318`) — **no legend, and it is not connected to the numeric points**.
- `frontend/src/types/defense-workspace.ts` types `rating` as a bare `string | null` — no typed rating scale, no label map.

## 3. Institutional form findings (supplied image)

The EARIST Individual Evaluation form uses a **per-criterion rating matrix**, not point limits:

| Rating | Label |
|---:|---|
| 1.00 | E — Excellent |
| 1.25 | HS — Highly Satisfactory |
| 1.50 | VS — Very Satisfactory |
| 1.75 | S — Satisfactory |
| 2.00 | BS — Below Satisfactory |
| 2.50 | F — (label cut off in the supplied crop) |

- Structure matches the code's **criteria names and grouping** exactly:
  - **Group I** (5): Timeliness and relevance of study to educational goals; Organization; Depth or Comprehensiveness of treatment; Relevance of conclusions and recommendations; Evidence of original thinking — with a **Group I Average** line.
  - **Group II** (4): Presentation; Mastery of Subject Matter; Communication Skill; Attitude (Receptive to suggestions) — with a **Group II Average** line.
- Header fields: Candidate, Course, Date; a **Recommendations** block; and (per SOT §15.5) a **Summary of Evaluation / Rating / Remarks** and the panelist's **signature over printed name**.
- The matrix is **not a uniform 0.25 grid**: it jumps `2.00 → 2.50` (no 2.25). This is an institutional artifact and must be preserved verbatim, not "corrected".
- Lower is better (1.00 = Excellent, 2.50 = failing end).

## 4. Identified mismatch

| Dimension | Current code | Institutional form |
|---|---|---|
| Per-criterion scale | 0–10 / 0–15 points | 1.00–2.50 rating (6 fixed levels) |
| Group derivation | point **sum** (60 / 40) | group **average** |
| Overall | point **total** (100) | derived summary / rating / remarks |
| Categorical label | stored independently, unconnected | **is** the per-criterion rating |
| Legend | absent | E/HS/VS/S/BS/F |

The **criteria structure is correct**; the **scale and derivation are not**. The 10/15 point limits appear nowhere on the form.

## 5. Explicit recommended direction — **Option B**

**Adopt the institutional 1.00–2.50 rating scale as the authoritative target
model** for the Individual Evaluation:

- Each criterion is rated on the six-level matrix; the categorical label
  (E/HS/VS/S/BS/F) is the rating at that criterion.
- Group I / Group II values become **averages** of their criterion ratings.
- The evaluator "Overall" becomes an explicitly defined institutional summary
  (average + Summary of Evaluation / Rating / Remarks), not a point total.
- The UI follows the form's matrix/legend.

**Not adopted:** Option A (keep point semantics) would present a familiar-looking
matrix that misrepresents the real scale. Option C is only for direct
institutional evidence (none supplied).

## 6. Unresolved institutional question — BLOCKED

The form fixes the **target**, but it does **not** tell us how to convert
**already-persisted point records** (0–60 / 0–40 / 0–100 and the independent
E/HS/VS/S/BS/F rating) into 1.00–2.50 ratings. Per the task and SOT §7.2/§17:

> **Do NOT invent a conversion between the point model and the 1.00–2.50 matrix.**

Therefore:

- **BLOCKED / NEEDS INSTITUTIONAL CONFIRMATION:** the legacy→1.00–2.50 conversion.
- CDW-0 performs **no destructive migration** and **no reinterpretation** of
  existing rows.
- Legacy point rows must remain **readable under their original meaning**.

## 7. Exact CDW-4 impact

### 7a. Scoring-model adoption (Option B)

Backend:
- `oral-evaluation.rules.ts` — replace `CRITERION_LIMITS` with the six-level
  institutional scale; `validateCriterionValue` must validate against the allowed
  levels; `calculateEvaluationScores` returns group **averages**; define the
  Overall/summary derivation.
- `OralExamScore` — the nine criterion columns + `groupAAverage`/`groupBAverage`/
  `overallAverage` change meaning from points/sums to ratings/averages. Decide
  whether the independent `rating` column is retained (per-criterion) or derived.
- `official-defense-record.service.ts` — snapshot schema + `ensureOralExamSummary`
  (`overallAverage` currently mean of point totals).
- Legacy handling: a versioned interpretation or an institutionally confirmed
  conversion is required before existing rows can be re-read (this is the BLOCKED item).
- Tests to change: `oral-evaluation.rules.test.ts`, `oral-evaluation.service.test.ts`,
  `official-defense-record` tests (`cp7-*`), `panelist-dashboard.rules.test.ts`.

Frontend:
- `oral-evaluation-form.tsx` — replace numeric inputs with the 1.00–2.50 radio
  matrix + legend; show group **averages**; keep Recommendations separate.
- `types/defense-workspace.ts` — type the rating scale and label map.
- Chairman Oral Summary display — new derived values.

### 7b. Scoring-open correction (target: all stages open only when `IN_PROGRESS`)

Verified current state **differs from the target**:

- `oral-evaluation.rules.ts:51-81` — Title editable only when `IN_PROGRESS`;
  Proposal/Final editable when `SCHEDULED` **or** `IN_PROGRESS`.
- `oral-evaluation.service.ts:359-371` — Proposal/Final **auto-start** the session
  on the first draft save; Title never auto-starts.
- `panelist-dashboard.rules.ts:335-337` mirrors the same branch.
- `defense-workspace.service.ts:567-624` — `startTitleDefense` (Chairman-only) is Title-specific.

CDW-4 must:
- make `isSessionEditableForEvaluation` require `IN_PROGRESS` for **all** stages;
- remove the Proposal/Final auto-start (or require an explicit Start Defense for all stages);
- generalize the Start action beyond Title;
- update backend tests `oral-evaluation.rules.test.ts`, `oral-evaluation.service.test.ts`,
  `panelist-dashboard.rules.test.ts`, defense-workspace tests; and frontend capability
  semantics (`defense-workspace.ts`, workspace page, `oral-evaluation-form.tsx`).

## 8. Verdict

Evaluation semantics now have an **explicit, approved implementation direction
(Option B)**, with the legacy conversion correctly marked **BLOCKED** rather than
guessed. CDW-0B is therefore **resolved as a direction** and **blocked only on the
legacy-data conversion question**, which must be answered by the institution/client
before any CDW-4 migration.
