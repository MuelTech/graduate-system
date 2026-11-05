# EXAM-B10-MQA-UI — Entrance Examination UI & Content Refinement

**Status:** IMPLEMENTED — INDEPENDENT REVIEW AND PROJECT-OWNER VISUAL ACCEPTANCE PENDING
**Date:** 2026-11-05  
**Branch:** `feat/exam-engine-scheduling`

## 1. Purpose

Project-owner manual/browser QA of the Phase B Entrance Examination flow found that the underlying exam behavior is largely correct, but several Applicant/Admin surfaces present authoritative data with weak information hierarchy, redundant fields, overly technical wording, and engineering/audit details that are too prominent for ordinary operational use.

This specification records the **presentation correction target only**.

It does **not** authorize changes to:

- scheduling/capacity rules;
- Program scoping;
- start/deadline authority;
- draft persistence;
- finalization;
- essay grading;
- B8 scoring;
- B9 reconsideration authority;
- database schema/migrations;
- email integration.

## 2. Governing sources

Implementation must read:

- `docs/superpowers/USER_FACING_COPY_SOURCE_OF_TRUTH.md`
- `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`
- `docs/superpowers/ui-ux/UI_UX_AUDIT.md`
- `docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md`
- `docs/superpowers/reports/2026-11-05-exam-b10-lifecycle-acceptance.md`

The User-Facing Copy Source of Truth governs visible wording. This document governs the **Exam-specific information architecture and composition** discovered during owner QA.

## 3. Manual-QA findings

### 3.1 Admin — Assign Applicant dialog

Observed problems:

- positive eligibility text explains the inverse condition;
- blocking text appends an obvious consequence;
- empty state tells an Admin to contact the schedule administrator;
- wording is longer than necessary.

Canonical target wording:

- **Eligible for assignment.**
- **This Applicant already has an examination record.**
- **No schedules are available for this Applicant’s Program.**
- **Program alignment or waiver clearance is required before assignment.**

Do not change eligibility, Program matching, capacity, or record-blocking behavior in this presentation package.

### 3.2 Applicant — pre-start examination state

Observed problems:

- **Original appointment** shown even when no replacement/reschedule context exists;
- **Examination not started.** repeats an obvious state;
- **Start Now authorization is required for early entry.** exposes an Admin/internal mechanism;
- refresh/deadline/question-recovery invariants are narrated as product copy;
- incomplete Admin configuration leaks exact Admin-only configuration detail to Applicant.

Target presentation:

- heading: **Scheduled Examination**;
- show Program and scheduled date/time once;
- before normal start: **You can start your examination at [time].**;
- after authorized early start: **You may start your examination now.**;
- if Admin configuration prevents start: **The examination is not available yet.**;
- do not display server/deadline/recovery implementation explanations;
- show save reassurance only when useful during the active exam: **Your answers are saved automatically.**

### 3.3 Admin — Exam Configuration

Observed problems:

- **Institutional Timezone** plus **system-defined, read-only** exposes implementation-oriented wording;
- configuration guidance reads like technical documentation.

Target:

- label: **Timezone**;
- value: **Philippine Time (Asia/Manila)**;
- no “read-only” prose when the value is already non-editable;
- concise guidance such as:
  **Complete all fields to enable new examinations. Passing Threshold must be between 0% and 100%. Changes apply only to new examinations.**

Do not change the underlying four required values, percentage semantics, or frozen-start behavior.

### 3.4 Applicant — submitted examination state

Observed problems:

- flat list of technical lifecycle evidence;
- raw receipt UUID given primary visual weight;
- **Finalized** is implementation/lifecycle wording;
- deadline remains prominent after submission;
- duplicate/unnecessary explanatory prose;
- complete submissions still show generic unanswered-item language;
- weak next-action hierarchy.

Target hierarchy:

1. **Examination Submitted**
2. short success confirmation;
3. concise submission summary:
   - **Submitted**
   - **Questions answered**
   - **Status: Awaiting evaluation**
4. one primary **View Examination Status** action;
5. optional/secondary **Submission details** for technical evidence if operationally needed:
   - Submission Reference
   - Started

Do not show deadline as primary post-submit information unless a later policy gives the Applicant a real use for it.

Conditional answered copy:

- complete: **All 73 questions were answered.**
- incomplete: **68 of 73 questions answered. 5 questions were left unanswered.**

Do not show **Unanswered items remain unanswered.**

### 3.5 Admin — Exam Record timing

Observed problems:

- **Examination Start / Original appointment / Start Now authorization / Actual examination start / Individual deadline** reads like domain/debug evidence;
- **Not authorized** is shown even when no early-start event was relevant;
- timing facts repeat elsewhere.

Target section:

**Exam Timing**

- **Scheduled**
- **Started**
- **Ends**

Only show early-start authority when it is operationally relevant before start or when explicit historical/audit inspection is requested. Do not show a default **Not authorized** row on an already-started normal examination.

Use **Original Schedule / Rescheduled To** only when a real replacement/history comparison exists.

