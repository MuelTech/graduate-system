# Defense Session & Thesis Journey Correction — Design Specification

**Date:** 2026-09-26  
**Branch:** `refactor/defense-workflow-corrections`  
**Status:** Canonical correction design after manual QA and client workflow clarification  
**Canonical parent:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Implementation plan:** `docs/superpowers/plans/2026-09-26-post-qa-defense-workflow-corrections.md`

---

## 1. Purpose

This document captures the workflow corrections discovered after WP1–WP13 manual QA and the client/form clarifications gathered on 2026-09-26. The completed Student Thesis Journey branch was first integrated into `refactor/defense-workflow`; implementation of these corrections continues on `refactor/defense-workflow-corrections`.

It is normative for the next implementation pass. Where this document conflicts with the 2026-09-25 Student Thesis Journey design or plan, this document wins.

This correction covers:

- Student status and UI/UX consistency;
- Admin review/scheduling visibility;
- Title Defense completion semantics;
- Adviser review/certification before Proposal/Final Admin review;
- Proposal/Final evaluator scoring and e-signature;
- Chairman conclusion authority;
- Rapporteur/RAP workflow;
- role-aware Defense Workspace;
- Proposal-to-Final revision traceability;
- current implementation/security gaps.

Do not infer institutional rules that are still marked OPEN_QUESTION.

---

## 2. Rule labels

- **CONFIRMED_CLIENT** — explicitly confirmed by the client/project owner.
- **SUPPORTED_FORM** — supported by the current EARIST forms/guides supplied to the project.
- **CONFIRMED_PROJECT_DESIGN** — accepted system behavior for this implementation.
- **IMPLEMENTATION_GAP** — current branch behavior does not yet match the canonical rule.
- **OPEN_QUESTION** — do not hard-code without later confirmation.

---

## 3. Canonical end-to-end sequence

```text
Comprehensive Examination PASSED
        ↓
Title Defense application
        ↓
Admin review
        ↓
APPROVED
        ↓
Admin schedules defense + assigns committee
        ↓
Title Defense
- panel reviews 3 proposed titles
- one official title is selected
- Rapporteur records minutes/recommendations
- Chairman records formal result
        ↓
Title RAP sent for required digital signatures
        ↓
Title RAP FINALIZED
        ↓
If formal Title result is PASSED
+ official title exists
+ required Title RAP is finalized
        ↓
Title Defense COMPLETED
        ↓
Adviser Request
        ↓
Adviser CONFORME
        ↓
Dean approval
        ↓
Active AdviserAssignment
        ↓
Student uploads Proposal manuscript
        ↓
Adviser reviews manuscript
        ├─ needs changes → returns to Student for continued editing
        └─ acceptable → e-signs Proposal Adviser Certification
        ↓
Proposal application becomes Admin-reviewable
(Student also satisfies stage COR + defense-fee proof)
        ↓
Admin review → approve → schedule + assign committee
        ↓
Proposal Defense
- evaluators review manuscript
- Group I / Group II evaluation
- recommendations
- evaluator e-sign + finalize
- Rapporteur prepares defense summary/RAP
        ↓
System generates Oral Examination Summary Sheet
        ↓
Chairman records formal result
        ↓
Required RAP signatures
        ↓
Proposal RAP FINALIZED
        ↓
Student continues/revises research toward Final
(no separate Proposal-revision upload workflow)
        ↓
Student uploads Final manuscript
        ↓
Adviser reviews + e-signs Final Adviser Certification
        ↓
Final application becomes Admin-reviewable
        ↓
Admin review → approve → schedule + assign committee
        ↓
Final Defense
- evaluators can view Proposal history/RAP + current Final manuscript
- Group I / Group II evaluation
- evaluator e-sign + finalize
- Rapporteur prepares Final RAP
        ↓
System generates Oral Examination Summary Sheet
        ↓
Chairman records formal result
        ↓
Required RAP signatures
        ↓
Final RAP / post-defense completion
```

---

## 4. Student Journey and status UX

The centralized Journey states remain:

- `COMPLETED`
- `CURRENT`
- `AVAILABLE`
- `WAITING`
- `LOCKED`

These are coarse journey states. Each defense page must also expose the student's actual administrative/session substatus.

