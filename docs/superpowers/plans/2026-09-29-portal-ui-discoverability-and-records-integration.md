# Portal UI Discoverability and Official Records Integration — Implementation Plan

**Date:** 2026-09-29  
**Branch:** `refactor/defense-workflow-corrections`  
**Accepted CP1–CP10 baseline before this plan:** `5de128505cfe356388c441ff3aa7c3ed0756eb11`  
**Status:** Post-CP10 UI integration plan  
**Execution rule:** Implement one UI-FIX package at a time. Commit, push, report, and STOP before starting the next package.

## 1. Purpose

CP1–CP10 established and regression-tested the corrected defense workflow, authority model, official records, RAP lifecycle, Adviser workflow, Student Journey, Panelist Defense Workspace, CP8 Proposal history, CP9 Panelist Dashboard, and deterministic fixtures.

This plan does **not** reopen those domain decisions.

The purpose of this plan is to correct portal discoverability and frontend wiring issues found after CP10 while reviewing the actual accepted Admin, Panelist, and Student UI.

The implementation principle is:

```text
accepted backend/domain authority
→ expose it consistently in each portal
→ remove stale frontend assumptions
→ preserve access/privacy boundaries
```

Do not redesign backend workflow merely to make a page easier to reach.

## 2. Read first

Before implementing any UI-FIX package, read in this order:

1. `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`
2. `docs/superpowers/specs/2026-09-26-defense-session-workflow-design.md`
3. `docs/superpowers/plans/2026-09-26-post-qa-defense-workflow-corrections.md`
4. `docs/superpowers/STUDENT_THESIS_JOURNEY_IMPLEMENTATION_REFERENCE.md`
5. this plan

If older UI code conflicts with the accepted CP1–CP10 behavior, the accepted workflow/domain authority wins.

## 3. Working method

For every UI-FIX package:

1. verify the branch is `refactor/defense-workflow-corrections`;
2. verify remote HEAD exactly matches the latest independently accepted SHA supplied in the package prompt;
3. verify the worktree is clean;
4. inspect the current implementation before editing;
5. keep the package narrowly scoped;
6. do not weaken backend authority to make UI behavior simpler;
7. run focused frontend validation;
8. commit and push only the bounded package;
9. report exact files/checks/manual status;
10. STOP for independent remote review.

Do not merge.

Do not start the next UI-FIX package in the same coding-agent run.

## 4. Accepted domain authority that must not change

Preserve all CP1–CP10 invariants, including:

```text
APPROVED != PASSED
Scheduled != completed
score completion != formal result
average != automatic academic result

Title Defense has no Proposal/Final numerical scoring

Evaluator owns only their own evaluation
Rapporteur owns the defense-notes workflow
Chairman owns the formal academic result

RAP FINALIZED is the sole canonical completed RAP state
ALL_SIGNED / DISTRIBUTED are legacy only

requested Adviser != active Adviser
CONFORME != Dean approval
Dean APPROVED -> active AdviserAssignment

current Proposal/Final manuscript
= exact issued AdviserCertification.reviewedDocumentId binding

Final CP8 Proposal-history access
!= unrestricted Proposal-document access

Research Variables remain nonblocking
STRIKE remains policy-driven, not universally mandatory

system-owned RAP / Adviser Certification
are not Student uploads
```

No UI package may invent:

- score-to-PASS/FAIL logic;
- average-to-rating formula;
- new RAP signatory policy;
- new Summary-signature policy;
- multiple-attempt/re-defense policy;
- post-Final correction-clearance authority;
- unconditional STRIKE;
- new Research Variables approval workflow;
- exact institutional paper-form facsimile where not confirmed.

---

# 5. Confirmed portal findings

These findings were observed in the accepted remote source at CP10 baseline `5de128505cfe356388c441ff3aa7c3ed0756eb11`.

## 5.1 Admin — Defense Records exists but is not discoverable from the sidebar

Existing route:

`/admin/thesis/defense-records`

Existing detail route:

`/admin/thesis/defense-records/{scheduleId}`

Existing individual Criteria print route:

`/admin/thesis/defense-records/{scheduleId}/criteria/{panelAssignmentId}`

The Admin sidebar currently lists under Thesis Management:

```text
Defense Applications
Scheduling & Panels
RAP Reports
Adviser Request Review
```

It does not expose Defense Records.

This is a navigation/discoverability defect, not a backend records defect.

### Expected information architecture

