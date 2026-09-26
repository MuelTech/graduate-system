> **HISTORICAL PLAN NOTICE — 2026-09-26**  
> WP1–WP13 in this plan are complete and were integrated into `refactor/defense-workflow`. Do not restart them. Manual QA exposed workflow/UI corrections that are planned in `docs/superpowers/plans/2026-09-26-post-qa-defense-workflow-corrections.md`. New coding-agent work must use `refactor/defense-workflow-corrections` and start from that correction plan plus the 2026-09-26 Defense Session design spec.

# Student Thesis Journey Refactor — Implementation Plan

**Date:** 2026-09-25  
**Branch:** `refactor/student-thesis-journey`  
**Parent branch:** `refactor/defense-workflow`  
**Implementation owner:** Local coding agent  
**Execution rule:** One work package per agent session. Stop after the assigned package and report before continuing.

## Baseline

The feature branch starts from `refactor/defense-workflow`.

The migration replay defect in the parent branch has already been repaired by:

`63ce47149a6c9fdc660f62be8a4e75ab4aca4378` — `fix(prisma): repair fresh migration replay order`

Verified on 2026-09-25 against a newly created MySQL `graduate_system` database:

- all existing migrations replayed successfully through `20260923160000_rap_signature_policy`;
- `npx prisma migrate dev` completed successfully;
- Prisma reported the database/schema in sync.

Do not reopen the historical migration repair unless a new concrete defect is found.

The experimental branch `refactor/student-thesis-journey-rebuild` is historical/reference only. Do not copy its implementation code, schema changes, migrations, seeds, tests, or UI wholesale.

## Working method

Every agent session must:

1. read the SOT, design spec, implementation reference, and this plan;
2. verify it is on `refactor/student-thesis-journey`;
3. work on **one work package only**;
4. avoid unrelated cleanup/refactors;
5. run only the validations required by that package;
6. stop and produce a handoff report;
7. wait for review before continuing to another package.

Backend/domain contracts come first. Frontend presentation starts only after the corresponding backend contract is stable.

Automated browser E2E is **not part of this feature plan**. It will be handled separately after the Student Thesis Journey flow is implemented and stable.

---

## WP1 — GS-020 schema and AdviserRequest model

### Goal

Define a clean data model for:

```text
Student request
→ Adviser response
→ Dean decision
→ active AdviserAssignment
```

### Inspect first

Review:

- current `AdviserRequest`;
- `AdviserAssignment`;
- `DefenseSchedule`;
- `DefenseConclusion`;
- `ThesisTitle`;
- `PanelAssignment`;
- existing request/approval enums and relations.

### Required model capability

The GS-020 request must support, at minimum:

- Student;
- requested adviser;
- source passed Title Defense schedule;
- Student reason/remarks;
- request date;
- Adviser status;
- Adviser response timestamp/remarks;
- Dean status;
- Dean reviewer;
- Dean review timestamp/remarks;
- final request state / compatibility status as needed.

### Rules

- pending request must not require storing the Student as a fake approver;
- approver/reviewer fields are nullable until that actor acts;
- do not create AdviserAssignment in this package;
- do not implement frontend;
- create a **new feature migration** only if schema changes are required;
- do not modify the already-repaired historical migrations.

### Validation

Run:

- `npx prisma generate`;
- migration validation on the current fresh dev database if a new migration is created;
- backend TypeScript build;
- focused schema/service tests if affected.

### Stop condition

STOP after WP1. Report exact schema/migration changes and validation results.

---

## WP2 — Student adviser candidate and request backend

### Goal

Implement only the Student-side GS-020 backend entry points.

### Required behavior

Eligible adviser candidates come only from the Student's actual passed Title Defense ODP.

Backend request gate requires:

- formal Title Defense conclusion = `PASSED`;
- official selected title exists via the formal Title conclusion;
- candidate belongs to that passed Title Defense ODP.

Working candidate mapping:

- Chairman;
- evaluator Panelists.

Exclude:

- Facilitator;
- Rapporteur;
- **External panelists (`Panelist.isExternal = true`)**.

Additional adviser eligibility:

