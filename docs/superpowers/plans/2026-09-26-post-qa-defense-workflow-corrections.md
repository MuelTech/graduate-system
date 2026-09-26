# Post-QA Defense Workflow Corrections — Implementation Plan

**Date:** 2026-09-26  
**Branch:** `refactor/student-thesis-journey`  
**Baseline accepted HEAD before this documentation pass:** `587afd3cf1d1e7c6b35ce5cbcf3ae9ca66a10c0b`  
**Status:** Next implementation plan after completed WP1–WP13  
**Execution rule:** One correction package per coding-agent session. Stop and report before starting the next package.

## 1. Read first

In this order:

1. `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`
2. `docs/superpowers/specs/2026-09-26-defense-session-workflow-design.md`
3. this plan
4. `docs/superpowers/specs/2026-09-25-student-thesis-journey-design.md`
5. `docs/superpowers/STUDENT_THESIS_JOURNEY_IMPLEMENTATION_REFERENCE.md`

The 2026-09-26 correction spec supersedes conflicting 2026-09-25 assumptions.

WP1–WP13 are historical completed work. Do not re-run them.

## 2. Working method

For every correction package:

1. inspect the current branch implementation before editing;
2. keep backend/domain authority ahead of frontend presentation;
3. do not weaken a domain gate merely to make fixtures/UI pass;
4. add/adjust focused tests for the changed rule;
5. keep unrelated cleanup out;
6. commit/push the bounded package;
7. report exact files, tests/checks, and remaining gaps;
8. stop for review.

Do not implement unresolved institutional policy as an assumption.

---

## CP1 — Canonical stage completion, eligibility authority, and fixtures

### Goal

Align backend progression with the corrected workflow before changing UI.

### Required changes

- Title stage completion / Adviser Request unlock requires:
  - formal Title result = PASSED;
  - official selected title;
  - finalized required Title RAP.
- Central Journey and GS-020 candidate/request gate must use the same completion rule.
- Proposal prior-stage checks must use formal defense authority and finalized RAP rather than stale compatibility mirrors where possible.
- Separate missing messages for:
  - Title formal result/selected title;
  - Title RAP finalization.
- Disable Research Variables as an active Proposal apply/schedule blocking gate.
- Preserve ResearchVariableForm schema/data; do not invent N/A workflow.
- Update deterministic fixtures so scenarios used for application eligibility include the real prerequisite records they claim to represent.
- Add focused tests proving Journey and eligibility agree.

### Inspect

At minimum:

- `student-thesis-journey.service.ts`
- `student-thesis-journey.rules.ts`
- `stage-completion.ts`
- `defense-eligibility.service.ts`
- `defense-eligibility.repository.ts`
- GS-020 adviser-request rules/services
- Journey fixture builder/verifiers

### Stop

STOP after backend tests/build and fixture validation.

---

## CP2 — Student defense status, schedule visibility, and freshness

### Goal

Fix the Student UI/UX inconsistencies found during manual QA.

### Required behavior

For Title/Proposal/Final pages distinguish:

- submitted/under review;
- approved/waiting for scheduling;
- scheduled;
- defense active;
- finalizing result/RAP;
- completed/result.

Extend the Journey/read DTO with a safe schedule/session summary where needed:

- date;
- time;
- venue/link;
- defense/session status.

Do not create a second progression model in the frontend.

Replace generic Title `WAITING` heading with status-specific copy.

Ensure waiting/active pages can refresh cross-role changes through controlled polling and/or an explicit Refresh Status action.

### Validation

Manual QA:

- Admin approves while Student waits;
- Admin schedules while Student waits;
- Student sees correct schedule/status without a hard page reset;
- direct locked routes remain non-usable.

### Stop

STOP after focused frontend/backend checks.

---

## CP3 — Proposal Adviser review and Adviser Certification workflow

### Goal

Turn Proposal Adviser Certification from a passive eligibility flag into a real workflow.

### Required flow

```text
Student uploads Proposal manuscript
→ active Adviser receives review task
→ Adviser reviews manuscript
├─ return/request changes
└─ certify eligible
   → Adviser e-signature
   → Proposal AdviserCertification ISSUED
→ Proposal becomes Admin-reviewable when other Student-owned requirements exist
```

### Requirements

- authorization must bind Adviser action to the active AdviserAssignment;
- certification is stage-scoped to Proposal;
- store signer and server-side issued/signed timestamp;
- Student does not upload Adviser Certification;
- COR/fee proof remain Student/external requirements;
- Admin review/scheduling still occurs after certification.

Do not require Research Variables in this package.

### Stop

STOP after focused backend tests + Adviser/Student UI checks.

---

## CP4 — Final Adviser review and certification

### Goal

Apply the same controlled Adviser-review pattern to Final without conflating Proposal certification.

### Required behavior

- Final manuscript routed to active Adviser review;
- return/request changes supported;
- Final e-signed certification is separate from Proposal certification;
- only then can Final become Admin-reviewable when remaining requirements are present.

Preserve optional STRIKE policy behavior as currently centralized; do not make STRIKE newly mandatory.

### Stop

STOP after focused tests/UI verification.

---

## CP5 — Individual evaluator lifecycle and authorization

### Goal

Build the authoritative Proposal/Final evaluation record lifecycle.

### Required behavior

- Title Defense does not use Group I/II scoring in this correction.
- Proposal/Final assigned evaluator can create/update only own evaluation.
- backend derives or verifies assignment ownership from authenticated user + schedule;
- one logical evaluation per evaluator assignment;
- support DRAFT state;
- server calculates/validates confirmed averages rather than trusting arbitrary client totals;
- e-signature required at finalization;
- FINALIZED evaluation is locked from normal editing;
- evaluation signature is separate from RAP signature;
- Facilitator/Rapporteur do not block evaluator completion unless separately assigned as evaluator by confirmed policy.