```text
Thesis Management
├─ Defense Applications
├─ Scheduling & Panels
├─ Defense Records
├─ RAP Reports
└─ Adviser Request Review
```

Defense Records is the read-only academic-record surface.

RAP Reports remains RAP signature/lifecycle tracking.

Do not merge the two responsibilities.

## 5.2 Admin — nested record routes do not naturally keep the parent navigation active

The current Admin child navigation uses exact pathname equality.

Nested routes such as:

```text
/admin/thesis/defense-records/{scheduleId}
/admin/thesis/defense-records/{scheduleId}/criteria/{panelAssignmentId}
/admin/thesis/defense-records/{scheduleId}/summary
```

should keep Defense Records visually active.

A route-match rule may use:

```text
pathname === href
OR
pathname starts with `${href}/`
```

Keep this change narrow.

## 5.3 Admin — Title Defense must not look like a missing numerical evaluation

Canonical rule:

```text
TITLE_DEFENSE
→ no Group I / Group II numerical evaluation
→ no numerical Oral Examination Summary
```

Therefore Title Defense should not be shown as if numerical Criteria/Summary are merely unfinished.

Expected presentation:

- Summary column: `N/A` / `Not applicable`;
- detail page: explicitly state numerical Oral Examination Criteria/Summary are not applicable;
- do not show "waiting for evaluator finalizations" for Title;
- do not fabricate zero scores;
- do not call the numerical Summary endpoint for Title.

The formal Title conclusion and RAP remain official records.

## 5.4 Admin — individual Criteria already has a dedicated print surface

Preserve the existing route:

`/admin/thesis/defense-records/{scheduleId}/criteria/{panelAssignmentId}`

This is the official per-evaluator Criteria print surface for authorized FINALIZED evaluator records with signature evidence.

It may contain:

- candidate/student;
- program;
- defense stage/date;
- evaluator + functional role;
- criterion values;
- Group I;
- Group II;
- Overall;
- explicit Rating if present;
- recommendations;
- evaluator signature;
- signed/finalized timestamps.

Do not infer academic result from evaluator values.

## 5.5 Admin — Oral Examination Summary needs its own dedicated print surface

Current Defense Record detail already renders Summary data, but its Summary print action uses `window.print()` from the whole Defense Record page.

Create a dedicated Proposal/Final Summary route:

`/admin/thesis/defense-records/{scheduleId}/summary`

Reuse the accepted existing authorized Summary read model/endpoint where possible.

Expected Summary content:

- candidate;
- student number;
- program;
- defense stage;
- defense date;
- evaluator rows;
- evaluator functional role;
- Group I;
- Group II;
- Overall;
- explicit evaluator Rating if present;
- Overall Defense Average;
- explicit Final Rating if present;
- separately recorded formal outcome where appropriate;
- generated timestamp.

Browser Print / Save as PDF is acceptable.

Do not invent:

- automatic outcome recommendation;
- grade-to-rating conversion;
- Chairman/Member/Adviser/Dean signature lines;
- exact EARIST paper-form facsimile.

Title Defense must not use this numerical Summary route.

---

# 6. Panelist findings

## 6.1 `DefenseSchedule.sessionStatus` is authoritative

The accepted Panelist assignment DTO exposes:

`schedule.sessionStatus`

The legacy alias:

`schedule.status`

is deprecated.

Known stale consumers remain in:

- My Defenses;
- Materials.

Frontend decisions must use `sessionStatus`.

Do not derive defense-session state from ThesisRecord application status.

## 6.2 My Defenses can hide the canonical Workspace action

The accepted canonical action is:

`/panelist/defense-workspace/{scheduleId}`

Current stale `schedule.status` checks can make a real `SCHEDULED` assignment appear non-upcoming and can hide the Workspace action.

Fix the display and action visibility from authoritative `sessionStatus`.

Do not classify every non-`SCHEDULED` session as Completed.

Preserve actual accepted session states such as:

```text
SCHEDULED
IN_PROGRESS
AWAITING_CONCLUSION
CONCLUDED
CANCELLED
```

Assigned non-cancelled sessions should not lose the canonical Workspace entry merely because the defense has moved beyond exactly `SCHEDULED`.

The Workspace itself remains role/state authoritative.

## 6.3 Do not restore retired/legacy defense flows

Keep:

`/panelist/defense-lobby/{scheduleId}`

as a redirect to Defense Workspace.

Keep the legacy scoring detail compatibility route as a redirect to Defense Workspace.

