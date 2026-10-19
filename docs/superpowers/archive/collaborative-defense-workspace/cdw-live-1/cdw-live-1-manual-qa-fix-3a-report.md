# CDW-LIVE-1 MANUAL-QA FIX-3A — Signature Modal Copy + Committee Report Readiness Wording

- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `700f01450ba4711577881e8783616ea25bdf0d4d`
- **Status:** **ACCEPTED — INDEPENDENT SOURCE REVIEW PASS + PROJECT-OWNER BOUNDED PRODUCT REVIEW**
- **Date:** 2026-10-18
- **Scope:** two visible copy/cleanup refinements after FIX-3
- **Migration:** **NONE**
- **Academic workflow change:** **NONE**

The package did not self-accept at implementation time. Independent remote source review subsequently passed, and the project owner accepted the visible bounded result. CDW-9 remains NOT STARTED.

---

## 1. Committee Report Signatures wording

When required report-signature slots do not yet exist, the Chairman-facing Formal Verdict
card now shows:

```text
○ Committee Report Signatures — Waiting for report
```

It no longer shows `Pending` or `0 of 0 completed`.

Once required signer slots exist, the card shows the actual authoritative progress:

```text
○ Committee Report Signatures — 0 of 6 completed
○ Committee Report Signatures — 3 of 6 completed
✓ Committee Report Signatures — 6 of 6 completed
```

`Waiting for report` means the Committee Report has not yet reached the stage where the
required signature slots are available. It does not mean report signatures are optional.

## 2. Printed-name copy and plumbing removed

The Step 2 signing modal no longer shows:

- “Your printed name will be supplied automatically from your committee assignment.”
- “Printed name: …”

No manual name field exists.

Because that text block was the only visible consumer of the FIX-3-added name plumbing,
the temporary plumbing was removed cleanly:

- `EvaluationFinalizationDialog.printedName` prop and its visible block;
- `OralEvaluationForm.evaluatorName` prop and forwarding;
- `RoleRail` `workspace.myAssignment.name` forwarding;
- `DefenseWorkspace.myAssignment.name` frontend type field;
- `DefenseWorkspaceDto.myAssignment.name` backend read-model field and derivation;
- the corresponding backend read-model test.

Roster member names and all existing identity data used elsewhere were not changed. The
canonical meaning remains: for eventual official rendering, the printed name is derived
from the exact authenticated assignment/roster identity. The evaluator does not see or
re-type it in the signing modal.

## 3. Preserved behavior

- Individual evaluation signing remains **Draw-only** with Clear, the large canvas,
  correct pointer scaling, touch support, and PNG evidence.
- Back/Cancel/close clears abandoned signature state.
- `flushAndWait()` remains before the finalize POST; failed draft persistence blocks
  finalize.
- Duplicate-submit protection and FINALIZED immutability remain.
- Formal Verdict still shows only Evaluation Signatures and Committee Report Signatures.
- Formal Result controls remain gated by server `readyForConclusion`.
- FIX-2 layout, autosave, and Chairman/Panelist consistency remain intact.

## 4. Realtime / privacy

No realtime code or event mapping changed. Existing accepted mappings remain:

- `evaluation.finalized` → invalidates `conclusionReadiness`;
- `rap.signature.recorded` → invalidates `conclusionReadiness`;
- `rap.finalized` → invalidates `conclusionReadiness`.

Formal Verdict continues to show progress/status only. No raw signature images, draft
scores, evaluation signatures, or report signature evidence are broadcast.

## 5. Files changed

- `frontend/src/components/defense-workspace/chairman-verdict-panel.tsx`
- `frontend/src/components/defense-workspace/evaluation-finalization-dialog.tsx`
- `frontend/src/components/defense-workspace/oral-evaluation-form.tsx`
- `frontend/src/components/defense-workspace/role-rail.tsx`
- `frontend/src/types/defense-workspace.ts`
- `backend/src/services/defense-workspace.service.ts`
- `backend/tests/unit/services/defense-workspace.service.test.ts`
- `frontend/scripts/verify-cdw-live-1-manual-qa-fix-3a.mjs` (new)
- `frontend/scripts/verify-cdw-live-1-manual-qa-fix-3.mjs`
- `frontend/scripts/verify-cdw-live-1-manual-qa-fix-2.mjs`
- `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-3-signature-verdict-roster-ux-design.md`
- `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-3-report.md`
- `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-3a-report.md` (this report)

## 6. Verification

| Check | Result |
|---|---|
| New FIX-3A verifier | **13 passed / 0 failed** |
| FIX-3 verifier | **17 passed / 0 failed** |
| FIX-2 verifier | **20 passed / 0 failed** |
| CDW-LIVE-1B verifier | **24 passed / 0 failed** |
| CDW-LIVE-1C verifier | **31 passed / 0 failed** |
| CDW-4 matrix / workspace | **19 / 9 passed / 0 failed** |
| RAP-C1 verifier | **13 passed / 0 failed** |
| All frontend verification scripts (19) | **395 passed / 0 failed** |
| Backend workspace focused test | **23 passed / 0 failed** |
| Full backend suite | **157 files / 1830 passed / 5 skipped / 0 failed** |
| Backend build | **pass** |
| `npx tsc --noEmit` | **clean** |
| Scoped `npx eslint` | **clean** (one pre-existing `<img>` warning) |
| Frontend production build | **pass** |
| `npx prisma validate` | **valid** |
| New migration | **NONE** |
| `git diff --check` | **clean** |

## 7. Manual QA

The coding agent did **NOT EXECUTE** authenticated browser QA because of environment limitations; no agent manual PASS is claimed.

The project owner subsequently reviewed the visible signature-modal and Formal Verdict wording result and accepted this bounded refinement. The complete multi-user live-defense sequence, including independent authenticated Chairman/Panelist/Rapporteur clients through conclusion, remains pending as the final pre-CDW-9 manual acceptance gate.

## 8. Confirmations

- No backend academic authority expansion; only the temporary display-name plumbing was
  removed.
- Printed identity remains system-derived for eventual official rendering.
- Draw-only signing preserved.
- `readyForConclusion` gate preserved.
- Realtime conclusion-readiness invalidation preserved.
- No schema/migration change.
- No CDW-9 work.

**Reconciled outcome: ACCEPTED FOR BOUNDED UX SCOPE. Final end-to-end multi-user live-defense manual acceptance remains pending before CDW-9.**
