# CDW-LIVE-1 MANUAL-QA FIX-5 — Committee Report Signing + Defense Records UX Alignment

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** MuelTech/graduate-system  
**Branch:** `refactor/collaborative-defense-workspace`  
**Design baseline HEAD:** `3b24c496cd8700aaa0fc287eb55e61eeb12dfaac`  
**Parent workflow authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Collaborative workspace authority:** `docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md`  
**Implementation plan:** `docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md`  
**UI/UX reference:** `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`  
**Status:** IMPLEMENTED / INDEPENDENT SOURCE REVIEW PASS / PROJECT-OWNER TARGETED MANUAL QA PASS — BOUNDED UX ACCEPTED

**Implementation HEAD:** `13a4c38acbc72dc13902539da398127f674384e5`  
**Implementation report:** `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-5-report.md`
**Date:** 2026-10-18  
**Expected schema change:** NONE  
**Expected migration:** NONE  
**Expected document-processing work:** NONE  
**CDW-9:** NOT STARTED

---

## 0. Why FIX-5 exists

Project-owner manual inspection after FIX-4 confirmed that the institutional Oral Examination Summary is being generated and displayed in Admin, but also exposed a set of connected presentation problems that should be resolved before the final multi-user live-defense acceptance.

These are not new academic rules.

They are one bounded UX-alignment package covering:

1. stale Committee Report e-signing interaction in the faculty workspace;
2. excessive cross-signer roster/timestamp detail in the faculty signing surface;
3. Admin Evaluation Results columns that no longer fit institutional V2;
4. Admin Oral Examination Summary fields that FIX-4 explicitly classified as internal/deferred;
5. unexplained/stale user-facing `RAP` terminology and lifecycle copy.

The package must preserve all existing backend authority and data integrity.

---

## 1. Current problems observed

### 1.1 Faculty Committee Report signing is visually stale

Current frozen-report UI renders a large inline block containing:

- every required signer name;
- role;
- Signed/Pending state;
- exact timestamp for signed users;
- aggregate signature count;
- inline e-signature pad for the current signer.

This turns the faculty workspace into an audit registry and pushes the actual Committee Report body down the page.

It is also inconsistent with the accepted individual-evaluation signing pattern.

### 1.2 Committee Report signing still uses the shared default signature mode

The shared `ESignaturePad` supports Type + Draw for legacy/other flows.

Individual evaluation finalization has already established the preferred official evaluator behavior:

```tsx
allowTyped={false}
```

Committee Report signing should follow the same draw-only direction.

### 1.3 Admin Evaluation Results contains low-value columns

Current table:

```text
Evaluator | Role | Status | Overall | Criteria
```

For institutional V2, `overallAverage` is intentionally null on the individual evaluation record, so the visible Overall column becomes a row of em dashes.

`Criteria = Available` is also redundant in this registry because exact official Individual Evaluation document rendering is not implemented yet.

### 1.4 Admin Oral Examination Summary exposes internal/deferred fields

Current V2 Summary shows:

```text
Internal Average
Final Rating — Not assigned
```

FIX-4 explicitly established that:

- the persisted `overallAverage` is an internal compatibility/read-model aggregate;
- the supplied institutional Summary Sheet does not establish that aggregate as an extra visible field;
- Rating/Remarks are deferred and must remain null rather than fabricated.

Therefore those two meta fields should not be presented as part of the current institutional V2 Summary UI.

### 1.5 User-facing RAP wording is unclear/stale

The codebase historically uses internal names such as `RapReport` and `RapSignature`.

However, no authoritative project document establishes an official user-facing expansion of `RAP` that faculty/Admin users should be expected to understand.

Current visible labels such as:

- `RAP / Committee Report`;
- `RAP finalized`;
- `the RAP is created after the formal conclusion`;

should be replaced with plain Committee Report language.

The last statement is functionally stale because the canonical report/signature lifecycle completes before formal conclusion.

---

## 2. Faculty-facing Committee Report target

The report body remains the dominant surface.