Do not restore:

- Defense Lobby as a separate workflow;
- direct legacy scoring mutation;
- client-supplied assignment authority.

## 6.4 Panelist navigation terminology is stale

The existing Adviser review page supports both Proposal and Final review tasks.

Change sidebar label:

`Proposal Reviews`

to:

`Adviser Reviews`

The existing `/panelist/scoring` index now functions as a Defense Workspace index rather than an independent scoring workflow.

Preferred sidebar label:

`Defense Workspaces`

The route may remain for compatibility.

Where practical, a nested `/panelist/defense-workspace/{scheduleId}` route should visually activate the Defense Workspaces navigation entry.

## 6.5 CP9 Dashboard is already the preferred actionable surface

Preserve the CP9 Dashboard architecture:

- summary metrics;
- evaluation task cards;
- RAP pending;
- Adviser Requests pending;
- adviser availability;
- recent activity;
- assignment role;
- canonical Open Defense Workspace action.

Do not redesign CP9 merely to fix older navigation surfaces.

---

# 7. Student findings

## 7.1 Preserve state-driven Thesis Journey navigation

Current navigation intentionally derives from the centralized Student Thesis Journey.

Keep the accepted behavior:

```text
COMPLETED → navigable
CURRENT   → navigable
AVAILABLE → navigable
WAITING   → navigable
LOCKED    → visible but disabled
```

Unknown/loading/error state must not unlock a step.

Do not add static shortcuts that bypass Journey authority.

## 7.2 Completed defense pages hide the existing Student RAP surface

Waiting/active defense presentation uses:

```text
DefenseStatusPanel
→ DefenseScheduleSummary
→ StudentRapPanel
```

The existing Title/Proposal/Final pages use an early COMPLETED return that replaces this context with a completion card.

Result:

```text
while waiting
→ Student can see schedule/RAP status context

after stage becomes COMPLETED
→ completion card replaces status panel
→ finalized RAP becomes harder to discover
```

For completed Title, Proposal, and Final pages:

- preserve the existing completion card;
- also show the completed defense schedule/session context;
- retain Student-safe RAP access for the exact completed session;
- reuse `DefenseScheduleSummary` / `StudentRapPanel` or equivalent existing safe components.

Do not expose:

- individual evaluator Criteria;
- private numerical score sheets;
- other evaluator private signature evidence;
- Rapporteur draft notes.

Do not create an Admin-style Student Defense Records page in this plan.

## 7.3 Student RAP UI has a stale legacy completion condition

Current Student UI must not treat `ALL_SIGNED` as finalized.

Canonical rule:

```text
FINALIZED = completed official RAP
ALL_SIGNED = legacy only
DISTRIBUTED = legacy only
```

Student official RAP content/action is finalized only when:

`rapStatus === "FINALIZED"`

Preserve backend privacy and Student ownership checks.

---

# 8. Implementation packages

## UI-FIX1 — Admin Defense Records discoverability

### Goal

Expose the accepted Admin Defense Records feature and correct Title-specific presentation without adding new record functionality.

### Implement only

1. Add `Defense Records` under Admin Thesis Management before RAP Reports.
2. Make nested Defense Records routes keep the Defense Records navigation entry active.
3. For Title Defense:
   - Summary = `N/A` / not applicable;
   - do not imply missing Group I/II evaluation;
   - do not present "waiting for numerical Summary";
   - do not call the numerical Summary route.

### Likely files

- `frontend/src/app/(portal)/admin/layout.tsx`
- `frontend/src/app/(portal)/admin/thesis/defense-records/page.tsx`
- `frontend/src/app/(portal)/admin/thesis/defense-records/[scheduleId]/page.tsx`

### Do not implement yet

- dedicated Summary page;
- Panelist changes;
- Student changes;
- backend/domain changes.

### STOP

Commit/push and STOP for independent review.

---

## UI-FIX2 — Admin official Summary print view

### Goal

Give Oral Examination Summary the same dedicated print/read experience already available to individual Criteria.

### Implement only

1. Create:
   `/admin/thesis/defense-records/{scheduleId}/summary`
2. Reuse existing authorized Summary endpoint/read model.
3. Render Proposal/Final authoritative Summary values only.
4. Add `Print / Save as PDF` browser-print action.
5. Hide controls in print CSS.
6. Replace the whole-record Summary `window.print()` action with:
   `View / Print Summary`
   → dedicated Summary route.

