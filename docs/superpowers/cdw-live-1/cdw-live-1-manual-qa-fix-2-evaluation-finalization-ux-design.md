# CDW-LIVE-1 MANUAL-QA FIX-2 — Evaluation Finalization UX Design

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** MuelTech/graduate-system  
**Branch:** `refactor/collaborative-defense-workspace`  
**Design baseline HEAD:** `9e6d00c0b7253cc55c7812008b54f4bb99dda4d9`  
**Parent functional authority:** `docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md`  
**Implementation plan:** `docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md`  
**CDW-LIVE-1 design:** `docs/superpowers/cdw-live-1/cdw-live-1-live-report-and-draft-autosave-design.md`  
**Status:** CONFIRMED DESIGN — NOT IMPLEMENTED  
**Date:** 2026-10-18  
**Expected migration:** NONE  
**Expected backend workflow change:** NONE

---

## 0. Why this fix exists

Manual QA after CDW-LIVE-1 exposed an evaluator usability problem, especially for the
Chairman role.

The current left role rail can become visually crowded because it contains:

- the evaluator criteria;
- Recommendations;
- save/finalize actions;
- inline finalization/signature UI;
- Evaluation Completion;
- Chairman-only Formal Verdict;
- Committee Roster and other role-specific controls.

When signature/finalization UI expands inline, the narrow rail can overlap, compress, or
push other Chairman controls into a poor layout. The signature surface is also too
constrained for comfortable signing.

At the same time, evaluation DRAFT criteria/recommendations already autosave. A separate
manual **Save now** button therefore adds unnecessary choice and visual weight.

This package improves the evaluator experience without changing academic authority,
evaluation privacy, REST/database authority, or the existing finalize endpoint.

---

## 1. Product decisions

### 1.1 Remove evaluator Save now

While an evaluation is editable, criteria and Recommendations continue to autosave
privately through the existing serialized DRAFT pipeline.

The evaluator rail must not show a redundant **Save now** button.

Instead, show concise state:

- Saving...
- Saved
- Offline — changes not saved
- Save failed

No UI may show Saved before the server confirms persistence.

This decision applies to the **individual evaluator form**. It does not automatically
remove a Rapporteur Committee Report manual flush/save action.

### 1.2 Keep one primary evaluator action

The editable evaluator rail exposes one primary finalization action:

**Review & Finalize**

Clicking it does not finalize the record. It opens a centered modal/dialog.

### 1.3 Progressive disclosure

Use two modal steps:

```text
Edit evaluation
  -> autosave
  -> Review & Finalize
  -> Step 1: Review Evaluation
  -> Continue to Sign
  -> Step 2: E-Signature
  -> Confirm Finalize
  -> evaluation locked
```

The irreversible action is only **Confirm Finalize** in Step 2.

---

## 2. Step 1 — Review Evaluation

The first modal step helps the evaluator verify the academic content before signing.

Show:

- Group I criteria and selected ratings;
- Group II criteria and selected ratings;
- server/local derived group values that are already supported by the confirmed scoring model;
- Recommendations;
- evaluation status/context needed to understand what is being finalized.

Do not invent an Overall/Rating formula that is not institutionally confirmed.

Primary actions:

- **Cancel**
- **Continue to Sign**

Behavior:

- opening this step performs no finalize request;
- Cancel closes the dialog and returns to the editable evaluator rail;
- draft values remain governed by autosave;
- no signature evidence is captured or persisted in this step.

---

## 3. Step 2 — Sign Your Evaluation

The second modal step focuses only on the evaluator's explicit attestation.

Show:

- clear title such as **Sign Your Evaluation**;
- supported e-signature modes, including current Type and Draw options where available;
- a large centered signature input/canvas;
- a concise irreversible-action statement;
- enough space for comfortable pointer/touch signing.

Actions:

- **Back**
- **Confirm Finalize**

Back returns to Step 1 without finalizing.

Closing/cancelling the modal must not persist signature evidence and must not finalize the
evaluation.

---

## 4. Finalization transaction boundary

Before calling the existing finalize endpoint:

1. disable duplicate finalization submission;
2. drain/flush the newest pending evaluator autosave using the same serialized autosave
   pipeline already accepted in CDW-LIVE-1B;
3. if the draft flush fails, remain unfinalized and show the save/finalization error;
4. only after the newest DRAFT is server-confirmed may the explicit signed finalize
   request run;
5. on success, invalidate/refetch the authoritative evaluation/readiness state;
6. render the finalized evaluation as locked/read-only.

No signature autosave.

No automatic finalization.

No second competing draft-save path.

No socket academic-write path.

---

## 5. Chairman and Panelist consistency

Chairman and Panelist use the same interaction for their **own individual evaluation**:

```text
Review & Finalize
  -> Review Evaluation
  -> Continue to Sign
  -> E-Signature
  -> Confirm Finalize
```

This consistency reduces role-specific surprises and makes the signing behavior easier to
learn.

The Chairman's **Formal Verdict** is a separate authority and a later workflow action.
It must not appear inside the evaluation finalization modal and must not be automatically
triggered by evaluation finalization.

---

## 6. Chairman role-rail layout correction

The Chairman rail must remain usable even though the Chairman has more controls than a
normal Panelist.

Required layout behavior:

- role rail is the scrolling container;
- evaluation form/card has natural height;
- evaluator autosave status + Review & Finalize remain compact;
- no inline signature editor;
- Evaluation Completion is its own section/card;
- Formal Verdict is its own section/card;
- Committee Roster is its own section/card;
- sections stack vertically without overlap;
- no absolute-positioned finalization panel may cover a neighboring card;
- opening the centered modal must not resize the rail.

After evaluation finalization, replace editable evaluator actions with a compact locked
state, for example:

```text
Evaluation finalized
Signed <date/time>
```

Exact copy may follow the established EARIST UI language as long as meaning is clear.

---

## 7. Modal visual behavior

Desktop target:

- centered over the Defense Workspace;
- background remains visible but subdued;
- recommended width roughly 640–768 px or an equivalent responsive max width;
- max height around the viewport with internal scrolling;
- signature surface receives generous width;
- no horizontal overflow.

Narrow screens:

- modal may become a near-full-width sheet/dialog;
- review and signing remain sequential;
- actions remain reachable without horizontal scrolling.

Do not make workflow semantics depend on screen size.

---

## 8. Accessibility and interaction requirements

The dialog must:

- trap keyboard focus while open;
- return focus to Review & Finalize when closed where practical;
- have an accessible title and description;
- support keyboard navigation across controls;
- provide visible focus styles;
- expose validation/finalization errors accessibly;
- define Escape behavior consistently with Cancel while no irreversible request is in
  progress;
- prevent accidental duplicate Confirm Finalize submissions;
- avoid closing mid-request if that would create ambiguous user feedback.

Type/Draw controls and signature canvas/input must have accessible labels/instructions.

---

## 9. Authority and privacy invariants

This UI redesign must not change:

- evaluator authority: Chairman + assigned Panelists only;
- each evaluator sees/edits only their own private DRAFT according to existing backend
  authorization;
- no evaluator draft values broadcast to other evaluators;
- signature evidence remains private except where existing authorized final record behavior
  permits it;
- `evaluation.finalized` remains readiness/status synchronization, not score broadcast;
- finalized evaluations remain immutable;
- scores do not auto-decide the formal verdict;
- Chairman alone records PASSED or REDEFENSE_REQUIRED;
- RAP signing is separate from individual evaluation signing.

---

## 10. Expected implementation scope

Expected frontend production areas:

- `frontend/src/components/defense-workspace/oral-evaluation-form.tsx`;
- existing shared Dialog/Modal primitives;
- small focused supporting component(s) if needed for the two-step review/sign flow;
- relevant verification scripts/tests.

Potentially inspect, but do not redesign unless required:

- evaluation autosave controller;
- signature input/draw components already used by the current evaluator flow;
- Chairman role rail/workspace shell layout.

Expected backend production change:

**NONE**, unless implementation discovers a concrete incompatibility with the already
accepted finalize contract. If such an incompatibility appears, STOP and report before
changing backend academic behavior.

