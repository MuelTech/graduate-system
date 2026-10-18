# CDW-LIVE-1 MANUAL-QA FIX-5 — Committee Report Signing + Defense Records UX Report

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `f90633aec98a7b57d335dbf17e276f392125b112`
- **Status:** IMPLEMENTED — PENDING INDEPENDENT REVIEW
- **Date:** 2026-10-18
- **Migration:** NONE
- **Schema change:** NONE
- **Document-processing work:** NONE

---

## 1. Scope

FIX-5 is a bounded presentation/interaction alignment package. It does not change
evaluator authority, Committee Report signer authority, report authoring authority,
frozen report version/hash binding, signature persistence, Summary arithmetic,
Rating/Remarks policy, conclusion readiness, verdict authority, attempt history, or
the realtime event taxonomy.

---

## 2. Faculty Committee Report signing

### 2.1 Frozen-state presentation

`RapSignaturePanel` now presents a compact frozen-report status:

- `Committee Report` heading;
- `Awaiting signatures` or `Committee Report finalized`;
- `X of N required signatures completed`;
- frozen content version;
- for an unsigned required signer, `Your signature is required for this frozen report.`
  and a `Review & Sign` action;
- for an already-signed current user, only their own
  `You signed this report on <own timestamp>.` state;
- no signing control for a non-required viewer.

The complete cross-signer roster, other signer names/roles, and other signers'
exact timestamps are no longer rendered in the faculty workspace. The report body
remains the primary content.

### 2.2 Read-model posture

The backend Committee Report read model still returns `signatures`/`mySignature`
for authority and current-user derivation. FIX-5 intentionally hides the complete
signer roster only in the faculty presentation; it does not remove or reshape the
existing backend DTO. The Admin Defense Record detail remains the full signer-audit
surface.

### 2.3 Signing dialog

New focused component:

    frontend/src/components/defense-workspace/committee-report-signature-dialog.tsx

Step 1 — **Review Committee Report Signature**:

- confirms the exact frozen Committee Report/version currently displayed;
- states that signing does not edit the report;
- states that the signature cannot be undone through this flow;
- states that nothing is signed until final confirmation;
- actions: Cancel, Continue to Sign.

Step 2 — **Sign Committee Report**:

- uses the shared `ESignaturePad` with `allowTyped={false}`;
- uses neutral helper copy: `Signature ready.` /
  `Draw your signature before confirming.`;
- actions: Back, Confirm Signature.

Opening the dialog, Cancel, close, and Back make zero signature requests. Back
clears the drawn signature before returning to Step 1. Only Confirm Signature
invokes the existing endpoint:

    POST /thesis/defense/:scheduleId/collaboration/report/sign

### 2.4 Duplicate-submit protection

The dialog uses a stable `confirmingRef` guard, matching the accepted Evaluation
finalization pattern. A pending signature disables Back/Cancel/close and Confirmation.
The ref resets only after the mutation settles, so rapid double-clicks cannot issue
two signature requests.

### 2.5 Shared signature pad

`ESignaturePad` retains its default Type + Draw behavior and existing default
Evaluation copy. It now accepts optional `readyText` / `requiredText` overrides for
report-specific neutral copy. No global typed-signing capability was removed.

### 2.6 Invalidation / realtime

Successful signing still invalidates:

- `committeeReport`;
- `defenseWorkspace`;
- `conclusionReadiness`.

No realtime event was added. The canonical nine persisted events remain unchanged.

---

## 3. Admin Evaluation Results

Visible columns are now:

```text
Evaluator | Role | Evaluation Status | Signature Status | Signed At
```

- Evaluation Status uses the existing authoritative `FINALIZED` / `DRAFT` /
  `NOT_STARTED` state and display labels.
- Signature Status is `Signed` only when the existing safe
  `hasOfficialCriteria` evidence flag is true; otherwise `Not signed`.
- Signed At uses the existing authoritative `signedAt` value and the shared
  human-readable date formatter.
- `Overall` and `Criteria` were removed from this registry table only.
- No backend criteria, group values, `overallAverage`, official snapshot,
  recommendations, signatures, or timestamps were removed.

No raw signature image data is read or rendered by the Admin table.

---

## 4. Admin Oral Examination Summary

For `INSTITUTIONAL_MATRIX_V2`, the visible Summary remains:

```text
Examiner | Role | Group A | Group B | Average
```

Values remain formatted to exactly two decimals. FIX-4 arithmetic and snapshot
semantics were not changed.

The V2 presentation no longer renders the internal compatibility aggregate or the
deferred Final Rating/Not assigned fields. `OralExamSummary.overallAverage` and
nullable `finalRating` remain persisted/read-model data for compatibility. Legacy
records may still use the historical Overall Average / Final Rating presentation.

---

## 5. Admin Committee Report

Visible section title is now **Committee Report**. The Admin surface retains:

- truthful lifecycle badge (`Awaiting Signatures`, `Finalized`, etc.);
- aggregate `X of N required signatures completed`;
- full signer audit table:

```text
Signer | Role | Signature Status | Signed At
```

The stale empty state was replaced with:

```text
The Committee Report has not been prepared yet.
```

Visible `RAP / Committee Report`, `RAP finalized`, and after-formal-conclusion
creation wording are removed from the affected surfaces. Internal `RapReport`,
`RapSignature`, `rapReport`, and related model/service names remain unchanged.

---

## 6. Download / Print and document processing

All existing **Download / Print** controls remain disabled placeholders. FIX-5 did
not add `window.print()`, PDF generation, fake output, form rendering, signature
placement, logos, headers, geometry, or template versioning.

---

## 7. Backend / schema

- Production backend changes: **NONE**.
- Schema changes: **NONE**.
- Migration: **NONE**.

The Admin page uses existing authoritative read-model fields (`status`,
`hasOfficialCriteria`, `signedAt`, Summary rows, and Committee Report signatories).

---

## 8. Automated verification

Focused frontend FIX-5 verifier:

- `verify-cdw-live-1-manual-qa-fix-5.mjs` — 17 tests passed.

All frontend verifiers:

- 21 scripts / 422 tests passed.

Focused backend read-model/signature regressions:

- 3 files / 136 tests passed.

Static/build:

- `npx tsc --noEmit` — clean;
- scoped ESLint — 0 errors; one pre-existing `@next/next/no-img-element`
  warning in the shared signature preview;
- `npm run build` — pass;
- `git diff --check` — clean.

---

## 9. Manual QA

**NOT EXECUTED — ENVIRONMENT LIMITATION.**

No independent authenticated required-signer / non-required-viewer / Admin browser
contexts were available for the targeted FIX-5 walkthrough. The static verifiers
cover the faculty roster removal, own-signature states, modal step structure,
draw-only configuration, duplicate guard, Admin column changes, V2 Summary
presentation, Committee Report audit retention, terminology, and disabled document
actions. This is not claimed as browser/manual acceptance.

---

## 10. Hosted CI and gates

- Hosted CI: no GitHub Actions/hosted status was observed or claimed; results are
  local agent results.
- Final end-to-end multi-user live-defense acceptance: NOT STARTED.
- CDW-9: NOT STARTED.

---

## 11. Recommendation

**READY FOR INDEPENDENT REVIEW.**

FIX-5 is not marked accepted by this report. Targeted manual QA and the later
end-to-end multi-user acceptance remain separate gates.
