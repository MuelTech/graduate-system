# CDW-LIVE-1 MANUAL-QA FIX-3 — Evaluator Signature + Verdict + Roster UX Design

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** MuelTech/graduate-system  
**Branch:** `refactor/collaborative-defense-workspace`  
**Design baseline HEAD:** `dc1745f11685ad1fd5649befa846f915aa546f35`  
**Parent functional authority:** `docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md`  
**Parent workflow authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Implementation plan:** `docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md`  
**FIX-2 implementation report:** `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-2-report.md`  
**Status:** IMPLEMENTED — PENDING INDEPENDENT REVIEW

**Date:** 2026-10-18  
**Expected migration:** NONE  
**Expected academic workflow change:** NONE

---

## 0. Why FIX-3 exists

FIX-2 correctly solved the evaluator rail overlap/crowding problem, removed redundant evaluator Save now, and moved evaluation finalization into a centered two-step dialog.

Independent source review passed. Manual product review then identified three remaining faculty-facing UX problems:

1. individual evaluation signing still offers Type/Draw even though the official form uses **Signature over Printed Name of Panelist**;
2. the Chairman Formal Verdict card exposes technical lifecycle terms rather than concise faculty-facing readiness;
3. Committee Roster is collapsible but lacks a visible expand/collapse affordance.

FIX-3 is a bounded refinement only. It must not reopen the accepted academic authority model.

---

## 1. Individual evaluation signature semantics

### 1.1 Official-form interpretation

For the individual Oral Examination Criteria form:

```text
drawn evaluator signature
        +
authoritative evaluator printed name
        =
Signature over Printed Name of Panelist
```

The evaluator supplies only the handwritten/drawn signature evidence.

The evaluator's printed name comes from the authenticated defense assignment / exact committee roster. The user must not manually re-enter their name merely to satisfy the printed-name portion of the form.

This avoids duplicate identity entry and prevents mismatches between typed text and the assigned evaluator identity.

### 1.2 Evaluation signing UX

Step 2 remains **Sign Your Evaluation**, but for the individual evaluation it is draw-only.

Target:

```text
Sign Your Evaluation

Draw your signature
[ large signature canvas ]

Your printed name will be supplied automatically
from your committee assignment.

[ Clear ]

[ Back ]                         [ Confirm Finalize ]
```

Requirements:

- no Type tab in the individual evaluation finalization dialog;
- no typed-name input;
- no manual printed-name field;
- retain Clear;
- retain a large touch/pointer-friendly draw surface;
- retain existing PNG data-URL signature evidence contract unless implementation audit proves a contract change is necessary;
- signature remains transient until explicit Confirm Finalize;
- Cancel/Back/close must not persist abandoned signature evidence;
- newest evaluation DRAFT still flushes before finalize;
- finalized evaluation remains immutable.

### 1.3 Shared signature component boundary

Do **not** globally remove Type capability from shared signature infrastructure merely because the individual evaluation is draw-only.

If `ESignaturePad` is shared with other signing flows, use a bounded configuration/prop or a focused evaluation-specific wrapper so other authorized document flows keep their own confirmed modes.

FIX-3 changes only the individual evaluator signing experience.

---

## 2. Printed evaluator identity source

Use one authoritative identity source.

Preferred relationship:

```text
authenticated user
  -> exact PanelAssignment for schedule
  -> roster/assignment display name
  -> printed evaluator name
```

Do not create a free-text printed-name field.

Do not trust client-supplied arbitrary evaluator names for official identity.

If the current finalization dialog does not have the display name, prefer passing it from the already-authorized Defense Workspace exact assignment/roster read model. A minimal read-model field may be added only if needed; do not create a second identity database source.

Official form rendering is still a later document-processing concern. FIX-3 only establishes the correct identity/signature semantics now.

---

## 3. Chairman Formal Verdict UX

### 3.1 Faculty-facing readiness

The Chairman should not see internal implementation terminology as separate checklist items.

Show exactly two primary readiness rows:

1. **Evaluation Signatures**
2. **Committee Report Signatures**

Examples:

```text
Formal Verdict

✓ Evaluation Signatures — 5 of 5 completed
○ Committee Report Signatures — 3 of 6 completed
```

When all authoritative conclusion requirements are satisfied:

```text
Formal Verdict

✓ Evaluation Signatures — 5 of 5 completed
✓ Committee Report Signatures — 6 of 6 completed

Formal Result
[ PASSED                         v ]

[ Record Formal Verdict ]
```

### 3.2 Pending report-signature slots

Do not display:

```text
Committee Report Signatures — 0 of 0 completed
```

before required report signature slots exist.

Show:

```text
Committee Report Signatures — Pending
```

until the report reaches the authoritative state where required signer slots/count are known.

Once slots exist, show completed/required counts.

### 3.3 Hide technical readiness terminology from faculty UI

Do not show these as separate Chairman-facing checklist rows:

- Oral Examination Summary ready;
- Committee Report frozen;
- RAP finalized.

Do not show a generic sentence such as **Unavailable until the Committee Report is finalized** when the concise readiness rows already explain what remains.

These are presentation removals only.

### 3.4 Backend conclusion gates remain unchanged

The server must still require every canonical conclusion prerequisite, including the internal states represented by:

- all required evaluations finalized;
- Oral Examination Summary exists;
- report frozen/ready as required by current backend lifecycle;
- all required Committee Report / RAP signatures signed;
- report/RAP finalized;
- correct session state and Chairman authority.

FIX-3 must not make frontend simplification weaken backend validation.

The Formal Result selector and **Record Formal Verdict** action appear only when the existing authoritative `readyForConclusion` gate is true.

Scores still never auto-decide PASSED or REDEFENSE_REQUIRED.

---

## 4. Mapping concise UI to authoritative state

The UI may summarize several internal checks.

```text
Evaluation Signatures
  <- finalizedEvaluations / evaluatorAssignments
  <- allEvaluationsFinalized
  <- Oral Summary remains an internal generated prerequisite

Committee Report Signatures
  <- requiredSignatures / signedSignatures
  <- report readiness/frozen lifecycle remains internal
  <- allSignaturesSigned
  <- reportFinalized remains internal
```

Do not falsely mark a row complete in a way that enables the verdict action early.

The action gate remains `readyForConclusion`, not the visual row count alone.

---

## 5. Committee Roster affordance

Committee Roster remains collapsible.

Current native `details/summary` semantics are acceptable and preferred.

Add a clear visual affordance:

```text
Committee Roster                         v
```

Open state:

```text
Committee Roster                         ^
------------------------------------------
[ roster content ]
```

Implementation guidance:

- add a chevron icon such as `ChevronDown`;
- rotate/change it on `group-open` / open state;
- keep the whole summary row clickable;
- preserve keyboard/native details behavior;
- use an accessible label/title if needed;
- do not add unnecessary custom accordion state.

---

## 6. FIX-2 behavior that must remain intact

Do not regress:

- autosave-only evaluator DRAFT behavior;
- no evaluator Save now;
- server-confirmed save states;
- centered two-step Review -> Sign dialog;
- no inline signature panel in role rail;
- natural-height evaluator card;
- RoleRail as the scrolling container;
- non-overlapping Chairman cards;
- flushAndWait before finalize;
- duplicate finalize protection;
- finalized evaluation lock;
- Chairman/Panelist shared evaluator flow;
- Formal Verdict as a separate later authority.

---

## 7. Authority and privacy invariants

Do not change:

- numerical evaluators: Chairman + assigned Panelists only;
- evaluator owns only their own private DRAFT;
- no live/private score broadcast;
- no signature autosave;
- evaluation signature is distinct from RAP signature;
- Adviser is not an evaluator under current policy;
- Facilitator is not an evaluator;
- Rapporteur is not an evaluator;
- Chairman alone records formal verdict;
- verdicts remain PASSED / REDEFENSE_REQUIRED;
- scores never auto-decide verdict;
- finalized evaluations and concluded attempts remain immutable.

---

## 8. Expected implementation scope

Expected frontend production areas:

- `frontend/src/components/defense-workspace/evaluation-finalization-dialog.tsx`;
- `frontend/src/components/defense-workspace/e-signature-pad.tsx` or a focused configuration/wrapper;
- `frontend/src/components/defense-workspace/oral-evaluation-form.tsx` only if data plumbing is needed;
- `frontend/src/components/defense-workspace/role-rail.tsx`;
- `frontend/src/components/defense-workspace/chairman-verdict-panel.tsx`;
- relevant verifier scripts/tests.

Potential contract/read-model inspection:

- `frontend/src/types/defense-workspace.ts`;
- `backend/src/services/defense-workspace.service.ts`.

A minimal authenticated display-name read-model change is allowed only if necessary to avoid unsafe client inference. No backend academic workflow change is expected.

Expected schema change: **NONE**.

Expected migration: **NONE**.

---

## 9. Explicit non-goals

Do not:

- start CDW-9;
- change evaluator counts/roles;
- change RAP signer policy;
- change conclusion rules;
- remove Oral Summary generation;
- remove report frozen/finalized lifecycle states;
- bypass `readyForConclusion`;
- add automatic verdict;
- redesign the whole Defense Workspace;
- add new academic workflow state;
- add signature autosave;
- add evaluation-draft realtime;
- globally remove Type signature mode from unrelated signing workflows without separate authority;
- add schema/migration;
- implement official PDF rendering in this package.

---

## 10. Automated acceptance requirements

At minimum verify:

1. individual evaluation signing exposes Draw/Clear only;
2. no Type tab or manual name input appears in the individual evaluation finalization flow;
3. printed evaluator name is system-derived from exact authorized assignment/roster data;
4. arbitrary client-entered printed name is not accepted as identity authority;
5. shared signature component retains other modes where unrelated flows still need them;
6. evaluation signature still produces valid signature evidence;
7. Cancel/Back/close clears abandoned signature state;
8. flushAndWait still precedes finalize;
9. Formal Verdict shows Evaluation Signatures progress;
10. Formal Verdict shows Committee Report Signatures progress;
11. `0 of 0` is not rendered for not-yet-created report signature slots;
12. pending report signature state is faculty-readable;
13. Oral Examination Summary ready is not shown as a separate checklist row;
14. Committee Report frozen is not shown as a separate checklist row;
15. RAP finalized is not shown as a separate checklist row;
16. backend/readiness contract still requires the existing internal gates;
17. verdict controls remain gated by server `readyForConclusion`;
18. Committee Roster has a visible chevron/open-state affordance;
19. native details/summary accessibility remains intact;
20. no schema/migration and no CDW-9 changes.

---

## 11. Manual QA

### Evaluator signature

1. open Panelist evaluation;
2. Review & Finalize;
3. Continue to Sign;
4. confirm there is no Type option and no name field;
5. draw signature by mouse/touch;
6. Clear and redraw;
7. Back then return to Sign and verify abandoned signature does not persist unexpectedly;
8. Confirm Finalize and verify locked evaluation;
9. repeat for Chairman own evaluation.

### Formal Verdict

1. while evaluations/signatures are incomplete, verify only the two concise rows appear;
2. verify no Oral Summary / frozen / RAP-finalized technical rows;
3. before report signature slots exist, verify **Committee Report Signatures — Pending** rather than 0 of 0;
4. once slots exist, verify correct completed/required count;
5. verify Formal Result controls remain unavailable until server `readyForConclusion` is true;
6. verify PASSED / Re-defense Required flow remains unchanged.

### Committee Roster

1. collapsed state visibly shows a chevron;
2. activate with mouse and keyboard;
3. chevron changes/rotates in open state;
4. collapse again;
5. no layout overlap/regression.

---

## 12. Gate relative to CDW-9

```text
CDW-LIVE-1 core ACCEPTED / CLOSED
  -> MANUAL-QA FIX-1 IMPLEMENTED
  -> MANUAL-QA FIX-2 IMPLEMENTED / SOURCE REVIEW PASS
  -> MANUAL-QA FIX-3 Signature + Verdict + Roster UX
  -> independent review
  -> manual Chairman + Panelist QA
  -> CDW-9
```

CDW-9 remains **NOT STARTED** until FIX-3 is implemented and manually accepted.

---

## 13. Definition of done

FIX-3 is complete only when:

- individual evaluation uses draw-only signing;
- evaluator name is not manually re-entered;
- printed evaluator name is bound to authoritative assignment identity;
- Formal Verdict exposes only concise Evaluation Signatures and Committee Report Signatures readiness;
- technical internal readiness labels are hidden from faculty UI without weakening backend gates;
- 0 of 0 is not shown for unavailable report signature slots;
- Committee Roster clearly indicates expand/collapse;
- FIX-2 layout/autosave/finalization protections remain intact;
- no authority, schema, migration, realtime privacy, or CDW-9 scope changes;
- independent review and manual QA pass.