- candidate must be an internal Panelist;
- `Panelist.isAvailableAsAdviser = true` is required for a new request;
- external panelists may still serve on defense panels, but never as thesis/dissertation advisers.

Unrestricted faculty/adviser directory is invalid for Student selection.

### Conceptual endpoints

Equivalent behavior to:

```text
GET  /thesis/adviser/candidates
POST /thesis/adviser/request
```

Exact route naming may follow repository conventions.

### Request creation rules

- one valid active/pending request path at a time;
- no AdviserAssignment creation;
- no direct approval;
- rejected/declined historical requests must not permanently block a future valid request.

### Validation

Add focused backend tests for:

- Title not passed → rejected;
- no official selected title → rejected;
- candidate outside ODP → rejected;
- Facilitator/Rapporteur → rejected;
- valid Chairman/Panelist → request created;
- request creation does not create AdviserAssignment.

### Stop condition

STOP after WP2. Report endpoints, service rules, tests, and changed files.

---

## WP3 — Requested Adviser response backend

### Goal

Implement only the requested Adviser's inbox/read and response behavior.

### Required behavior

A Panelist/eligible requested Adviser may retrieve only requests addressed to them.

Do not expose the Admin-wide request collection to PANELIST.

Conceptual behavior:

```text
GET  /thesis/adviser/requests/mine
POST /thesis/adviser/requests/:id/adviser-response
```

### Response states

Allowed Adviser decisions:

- `CONFORMED`
- `DECLINED`

### Authorization

For response:

```text
request.requestedAdviserId === authenticated userId
```

unless Admin override is explicitly required by existing project policy.

### Inbox data

Return enough data for later UI:

- Student name;
- Student number;
- Program;
- official selected title;
- request remarks;
- Title Defense role of the requested adviser;
- request date;
- adviser status;
- Dean status;
- response remarks/timestamp where applicable.

### Rules

- CONFORME does not create AdviserAssignment;
- CONFORME keeps Dean review pending;
- Decline creates no assignment and permits later retry by Student.

### Validation

Focused tests for:

- own requests visible;
- another adviser's requests hidden;
- another adviser cannot respond;
- CONFORME state transition;
- Decline transition;
- no assignment after either Adviser response.

### Stop condition

STOP after WP3.

---

## WP4 — Dean decision and AdviserAssignment backend

### Goal

Implement the final GS-020 backend transition.

### Required behavior

Dean/Admin can review conformed requests and choose:

- Approve;
- Reject.

Approval transaction must re-check:

- request exists;
- `adviserStatus === CONFORMED`;
- `deanStatus === PENDING`;
- requested adviser is still an **internal Panelist** and is not external;
- no conflicting active AdviserAssignment exists.

Only then:

- mark Dean APPROVED;
- store reviewer/timestamp/remarks;
- create active AdviserAssignment transactionally.

Reject:

- marks Dean REJECTED;
- stores reviewer/timestamp/remarks;
- creates no assignment;
- allows Student to make another valid request later.

### Legacy compatibility

If an old `/adviser/assign` path remains, it must not bypass Adviser CONFORME → Dean approval.

### Validation

Focused tests for:

- Dean cannot approve before CONFORME;
- approved request creates exactly one active assignment;
- rejected request creates none;
- conflicting active assignment prevents duplicate creation;
- retry remains possible after rejection.

### Stop condition

STOP after WP4.

---

## WP5 — Central Student Thesis Journey read model and STRIKE policy

### Goal

Create the single backend-authoritative Student Thesis Journey read model.

### Journey states

Use:

- `COMPLETED`
- `CURRENT`
- `AVAILABLE`
- `WAITING`
- `LOCKED`

### Required progression inputs

At minimum:

- Comprehensive Exam result;
- formal Title `DefenseConclusion`;
- official selected title;
- AdviserRequest;
- active AdviserAssignment;
- formal Proposal conclusion;
- persisted plagiarism/STRIKE result;
- formal Final conclusion.

Do not derive academic progression from `ThesisRecord.stage/status` alone.

### Conceptual response

