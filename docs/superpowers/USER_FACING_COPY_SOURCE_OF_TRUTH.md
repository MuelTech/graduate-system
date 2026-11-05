# User-Facing Copy Source of Truth

**Status:** CANONICAL  
**Scope:** All portal-facing labels, helper text, status messages, empty states, validation, errors, confirmations, dialog copy, button labels, and other microcopy in the EARIST Graduate School Information System.

This document defines **how authoritative system state is expressed to users**. It does not create or change workflow, permissions, scoring, scheduling, academic policy, database authority, or role ownership.

## 1. Precedence

When wording is implemented or reviewed, use this order:

1. confirmed EARIST institutional/academic terminology;
2. canonical workflow/domain source-of-truth documents;
3. exact approved visible wording in a bounded accepted design/package;
4. this User-Facing Copy Source of Truth for presentation wording;
5. local page/component wording only when none of the above is more specific.

If these sources conflict, stop and report the conflict. Do not silently invent a new visible term or policy explanation.

Official generated forms remain governed by their official EARIST templates and approved document-specific exceptions. Portal copy must not silently rewrite official-form language.

## 2. Core rule: shortest truthful wording

Use the **shortest wording that communicates the authoritative state without hiding a necessary consequence, recovery step, ownership boundary, or institutional rule**.

Prefer:

```text
clear task label
+ authoritative state
+ available action
+ consequence/recovery only when needed
```

Avoid UI prose that reads like implementation documentation.

## 3. One state, one message

Do not explain both the current state and the inverse condition already implied by that state.

Preferred:

- **Eligible for assignment.**
- **This Applicant already has an examination record.**
- **This schedule is full.**
- **This schedule is closed for booking.**

Avoid:

- **Eligible for assignment · No examination record prevents assignment.**
- **This Applicant already has an examination record that prevents another assignment.**

If the action is visibly disabled or unavailable, do not repeat that obvious consequence unless the user needs additional recovery guidance.

## 4. Do not explain what the UI already demonstrates

Do not repeat:

- the page/dialog purpose;
- an already-visible status;
- an obvious button consequence;
- an obvious disabled-state consequence;
- workflow narration already communicated by layout, stepper, labels, or controls.

Keep explanatory copy only when the user needs it to:

- understand an irreversible/high-impact consequence;
- understand a non-obvious blocker;
- recover from an error/conflict;
- distinguish ambiguous choices;
- understand a real institutional rule.

## 5. Role-aware wording and information boundaries

Copy must reflect what the **current actor needs to know and owns**.

### 5.1 Do not tell the current role to contact itself

Admin-side avoid:

> No eligible same-day schedules have seats available. Contact the schedule administrator.

Preferred:

> **No schedules are available for this Applicant’s Program.**

If an Admin-owned next action genuinely helps, it may be added concisely:

> **No schedules are available for this Applicant’s Program. Create or update a schedule to continue.**

### 5.2 Do not leak Admin/internal configuration details to Applicants

Applicant-facing errors should not expose internal Admin configuration or operational details when the Applicant cannot act on them.

Avoid to Applicant:

> Complete Exam Configuration, including the passing percentage, before starting.

Preferred:

> **The examination is not available yet.**

Admin may receive the detailed actionable message:

> **Exam Configuration is incomplete. Set the missing required values before new examinations can start.**

### 5.3 Do not expose internal authorization mechanics

Avoid ordinary Applicant-facing wording such as:

- **Start Now authorization is required for early entry.**
- **current active-ADMIN authorization**
- **server-owned deadline**
- **persisted execution configuration**
- **recovery receipt**

Preferred Applicant wording should describe the user's state/action:

- **You can start your examination at 11:30 PM.**
- **You may start your examination now.**

Internal authorization remains enforced by the backend without being narrated to the Applicant.

## 6. Engineering invariants are not automatically UI copy

A requirement being important for implementation/testing does not mean it must be explained to the user.

Examples of engineering truths that should normally stay in implementation/tests unless needed for recovery:

- refreshing preserves the authoritative deadline;
- refreshing restores the same immutable question set;
- saved answers recover from server state;
- actual start time is server-owned;
- attempt/content/configuration is frozen;
- transaction/locking/version behavior.

Instead of:

> Your allotted time begins when you click Start Examination. Refreshing restores the same deadline, questions and saved answers.

Prefer either no extra sentence, or only a user-relevant reassurance when needed:

> **Your answers are saved automatically.**

## 7. Status and heading labels

Use natural task/state language rather than historical/internal lifecycle labels.

For an ordinary current Applicant appointment:

Preferred:

> **Scheduled Examination**

Avoid by default:

> **Original appointment**

Use **Original appointment** only when the UI is specifically comparing preserved history against a replacement/rescheduled appointment and the distinction is meaningful to the user.

Redundant status text such as **Examination not started.** should be omitted when the surrounding state and Start action already make that obvious.

## 8. Configuration and settings copy

Admin settings should be actionable, not implementation-oriented.

Preferred:

> **Timezone**  
> Philippine Time (Asia/Manila)

Avoid:

> **Institutional Timezone**  
> Asia/Manila — system-defined, read-only

If a value is displayed as text rather than an editable control, “read-only” usually does not need to be stated.

Preferred configuration guidance:

> **Complete all fields to enable new examinations. Passing Threshold must be between 0% and 100%. Changes apply only to new examinations.**

Avoid verbose descriptions of storage/binding behavior unless the Admin needs that information to make a decision.

## 9. Empty states

An empty state should answer only what is unavailable and, when useful, the next action.

Preferred:

