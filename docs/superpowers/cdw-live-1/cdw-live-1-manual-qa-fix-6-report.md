# CDW-LIVE-1 MANUAL-QA FIX-6 — Parallel Committee Report Signing + Faculty UI Language

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `c7893737d9bb0ea10963ea3fb84c743596519e46`
- **Status:** IMPLEMENTED + SOURCE-REVIEW CORRECTION APPLIED + MANUAL-REVIEW UI SIMPLIFICATION — READY FOR REVIEW
- **Date:** 2026-10-19
- **Migration:** NONE
- **Schema change:** NONE
- **Document-processing work:** NONE
- **CDW-9:** NOT STARTED

---

## 1. Scope

FIX-6 removes the unnecessary serialization between individual evaluation work and
Committee Report finalization/signing. It also replaces faculty-facing implementation
jargon (`freeze`, `frozen version`, `contentVersion`, `RAP Report`) with the approved
Committee Report workflow language.

The two workstreams remain independent until the Chairman's formal-verdict gate:

```text
IN_PROGRESS
  ├─ Evaluation work: Chairman/Panelists draft, sign, finalize
  └─ Committee Report work: Rapporteur authors, finalizes, required signers sign
                              ↓
                  strict Chairman conclusion readiness
```

---

## 2. Root cause

`DefenseCollaborationService.freezeReportForSignatures()` called
`OfficialDefenseRecordService.ensureOralExamSummary()` before creating the immutable
report snapshot. That call failed whenever not every required evaluator was finalized,
so Committee Report finalization indirectly required the entire evaluation workstream
and the Oral Examination Summary.

The report read model also exposed an evaluator/Summary readiness checklist, and the
faculty signing surfaces still rendered `Freeze for Signatures`, `Confirm Freeze`,
`Frozen version`, and the internal `contentVersion`.

---

## 3. Backend rules after FIX-6

### Committee Report finalization

The assigned Rapporteur may finalize a content-complete `DRAFT` Committee Report when:

- the caller is the exact assigned Rapporteur;
- the session is `IN_PROGRESS` or `AWAITING_CONCLUSION`;
- the report is still `DRAFT` and not yet frozen;
- the stored body is valid and contains meaningful content;
- the locked draft body version still matches.

Finalization still creates the immutable signing snapshot, `contentVersion`, and
server-side SHA-256 hash, and creates/reconciles the exact stage-aware signer slots.

Finalization no longer requires or triggers:

- all required evaluator records to be `FINALIZED`;
- an existing Oral Examination Summary;
- the Chairman/Panelists/Rapporteur to have completed their own evaluation.

### Committee Report signing

A required signer may sign the finalized report when:

- the caller has an exact own required slot on the report;
- the report is frozen and in `FOR_SIGNATURE` / `PARTIALLY_SIGNED`;
- the session is `IN_PROGRESS` or `AWAITING_CONCLUSION`;
- the slot is still unsigned.

Signing does not check the signer's own evaluation state, does not permit signing
another person's slot, and remains bound to the finalized content version/hash.

### Chairman conclusion

The existing strict gate is unchanged. Conclusion still requires:

- assigned session Chairman;
- `AWAITING_CONCLUSION`;
- all required evaluations finalized;
- Oral Examination Summary present;
- Committee Report finalized and every required signature complete;
- no existing conclusion;
- explicit `PASSED` or `REDEFENSE_REQUIRED`.

Scores still never decide the verdict.

### Evaluation finalization

Evaluation ownership, privacy, draft autosave, drawn signature, finalization locking,
and automatic idempotent Oral Examination Summary generation remain unchanged.

---

## 4. Faculty-facing UI language

### Rapporteur authoring

- `Committee Report`
- `Draft`
- `Finalize Committee Report`
- `Finalize Committee Report?`
- `Once finalized, the report can no longer be edited. Required committee members can review and sign it immediately.`
- `Evaluations can be completed separately before the Chairman records the formal verdict.`
- `Cancel`
- `Finalize Report`
- `Finalizing…`
- `The Committee Report could not be finalized. Please try again.`

The evaluator/Summary readiness checklist was removed from the authoring experience.

> **Post-review copy refinement — 2026-10-19:** the implemented sentence `Evaluations can be completed separately before the Chairman records the formal verdict.` is no longer approved as faculty-facing confirmation copy. It is domain-correct but redundant because the UI already demonstrates the parallel workstreams. The canonical FIX-6 design now omits it. This documentation update does not claim that the existing rendered sentence at the current implementation HEAD has already been removed; remove it when this surface is next refined or in a bounded copy cleanup.

### Finalized report

- `Ready for Signatures`
- `Awaiting Signatures`
- `<signed> of <required> signatures completed`
- `Your signature is required.`
- `Sign Committee Report`
- `Signed`
- `You signed this Committee Report on <date/time>.`
- `Committee Report Complete`