### 4.1 Required defense-page statuses

For Title, Proposal, and Final where applicable, Student UI must distinguish:

```text
Not submitted
→ Application submitted / under Admin review
→ Application approved / waiting for scheduling
→ Defense scheduled
→ Defense in progress
→ Finalizing defense result / RAP
→ Completed / formal result available
```

A single generic heading such as **Application under review** must not represent every `WAITING` state.

When scheduled, Student should see the schedule summary when available:

- defense date;
- defense time;
- venue or meeting link;
- defense type;
- relevant status.

The central Journey DTO/read model may be extended with a scoped schedule/session summary so individual Student pages do not invent their own progression logic.

### 4.2 Cross-role freshness

Admin/Chairman/Rapporteur actions can change Student-visible state while the Student page is already open.

The UI must not remain indefinitely stale. Use a controlled mechanism such as:

- polling only while the step is `WAITING` / active; and/or
- an explicit **Refresh Status** action;
- normal query invalidation after Student-originated mutations.

A real-time socket architecture is not required for this correction.

---

## 5. Title Defense

### 5.1 Confirmed Title Defense behavior

**CONFIRMED_CLIENT**

1. Student proposes three research titles.
2. The panel reviews the three proposals during Title Defense.
3. One title is selected from the three during the defense.
4. Rapporteur records the defense minutes/recommendations.
5. The system prepares the Title RAP.
6. The required panel signatories approve the Title RAP through digital e-signature.
7. The final Title result/title/RAP are recorded in the Student's system history.

### 5.2 No Group I / Group II scoring for Title

The Group I / Group II Oral Examination Criteria workflow described in Section 9 is for Proposal and Final Defense in the current confirmed design.

Do not require Proposal/Final-style numerical Group I / Group II scoring to complete Title Defense unless the client later explicitly changes this rule.

### 5.3 Title conclusion and completion

The Chairman is the formal result authority.

For a successful Title stage, the system must have:

- formal Title result = `PASSED`;
- one official selected title from the submitted three;
- finalized Title RAP with all required signatures.

Only then:

```text
Title Defense = COMPLETED
Adviser Request = CURRENT / AVAILABLE
```

A selected title by itself must not unlock Adviser Request.

A formal `PASSED` result by itself must not unlock Adviser Request if the required Title RAP is still incomplete.

Student may see an intermediate message such as **Finalizing Title Defense records** while the selected title/result/RAP are still being completed.

---

## 6. Adviser Request

Adviser Request remains:

```text
Student selects eligible candidate from own Title Defense panel
→ Adviser CONFORME / Decline
→ Dean Approve / Reject
→ active AdviserAssignment only after Dean approval
```

Backend unlock must require the completed Title stage described in Section 5.3.

A pending/conformed request is not an active assignment.

---

## 7. Proposal and Final pre-defense Adviser review

The Adviser Certification form supplied to the project states that the manuscript was **reviewed and certified as eligible** for Proposal or Final Defense and includes the Adviser's signature.

Therefore Adviser Certification is not merely a pre-existing checkbox. It is a first-class workflow.

### 7.1 Proposal

```text
Student has active adviser
        ↓
Student uploads Chapters 1–3 manuscript
        ↓
Manuscript goes to active Adviser review
        ├─ Adviser requests changes → Student continues editing/resubmits manuscript for Adviser review
        └─ Adviser accepts manuscript
                ↓
Adviser e-signs Proposal Adviser Certification
                ↓
Proposal is eligible for Admin application review
when the remaining Student-owned requirements are present
```

### 7.2 Final

Same pattern using the complete Final manuscript and a Final-stage Adviser Certification.

### 7.3 Evidence ownership

System-owned evidence must be referenced internally, not downloaded and re-uploaded:

- Comprehensive Exam result/certificate;
- prior-stage finalized RAP;
- Adviser Certification;
- formal defense result;
- selected official title.

Student-owned/external digital evidence remains uploaded:

- manuscript;
- current COR;
- stage-specific defense-fee proof.

Physical requirements such as envelopes/ring binding are office instructions/checklist items, not digital uploads merely because they appear on the paper guide.

---

## 8. Defense Workspace

