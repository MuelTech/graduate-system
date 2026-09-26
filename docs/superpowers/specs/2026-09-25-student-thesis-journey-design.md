> **SUPERSESSION NOTICE — 2026-09-26**  
> WP1–WP13 based on this design have been implemented, manually QA'd, and integrated into `refactor/defense-workflow`. The post-QA workflow corrections are now defined in `docs/superpowers/specs/2026-09-26-defense-session-workflow-design.md`. Implementation now continues on `refactor/defense-workflow-corrections`. Where this document conflicts with that correction spec, the 2026-09-26 spec wins. In particular: Title Adviser Request now waits for finalized Title RAP; Title does not use Proposal/Final Group I/II scoring; Proposal/Final add Adviser review/certification before Admin review; Chairman records the formal result; Research Variables is not an active blocking gate in the correction pass.

# Student Thesis Journey — Design Specification

**Date:** 2026-09-25  
**Branch:** `refactor/student-thesis-journey`  
**Parent branch:** `refactor/defense-workflow`  
**Canonical business source:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Implementation owner:** Local coding agent

## 1. Goal

Refactor the Student Portal so the UI reflects the actual graduate research/defense sequence while keeping workflow state authoritative in the backend.

This branch is documentation-first. The local coding agent owns schema/backend/frontend implementation, migration cleanup, fixtures, automated tests, and manual verification. Playwright/E2E is intentionally deferred until the backend/frontend workflow is stable.

## 2. Student Thesis Journey

```text
Thesis Journey
├── Title Defense
├── Adviser Request
├── Proposal Defense
├── STRIKE / Plagiarism
└── Final Defense
```

The parent is a toggle/group label, not a competing overview destination. The legacy `/student/thesis` route must not become a second source of truth.

## 3. Journey state model

Each child has one derived state:

- **COMPLETED** — milestone complete; page remains viewable.
- **CURRENT** — primary current step.
- **AVAILABLE** — accessible/actionable.
- **WAITING** — another actor/event is pending.
- **LOCKED** — inaccessible; include a user-facing reason.

Backend/domain rules remain authoritative, including direct URL access.

Journey progression must not be inferred from `ThesisRecord.stage/status` alone. At minimum, derive from formal `DefenseConclusion`, selected official title, Adviser Request state, active `AdviserAssignment`, Proposal outcome, plagiarism/STRIKE state when enabled, and Final outcome.