No full cross-signer roster or signature timestamps are shown to ordinary faculty.

### Sign Committee Report dialog

- `Sign Committee Report`
- `Draw your signature below. Once confirmed, your signature cannot be changed.`
- draw-only shared signature pad
- `Cancel`
- `Confirm Signature`
- `Signing…`

The dialog opens directly to the signature pad. There is no separate review/step state.
Internal version/snapshot/hash identifiers are not rendered.

> **Post-manual-review UI correction — 2026-10-19:** the original FIX-6 implementation
> used a two-step review/sign dialog. Project-owner manual review found the review step
> redundant because the finalized Committee Report is already visible before signing.
> The current copy above reflects the accepted single-step flow. The earlier two-step
> implementation remains part of the historical implementation record and is not
> rewritten as if it never existed.

### Formal Verdict

- `Evaluations` — `<finalized> of <required> finalized`
- `Committee Report Signatures` — `<signed> of <required> completed`
- when slots do not yet exist: `Committee Report Signatures — Waiting for finalized report`

The server `readyForConclusion` decision still controls the verdict action.

### Secondary E-Signatures page

Visible legacy labels were reconciled to `Committee Report`, including:

- `pending Committee Report signatures`
- `No pending Committee Report signatures.`
- `Committee Report`
- `official Committee Report`
- `No signed Committee Report slots loaded in this view yet.`

Backend routes such as `/rap-reports/...` were intentionally not renamed.

---

## 5. Files changed

Backend production:

- `backend/src/services/defense-collaboration.service.ts`
- `backend/src/services/report-edit-authority.rules.ts`
- `backend/src/services/rap-report.service.ts` (user-facing error wording only)

Backend tests:

- `backend/tests/unit/services/defense-collaboration.service.test.ts`
- `backend/tests/unit/services/rap-c1-freeze-signature.test.ts`

Frontend production:

- `frontend/src/components/defense-workspace/rap-signature-panel.tsx`
- `frontend/src/components/defense-workspace/committee-report-panel.tsx`
- `frontend/src/components/defense-workspace/committee-report-signature-dialog.tsx`
- `frontend/src/components/defense-workspace/chairman-verdict-panel.tsx`
- `frontend/src/components/defense-workspace/role-rail.tsx`
- `frontend/src/components/defense-workspace/defense-history-panel.tsx` (visible Committee Report label)
- `frontend/src/app/(portal)/panelist/signatures/page.tsx`

Verification:

- new `frontend/scripts/verify-cdw-live-1-manual-qa-fix-6.mjs`
- updated existing Committee Report/signing/history verifiers whose accepted copy or
  revision-history assertions were superseded by FIX-6

Correction additions:

- `frontend/src/lib/report/report-autosave.ts`
- `backend/src/controllers/defense-collaboration.controller.ts`
- `backend/tests/unit/controllers/defense-collaboration.controller.test.ts`
- focused autosave regressions in `frontend/scripts/verify-cdw-live-1a-report.mjs`

Documentation:

- this report

---

## 6. Realtime impact

No new persisted domain event and no event-taxonomy change. The existing events remain:

- `report.ready_for_signature` after successful report finalization;
- `rap.signature.recorded` after signature persistence;
- `rap.finalized` after all required report signatures complete;
- `evaluation.finalized` independently after evaluator completion;
- `defense.concluded` after the Chairman verdict.

REST/database remains authoritative. Clients continue to invalidate/refetch.

---

## 7. Verification

| Check | Result |
|---|---|
| Focused backend FIX-6/RAP tests | **2 files / 97 passed / 0 failed** |
| Full backend suite | **159 files / 1852 passed / 5 skipped / 0 failed** |
| All frontend verifier scripts (23 scripts) | **454 passed / 0 failed** |
| New FIX-6 verifier | **13 passed / 0 failed** |
| Frontend `npx tsc --noEmit` | **clean** |
| Scoped frontend ESLint | **clean** |
| Frontend `npm run build` | **pass** |
| Backend `npm run build` (`tsc`) | **pass** |
| `npx prisma validate` | **valid** |
| `git diff --check` | **clean** (line-ending notices only) |
| Schema / migration change | **NONE** |

---

## 8. Independent Source Review Correction — Autosave Finalization Drain

### Source-review finding

The initial FIX-6 implementation removed the evaluator/Summary prerequisite, but
`RapSignaturePanel` still posted `/collaboration/report/freeze` directly while
`ReportAuthoringPanel` owned the `ReportAutosaveController` and the newest editor body.

That left a real race:

1. the Rapporteur types newer wording;
2. autosave is still debounced or in flight;
3. the Rapporteur confirms **Finalize Report**;
4. finalization could freeze the older persisted body;
5. the pending newer save would then fail after the report became immutable.