- **No schedules are available for this Applicant’s Program.**
- **No examination records found.**
- **No pending waiver requests.**

Do not add generic escalation instructions when the current user owns the relevant workflow.

## 10. Blocked states

State the blocker directly.

Preferred:

- **This Applicant already has an examination record.**
- **Program alignment or waiver clearance is required before assignment.**
- **This schedule is full.**

Add the next action only when it is not obvious from surrounding controls.

## 11. Validation and errors

Validation should be:

- specific;
- concise;
- written in user language;
- limited to information the current role can act on.

Do not expose raw exceptions, model names, route names, SQL/database terms, raw enums, internal IDs, transaction mechanics, or hidden authorization implementation.

For role-sensitive errors, present different levels of detail where appropriate:

- Applicant: safe, actionable availability/status message;
- Admin: detailed operational/configuration message;
- diagnostic/audit surfaces: technical detail only when explicitly appropriate.

## 12. Confirmations

A confirmation should explain the direct consequence when it is consequential or irreversible.

Good:

> **Once finalized, the report can no longer be edited.**

Do not add unrelated workflow narration merely to make the dialog feel complete.

For reversible/low-risk actions, avoid unnecessary “Are you sure?” dialogs when normal UI feedback is sufficient.

## 13. Buttons and actions

Use task verbs:

- **Start Examination**
- **Review Assignment**
- **Save Configuration**
- **Finalize Result**
- **Reconsider Result**

Do not use internal lifecycle verbs merely because they exist in service/model code.

Use one accepted phrase consistently for the same action across pages.

## 14. Terminology preservation

Concise wording must not weaken or alter:

- academic terminology;
- official EARIST terms;
- workflow authority;
- legal/document language;
- role ownership;
- status meaning.

Shorter is better only when meaning remains exact.

## 15. Current Entrance Examination microcopy decisions

These decisions come from project-owner manual QA on 2026-11-05 and are canonical for future corrections of the affected surfaces.

| Context | Preferred wording |
|---|---|
| Admin Applicant eligible | **Eligible for assignment.** |
| Admin blocking exam record | **This Applicant already has an examination record.** |
| Admin no program schedule | **No schedules are available for this Applicant’s Program.** |
| Applicant ordinary appointment heading | **Scheduled Examination** |
| Applicant before scheduled start | **You can start your examination at [time].** |
| Applicant after early-start authority is granted | **You may start your examination now.** |
| Applicant blocked by incomplete Admin configuration | **The examination is not available yet.** |
| Active exam save reassurance when needed | **Your answers are saved automatically.** |
| Admin timezone label | **Timezone** |
| Admin timezone value | **Philippine Time (Asia/Manila)** |
| Applicant submitted heading | **Examination Submitted** |
| Applicant submitted timestamp | **Submitted** |
| Applicant complete answer summary | **All [N] questions were answered.** |
| Applicant incomplete answer summary | **[X] of [N] questions answered. [Y] questions were left unanswered.** |
| Applicant post-submit state | **Awaiting evaluation** |
| Admin timing section | **Exam Timing** |
| Admin scheduled timestamp | **Scheduled** |
| Admin actual-start timestamp | **Started** |
| Admin deadline timestamp | **Ends** |
| Admin computed academic outcome | **Computed Result** |
| Admin reconsidered authority | **Final Decision: Passed — Reconsidered** |

The following are not approved ordinary portal wording:

- **No examination record prevents assignment.**
- **Contact the schedule administrator.** on the Admin scheduling surface.
- **Start Now authorization is required for early entry.**
- **Refreshing restores the same deadline, questions and saved answers.**
- **Complete Exam Configuration, including the passing percentage, before starting.** shown to an Applicant.
- **Asia/Manila — system-defined, read-only.**
- **Original appointment** when there is no replacement/history comparison context.
- **Finalized:** as the ordinary Applicant submission timestamp label.
- **Individual deadline** as ordinary Admin-facing timing language.
- **Actual examination start** when **Started** communicates the same fact.
- **Percentage (display rounded)** in ordinary result presentation.
- **The result uses the exact score comparison before display rounding.** in ordinary portal UI.
- raw receipt UUID as primary Applicant-facing success content; use **Submission Reference** only in secondary details when needed.

## 16. Required microcopy review gate

Any implementation package that adds or changes visible copy must explicitly review:

```text
□ shortest truthful wording
□ one state, one message
□ no inverse-condition restatement
□ no duplicated page/dialog context
□ no obvious consequence narration
□ no backend/internal phrasing
□ role-aware information boundary
□ no instruction for the current role to contact itself
□ next action only when useful
□ exact academic/institutional terminology preserved
□ Applicant/Admin detail level appropriate to the actor
□ confirmation explains only necessary consequence
```

## 17. Agent implementation rule

Before implementing or refining any user-facing text, coding/review agents must read this document.

If exact wording is already approved here or in a more specific accepted package, use it as normative visible copy.

If the existing UI violates this source of truth:

- do not silently broaden an unrelated functional package into a system-wide copy rewrite;
- record the finding;
- fix it in the current package only when presentation/copy scope is authorized;
- otherwise create a bounded copy correction or address it during manual QA cleanup.

Automated tests should verify critical state meaning and normative labels where valuable, but should not make every sentence a brittle exact-string contract. Project-owner/manual review remains the final quality gate for naturalness, redundancy, and role context.

## 18. Relationship to UI/UX documentation

The UI/UX playbook governs layout, hierarchy, interaction patterns, component use, workflow presentation, and visual/structural behavior.

This document separately governs **the words users read**.

The UI/UX playbook may reference this source but should not duplicate its detailed microcopy rules.
