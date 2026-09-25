# Student Thesis Journey Refactor — Implementation Plan

**Date:** 2026-09-25  
**Branch:** `refactor/student-thesis-journey`  
**Parent branch:** `refactor/defense-workflow`  
**Implementation owner:** Local coding agent  
**Rule:** Start implementation from this clean branch based on `refactor/defense-workflow`. Do not copy implementation code, schema changes, migrations, seeds, or tests from `refactor/student-thesis-journey-rebuild`; use its reviewed documentation only as reference.

## Phase 0 — Migration-chain cleanup

Before feature work, investigate the Prisma migration chain.

Known failure:

```text
20260922183328_align_defense_conclusion_relations
tries to MODIFY rap_report_signatures.required

before

20260923160000_rap_signature_policy
creates rap_report_signatures.required
```

Agent requirements:

1. Inspect all migrations touching `rap_report_signatures`.
2. Identify the smallest historically correct fix.
3. Do not reset the current working database.
4. Do not run `prisma migrate resolve` unless evidence shows a migration-metadata problem.
5. Do not push a migration-history change before validating it.
6. Use a fresh temporary MySQL database.
7. Replay the full migration chain from zero.
8. Verify `prisma migrate dev` succeeds on the clean database.
9. Run seed.
10. Run `prisma generate`, backend build, and backend tests.
11. Report the exact migration change and validation results before destructive actions on the current dev DB.

Acceptance:
- a clean database can be built from migration history;
- no permanent workaround depends on `migrate deploy` alone.

## Phase 1 — Inspect current domain and seed architecture

Inspect:
- `ThesisRecord`
- `DefenseSchedule`
- `DefenseConclusion`
- `ThesisTitle`
- `PanelAssignment`
- `AdviserRequest`
- `AdviserAssignment`
- `PlagiarismResult`
- RAP/certification records
- current seed scenarios

Map the authoritative record for every Student Journey transition.

Identify legacy pages/services that infer progression from `ThesisRecord.status` alone.

## Phase 2 — Deterministic Student Journey fixtures

Create idempotent scenario data for:

- Title eligible, not submitted;
- Title application pending;
- Title formally PASSED + selected title + no adviser request;
- Adviser request waiting for adviser;
- Adviser CONFORME waiting for Dean;
- Adviser approved / active AdviserAssignment;
- Proposal ready;
- Proposal formally PASSED;
- STRIKE ready;
- STRIKE completed/eligible;
- Final ready;
- Final formally PASSED.

Prefer dedicated scenario accounts instead of overloading `student@earist.edu.ph`.

For each fixture, define:
- records that must exist;
- records that must be absent;
- expected journey state;
- expected accessible/locked routes.

Run seed repeatedly to prove idempotency.

## Phase 3 — Adviser Request domain correction

Implement:

```text
Student Request
→ Adviser CONFORME / Decline
→ Dean Approve / Reject
→ Active AdviserAssignment
```

Required data should support:
- student;
- requested adviser;
- source passed Title Defense session;
- request timestamp/reason;
- adviser response/timestamp/remarks;
- Dean review/reviewer/timestamp/remarks;
- final request state.

Rules:
- no active assignment before Adviser CONFORME + Dean approval;
- candidate must belong to the student's actual passed Title ODP;
- unrestricted adviser directory is invalid for Student selection;
- Facilitator/Rapporteur excluded under the current working mapping;
- declined/rejected requests allow a new valid request.

Schema changes happen only after Phase 0 proves migration health.

## Phase 4 — Central Student Thesis Journey read model

Create one authenticated backend endpoint/service deriving:

- Comprehensive Exam gate;
- Title formal conclusion;
- official selected title;
- Adviser Request state;
- active AdviserAssignment;
- Proposal formal conclusion;
- STRIKE/plagiarism state;
- Final formal conclusion;
- navigation state;
- lock reason;
- current step;
- centralized STRIKE-before-Final policy.

Do not use application `APPROVED` as a synonym for `PASSED`.

Do not derive progression from `ThesisRecord.stage/status` alone.

Add focused tests for each transition.

## Phase 5 — Student sidebar and route behavior

Target navigation:

```text
Thesis Journey ▼
├── Title Defense
├── Adviser Request
├── Proposal Defense
├── STRIKE / Plagiarism
└── Final Defense
```

Requirements:
- parent is toggle-only;
- no competing Overview child;
- render COMPLETED/CURRENT/AVAILABLE/WAITING/LOCKED;
- locked items are non-navigable and show a reason;
- completed items remain viewable;
- direct route access remains backend/domain guarded;
- `/student/thesis` redirects to the current relevant step.

## Phase 6 — Student pages

### Title Defense
- consume centralized journey state;
- rename Concept Paper to Title Defense Proposal Package;
- after PASSED + selected title, CTA points to Adviser Request.

### Adviser Request
- use ODP-derived candidates;
- show stored candidate metadata;
- support ready / waiting adviser / declined / waiting Dean / rejected / approved states;
- allow retry after decline/rejection;
- never create assignment directly from Student action.

### Proposal Defense
- require active AdviserAssignment for page access;
- keep application submission eligibility server-side;
- no Proposal-corrections workflow state.

### STRIKE / Plagiarism
- follow centralized policy;
- use persisted plagiarism infrastructure;
- do not show mock data as real;
- if submission backend is absent, represent that honestly.

### Final Defense
- consume centralized state;
- require Proposal formal completion;
- apply STRIKE only through centralized policy;
- do not add Statistician/Instrument gates without SOT confirmation.

## Phase 7 — Academic Journey cleanup

Reduce Academic Journey to:

```text
Admissions / Enrollment
→ Coursework / Curriculum
→ Comprehensive Examination
→ Thesis / Dissertation Phase
→ Research Completion
→ Graduation / Completion
```

Remove Adviser-before-Title ordering and avoid duplicating detailed Thesis Journey steps.

## Phase 8 — Expert Evaluation scope protection

Do not implement the legacy in-system expert assignment/scoring workflow.

If evidence storage is needed:
- treat it as external/manual supporting evidence;
- prefer document uploads/records;
- keep current expert-evaluation tables dormant unless client scope expands.

## Phase 9 — Backend tests

Add/adjust tests for:
- Title PASSED from formal conclusion;
- selected title required before Adviser Request unlock;
- ODP candidate derivation;
- Facilitator/Rapporteur exclusion under working mapping;
- no assignment before Adviser CONFORME;
- Dean cannot bypass Adviser CONFORME;
- retry after decline/rejection;
- Proposal locked before active adviser;
- Proposal unlock after active assignment;
- Proposal PASSED from formal conclusion;
- STRIKE follows centralized policy;
- Final follows centralized policy;
- direct-route guards;
- completed stages remain viewable.

## Phase 10 — Build validation

Run:
- Prisma generate;
- backend TypeScript build;
- backend tests;
- available frontend lint/build/type checks.

A successful compile is not proof of correct workflow state.

## Phase 11 — Deferred Playwright/E2E validation

Playwright/E2E is **deferred for the current refactor pass**. Do not spend implementation time expanding or stabilizing browser tests until backend/frontend contracts are stable.

Keep the existing E2E files as reference unless a small compile-only adjustment is required by renamed routes/types. Do not treat Playwright as a completion gate for this pass.

A later stabilization pass will cover the previously defined Student journey scenarios and full Student → Adviser → Dean GS-020 flow.

## Phase 12 — Agent handoff report

Before review/merge, report:
- changed-file list;
- schema/migration rationale;
- clean DB migration replay result where applicable;
- seed result;
- backend build/test results;
- frontend typecheck/lint/build results;
- manual functional verification notes;
- remaining OPEN_QUESTION items;
- intentional differences from legacy code;
- explicit note that Playwright/E2E was deferred for this pass.

## Historical reference branch

`refactor/student-thesis-journey-rebuild` is historical/reference only. Do not cherry-pick its implementation commits by default. If a specific idea is reused, re-derive it against the current SOT/spec and implement it cleanly on this branch.

## Current correction-pass priority — backend first

Before continuing UI polish, resolve the known backend/frontend authority mismatches from the branch review.

Order of work:

1. **Unify STRIKE policy authority**
   - one shared policy/config must drive Student Thesis Journey state and Final application/scheduling eligibility;
   - do not allow Final to be LOCKED in the journey while the backend application endpoint independently permits it.