Expected database/schema change:

**NONE**.

Expected migration:

**NONE**.

---

## 11. Explicit non-goals

Do not add:

- CDW-9 hardening work;
- new academic workflow state;
- new scoring formula;
- new evaluation role;
- Rapporteur evaluation authority;
- Adviser evaluation authority;
- Facilitator evaluation authority;
- automatic verdict;
- signature autosave;
- evaluation draft Socket.IO events;
- live score broadcast;
- persistent local signature storage;
- CRDT/Yjs/OT;
- unrelated Defense Workspace redesign;
- Official Defense Forms/PDF rendering.

---

## 12. Automated acceptance requirements

At minimum verify:

1. evaluator rail contains no manual Save now action while autosave is active;
2. server-confirmed autosave state remains visible;
3. Review & Finalize opens the modal and does not finalize;
4. Step 1 renders review content and has Cancel / Continue to Sign;
5. Step 2 renders e-signature UI and has Back / Confirm Finalize;
6. signature UI is not rendered inline in the role rail;
7. Cancel from Step 1 leaves evaluation unfinalized;
8. Back from Step 2 leaves evaluation unfinalized;
9. closing the modal does not persist/finalize signature evidence;
10. newest pending draft is flushed before finalize;
11. autosave failure blocks finalize;
12. finalize request includes explicit signature and runs only after the user confirms;
13. successful finalize locks the evaluation;
14. duplicate confirm clicks cannot create duplicate finalization;
15. Chairman and Panelist use the same evaluation-finalization component/interaction;
16. Chairman Formal Verdict remains separate;
17. Chairman rail sections do not overlap after opening/closing the modal;
18. evaluator privacy tests remain green;
19. CDW-LIVE-1B autosave regressions remain green;
20. no new migration/schema change.

---

## 13. Manual QA matrix

Run separate Chairman and Panelist checks.

### Panelist

1. change several criteria;
2. verify Saving -> Saved without clicking Save now;
3. verify no Save now button exists;
4. click Review & Finalize;
5. verify centered review modal;
6. verify all current selections/Recommendations are correct;
7. Continue to Sign;
8. verify Type/Draw signature area is comfortably sized;
9. Back, then Continue to Sign again;
10. Cancel/close and prove evaluation is still editable/unfinalized;
11. reopen, sign, Confirm Finalize;
12. verify locked finalized state.

### Chairman

Repeat the evaluator flow, then verify:

- Evaluation Completion remains correctly laid out;
- Formal Verdict remains visible as a separate later action;
- Committee Roster remains correctly stacked;
- no card overlaps another;
- no inline signature panel reappears in the rail.

### Failure/offline

- create an unsaved evaluator change and force an autosave failure/offline condition;
- open finalization flow if allowed;
- Confirm Finalize must not bypass failed draft persistence;
- recover connectivity, save latest draft, then finalize successfully.

---

## 14. Gate relative to CDW-9

```text
CDW-LIVE-1 core ACCEPTED / CLOSED
  -> MANUAL-QA FIX-1 IMPLEMENTED
  -> MANUAL-QA FIX-2 Evaluation Finalization UX
  -> independent review
  -> manual Chairman + Panelist QA
  -> CDW-9
```

CDW-9 remains **NOT STARTED** until this bounded UX fix is implemented and accepted.

---

## 15. Definition of done

MANUAL-QA FIX-2 is complete only when:

- evaluator draft saving is autosave-first with no redundant Save now button;
- save status remains clear and server-confirmed;
- finalization no longer expands inline in the left rail;
- Review & Finalize opens a centered focused modal;
- review and signing are separate sequential steps;
- signature is collected only after review;
- Confirm Finalize remains the final irreversible action;
- newest pending draft is saved before finalization;
- autosave failure blocks finalization;
- successful finalization produces a locked evaluator state;
- Chairman and Panelist interactions are consistent;
- Chairman Formal Verdict remains separate;
- Chairman rail no longer overlaps/crowds due to inline signature UI;
- no backend authority, schema, migration, realtime privacy, or verdict rule changes;
- focused regression, full relevant verification, independent review, and manual QA pass.