### Preserve

- existing individual Criteria route;
- existing top-level whole Defense Record print if still useful;
- no Title numerical Summary.

### Do not implement

- new Summary model;
- automatic result logic;
- unconfirmed signatures;
- exact EARIST facsimile.

### STOP

Commit/push and STOP for independent review.

---

## UI-FIX3 — Panelist canonical session/navigation wiring

### Goal

Align legacy Panelist portal surfaces with the accepted Defense Workspace and authoritative `sessionStatus`.

### Implement only

1. Replace UI decisions based on `schedule.status` with `schedule.sessionStatus` in My Defenses and Materials.
2. Present real session states instead of "non-SCHEDULED = Completed".
3. Keep canonical Workspace action discoverable for assigned non-cancelled sessions where the existing Workspace supports access.
4. Rename:
   - `Proposal Reviews` → `Adviser Reviews`;
   - `Scoring` → `Defense Workspaces`.
5. Keep legacy lobby/scoring detail routes as redirects only.
6. Preserve CP9 Dashboard actions and semantics.

### Do not change

- evaluator ownership;
- scoring lifecycle;
- Rapporteur authority;
- Chairman authority;
- backend assignment rules.

### STOP

Commit/push and STOP for independent review.

---

## UI-FIX4 — Student completed-defense records visibility

### Goal

Keep completed defense session/RAP context discoverable without bypassing Student Journey.

### Implement only

1. Completed Title view:
   - keep completion card;
   - show completed schedule/session;
   - retain Student-safe RAP panel.
2. Completed Proposal view: same.
3. Completed Final view: same.
4. In Student RAP UI:
   - `FINALIZED` only = finalized;
   - remove `ALL_SIGNED` as a completed condition.

### Do not expose

- Criteria;
- evaluator private scores;
- Rapporteur draft notes;
- other users' raw signatures.

### Do not modify

- Journey unlock rules;
- defense eligibility;
- Adviser workflow;
- backend RAP authority.

### STOP

Commit/push and STOP for independent review.

---

## UI-FIX5 — Portal integration regression

### Goal

Prove Admin, Panelist, and Student can reach the accepted CP1–CP10 behavior consistently.

No new feature work is expected.

### Admin checks

- Defense Records visible in sidebar;
- nested record routes active correctly;
- Title numerical records show N/A;
- Proposal/Final individual Criteria view/print;
- Proposal/Final dedicated Summary view/print;
- RAP Reports remains separate from Defense Records.

### Panelist checks

- CP9 Dashboard;
- My Defenses;
- Defense Workspaces;
- assigned Workspace;
- Materials;
- Adviser Reviews;
- RAP signatures;
- no legacy lobby/scoring mutation restored.

### Student checks

- locked/current/completed Journey navigation;
- completed Title schedule/RAP;
- completed Proposal schedule/RAP;
- completed Final schedule/RAP;
- legacy `ALL_SIGNED` not considered finalized;
- no evaluator Criteria exposure.

### Manual QA status

Use only:

```text
PASS
FAIL
PARTIAL
NOT EXECUTABLE
```

Do not relabel automated checks as manual PASS.

### STOP

Commit only if a concrete bounded regression fix is required. Otherwise report validation evidence and STOP.

---

# 9. Validation expectations per package

For frontend-changing UI-FIX packages, run and report exact commands for:

- TypeScript no-emit check;
- ESLint on every changed/new frontend file, or full lint where feasible;
- `next build`.

The known unrelated `/login` `useSearchParams` Suspense prerender failure must be reported accurately if it remains after successful compile/type checking.

Do not modify `/login` unless a package itself caused a new failure there.

If browser/login environment is available, manually verify the package's role-specific UI.

If it is unavailable, report `NOT EXECUTABLE`.

No schema migration is expected for this plan.

---

# 10. Handoff report template

For each package report:

## Git

- commit SHA;
- parent SHA;
- commit message;
- branch;
- exact changed files;
- push status;
- clean/dirty worktree.

## Package behavior

State each required acceptance criterion and the implementation used to satisfy it.

## Validation

Report exact results for:

- typecheck;
- lint;
- build;
- focused tests if any;
- manual QA.

## Scope confirmation

Confirm:

- no schema/migration;
- no backend authority broadening unless a concrete blocker was separately reported;
- no automatic academic result;
- no new institutional policy;
- no next UI-FIX package started.

**STOP after the assigned UI-FIX package and wait for independent remote review.**