2. **Harden Adviser Request domain gates**
   - backend request creation requires formal Title Defense PASSED **and** official selected title;
   - candidate must come from that passed Title Defense ODP under the working Chairman + Panelist mapping;
   - do not rely on frontend locking as the security/domain gate.

3. **Scope Panelist/Adviser request reads**
   - do not expose the Admin-wide adviser-request list to PANELIST;
   - provide/read only requests where requestedAdviserId matches the authenticated adviser;
   - return Student/program, official title, Title Defense role, request remarks/date, and adviser/dean state.

4. **Correct AdviserRequest audit semantics**
   - pending Student request must not store the Student as a placeholder approver;
   - approval/reviewer fields should be nullable until the correct actor acts;
   - validate migration/schema FK/index consistency for Dean review fields.

5. **Strengthen Dean approval transaction**
   - re-check Adviser CONFORME, Dean PENDING, and absence of a conflicting active AdviserAssignment before creation;
   - assignment remains transactional with Dean approval.

6. **Complete the three-actor frontend**
   - Student candidate selection/confirmation UX;
   - Panelist/Adviser inbox with real CONFORME/Decline;
   - Dean review with real Approve/Reject and no arbitrary adviser picker.

7. **Restore application-state UX and query consistency**
   - Proposal/Final must distinguish fresh form vs submitted/review/scheduled/concluded states without creating a competing academic progression model;
   - remove hard-coded always-form or dead conditional placeholders;
   - use one shared Student Thesis Journey React Query key and invalidate it consistently.

8. **Then polish sidebar/status presentation**
   - text left, status icon right, accessible tooltip/focus/tap explanation;
   - LOCKED remains non-navigable.

Validation for this correction pass: Prisma generate, backend build/tests, available frontend typecheck/lint/build, deterministic seed verification, and manual functional review. Playwright/E2E is deferred.

## Phase 13 — Frontend architecture audit before implementation

Before implementing the Student Thesis Journey UI, audit the parent-branch frontend against the design specification and identify legacy progression logic that must be replaced or redirected.

Inspect at minimum:

- Student sidebar;
- Title Defense page;
- Adviser Request page;
- Proposal Defense page;
- STRIKE page;
- Final Defense page;
- Academic Journey page;
- legacy `/student/plagiarism`;
- Panelist layout and Adviser Requests page;
- Admin/Dean adviser-management page;
- Playwright Student Thesis Journey tests.

For each page, identify and remove local progression rules that duplicate or contradict `GET /thesis/student/journey`.

Do not introduce frontend-local progression rules that duplicate backend authority. Schema/backend changes must follow the earlier backend phases and the canonical SOT.

## Phase 14 — Student Thesis Journey UI refactor

### 14.1 Sidebar

- consume centralized journey state;
- render COMPLETED/CURRENT/AVAILABLE/WAITING/LOCKED;
- keep each step label on the **left** and its status icon on the **right**;
- use icon semantics: COMPLETED = check/check-circle, CURRENT = circle-dot/filled-dot with subtle row emphasis, AVAILABLE = hollow-circle/arrow, WAITING = clock, LOCKED = lock;
- do not clutter rows with repeated text badges such as CURRENT/WAITING/LOCKED when the icon already conveys state;
- provide tooltip/focus text for every status icon; on touch/mobile provide equivalent tap/focus access;
- LOCKED tooltip/focus text must include the backend lockReason;
- keep COMPLETED and WAITING pages viewable;
- make LOCKED children genuinely non-navigable, not just aria-disabled Links;
- keep Thesis Journey parent toggle-only.

### 14.2 Title Defense

- completed Title remains viewable;
- show official selected title;
- completed-state CTA = **Continue to Adviser Request**;
- remove any direct 'Proceed to Proposal Defense' action before active adviser assignment.

### 14.3 Adviser Request

Replace minimum/basic selection UX with a clear ODP candidate experience.

Show candidate metadata: name, Title Defense role, specialization when available, and office affiliation when available.

Support distinct ready, waiting-for-adviser, declined, waiting-for-Dean, Dean-rejected, and approved/active states.