### 3.6 Admin — Exam Record result and assessment

Observed problems:

- result repeated across **Current Exam State**, **Institutional Decision**, **Exam Information**, and **Assessment**;
- Program/date/time duplicated despite already appearing in identity/timing sections;
- **Percentage (display rounded)** and exact-comparison explanation expose verification implementation;
- one oversized Assessment card mixes score summary, result, timestamps, essay prompt/response, evaluator data, and institutional decision;
- reconsideration is technically correct but visually confusing because raw **FAILED** and effective **PASSED — RECONSIDERED** are repeated without hierarchy.

Target hierarchy:

1. **Applicant identity**
   - Name
   - Pinnacle Applicant ID
   - Program
   - View Applicant Profile

2. **Examination Result**
   - prominent effective/current institutional result;
   - compact score summary:
     - MCQ
     - Essay
     - Total
     - Score percentage
     - Passing Threshold
   - show **Computed Result** once;
   - if reconsidered, show **Final Decision: Passed — Reconsidered** distinctly.

3. **Exam Timing**
   - Scheduled
   - Started
   - Ends

4. **Essay Evaluation**
   - Question
   - Applicant response
   - Score
   - Evaluated by
   - Evaluated on

5. **Reconsideration**
   - render only when a reconsideration exists or when the action is currently available;
   - when recorded:
     - **Passed — Reconsidered**
     - Reason
     - Decided by
     - Decision date
   - original computed result remains visible once and immutable.

Remove the separate **Exam Information** card when its Program/date/time/state fields duplicate identity, timing, or result sections.

Do not display:

- **Percentage (display rounded)**
- **The result uses the exact score comparison before display rounding.**

Those remain implementation/test/audit facts, not primary Admin record copy.

### 3.7 Result Email section

Email Integration is explicitly deferred from B10 core acceptance.

Do not redesign or claim acceptance of:

- Send Result Email;
- queue/delivery state;
- worker/Redis behavior;
- current-actor authorization;
- retry/failure semantics.

A future Email Integration package owns this section.

## 4. General Exam record information-architecture rule

The Exam Record should be **information-rich but scannable**, not a flat dump of every persisted field.

A fact should have one primary home:

- identity → header;
- effective/current result → result summary;
- computed score → result summary;
- timing → timing section;
- essay evidence → essay section;
- reconsideration authority → reconsideration section;
- audit/technical evidence → secondary details/history when needed.

Do not repeat the same status/result/date/program in multiple equal-weight cards merely because each backend object exposes it.

## 5. Visual hierarchy target

For Admin record detail:

```text
Applicant identity
      ↓
Examination Result
      ↓
Exam Timing
      ↓
Essay Evaluation
      ↓
Reconsideration / institutional exception when applicable
      ↓
Deferred Email Integration (future package)
```

For Applicant terminal state:

```text
Outcome / current state
      ↓
small summary
      ↓
one clear next action
      ↓
optional secondary technical details
```

Avoid large empty cards whose only purpose is to repeat information already present above.

## 6. Data minimization vs authority

Presentation cleanup must not delete authoritative backend evidence.

It is acceptable to:

- remove a duplicated field from the primary UI;
- rename an implementation-oriented label;
- move technical evidence to secondary details;
- conditionally hide irrelevant rows;
- combine repeated data into one summary.

It is not acceptable to:

- recompute scores in the frontend;
- hide the original computed FAILED result after reconsideration;
- mutate historical schedule evidence;
- remove audit evidence from persistence;
- weaken role/authorization rules;
- invent a new status.

## 7. Manual QA acceptance criteria for a future correction

A future bounded implementation should prove:

- no runtime/domain behavior changed;
- each authoritative fact has one clear primary location;
- no repeated result/status cards without distinct purpose;
- Applicant pages expose no Admin/internal configuration or authorization mechanics;
- Admin pages remain operationally informative without raw implementation terminology;
- reconsidered results clearly distinguish **Computed Result** from **Final Decision**;
- desktop and narrow layouts remain readable;
- keyboard/dialog behavior is unchanged;
- wording matches `USER_FACING_COPY_SOURCE_OF_TRUTH.md`;
- Email Integration remains deferred.

## 8. Original documentation decision

These manual-QA findings **block final visual/content acceptance of B10**, but they do not invalidate the already-passed automated core examination behavior.

Implementation of this refinement is **not authorized by this documentation commit alone**. A separately bounded correction package should be authorized after owner review of this specification.

## 9. Owner-authorized implementation — 2026-11-06

The project owner separately authorized EXAM-B10-MQA-UI on the existing feature
branch. [Implementation, page-specific decisions and verification evidence](../reports/2026-11-06-exam-b10-mqa-ui.md): eight frontend files, no backend/read-model
change, six focused UI contract files / 136 tests PASS; TypeScript, scoped ESLint,
production build and diff check PASS. Canonical copy and the information hierarchy
above are applied. Independent review and owner manual/browser visual acceptance
remain pending. Email Integration remains deferred; B10/Phase B is not complete.