```ts
{
  steps: {
    title: { state, href, lockReason, nextAction },
    adviser: { state, href, lockReason, nextAction },
    proposal: { state, href, lockReason, nextAction },
    strike: { state, href, lockReason, nextAction },
    final: { state, href, lockReason, nextAction }
  },
  currentStep,
  selectedTitle,
  activeAdviser,
  adviserRequest,
  policy: {
    strikeBeforeFinalRequired
  }
}
```

### STRIKE policy

Create one centralized/configurable policy source used by:

- Student Journey state;
- Final application eligibility;
- Final scheduling eligibility.

Do not allow Journey to say Final is locked while backend submission/scheduling independently permits it.

STRIKE-before-Final remains `OPEN_QUESTION / PROPOSED_SYSTEM_DESIGN`; do not present it as confirmed institutional policy.

### Validation

Focused backend tests for major state transitions.

### Stop condition

STOP after WP5.

---

## WP6 — Deterministic backend fixtures

### Goal

Create idempotent scenario fixtures for later frontend/manual validation.

Required scenarios:

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

### Validation

- run seed;
- run seed again;
- prove idempotency;
- verify each fixture's required records and absent records;
- keep fixtures internally consistent with the central journey rules.

### Stop condition

STOP after WP6.

---

## WP7 — Student Journey hook, sidebar, and /student/thesis redirect

### Goal

Implement only the central Student Journey frontend plumbing/navigation.

### Required work

- one Student Thesis Journey hook/query;
- one shared React Query key;
- `/student/thesis` redirects from `currentStep`;
- Thesis Journey parent is toggle-only;
- five children only.

### Sidebar status UX

Text stays on the **left**. Status icon stays on the **right**.

```text
Title Defense                         [check]
Adviser Request                       [circle-dot]
Proposal Defense                      [lock]
STRIKE / Plagiarism                   [lock]
Final Defense                         [lock]
```

Mapping:

- COMPLETED → Check / CheckCircle;
- CURRENT → CircleDot / filled dot + subtle row emphasis;
- AVAILABLE → hollow circle / subtle arrow;
- WAITING → Clock;
- LOCKED → Lock.

Do not show noisy CURRENT/WAITING/LOCKED pills beside every item.

Every icon needs accessible hover/focus/tap explanation.

LOCKED:

- must be genuinely non-navigable;
- backend `lockReason` appears in tooltip/focus text.

### Scope limit

Do not redesign the individual thesis pages in WP7.

### Stop condition

STOP after WP7 and provide screenshots/manual notes if useful.

---

## WP8 — Student Adviser Request UI

### Goal

Implement the Student GS-020 UI only.

### Candidate presentation

Do not use a generic unrestricted faculty directory.

Show candidate metadata:

- Name;
- Title Defense role;
- specialization when available;
- office affiliation when available;
- visible selected state.

A searchable selector is acceptable only if the same metadata remains visible.

Before submission, show a selected-candidate confirmation summary plus optional Student remarks.

### Student-facing states

Support:

1. Ready to request
2. Waiting for Adviser response
3. Adviser declined
4. Adviser CONFORMED — waiting for Dean
5. Dean rejected
6. Approved / active adviser

Pending must never imply assignment.

Decline/rejection must support retry.

### Stop condition

STOP after WP8.

---

## WP9 — Panelist/Adviser Adviser Requests UI

### Goal

Implement the requested Adviser inbox and response UI.

### Required information

- Student;
- Student number;
- Program;
- official selected title;
- Student remarks;
- Title Defense role;
- request date/status.

### Actions

When response is pending:

- Decline
- CONFORME / Accept

After CONFORME, clearly show:

```text
Adviser response recorded
Waiting for Dean approval
```

Do not imply active assignment before Dean approval.

Add discoverable Adviser Requests navigation in the Panelist/Adviser portal.

### Stop condition

STOP after WP9.

---

## WP9.5 — Internal-only adviser eligibility correction

### Goal

Apply the confirmed client rule that **external panelists may participate in defenses but can never become thesis/dissertation advisers**.

### Required behavior