Do not expose unrestricted faculty selection.

### 14.4 Proposal Defense

- consume `steps.proposal`;
- if LOCKED, render lock UX only and no usable form;
- require active adviser assignment for access;
- do not infer access from Title PASSED alone.

### 14.5 STRIKE

- use persisted data only;
- remove developer/internal policy wording from Student-facing copy;
- do not display fake/mock result/history data;
- follow centralized policy only.

### 14.6 Final Defense

- replace old `/student/journey` / `ThesisRecord.stage/status` progression logic;
- consume centralized journey state;
- if LOCKED, do not render usable Final form;
- respect centralized STRIKE policy on both sidebar and direct URL.

Acceptance: the same fixture must produce the same state in sidebar, page, `/student/thesis` redirect, and direct-route behavior.

## Phase 15 — Complete GS-020 three-actor UI

### 15.1 Student

Ensure Student Adviser Request UI meets the updated design specification.

### 15.2 Panelist/Adviser

Implement a real Adviser Requests inbox and request detail/action screen.

Required:

- discoverable sidebar navigation;
- Student identity/program;
- official selected title;
- request remarks;
- Title Defense role;
- request status/date;
- CONFORME action;
- Decline action;
- real endpoint integration;
- refresh/status feedback after action.

Do not leave a placeholder-only page.

### 15.3 Admin/Dean

Refactor the old adviser assignment UI into Dean review semantics for GS-020.

Required:

- show Student-selected adviser;
- show Adviser CONFORME state;
- show official title/request details;
- Approve action;
- Reject action;
- real Dean decision endpoint.

Remove the requirement for Dean/Admin to choose an arbitrary replacement adviser from the unrestricted adviser list during this approval action.

Any retained legacy assign endpoint/UI must not bypass the service invariant.

## Phase 16 — Academic Journey and legacy route cleanup

### Academic Journey

Replace the detailed Thesis/Adviser milestone timeline with:

```text
Admissions / Enrollment
→ Coursework / Curriculum
→ Comprehensive Examination
→ Thesis / Dissertation Phase
→ Research Completion
→ Graduation / Completion
```

Remove Adviser-before-Title ordering, `APPROVED` treated as `PASSED`, and duplicated detailed thesis progression logic.

### Legacy routes

Review and resolve:

- `/student/thesis` — centralized current-step redirect only;
- `/student/plagiarism` — redirect to `/student/thesis/strike` or otherwise retire as a competing workflow page;
- old adviser routes/pages — no independent/bypass workflow.

Do not delete compatibility routes without checking references; redirect where safer.

## Phase 17 — Playwright stabilization pass (deferred)

Do **not** execute this phase during the current backend/frontend refactor session.

After the workflow is stable, return to Playwright and implement behavioral coverage for adviser states, Proposal and Final direct-route locks, STRIKE policy transitions, Final PASSED viewability, the full Student → requested Adviser → Dean → Student GS-020 flow, and decline/reject/retry paths where practical.

Locked-route tests must assert actual unusability, not only page headings.

## Phase 18 — Final UX regression and handoff

Before final handoff:

1. Run backend generate/build/tests.
2. Run frontend type/lint/build checks available in the repository.
3. Run the complete deterministic seed set.
4. Do not run Playwright/E2E in this pass unless explicitly requested after backend/frontend stabilization.
5. Manually inspect major pages at desktop and one narrow/mobile viewport.
6. Verify no Student-facing page exposes engineering phrases such as `OPEN_QUESTION`, `PROPOSED_SYSTEM_DESIGN`, or 'policy is centralized'.
7. Verify no mock plagiarism data is presented as real.
8. Verify no frontend route bypasses Adviser CONFORME → Dean.
9. Verify no Student page bypasses centralized lock state.
10. Report pre-existing unrelated issues separately rather than silently changing unrelated modules.

Final handoff must include:

- exact changed-file list for the correction pass;
- before/after summary of each audited UI;
- backend test count/result;
- frontend check results;
- Playwright/E2E status: explicitly mark **deferred** for this pass;
- screenshots or traces for remaining UI failures;
- remaining OPEN_QUESTION items;
- explicit confirmation that the branch has not been merged unless project-owner approval was given.