The current Defense Lobby is not the target UX. The next implementation should use a role-aware **Defense Workspace**.

### 8.1 Desktop layout

For an evaluator:

```text
┌──────────────────────────────┬──────────────────────────────────┐
│ MY EVALUATION                │ STUDENT DOCUMENT                 │
│                              │                                  │
│ Group I / Group II           │ embedded PDF/document viewer     │
│ recommendations              │                                  │
│ save draft                   │                                  │
│ review + e-sign + finalize   │                                  │
└──────────────────────────────┴──────────────────────────────────┘
```

Recommended ratio is roughly 40–50% action area and 50–60% document viewer. Exact pixel ratio is responsive, not contractual.

On narrow/mobile layouts, use tabs/stacking such as **Evaluation | Document** rather than squeezing both columns.

### 8.2 Role-aware behavior

Per defense assignment:

- **CHAIRMAN** — own evaluation when the stage uses numerical evaluation; access to consolidated summary; records formal result; Title conclusion also records the selected official title.
- **PANELIST / evaluator** — views relevant Student material and edits only own evaluation.
- **RAPPORTEUR** — views relevant Student material and edits the Defense Notes/RAP workspace.
- **FACILITATOR** — no dedicated digital workflow in the current scope; may remain visible in roster/schedule.
- **ADVISER**, when present in a defense roster — no scoring permission unless explicitly configured/confirmed.

The functional role is per defense session. A user may have different assignments in different sessions.

### 8.3 Document access

Assigned participants must only receive access to documents relevant to the defense/stage they are assigned to.

A Title assignment must not automatically grant access to a future Final manuscript solely because all documents belong to the same thesis record.

---

## 9. Proposal / Final evaluator scoring

### 9.1 Individual Oral Examination Criteria

Each required evaluator completes their own form.

**Group I**

- Timeliness and relevance of study to educational goals
- Organization
- Depth / comprehensiveness of treatment
- Relevance of conclusions and recommendations
- Evidence of original thinking

**Group II**

- Presentation
- Mastery of subject matter
- Communication skill
- Attitude / receptiveness to suggestions

The system calculates Group I average, Group II average, and any confirmed overall numeric average.

Do not invent an institutional weighting or grade-boundary formula that is not explicitly supported.

### 9.2 Privacy / ownership

During evaluation:

- evaluator sees/edits only their own score sheet;
- evaluator must not overwrite another evaluator's score;
- the backend must bind the evaluation to the authenticated user's `PanelAssignment`;
- do not trust a client-supplied `panelId` as ownership proof.

### 9.3 Draft and finalization lifecycle

Required UX:

```text
DRAFT
→ Save Draft
→ Review Evaluation
→ E-sign
→ Finalize
→ LOCKED
```

After finalization, normal editing is disabled.

If the institution later requires correction of a finalized evaluation, implement a separate authorized reopen/audit action; do not silently overwrite a signed record.

The e-signature on the individual evaluation is separate from the later RAP signature.

### 9.4 Finalized individual evaluation is an official defense record

The web evaluation form is the data-entry interface; the finalized record must be reproducible as the official **Oral Examination Criteria** output for that evaluator.

A finalized evaluator record should preserve at minimum:

- Candidate;
- Course/Program;
- Defense date;
- Group I criterion selections and Group I average;
- Group II criterion selections and Group II average;
- Recommendations;
- Summary of Evaluation / Rating / Remarks when supported by the form;
- evaluator printed name;
- evaluator digital signature;
- finalized/signed timestamp;
- defense session and evaluator-assignment identity.

Once `FINALIZED`, the record is read-only through the normal workflow and becomes available as a printable/downloadable official output.

Draft or unsigned evaluations must not be presented as official printable copies.

---

## 10. Oral Examination Summary and formal result

After all required Proposal/Final evaluator score sheets are finalized:

1. system consolidates evaluator Group I / Group II results;
2. system generates the Oral Examination Summary Sheet data;
3. system displays the grade/averages;
4. system does **not** automatically declare PASS/FAIL from that number;
5. Chairman records the formal result.

**CONFIRMED_CLIENT:** Chairman is the formal result authority.

The software must not implement an automatic PASS/FAIL threshold unless the client later supplies the exact institutional rule and explicitly asks for automation.