- backend candidate eligibility excludes `Panelist.isExternal = true`;
- request creation rejects an external requested adviser even if a client submits the ID manually;
- Admin Panelist management keeps external status and adviser availability consistent: external → effective `isAvailableAsAdviser = false`, and the adviser-availability control is disabled/not applicable while external;
- Dean approval defensively re-checks that the requested adviser is still internal before creating `AdviserAssignment`;
- do not hide the Panelist Adviser Requests inbox solely because the current Panelist is unavailable/external; historical/already-addressed records may still need to be viewed;
- add focused backend tests for external candidate exclusion, forged external request rejection, and Dean-assignment rejection.

### Scope

This is a narrow domain-correction package between WP9 and WP10. Do not start WP10 UI in this package.

### Stop condition

STOP after WP9.5.

---

## WP10 — Admin/Dean Adviser Review UI

### Goal

Replace old generic adviser-assignment semantics with GS-020 Dean review.

### Display

- Student;
- Student number;
- Program;
- official selected title;
- Student-selected adviser;
- Title Defense role;
- Student remarks;
- Adviser CONFORME state/remarks;
- timestamps.

### Actions

- Reject
- Approve Request

Both must be functional.

Do not show an unrestricted adviser picker in this approval step.

Do not retain dead Reject/Approve buttons.

### Stop condition

STOP after WP10.

---

## WP11 — Title and Proposal integration

### Title

- consume centralized journey state;
- completed Title remains viewable;
- show official selected title;
- CTA after PASSED + selected title = **Continue to Adviser Request**;
- user-facing upload label = **Title Defense Proposal Package**.

### Proposal

- consume `steps.proposal`;
- when LOCKED, show lock UX only;
- no usable form;
- no submit action;
- active AdviserAssignment required.

Proposal page must still represent real administrative/session state:

- not submitted;
- pending review;
- approved / ready for scheduling;
- scheduled/active;
- concluded.

Do not create another academic progression model.

### Stop condition

STOP after WP11.

---

## WP12 — STRIKE and Final integration

### STRIKE

- persisted data only;
- no fake similarity percentage/history/report links;
- no developer/internal policy wording;
- do not tell Student to perform an action that has no real mechanism.

Legacy `/student/plagiarism` should redirect/retire safely in favor of `/student/thesis/strike`.

### Final

- consume centralized journey state;
- LOCKED means no usable form/submit action;
- use centralized STRIKE policy;
- preserve real administrative/session application state;
- remove internal engineering/client-confirmation wording from Student-facing UI.

### Stop condition

STOP after WP12.

---

## WP13 — Academic Journey, legacy cleanup, and final UI consistency

### Academic Journey

Keep high-level only:

```text
Admissions / Enrollment
→ Coursework / Curriculum
→ Comprehensive Examination
→ Thesis / Dissertation Phase
→ Research Completion
→ Graduation / Completion
```

Do not duplicate detailed Thesis Journey state here.

### Legacy routes

Review:

- `/student/thesis`;
- `/student/plagiarism`;
- legacy Adviser assignment/request routes/pages.

No legacy page may maintain an independent progression model or bypass GS-020.

### UI consistency

- reuse existing EARIST UI primitives;
- keep spacing/typography/cards/alerts responsive;
- avoid raw enum/debug-style screens;
- remove internal implementation jargon;
- manually inspect desktop and one narrow/mobile viewport.

### Stop condition

STOP after WP13 and provide the final feature handoff report.

---

## Validation rules across packages

A successful compile does not prove correct workflow behavior.

Use focused validation:

### Backend packages

- Prisma generate when relevant;
- feature migration check when relevant;
- backend build;
- focused backend tests.

### Frontend packages

- available typecheck;
- lint;
- build;
- focused manual page verification.

### Fixture package

- seed twice;
- verify idempotency and expected state.

Do not run or add Playwright/browser E2E as part of this feature branch plan.

## Final feature handoff

Report:

- work packages completed;
- exact changed files;
- schema/migration changes;
- backend tests/results;
- frontend checks/results;
- deterministic fixture status;
- manual verification summary;
- remaining OPEN_QUESTION items;
- known unrelated/pre-existing issues;
- confirmation that automated browser E2E was intentionally excluded;
- confirmation that the branch was not merged unless explicitly approved.
