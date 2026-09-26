# Student Thesis Journey — Implementation Reference

**Date:** 2026-09-25  
**Historical implementation branch:** `refactor/student-thesis-journey`  
**Integration branch:** `refactor/defense-workflow`  
**Active correction branch:** `refactor/defense-workflow-corrections`  
**Status:** Documentation-only implementation guide

## 1. Purpose

This document is the short implementation entry point for a fresh coding-agent session.

Read these documents first, in order:

1. `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`
2. `docs/superpowers/specs/2026-09-26-defense-session-workflow-design.md`
3. `docs/superpowers/plans/2026-09-26-post-qa-defense-workflow-corrections.md`
4. `docs/superpowers/specs/2026-09-25-student-thesis-journey-design.md` — historical baseline; superseded where conflicting
5. `docs/superpowers/plans/2026-09-25-student-thesis-journey-refactor.md` — WP1–WP13 completed/history
6. this reference

The completed Student Thesis Journey work was integrated into `refactor/defense-workflow`. New correction work must be performed on `refactor/defense-workflow-corrections`.


## 1.1 Post-QA implementation status — 2026-09-26

WP1–WP13 are implemented and accepted at the pre-correction baseline `587afd3cf1d1e7c6b35ce5cbcf3ae9ca66a10c0b`. Manual QA then exposed integration/design gaps.

Do **not** continue with a hypothetical WP14 from the old plan. Use the 2026-09-26 correction packages (CP1 onward) on `refactor/defense-workflow-corrections`.

Canonical corrections include:

- Title completion = formal PASSED + selected title + finalized required Title RAP before Adviser Request;
- Proposal/Final manuscript goes through active Adviser review and e-signed Adviser Certification before Admin review;
- Proposal/Final evaluators use Group I/II, own-record e-sign/finalize lifecycle;
- Oral Summary shows computed grades but does not auto-PASS/FAIL;
- Chairman records formal result;
- Rapporteur owns defense summary/RAP workflow;
- finalized Proposal/Final individual evaluations become immutable printable Oral Examination Criteria records;
- the Oral Examination Summary is generated from finalized evaluator records rather than manually re-encoded;
- Admin gets a read-only Defense Records surface for finalized individual evaluations, the Summary, and finalized RAP outputs;
- role-aware Defense Workspace replaces the current lobby concept;
- Research Variables is not an active Proposal blocker in the correction pass;
- Proposal revisions are carried by RAP/history into Final Defense, without a separate revision upload gate;
- Student WAITING/status UX and schedule visibility require correction.

## 2. Migration baseline — VERIFIED

The historical fresh-replay ordering defect was repaired in the parent branch by:

`63ce47149a6c9fdc660f62be8a4e75ab4aca4378`  
`fix(prisma): repair fresh migration replay order`

The repaired parent baseline was then merged into this branch.

Verified on 2026-09-25 using a newly created MySQL `graduate_system` database:

- all existing migrations replayed successfully from the initial migration through `20260923160000_rap_signature_policy`;
- `npx prisma migrate dev` completed successfully;
- Prisma reported: database/schema in sync.

Therefore migration-chain repair is **not an implementation task for this feature anymore**.

Do not modify historical migrations again unless a new concrete defect is found.

Any new schema required by Student Thesis Journey must be introduced through a new feature migration on this branch.

## 3. Canonical Student flow

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

## 4. Student Thesis Journey navigation

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

## 5. Journey states

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

## 6. GS-020 Adviser Request

Candidate source:

- student's actual passed Title Defense ODP;
- working candidate mapping: Chairman + evaluator Panelists;
- Facilitator and Rapporteur excluded;
- **external panelists excluded from adviser candidacy** even if they served on the passed Title Defense panel;
- new adviser requests require an internal Panelist with `isAvailableAsAdviser = true`;
- unrestricted faculty directory is invalid for Student selection.

Backend unlock requires:

- formal Title Defense = PASSED;
- official selected title exists;
- required Title RAP is finalized/signed.

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

Confirmed client invariant:

- external panelists may serve on defense panels;
- external panelists cannot receive a new GS-020 adviser request;
- external panelists cannot become an active `AdviserAssignment`;
- Admin Panelist management must force/keep adviser availability off while `isExternal = true`;
- candidate listing/request creation and Dean assignment approval must enforce this on the backend;
- the Panelist Adviser Requests inbox may remain accessible regardless of current adviser availability so historical/already-addressed requests remain viewable.

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

## 8. Sidebar UI contract

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

## 9. Proposal and Final route behavior

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

## 10. STRIKE policy

STRIKE-before-Final remains an `OPEN_QUESTION / PROPOSED_SYSTEM_DESIGN`.

Use one centralized/configurable policy source for:

- journey state;
- Final application eligibility;
- Final scheduling eligibility.

Do not allow the UI to show Final locked while the backend independently permits Final submission.

Do not expose engineering uncertainty wording to Students.

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

## 12. Implementation strategy — one work package per agent session

Do **not** ask one coding-agent session to implement the whole feature.

The implementation plan is split into small work packages.

Rules for every agent session:

1. Read the SOT, design spec, implementation plan, and this reference.
2. Work on **one work package only**.
3. Do not begin the next package automatically.
4. Run only the validation required by that package.
5. Stop and provide a handoff report for review.
6. Continue only after the project owner starts/approves the next package.

Backend/domain work comes first. Frontend presentation comes only after its backend contract is stable.

## 13. Work-package order

```text
WP1  GS-020 schema / AdviserRequest model
↓
WP2  Student adviser-candidate + request backend
↓
WP3  Requested Adviser response backend
↓
WP4  Dean decision + AdviserAssignment backend
↓
WP5  Central Student Thesis Journey read model + STRIKE policy
↓
WP6  Backend-focused deterministic fixtures
↓
WP7  Student Journey hook + sidebar + /student/thesis redirect
↓
WP8  Student Adviser Request UI
↓
WP9  Panelist/Adviser Adviser Requests UI
↓
WP9.5 Internal-only adviser eligibility correction
↓
WP10 Admin/Dean Adviser Review UI
↓
WP11 Title + Proposal integration
↓
WP12 STRIKE + Final integration
↓
WP13 Academic Journey / legacy routes / final UI consistency
```

Automated browser E2E is intentionally **not part of this feature plan**. It will be handled separately after the Student Thesis Journey flow is implemented and stable.

## 14. Current validation scope

Use package-appropriate checks only.

Backend packages generally require:

- Prisma generate when schema changes;
- new feature migration validation when schema changes;
- backend TypeScript build;
- focused backend tests.

Frontend packages generally require:

- available frontend typecheck;
- lint;
- build;
- manual functional inspection for the changed page(s).

Seed/fixture packages require repeated seed execution to verify idempotency.

Do not turn every small work package into a full-repository browser-testing exercise.

## 15. Do not implement

Do not add:

- Adviser requirement before Title Defense;
- unrestricted faculty selection for Student adviser request;
- active AdviserAssignment before CONFORME + Dean approval;
- separate formal Proposal Corrections stage;
- Research/Data Gathering/Data Analysis sidebar modules;
- legacy in-system Expert Evaluation assignment/scoring workflow;
- unconditional Statistician/Instrument/STRIKE gates without SOT confirmation;
- another independent Student thesis progression model.

## 16. Historical implementation rule

Retired/experimental branch implementations are not authoritative sources for new work.

Use the current SOT, the 2026-09-26 correction design, and the active correction plan. If historical code and the current SOT/spec disagree, the current SOT/spec wins.