The backend `bodyVersion` CAS could not protect browser-local unsaved text.

### Correction

- `ReportAutosaveController` now exposes `flushAndWait()`.
- The drain is awaitable and serialized through the existing save pipeline.
- It covers:
  - dirty local body;
  - an already in-flight save;
  - newer edits made behind an in-flight save;
  - clean/already-saved state;
  - save failure;
  - CAS conflict;
  - offline unsaved state.
- It never changes lifecycle to `draining`, never starts a competing save, and never
  automatically retries a failed save.
- `ReportAuthoringPanel` now owns the finalization POST and performs:
  `flushAndWait()` → verify success → `POST /collaboration/report/freeze`.
- `RapSignaturePanel` requests finalization through an `onFinalize` callback and no
  longer posts the finalization endpoint independently.
- Save failure or conflict blocks finalization and leaves the report editable. The
  existing conflict/reload state remains available.
- A `finalizingRef` guard prevents duplicate finalization mutation execution.
- The finalization request includes the persisted `expectedBodyVersion`; the backend
  transaction rejects a stale version with `409` as defense-in-depth against another
  tab/client saving first. The frontend drain remains the primary protection.

### Correction verification

| Check | Result |
|---|---|
| Focused frontend verifier set (8 scripts) | **199 passed / 0 failed** |
| Focused backend set (4 files) | **149 passed / 0 failed** |
| Frontend `npx tsc --noEmit` | **clean** |
| Scoped frontend ESLint on correction files | **clean** |
| Frontend production build | **pass** |
| Backend build (`tsc`) | **pass** |
| `git diff --check` | **clean** |

The six new autosave-drain regressions cover dirty save-before-finalize, in-flight plus
newer edit, save failure, conflict (including no automatic retry), offline unsaved, and
clean/already-saved behavior. The FIX-6 verifier additionally checks the parent-owned
drain/POST ordering and duplicate-finalize guard.

---

## 9. Manual Review UI Correction — Single-Step Committee Report Signing

### Manual-review finding

The finalized Committee Report is already visible in the workspace before the user
clicks the signing action. The implemented two-step dialog nevertheless repeated a
review/instruction step that presented no additional report content:

```text
Review & Sign
  -> Review and Sign Committee Report
  -> Continue to Sign
  -> Add Your Signature
  -> Confirm Signature
```

That conflicted with the canonical UI rule: **Do not explain what the UI already
demonstrates.**

### Correction

- Finalized-report action is now **Sign Committee Report**.
- The dialog opens directly to the signature pad.
- Removed:
  - the review/sign step state;
  - `Review and Sign Committee Report`;
  - `Continue to Sign`;
  - the “Nothing is signed until…” instructional step;
  - `Add Your Signature`;
  - the Back action that existed only for the two-step flow.
- Current dialog copy:
  - title: **Sign Committee Report**
  - description: **Draw your signature below. Once confirmed, your signature cannot be changed.**
  - actions: **Cancel**, **Confirm Signature**
  - pending: **Signing…**
  - success remains **Signed**, with the existing own timestamp.
- Draw-only `ESignaturePad`, duplicate-confirm guard, error handling, and the existing
  signing endpoint remain unchanged.
- Rapporteur finalization still does **not** auto-sign the Rapporteur. Finalization and
  signing remain separate explicit actions.

### Correction verification

| Check | Result |
|---|---|
| Focused verifier set: FIX-5, FIX-6, RAP-C1 | **3 scripts / 44 passed / 0 failed** |
| Focused single-step dialog assertions | PASS |
| Frontend `npx tsc --noEmit` | **clean** |
| Scoped ESLint on changed components | **clean** |
| `git diff --check` | **clean** (line-ending notices only) |
| Frontend production build | Not run — bounded component copy/flow change; no API/type wiring or routing changes |
| Backend tests/build | Not run — no backend production-code change |
| Prisma tooling | Not run — no schema/migration change |

No backend authority, signer roster, evaluation workflow, Summary arithmetic, verdict
gate, realtime event, schema, or document-processing behavior was changed.

---

## 10. Manual QA

**NOT EXECUTED — PROJECT-OWNER OWNED.**

This implementation report does not claim browser/manual acceptance. Targeted
project-owner QA is still required for the revised parallel workflow, including:

- finalizing the Committee Report while at least one evaluation remains `DRAFT`;
- signing the report while the signer's own evaluation remains `DRAFT`;
- confirming the Chairman verdict stays unavailable until all evaluations, the Summary,
  and all report signatures are complete;
- confirming no ordinary faculty surface displays freeze/version/snapshot jargon.

Final end-to-end multi-user acceptance is not claimed by this package. CDW-9 remains
not started.