### 10.1 Summary generation

The Oral Examination Summary is derived from the finalized individual evaluator records. It must not require Admin or Chairman to re-encode the same scores manually.

Before every required evaluator is finalized, the system should show progress such as:

```text
Evaluations finalized: 3 of 5
Summary: Not ready
```

After every required evaluator is finalized:

```text
Evaluations finalized: 5 of 5
Summary: Ready
```

The generated summary becomes a persistent defense-session record and a printable/downloadable official output.

### 10.2 Admin Defense Records / Official Outputs

Admin must have read-only access to the finalized official records of a defense session.

Recommended navigation:

```text
Admin
→ Thesis / Dissertation
→ Defense Records
→ [Student / Defense Session]
```

A defense-record page should expose:

```text
Defense Overview
- Student
- Program
- Defense type
- Date / time / venue
- Committee / role assignments
- Formal result
- Record status

Individual Evaluations
- Evaluator / role
- Draft / Finalized state
- View finalized record
- Print / Download finalized Oral Examination Criteria

Oral Examination Summary
- View
- Print / Download

RAP Report
- Signature progress
- View finalized report
- Print / Download when finalized
```

Admin does not edit academic scores through this page and does not become the academic-result authority. It is an official-record/reporting surface.

Only finalized/signed records may be labeled or rendered as official outputs. A preview may exist for authorized workflow users, but drafts must be clearly marked non-official.

---

## 11. Rapporteur and RAP

### 11.1 During defense

The Rapporteur works during the defense, not as a later unrelated process.

The Rapporteur workspace should support draft notes for:

- summary/minutes of discussion;
- panel recommendations;
- requested revisions;
- important decisions.

Draft notes are internal. Student must not see live unfinished notes.

### 11.2 Finalization

After deliberation/evaluations are complete, the Rapporteur finalizes the official summary/RAP content.

The system then routes the RAP to the required signatories for digital e-signature.

Current confirmed direction:

- Proposal/Final RAP signatories are the participants assigned to evaluation/scoring for that defense;
- Title RAP is approved by the required Title panel signatories after title deliberation.

Exact printed RAP/PDF layout remains an OPEN_QUESTION until an authoritative RAP format is supplied. The system may still expose the finalized RAP record for view/download; it must not invent an EARIST facsimile layout that has not been provided.

### 11.3 Student visibility

Student sees only the official RAP state/output:

```text
RAP being finalized
→ RAP awaiting signatures
→ RAP finalized
→ View / Download official report
```

A system-generated RAP automatically satisfies the next stage's prior-RAP requirement when finalized.

Never require:

```text
system-generated RAP
→ Student downloads it
→ Student uploads the same RAP back
```

---

## 12. Proposal revisions and Final Defense history

There is no separate Proposal-revision upload/clearance workflow in the current confirmed flow.

After Proposal Defense:

- panel recommendations/revisions are preserved in the Proposal RAP;
- Student continues working on the research;
- Student does not upload a special revised Proposal file solely to prove each revision;
- when applying for Final, Student uploads the current Final manuscript.

During Final Defense, panel members should be able to review:

- prior Proposal manuscript;
- finalized Proposal RAP/recommendations;
- current Final manuscript.

The system may provide side-by-side/history/compare UX as a convenience, but it must not automatically claim that a recommendation was academically satisfied. That judgment remains with the panel.

---

## 13. Admin workflow

Admin handles operational/administrative transitions:

```text
Application submitted
→ Admin review
→ Approved
→ Committee assignment
→ Schedule
→ notifications
```

Admin approval is not academic PASS.

Admin scheduling is not academic PASS.

Formal academic result is recorded by the Chairman.

After a defense is completed, Admin's operational responsibility includes access to the read-only Defense Record and its finalized official outputs; this does not give Admin permission to change evaluator scores or replace the Chairman's formal conclusion.

The Student-facing status must reflect Admin actions clearly instead of remaining in a generic review state after approval/scheduling.

---

## 14. Panelist dashboard direction

The current dashboard is not final.

The dashboard should answer: **What requires my attention now?**

Recommended summaries:

- upcoming defenses;
- evaluations to complete;
- RAP reports awaiting signature;
- Adviser Requests requiring response;
- adviser availability;
- recent important activity.