After freeze, show a compact signature-status area rather than a full signer audit list.

### Unsigned required signer

```text
Committee Report
[Awaiting signatures]

4 of 6 required signatures completed

Your signature is required for this frozen report.
[Review & Sign]

<read-only frozen report body>
```

### Signed required signer

```text
Committee Report

5 of 6 required signatures completed

✓ You signed this report on <own timestamp>.

<read-only frozen report body>
```

### Non-required committee viewer

```text
Committee Report

4 of 6 required signatures completed

<read-only frozen report body>
```

No signing control is shown.

### Finalized

```text
Committee Report
[Finalized]

6 of 6 required signatures completed

✓ You signed this report on <own timestamp>.   // only when applicable

<read-only frozen report body>
```

Do not show `RAP finalized` to faculty users.

---

## 3. Faculty signer visibility boundary

Ordinary live-workspace committee viewers do not need the complete signer audit roster.

Do not render in the faculty Committee Report signing panel:

- every signer name;
- every signer role;
- every other person's exact signed timestamp;
- raw signature evidence.

Aggregate required-signature progress is allowed.

The current authenticated user's own signature status/timestamp is allowed.

This is a presentation minimization rule. It does not redefine endpoint authorization or signer authority.

Admin Defense Records remains the operational surface for the complete signer roster.

---

## 4. Committee Report signing modal

Replace the inline signature canvas with a centered modal aligned to the accepted Evaluation finalization interaction.

### Step 1 — Review & Sign

Dialog title:

**Review Committee Report Signature**

Content should communicate:

- this signature applies to the exact frozen Committee Report/version currently displayed;
- signing confirms the user reviewed that frozen report;
- report content cannot be edited by signing from this dialog;
- signing cannot be undone through this flow;
- Cancel/close does nothing.

The full report does not need to be duplicated into a second giant scrolling document inside the modal if it remains visible/readable behind the modal and the frozen version/hash is already authoritative. A concise version/title confirmation is sufficient.

Primary action:

**Continue to Sign**

### Step 2 — Draw Signature

Dialog title:

**Sign Committee Report**

Use:

```tsx
<ESignaturePad
  ...
  allowTyped={false}
/>
```

Actions:

- Back;
- Confirm Signature.

Only Confirm Signature may invoke the existing Committee Report signature endpoint.

Closing, Cancel, Back, or opening the modal must not sign.

The submit action must remain protected against accidental duplicate clicks while pending.

---

## 5. Backend/signature rules that must not change

FIX-5 does not change the canonical required signer policy.

Title Defense:

- Chairman;
- Panelists;
- Rapporteur.

Proposal/Final:

- active Adviser;
- Chairman;
- Panelists;
- Rapporteur.

Facilitator remains excluded under the current policy.

Do not change:

- report frozen snapshot/version/hash binding;
- signer slot creation;
- required-slot logic;
- signature persistence;
- signature timestamps;
- report FINALIZED transition;
- conclusion readiness;
- Chairman-only formal verdict;
- realtime event taxonomy.

No new backend domain event is needed.

---

## 6. Admin Evaluation Results target

Replace the current registry columns:

```text
Evaluator | Role | Status | Overall | Criteria
```

with:

```text
Evaluator | Role | Evaluation Status | Signature Status | Signed At
```

### Evaluation Status

Use authoritative evaluation state:

- Finalized;
- Draft;
- Not Started.

### Signature Status

For a finalized evaluator with signature evidence:

- Signed.

For a DRAFT / NOT_STARTED evaluator:

- Not signed / Awaiting signature using one concise existing project label.

Do not invent a signature when no signature exists.

### Signed At

Show the authoritative evaluation `signedAt` timestamp when present.

Use the same human-readable timestamp convention as the Committee Report Admin table where practical.

### Removed presentation columns

Remove from this Admin registry table:

- Overall;
- Criteria.

This does not remove backend `overallAverage`, criteria fields, official snapshots, signatures, or future document rendering capability.

---

## 7. Admin Oral Examination Summary target

For `INSTITUTIONAL_MATRIX_V2`, the visible Summary is:

```text
Examiner | Role | Group A | Group B | Average
```

All values remain exactly two decimals.

Do not render above the V2 table:

- Internal Average;
- Final Rating / Not assigned.

The existing persisted `OralExamSummary.overallAverage` remains available for compatibility/read-model use.

The existing nullable `finalRating` remains unchanged.

No data deletion or schema change is required.

Legacy summary presentation may preserve historical fields when needed for old records; do not reinterpret legacy data as V2.

---

## 8. Admin Committee Report target

User-facing section title:

**Committee Report**

Keep:

- lifecycle badge such as Finalized / Awaiting signatures;
- aggregate `X of N required signatures completed`;
- full signer table:

```text
Signer | Role | Signature Status | Signed At
```

Admin is the appropriate operational/audit surface for this cross-signer visibility.

Use **Committee Report finalized** as visible product language where a completed label needs prose.

Internal enum/model names remain unchanged.

---

## 9. Stale empty-state/lifecycle copy

Do not display:

```text
Not generated yet — the RAP is created after the formal conclusion.
```

The canonical lifecycle is pre-conclusion.

Use state-appropriate plain language such as:

```text
The Committee Report has not been prepared yet.
```

or:

```text
Waiting for the Rapporteur to prepare the Committee Report.
```

Choose one concise wording consistent with the actual read model.

Do not imply that Admin creates the report.

---

## 10. User-facing terminology

Prefer in UI:

- Committee Report;
- Committee Report Signatures;
- Committee Report finalized;
- Review & Sign;
- Sign Committee Report.

Avoid unexplained visible:

- RAP;
- RAP Report;
- RAP finalized;
- RAP / Committee Report.

This is a UI terminology rule only.

Do not rename database tables, Prisma models, service class names, routes, event types, test fixture internals, or migration history merely to remove `rap` from code.

---

## 11. Download / Print and document processing

FIX-5 does not implement official forms.

All existing section-owned Download / Print controls remain disabled placeholders.

Do not add:

- PDF generation;
- `window.print()`;
- official Summary form renderer;
- Individual Evaluation form renderer;
- Committee Report institutional form renderer;
- signature-image placement in documents;
- logos/headers/form codes;
- page geometry;
- template versioning.

---

## 12. Data/read-model posture

The current Admin read model already exposes enough evaluation signature metadata:

- evaluation status;
- `signedAt`;
- presence of signature evidence.

Prefer frontend-only column alignment unless a small read-model field is truly missing.

Do not return raw signature image data merely to show `Signed`.

The faculty Committee Report read model may continue to contain signer rows if the backend needs them for authorization/current-user derivation, but the faculty UI must not render the complete roster after FIX-5.

If a safer minimal backend projection can remove unnecessary cross-signer data from the faculty response without destabilizing the workflow, report that as an optional security/privacy improvement before implementing it. Do not expand scope automatically.

---

## 13. Realtime behavior

No tenth event.

Current report signature events continue to invalidate/refetch authoritative state.

Faculty UI may update:

- aggregate signature progress;
- current user's own signature state;
- finalized state.

Do not broadcast:

- raw signatures;
- other signers' signature images;
- private evaluator drafts/scores.

---

## 14. Likely implementation surfaces

Faculty:

- `frontend/src/components/defense-workspace/rap-signature-panel.tsx`;
- `frontend/src/components/defense-workspace/committee-report-panel.tsx`;
- shared `evaluation-finalization-dialog.tsx` as interaction reference only;
- shared `e-signature-pad.tsx` without globally removing typed mode.

Admin:

- `frontend/src/app/(portal)/admin/thesis/defense-records/[scheduleId]/page.tsx`;
- `backend/src/services/official-defense-record.service.ts` only if a minimal missing read-model field requires it.

Tests/verifiers:

- existing RAP/Committee Report signing tests;
- Defense Records UI verifiers/tests;
- new focused FIX-5 verifier as appropriate.

Expected schema/migration: NONE.

---

## 15. Automated acceptance

At minimum verify:

1. frozen faculty report no longer renders the full signer-name/timestamp roster;
2. aggregate required-signature count remains visible where appropriate;
3. unsigned required signer sees Review & Sign;
4. non-required viewer sees no sign action;
5. already-signed current user sees only their own signed state/timestamp;
6. finalized faculty status says Committee Report finalized / Finalized, not RAP finalized;
7. signing opens a centered modal;
8. modal has review step then sign step;
9. Committee Report signature is draw-only;
10. Type control is absent in this flow;
11. Cancel/Back/open does not call sign endpoint;
12. Confirm Signature calls the existing endpoint exactly once;
13. pending submission prevents duplicate confirm;
14. Admin Evaluation Results columns are Evaluator, Role, Evaluation Status, Signature Status, Signed At;
15. Admin Evaluation Results no longer shows Overall or Criteria columns;
16. Admin V2 Summary table still shows Examiner, Role, Group A, Group B, Average;
17. V2 Summary does not show Internal Average;
18. V2 Summary does not show Final Rating / Not assigned;
19. Admin Committee Report keeps full Signer, Role, Signature Status, Signed At table;
20. Admin section label is Committee Report;
21. stale after-formal-conclusion wording is removed;
22. Download / Print remains disabled;
23. no schema/migration;
24. no signer-policy change;
25. no Summary computation change;
26. no verdict-gate change;
27. no PDF/document processing;
28. no CDW-9 work.

---

## 16. Targeted manual QA after implementation

### Faculty signing

Using at least one required signer account:

1. open frozen Committee Report;
2. verify report body remains the dominant content;
3. verify other signer names/timestamps are not displayed as a roster;
4. verify aggregate progress is understandable;
5. click Review & Sign;
6. verify centered dialog;
7. continue to signature step;
8. verify Draw-only pad;
9. sign and confirm;
10. verify own signed state/timestamp appears;
11. verify progress updates.

Using a different required signer:

12. verify that account can sign independently;
13. verify it does not see the first signer's detailed timestamp roster.

Using a non-required committee account where applicable:

14. verify read-only report access;
15. verify no sign action.

### Admin Defense Records

16. Evaluation Results shows signature status + Signed At instead of Overall/Criteria;
17. V2 Oral Examination Summary shows only examiner rows plus Group A/B/Average;
18. no Internal Average / Final Rating meta fields for V2;
19. Committee Report Admin section shows all required signers and timestamps;
20. section terminology uses Committee Report;
21. stale post-conclusion creation copy is gone;
22. Download / Print remains disabled.

Manual QA of FIX-5 is not the same as the later complete multi-user lifecycle acceptance.

---

## 17. Explicit non-goals

Do not change:

- academic evaluator roles;
- Committee Report signer roles;
- Adviser policy;
- Facilitator policy;
- report authoring ownership;
- report freeze semantics;
- Summary arithmetic;
- Rating/Remarks;
- Formal Verdict choices;
- conclusion readiness;
- historical attempt immutability;
- schema;
- migrations;
- document generation;
- CDW-9.

---

## 18. Gate

```text
FIX-4 ORAL SUMMARY
  [IMPLEMENTED / SOURCE REVIEW PASS]
      ->
FIX-5 COMMITTEE REPORT SIGNING + DEFENSE RECORDS UX
  [IMPLEMENTED / SOURCE REVIEW PASS]
      ->
FIX-5 targeted project-owner manual QA
  [PASS]
      ->
FIX-5 bounded UX acceptance
  [ACCEPTED]
      ->
FINAL END-TO-END MULTI-USER LIVE-DEFENSE ACCEPTANCE
  [READY / NEXT GATE]
      ->
CDW-9
  [NOT STARTED]
```

The coding agent did not perform authenticated browser QA; that remains recorded in the implementation report. The later project-owner targeted QA is the manual evidence for this bounded acceptance.

FIX-5 acceptance does not replace the final complete role-separated multi-user lifecycle acceptance. CDW-9 remains blocked until that final gate is completed or the project owner explicitly changes the sequence.
