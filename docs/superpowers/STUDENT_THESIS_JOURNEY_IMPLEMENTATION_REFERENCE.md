# Student Thesis Journey — Implementation Reference

**Date:** 2026-09-25  
**Implementation branch:** `refactor/student-thesis-journey`  
**Parent branch:** `refactor/defense-workflow`  
**Status:** Documentation-only implementation guide  
**Playwright/E2E:** Deferred until backend/frontend contracts are stable

## 1. Purpose

This document is the short implementation entry point for a fresh coding-agent session.

Read these documents first, in order:

1. `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`
2. `docs/superpowers/specs/2026-09-25-student-thesis-journey-design.md`
3. `docs/superpowers/plans/2026-09-25-student-thesis-journey-refactor.md`
4. this reference

The branch is intentionally clean. It starts from `refactor/defense-workflow`. The experimental implementation on `refactor/student-thesis-journey-rebuild` is **not** an implementation base.

Do not copy its code, migrations, seeds, tests, or UI wholesale.

## 2. Canonical Student flow

```text
Comprehensive Examination PASSED
↓
Title Defense
↓
formal PASSED + official selected title
↓
Adviser Request
↓
Adviser CONFORME
↓
Dean approval
↓
active AdviserAssignment
↓
Proposal Defense
↓
formal PASSED
↓
research / manuscript completion
↓
STRIKE / Plagiarism, if required by centralized policy
↓
Final Defense
↓
post-defense corrections / final approved manuscript
↓
repository completion
```

There is no separate formal Proposal Corrections workflow state.

Research/Data Gathering/Data Analysis are academic activities, not sidebar modules.

Instrument Validation / Expert Evaluation remains external/manual in the current project scope.

## 3. Student Thesis Journey navigation

```text
Thesis Journey
├── Title Defense
├── Adviser Request
├── Proposal Defense
├── STRIKE / Plagiarism
└── Final Defense
```

The parent is toggle-only.

`/student/thesis` must redirect from the centralized backend journey state and must not maintain a second progression model.

## 4. Journey states

Use only:

- `COMPLETED`
- `CURRENT`
- `AVAILABLE`
- `WAITING`
- `LOCKED`

Backend/domain rules are authoritative.

Do not infer academic progression from `ThesisRecord.stage/status` alone.

Formal inputs include:

- Comprehensive Exam result;
- `DefenseConclusion`;
- official selected Title;
- Adviser Request state;
- active `AdviserAssignment`;
- Proposal formal outcome;
- centralized STRIKE policy/evidence;
- Final formal outcome.

Application approval, scheduling, score completion, formal conclusion, PASSED outcome, RAP completion, and stage completion are separate concepts.

## 5. Sidebar UI contract

Keep the text label on the **left** and the status icon on the **right**.

```text
Title Defense                         [check]
Adviser Request                       [circle-dot]
Proposal Defense                      [lock]
STRIKE / Plagiarism                   [lock]
Final Defense                         [lock]
```

Recommended icon semantics:

- COMPLETED → Check / CheckCircle
- CURRENT → CircleDot / filled dot + subtle row emphasis
- AVAILABLE → hollow circle / subtle arrow
- WAITING → Clock
- LOCKED → Lock

Do not show repeated CURRENT/WAITING/LOCKED text pills when the icon already conveys state.

Every icon needs accessible hover/focus/tap explanation.

For LOCKED, the tooltip/focus text includes the backend `lockReason`.

LOCKED items are genuinely non-navigable.

## 6. GS-020 Adviser Request

Candidate source:

- student's actual passed Title Defense ODP;
- working candidate mapping: Chairman + evaluator Panelists;
- Facilitator and Rapporteur excluded;
- unrestricted faculty directory is invalid for Student selection.

Backend unlock requires:

- formal Title Defense = PASSED;
- official selected title exists.

Flow:

```text
Student request
→ Adviser CONFORME / Decline
→ Dean Approve / Reject
→ active AdviserAssignment
```

A pending request is not an active assignment.

Decline/rejection permits another valid request.

Dean approval must not bypass Adviser CONFORME.

## 7. Three-actor GS-020 UI

### Student

Show eligible ODP candidates with:

- Name
- Title Defense role
- specialization when available
- office affiliation when available
- clear selected state
- confirmation summary before submission

Support:

- ready;
- waiting for Adviser;
- declined;
- Adviser CONFORMED / waiting for Dean;
- Dean rejected;
- approved / active adviser.

### Panelist / requested Adviser

Provide an Adviser Requests inbox scoped to the authenticated requested adviser only.

Show:

- Student identity/program;
- official selected title;
- Title Defense role;
- Student remarks;
- request date/status.

Actions:

- CONFORME / Accept
- Decline

After CONFORME, clearly show that Dean approval is still pending.

### Admin / Dean

Represent **Adviser Request Review**, not generic adviser assignment.

Show:

- Student;
- Program;
- official selected title;
- Student-selected adviser;
- adviser Title Defense role;
- Adviser CONFORME state/remarks;
- Student remarks;
- timestamps.

Actions:

- Approve
- Reject

Do not show an arbitrary adviser picker in the Dean approval flow.

## 8. Proposal and Final route behavior

A locked journey step may show a lock explanation, but it must not render a usable form or submit action.

Proposal requires an active AdviserAssignment.

Final must use the same centralized STRIKE policy as backend eligibility/scheduling.

Proposal/Final pages must still distinguish real application/session states such as:

- not submitted;
- pending review;
- approved / ready for scheduling;
- scheduled / active;
- concluded.

These are administrative/session states, not a second academic progression model.

## 9. STRIKE policy

STRIKE-before-Final remains an `OPEN_QUESTION / PROPOSED_SYSTEM_DESIGN`.

Use one centralized/configurable policy source for:

- journey state;
- Final application eligibility;
- Final scheduling eligibility.

Do not allow the UI to show Final locked while the backend independently permits Final submission.

Do not expose engineering uncertainty wording to Students.

## 10. Migration baseline warning

The parent branch currently contains the known fresh-replay ordering defect:

```text
20260922183328_align_defense_conclusion_relations
MODIFY rap_report_signatures.required

before

20260923160000_rap_signature_policy
ADD rap_report_signatures.required
```

Phase 0 must repair and validate the migration chain before feature schema work.

Use a fresh development/test database.

Required baseline after the repair:

- full migration replay from zero;
- `prisma migrate dev` succeeds on the clean database;
- seed succeeds;
- Prisma generate succeeds;
- backend build/tests succeed.

Do not use the old experimental database as the implementation baseline.

## 11. Deterministic fixtures

Create dedicated, idempotent fixtures for:

- Title ready;
- Title pending;
- Title PASSED + official title + no adviser request;
- Adviser pending;
- Adviser CONFORMED waiting Dean;
- Adviser approved;
- Proposal ready;
- Proposal PASSED;
- STRIKE ready;
- STRIKE eligible/completed;
- Final ready;
- Final PASSED.

Do not rely on one overloaded legacy Student account.

## 12. Implementation order

```text
Phase 0 migration-chain repair
↓
Backend/domain authority
↓
GS-020 schema + services
↓
Central Student Thesis Journey read model
↓
Backend tests
↓
Deterministic fixtures
↓
Student frontend
↓
Panelist/Adviser frontend
↓
Admin/Dean frontend
↓
Proposal/Final application-state cleanup
↓
Sidebar icon/tooltip polish
↓
Build/type/lint/seed/manual verification
↓
Playwright later
```

## 13. Current validation scope

Required now:

- Prisma generate;
- backend TypeScript build;
- backend tests;
- available frontend typecheck/lint/build checks;
- deterministic seed verification;
- manual functional review at desktop and one narrow/mobile viewport.

Deferred:

- Playwright/E2E expansion and stabilization.

## 14. Do not implement

Do not add:

- Adviser requirement before Title Defense;
- unrestricted faculty selection for Student adviser request;
- active AdviserAssignment before CONFORME + Dean approval;
- separate formal Proposal Corrections stage;
- Research/Data Gathering/Data Analysis sidebar modules;
- legacy in-system Expert Evaluation assignment/scoring workflow;
- unconditional Statistician/Instrument/STRIKE gates without SOT confirmation;
- another independent Student thesis progression model.

## 15. Historical branch rule

`refactor/student-thesis-journey-rebuild` is historical/reference only.

Use the reviewed documentation lessons from that branch, but re-implement cleanly on this branch.

If old code and the current SOT/spec disagree, the SOT/spec wins.