Do not implement automatic PASS/FAIL.

### Data-model note

Inspect whether a migration is required for:

- evaluation status;
- signature data/reference;
- signedAt/finalizedAt;
- uniqueness/upsert semantics.

Do not modify old migrations.

### Stop

STOP after migration validation if needed + backend tests.

---

## CP6 — Role-aware Defense Workspace

### Goal

Replace the prototype Defense Lobby interaction model with the actual defense work surface.

### Evaluator desktop UX

- left: My Evaluation;
- right: Student document viewer;
- sticky candidate/defense/role/status header;
- Save Draft;
- Review & Finalize;
- e-sign;
- finalized/locked state.

### Rapporteur UX

- relevant Student documents;
- Defense Notes/RAP workspace;
- Save Draft;
- Finalize Summary when allowed.

### Title Defense UX

No Group I/II form.

Provide:

- three proposed titles;
- Title proposal package viewer;
- deliberation/recommendation context;
- Chairman-only selected-title + formal result action at the correct phase;
- Rapporteur RAP workspace.

### Document authorization

Scope panel access to the defense/stage they are assigned to. Do not grant every thesis document just because the user appears on any defense schedule.

### Remove prototype-only behavior

Remove/replace misleading elements such as fake/static timer/action logs when they have no authoritative workflow meaning.

### Stop

STOP after desktop + narrow viewport manual verification.

---

## CP7 — Oral Summary, Chairman conclusion, Rapporteur/RAP, and signatures

### Goal

Complete the post-evaluation defense workflow.

### Proposal/Final

```text
all required evaluations FINALIZED
→ system generates Oral Examination Summary
→ Rapporteur finalizes official RAP content
→ Chairman reviews grade/summary and records formal result
→ RAP routed to required evaluator/scorer signatories
→ RAP FINALIZED after required e-signatures
```

The system displays grades/averages but does not auto-PASS/FAIL.

### Title

```text
panel deliberation
→ selected official title
→ Rapporteur Title RAP
→ Chairman formal result
→ required Title RAP signatures
→ Title COMPLETE only when PASSED + selected title + RAP FINALIZED
```

### Authorization

- formal conclusion endpoint must authorize the authenticated user through the session's `CHAIRMAN` assignment;
- do not expose a generic academic-conclusion action to ordinary panelists;
- do not rely on account role alone;
- Rapporteur note/finalize actions must require the session's `RAPPORTEUR` assignment.

### Student RAP

Add Student-safe status/view/download access for finalized RAP.

### Stop

STOP after focused tests and one manual full defense-session walkthrough.

---

## CP8 — Proposal-to-Final history and revision context

### Goal

Preserve Proposal recommendations without inventing a revision re-upload gate.

### Required behavior

After Proposal:

- keep Proposal manuscript;
- keep finalized Proposal RAP/recommendations;
- no special Student revision upload solely to clear Proposal comments.

For Final Defense Workspace show:

- previous Proposal manuscript;
- Proposal RAP/recommendations;
- current Final manuscript.

Optional compare/history UI is allowed, but the system must not automatically declare that a recommendation was complied with.

### Stop

STOP after access-control tests and manual Final workspace verification.

---

## CP9 — Panelist dashboard actionable summary

### Goal

Redesign the dashboard only after the underlying tasks are real.

Recommended summary cards:

- upcoming defenses;
- evaluations to complete;
- RAP signatures pending;
- Adviser Requests pending;
- adviser availability;
- recent important activity.

Each defense card shows the user's assignment role for that defense.

Dashboard is navigation/summary only; do not duplicate Defense Workspace forms.

### Stop

STOP after responsive manual QA.

---

## CP10 — Integration, fixture fidelity, and manual regression

### Goal

Prove the corrected workflow end to end without introducing new policy.

### Required manual scenarios

1. Title application submitted → Admin approved → scheduled; Student sees each status.
2. Title defense → title selected → RAP signatures → Title completed → Adviser Request unlocks only after RAP finalization.
3. GS-020: Student request → Adviser CONFORME → Dean approval.
4. Proposal manuscript → Adviser review/certification → Admin review/schedule.
5. Proposal evaluators independently draft/e-sign/finalize → Oral Summary → Chairman result → RAP finalized.
6. Proposal RAP/history appears during Final Defense; no Proposal revision re-upload gate exists.
7. Final Adviser review/certification → Admin review/schedule.
8. Final evaluator flow → Chairman result → Final RAP.
9. Unauthorized evaluator cannot submit for another panel assignment.
10. Unauthorized non-Rapporteur cannot edit RAP notes.
11. Research Variables absence does not block Proposal.
12. System-owned RAP/Certification are not requested as Student uploads.

### Validation

- backend test suite;
- backend build;
- Prisma generate/migration check when applicable;
- frontend lint/typecheck/build available in repository;
- seed twice / deterministic verifier;
- desktop and narrow manual UI check.

Report unrelated/pre-existing failures separately.

---

## 3. Explicitly out of scope

Do not add or decide in these correction packages:

- exact RAP PDF layout without source;
- automatic PASS/FAIL from numeric grade;
- exact unresolved Master's/Doctoral evaluator count;
- Research Variables approval/N/A workflow;
- new unconditional STRIKE policy;
- unrelated post-Final repository redesign;
- browser E2E unless separately requested.