## 4. Canonical sequence

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
STRIKE / Plagiarism, if required by current policy
↓
Final Defense
↓
post-defense corrections
↓
final approved manuscript
↓
repository completion
```

Current client direction does **not** define a separate formal Proposal Corrections workflow state.

Research/Data Gathering/Data Analysis are academic activities, not standalone sidebar modules.

Instrument Validation / Expert Evaluation remains external/manual for current project scope. Do not rebuild the legacy in-system expert assignment/scoring workflow.

## 5. Stage rules

### Title Defense

Requires Comprehensive Examination = PASSED.

Student supplies:
- three proposed title names;
- one Title Defense proposal package PDF;
- current COR;
- stage-specific defense-fee proof.

After formal PASSED + official selected title + finalized required Title RAP, next action is Adviser Request.

### Adviser Request

Unlocks only after:
- formal Title Defense = PASSED;
- official selected title exists; and
- required Title RAP is finalized/signed.

Candidates come only from the student's actual passed Title Defense ODP/evaluator subset. The unrestricted faculty directory is not a valid candidate source.

Working mapping is Chairman + evaluator Panelists; Facilitator and Rapporteur are excluded pending exact client role-label confirmation.

**Confirmed adviser-eligibility rule:** external panelists may serve on a defense panel but cannot become thesis/dissertation advisers. New GS-020 adviser candidates must therefore be internal Panelists (`isExternal = false`) with `isAvailableAsAdviser = true`. This must be enforced by the backend, not only by UI filtering. Admin Panelist management should force/keep adviser availability off while a Panelist is external, and Dean approval must defensively re-check the requested adviser before creating an active `AdviserAssignment`.

Flow:

```text
Student request
→ Adviser CONFORME / Decline
→ Dean Approve / Reject
→ Active AdviserAssignment
```

A pending request is not an active assignment. Declined/rejected requests create no active assignment and permit another eligible request.

### Proposal Defense

Page access requires an active AdviserAssignment.

Submission eligibility remains server-side. No separate Proposal-corrections state is added.

### STRIKE / Plagiarism

Working placement:

```text
Proposal PASSED
→ complete final manuscript
→ STRIKE / Plagiarism
→ Final Defense
```

This is **OPEN_QUESTION / PROPOSED_SYSTEM_DESIGN**. The rule must be centralized so it can be disabled or repositioned without rewriting every page.

### Final Defense

Consumes centralized journey state and server eligibility. Do not make Statistician Certification, Research Instruments, or STRIKE unconditional gates unless the canonical SOT is updated by current client confirmation.

## 6. Academic Journey

Keep it high-level:

```text
Admissions / Enrollment
→ Coursework / Curriculum
→ Comprehensive Examination
→ Thesis / Dissertation Phase
→ Research Completion
→ Graduation / Completion
```

Do not duplicate the detailed Thesis Journey here.

## 7. Central read model

Create one authenticated backend read model consumed by the sidebar, Thesis pages, and `/student/thesis` redirect.

Conceptual response:

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

Exact DTO may differ, but state derivation must have one authoritative backend path.

## 8. Deterministic test-data requirement

Do not use `student@earist.edu.ph` as the sole proof of this workflow because that account is overloaded by legacy/general-purpose fixtures.

Create dedicated, idempotent scenario fixtures for:
- Title ready;
- Title pending;
- Title PASSED + selected title + no adviser request;
- Adviser pending;
- Adviser CONFORME waiting Dean;
- Adviser approved;
- Proposal ready;
- Proposal PASSED;
- STRIKE ready;
- STRIKE completed/eligible;
- Final ready;
- Final PASSED.

Example adviser-ready fixture:

```text
Comprehensive Exam     PASSED
Title Defense          CONCLUDED
Title Outcome          PASSED
Official Title         selected
Title Committee        exists
Active Adviser         none
Pending Adviser Req    none
Proposal               not started
STRIKE                  none
Final                   none
```

Expected UI:

```text
Title Defense       COMPLETED
Adviser Request     CURRENT
Proposal Defense    LOCKED
STRIKE              LOCKED
Final Defense       LOCKED
```

## 9. Migration baseline

The historical fresh-replay ordering defect in the parent workflow branch has been repaired by commit:

`63ce47149a6c9fdc660f62be8a4e75ab4aca4378` — `fix(prisma): repair fresh migration replay order`

The repaired baseline is already present on this branch.

It was verified on 2026-09-25 against a newly created MySQL `graduate_system` database: all existing migrations replayed successfully through `20260923160000_rap_signature_policy`, and `npx prisma migrate dev` reported the database/schema in sync.

Therefore this feature must **not** reopen or rewrite the historical migration repair unless a new concrete migration defect is discovered.

Any Student Thesis Journey schema work must use a new feature migration on this branch.

Do not run destructive reset/resolve operations against a database unless explicitly approved by the project owner.

## 10. Definition of done

Complete for the current refactor pass only when:
- migration history replays from zero;
- deterministic fixtures exist;
- backend read model is authoritative;
- Adviser Request follows ODP → Adviser CONFORME → Dean approval;
- sidebar/pages consume the same state;
- direct-route guards match backend state;
- backend Prisma generate/build/tests pass;
- available frontend typecheck/lint/build checks pass;
- seed/manual functional verification is completed for the changed backend/frontend flows;
- remaining OPEN_QUESTION items are reported, not silently hard-coded.

Automated browser E2E is **out of scope for this feature plan**. It will be handled separately after the Student Thesis Journey flow is implemented and stable.

## 11. Mandatory UI/UX implementation contract

This section is **normative** for the Student Thesis Journey frontend implementation on this clean branch.

Do not reduce the workflow to bare technical status screens. Student, Panelist/Adviser, and Admin/Dean experiences must remain consistent with the existing EARIST portal visual language: cards, alerts, badges, clear headings, contextual actions, responsive layouts, and readable empty/locked/waiting states.

### 11.1 Student Thesis Journey sidebar

The sidebar must render the five Thesis Journey children from the centralized journey read model.

Status presentation is **icon-based**. Keep each step label left-aligned and place the status icon on the **right side of the row**.

```text
Thesis Journey
├── Title Defense                         ✓
├── Adviser Request                       ●
├── Proposal Defense                      🔒
├── STRIKE / Plagiarism                   🔒
└── Final Defense                         🔒
```

Use the project's icon set rather than literal emoji in implementation. Recommended semantics:

- `COMPLETED` — check/check-circle icon; clickable/viewable.
- `CURRENT` — circle-dot/filled-dot icon plus subtle row emphasis; clickable.
- `AVAILABLE` — subtle hollow-circle or arrow icon; clickable.
- `WAITING` — clock icon; clickable so the Student can inspect status.
- `LOCKED` — lock icon; **must not navigate**.

Do not show noisy text badges such as `CURRENT`, `WAITING`, or `LOCKED` beside every sidebar item when the icon already conveys the state.

Every status icon must have an accessible tooltip/label. On hover or keyboard focus, show a short state explanation. On touch/mobile, the same explanation must be available by tap/focus or equivalent accessible interaction.

Examples:

```text
CURRENT icon tooltip
Current step
```

```text
LOCKED icon tooltip
Proposal Defense is locked
An active approved adviser is required.
```

For `LOCKED`, do not render a functioning `<Link>` merely with `aria-disabled`. Use a non-navigating element/control and expose the backend-provided `lockReason` in the tooltip/focus text. The direct page lock card remains the fallback when a locked URL is entered manually.

The Thesis Journey parent remains toggle-only. Backend/domain state still protects direct URLs.

### 11.2 Direct-route lock behavior

When a step is `LOCKED`:

- do not render the application/upload form;
- do not render enabled submit actions;
- show a clear lock card using the authoritative `lockReason`;
- provide safe navigation to the current/previous relevant step when useful.

Direct URL entry must never make a locked workflow functionally usable.

### 11.3 Title Defense completed state

When Title Defense is formally `PASSED` and an official title is selected:

```text
Title Defense       COMPLETED
Adviser Request     CURRENT or WAITING/AVAILABLE
Proposal Defense    LOCKED until active AdviserAssignment
```

The Title page must show the official selected title and use **Continue to Adviser Request** as the primary next-step CTA. It must never send the Student directly to Proposal Defense before an active adviser exists.

Use **Title Defense Proposal Package** as the user-facing upload label; the existing API field may remain unchanged if no migration is required.

### 11.4 Student Adviser Request UI

Eligible candidates come only from the actual passed Title Defense ODP. The UI must not look like a generic unrestricted faculty directory.

Preferred candidate presentation:

```text
Eligible Adviser Candidate
├── Name
├── Title Defense role (Chairman / Panelist)
├── Specialization, when available
├── Office affiliation, when available
└── Select / selected state
```

A searchable selector is acceptable only if the same meaningful candidate metadata is visible before confirmation.

Before submission, show a confirmation summary of the selected candidate and optional request remarks.

Provide distinct UX states for: ready to request; waiting for Adviser CONFORME/decline; Adviser declined; Adviser CONFORMED and waiting for Dean; Dean rejected; approved/active adviser.

Decline/rejection must allow another eligible request. Pending states must never imply an active assignment.

### 11.5 Panelist/Adviser GS-020 inbox

The Panelist/Adviser portal must provide a real Adviser Request inbox; a placeholder page is not sufficient.

Each request detail should show, where available: Student identity/program, official selected research title, Student request remarks, the user's Title Defense role, and request date/status.

Available actions for the requested adviser are **CONFORME / Accept** and **Decline**. These actions must call the real Adviser response endpoint and refresh state.

After CONFORME, state clearly that Dean approval is still pending and no active AdviserAssignment exists yet.

The Panelist/Adviser sidebar must include a discoverable Adviser Requests navigation item. The inbox itself should not be hidden based on current adviser availability or external/internal status; historical/already-addressed requests may remain viewable, while backend eligibility prevents new invalid requests.

### 11.6 Admin/Dean Adviser Review UI

The Admin/Dean experience must represent Dean review, not the old generic 'assign any adviser' workflow.

For a conformed request, show Student identity/program, official selected title, Student-selected adviser, the adviser's Title Defense role, Adviser CONFORME state/remarks, Student request remarks, and relevant timestamps.

Dean actions are **Approve** and **Reject**.

The Dean must not be asked to choose a different adviser from the unrestricted adviser directory during this approval step.

Any retained legacy `/adviser/assign` path must not bypass Adviser CONFORME → Dean.

### 11.7 Proposal Defense page

The Proposal page must consume the centralized Student Thesis Journey state.

If `steps.proposal.state === "LOCKED"`, render the lock state only: no usable upload/application form and no possible submit action.

An active `AdviserAssignment` is required for Proposal page access. Do not infer accessibility merely because Title Defense is PASSED.

### 11.8 STRIKE / Plagiarism page

The Thesis Journey STRIKE page must use persisted plagiarism records and centralized policy.

Do not display hard-coded similarity percentages, fake history, fake report links, or mock results presented as real data.

The legacy `/student/plagiarism` page must not remain a competing workflow UI. Prefer redirecting it to `/student/thesis/strike` or retiring it after checking compatibility.

Do not expose engineering language to Students such as `OPEN_QUESTION`, `PROPOSED_SYSTEM_DESIGN`, 'policy is centralized', or 'may change after client confirmation'. Student copy should describe only the current operational state.

### 11.9 Final Defense page

The Final page must consume the same centralized Thesis Journey read model as the sidebar.

It must not derive progression from the old `/student/journey` payload or from `ThesisRecord.stage/status` as a substitute for formal conclusions.

If `steps.final.state === "LOCKED"`, show the authoritative lock reason and do not render a usable Final application form.

When `strikeBeforeFinalRequired === true`, missing/ineligible STRIKE must keep Final functionally locked on both sidebar and direct URL.

### 11.10 Academic Journey

Replace the old detailed thesis timeline with the high-level Academic Journey defined in Section 6.

It must not contain Adviser Assignment before Title Defense, a duplicate Title → Proposal → Final state machine, or logic that treats `APPROVED` as academic `PASSED`.

### 11.11 Legacy route compatibility

Review at minimum:

- `/student/thesis` — centralized `currentStep` redirect only;
- `/student/plagiarism` — redirect/retire in favor of `/student/thesis/strike`;
- old Adviser assignment/request routes — no independent or bypass workflow.

No legacy page may maintain an independent progression model.

### 11.12 Visual consistency requirements

- reuse existing project UI primitives/components before introducing new patterns;
- preserve EARIST spacing, typography, cards, badges, alerts, and responsive behavior;
- avoid developer/debug-style pages that only print raw enums;
- translate backend states into clear user-facing labels;
- keep status and next action understandable without implementation jargon.

## 12. UI/UX acceptance examples

### 12.1 Adviser-ready Student

Given Title PASSED + official selected title + no adviser request/assignment:

```text
Title Defense       COMPLETED
Adviser Request     CURRENT
Proposal Defense    LOCKED
STRIKE              LOCKED
Final Defense       LOCKED
```

Title primary CTA → Adviser Request. Adviser page shows eligible ODP candidates. Proposal direct URL shows lock explanation only, with no usable form.

### 12.2 Adviser request pending

Adviser Request is WAITING and Proposal remains LOCKED. The Student sees the requested adviser and that Adviser response is pending; the UI must not say the adviser is already assigned.

### 12.3 Adviser CONFORMED, Dean pending

Adviser Request is WAITING and Proposal remains LOCKED. The Student sees that CONFORME is complete and Dean review is pending. No active adviser is shown yet.

### 12.4 Adviser approved

Adviser Request becomes COMPLETED, active adviser is visible, and Proposal becomes CURRENT/AVAILABLE.

### 12.5 Final locked by STRIKE policy

When centralized policy requires STRIKE and no eligible plagiarism result exists, STRIKE is CURRENT/WAITING and Final is LOCKED. Direct Final URL shows lock UX and no usable Final form.

## 14. Implementation constraint

Start from the `refactor/defense-workflow` implementation baseline. Do not copy the experimental implementation from `refactor/student-thesis-journey-rebuild`; use that branch only as historical evidence for what was tried and what failed.

Implement one backend-authoritative journey architecture, complete the Student/Panelist/Dean GS-020 flow, preserve application/session state as separate from academic completion state, and follow the UI/UX contract in this document. Automated browser E2E is not part of this feature branch implementation plan.

Do not create another parallel journey architecture.

## 15. Implementation priority and package boundaries

For implementation on this clean branch, backend/domain contracts come first. Work must be divided into small packages, and a coding-agent session must stop after the assigned package rather than automatically continuing into the next one.

Preferred order:

1. **Backend correctness first**
   - one authoritative STRIKE-before-Final policy source used by journey state and Final eligibility/scheduling;
   - Adviser Request backend gate requires formal Title PASSED **and** official selected title;
   - Panelist/Adviser request listing is scoped to the authenticated requested adviser, not the Admin-wide list;
   - AdviserRequest audit semantics do not use the Student as a placeholder approver;
   - Dean approval rechecks CONFORME/pending state and creates the active assignment transactionally.

2. **GS-020 frontend completion**
   - Student adviser candidate selection/confirmation;
   - Panelist/Adviser inbox and CONFORME/Decline flow;
   - Admin/Dean review with real Approve/Reject semantics and no arbitrary adviser picker.

3. **Proposal/Final application-state cleanup**
   - keep centralized journey locks;
   - restore real submitted/review/scheduled/concluded application presentation;
   - do not hard-code fake submitted branches or always-form branches.

4. **Client-state/query consistency**
   - use one shared Student Thesis Journey query key and invalidate it consistently after mutations.

5. **UI polish**
   - sidebar right-side status icons + accessible tooltip/focus/tap explanations;
   - remove raw enum/debug wording and internal policy language from Student-facing pages;
   - keep the EARIST portal's existing visual language.

6. **Validation for this pass**
   - fresh/known-safe migration validation where relevant;
   - Prisma generate;
   - backend build/tests;
   - frontend typecheck/lint/build checks available in the repository;
   - deterministic seed verification;
   - manual functional verification at desktop and one narrow/mobile viewport.

Browser E2E work is excluded from this feature plan and should be scheduled separately after implementation is stable.