The dashboard is a summary/navigation surface. Actual defense work belongs in the Defense Workspace.

Each defense card should show the user's role for that specific defense.

---

## 15. Research Variables

**CONFIRMED_PROJECT_DESIGN FOR THIS CORRECTION:** Disable Research Variables as an active blocking gate for Proposal until the responsible actor, applicability decision, and approval flow are clarified.

Do not delete historical schema/data merely to disable the gate.

Do not ask the Student to self-certify `NOT_APPLICABLE` unless the client later confirms that authority.

---

## 16. Current implementation gaps to correct

The following are known gaps at the accepted pre-correction branch baseline:

1. Student Title `WAITING` page uses the generic heading **Application under review** even when backend detail represents approved/scheduled states.
2. Student Journey does not expose enough schedule detail for date/time/venue presentation.
3. Journey queries can remain stale during cross-role updates because the global query config does not refetch on window focus and no waiting-state polling exists.
4. Proposal eligibility currently mixes formal Journey authority with compatibility `ThesisRecord.stage/outcome` fields.
5. Proposal eligibility currently reports Title pass/RAP conditions in overlapping ways.
6. Research Variables currently blocks Proposal although the operational flow is not confirmed.
7. AdviserCertification schema/eligibility exists but the active Adviser review/e-sign issuance workflow is incomplete.
8. The same gap applies to Final Adviser Certification.
9. Current deterministic Journey fixtures directly create formal outcomes but do not reproduce all RAP/certification/variable side effects needed by application eligibility.
10. Current Defense Lobby mixes panel roster, Rapporteur notes, conclusion controls, and prototype live-session UI.
11. Panelist UI shows a **Conclude Defense** action while the current route is account-role restricted to ADMIN; canonical authority is now Chairman by defense assignment.
12. Current score submission accepts a client-provided `panelId` without sufficiently binding ownership to the authenticated evaluator.
13. Current score persistence has no complete DRAFT → e-sign → FINALIZED lifecycle for individual evaluator forms.
14. Existing e-signature implementation covers RAP signatures, not the individual Oral Examination Criteria signature.
15. Rapporteur notes update authorization must verify authenticated user is the assigned `RAPPORTEUR` for that defense.
16. Current thesis-document authorization is thesis-wide for assigned panelists; target access should be stage/session-scoped.
17. Student has no canonical read/download surface for finalized prior-stage RAP in the Thesis Journey.
18. Panelist dashboard is assignment-oriented but not yet the final actionable-summary dashboard.

---

## 17. Open questions that must stay open

Do not silently hard-code:

- exact Master's/Doctoral evaluator count where current sources conflict;
- whether Adviser consumes a defense committee seat or scores;
- exact RAP PDF layout;
- exact form-specific signatory placement beyond the confirmed workflow responsibility above;
- exact grading/average-to-rating boundary formula;
- automatic PASS/FAIL thresholds;
- Research Variables responsible actor/applicability workflow;
- revision versus re-defense institutional terminology after an unsuccessful defense;
- post-Final correction-clearance authority;
- long-term STRIKE requirement;
- post-Final repository completion details not already confirmed.

---

## 18. Non-negotiable invariants

1. Application APPROVED != defense PASSED.
2. Scheduled != completed.
3. Score completion != formal conclusion.
4. Oral Exam Summary numeric grade != automatic PASS/FAIL.
5. Chairman is the formal result authority.
6. Title has no Proposal/Final-style Group I/II scoring in the current confirmed design.
7. Title Adviser Request unlock requires PASSED + selected title + finalized required Title RAP.
8. Requested adviser != active adviser.
9. Adviser CONFORME != Dean approval.
10. Proposal/Final Adviser Certification is produced by Adviser review/e-sign, not Student re-upload.
11. System-owned RAP is never re-uploaded by Student to satisfy the next stage.
12. Proposal revisions are carried in RAP/history and checked at Final; no separate revision-upload gate.
13. Research Variables does not block Proposal in this correction pass.
14. Evaluator can only edit/finalize their own evaluation.
15. Rapporteur draft notes are not Student-visible.
16. Defense document access must be stage/session appropriate.
