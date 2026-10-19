# EARIST Collaborative Defense Workspace and RAP
## Canonical Source of Truth

**System:** EARIST Graduate School Information System (GS-IS)  
**Scope:** Collaborative Defense Workspace, evaluator experience, manuscript annotations, Rapporteur Committee Report / RAP, signatures, conclusion readiness, and defense-history review  
**Parent workflow authority:** docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md  
**Historical design baseline branch:** refactor/unified-defense-lifecycle  
**Implementation branch:** refactor/collaborative-defense-workspace  
**Accepted production implementation HEAD (CDW-0 through CDW-8):** `a9a179446284ea928faca8991de34deadc856e1b`  
**CDW-8C acceptance package HEAD:** `f6011c1eaa73706cce0fb950ceea2a64dad80fc7`  
**Accepted CDW-LIVE-1 core HEAD:** `0b06149889a1645919ecea557ca63562e1680208`  
**Accepted pre-CDW-9 product-code baseline:** `3e5ed6847db737e6395d531c04ee5f3b9b5c9812`  
**Latest pre-CDW-9 acceptance reconciliation:** `docs/superpowers/cdw-live-1/cdw-live-1-pre-cdw-9-acceptance-reconciliation-2026-10-19.md`<br>
**CDW-9A acceptance reconciliation:** `docs/superpowers/cdw-9/cdw-9a-acceptance-reconciliation-2026-10-19.md`<br>
**FIX-4 computation authority:** `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-4-oral-summary-computation-design.md`  
**Accepted pre-CDW-9 workflow/UX correction:** `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-6-parallel-report-signing-and-ui-language-design.md`  
**Document status:** CONFIRMED_PROJECT_DESIGN + IMPLEMENTED / ACCEPTED through FIX-6; parallel Evaluation / Committee Report sequencing, autosave-safe finalization, single-step Committee Report signing, and concise faculty UI are accepted; the project owner waived an additional full multi-user replay based on targeted regression evidence + independent source review under the risk-based verification policy; CDW-9 is NEXT / AUTHORIZED; its bounded execution plan is CDW-9A through CDW-9F in the implementation plan; CDW-9A through CDW-9D are ACCEPTED / CLOSED; CDW-9E is NEXT / AUTHORIZED — NOT YET IMPLEMENTED; CDW-9F remains PLANNED / NOT YET IMPLEMENTED unless a section is explicitly marked OPEN_QUESTION, DEFERRED, or HISTORICAL_BASELINE

**Version:** 1.10  
**Last updated:** 2026-10-19

---

## 0. Authority and relationship to the defense workflow SOT

This document extends the main Defense Workflow Source of Truth. The parent workflow document remains authoritative for the overall thesis/dissertation journey, eligibility, committee composition, Adviser workflow, defense outcomes, stage progression, and other cross-cutting academic rules.

This document is the canonical authority for the new collaborative Defense Workspace and for the RAP sequence that occurs inside that workspace.

Where older project documentation or current code conflicts with this document on the following bounded topics, this document controls for the new implementation:

- pre-defense committee review of the exact scheduled manuscript;
- the immersive Panelist/Rapporteur Defense Workspace;
- shared PDF highlights, annotations, comments, and replies;
- the digital individual Oral Examination evaluation experience;
- the Rapporteur Committee Report / RAP drafting experience;
- RAP freezing, review, signatures, and pre-conclusion finalization;
- conclusion readiness as exposed in the Defense Workspace;
- historical defense records and revision traceability across attempts and stages;
- the real-time synchronization layer.

The previously planned standalone WF-C1c package is absorbed into this design. Its core academic invariant remains mandatory: required evaluator records and the required RAP/signatures must be complete before the assigned Chairman records the formal verdict.

This Source of Truth remains the functional/domain authority. The dated implementation plan records package sequencing and implementation history. Later phase-specific technical notes may supplement implementation details, but they must not redefine the academic workflow or duplicate domain authority.

### 0.1 Status vocabulary used in this document

- CONFIRMED_PROJECT_DESIGN — agreed project behavior and implementation target.
- IMPLEMENTED_FOUNDATION — behavior implemented and accepted in `refactor/collaborative-defense-workspace` through CDW-8.
- IMPLEMENTED_ENHANCEMENT — behavior implemented after CDW-8 under the accepted CDW-LIVE-1 and bounded manual-QA fix packages.
- HISTORICAL_BASELINE — observed pre-CDW behavior retained only to explain migration/refactor history; it is not the current implementation.
- OPEN_QUESTION — requires explicit institutional/client confirmation before authority is expanded.
- DEFERRED — intentionally outside the accepted CDW-0 through CDW-8 foundation.

---

## 1. Purpose

The Defense Workspace should support the committee before, during, and after a defense without turning GS-IS into a general-purpose word processor.

The system should give authorized committee members one focused workspace where they can:

- review the exact manuscript assigned to the defense attempt;
- prepare before the defense by highlighting and commenting on the manuscript;
- conduct the official individual evaluation during the live defense;
- see shared committee discussion attached to the manuscript;
- allow the Rapporteur to prepare the official Committee Report / Suggestions of the Evaluation Committee;
- review and sign the exact frozen RAP content before the defense is concluded;
- revisit the completed attempt later in historical read-only mode;
- compare a later defense with relevant prior manuscripts, RAP recommendations, and historical annotations.

The system is Google-Docs-like only in review interaction. It is not collaborative editing of the student's manuscript.

---

## 2. Non-negotiable domain boundaries

The implementation must preserve these boundaries:

1. **Student manuscript**
   - The submitted defense manuscript/document is immutable evidence for the attempt.
   - Committee members do not edit the manuscript bytes.
   - A later revised manuscript is a new document/version, not an overwrite of historical evidence.

2. **Annotations and comments**
   - Highlights/comments are a separate collaboration layer bound to the exact defense attempt and exact document.
   - They do not alter the PDF.
   - They are not automatically part of the official RAP.

3. **Individual evaluation**
   - Chairman and assigned Panelists own their own Oral Examination evaluation.
   - Each evaluator drafts, reviews, e-signs, finalizes, and locks their own record.
   - An evaluator's formal evaluation signature is distinct from that person's later RAP signature.

4. **Committee Report / RAP**
   - The assigned Rapporteur owns the official report draft.
   - Other committee members may view the report while it is being prepared, but they do not directly edit its authoritative text.
   - The Rapporteur may use shared annotations/comments as source material, but inclusion in the official report is deliberate.

5. **Committee Report signatures**
   - Required signers review the same finalized, immutable report content.
   - Report-signing eligibility is independent of whether that signer's own evaluation is still DRAFT or already FINALIZED.
   - No signer may sign a report that can still be silently edited.

6. **Formal conclusion**
   - The assigned session Chairman alone records PASSED or REDEFENSE_REQUIRED.
   - Scores do not automatically determine the verdict.
   - The RAP is complete before the Chairman concludes the attempt.

7. **History**
   - A concluded attempt is immutable.
   - A later attempt or stage may read prior records for context but must not rewrite them.

---

## 3. Canonical workspace lifecycle

The Defense Workspace exists for the same schedule/attempt throughout four modes.

### 3.1 SCHEDULED — Pre-Defense Review Mode

Once a valid defense schedule exists and the committee assignment for that schedule is established, authorized assigned members may enter the Defense Workspace even if the defense date is still in the future.

Allowed:

- view the exact current manuscript for that scheduled attempt;
- highlight manuscript text;
- create shared comments;
- reply to shared comment threads according to role policy;
- review comments from other authorized committee members;
- review relevant prior defense history when applicable;
- Rapporteur may review committee annotations as preparation.

Not allowed:

- official Oral Examination scoring/finalization;
- evaluation e-signing;
- RAP signature;
- Chairman formal conclusion.

**New project rule:** official Oral Examination scoring opens only after the defense has been explicitly started and the session is IN_PROGRESS. This applies to Title, Proposal, and Final in the target collaborative workspace. It supersedes current transitional behavior that permits Proposal/Final evaluation while merely SCHEDULED.

### 3.2 IN_PROGRESS — Live Defense Mode

The Chairman starts the defense. The session becomes IN_PROGRESS.

Allowed:

- all pre-defense manuscript review actions remain available;
- Chairman and assigned Panelists complete their own official evaluations;
- evaluators save drafts;
- evaluators review, e-sign, finalize, and lock their evaluations;
- Rapporteur drafts the official Committee Report while discussion is occurring;
- Chairman/Panelists may view the Rapporteur's report draft read-only;
- the Rapporteur sees shared manuscript comments while drafting;
- the Rapporteur may deliberately add a shared annotation/comment as a source for an official report item.

The report may remain DRAFT while the Rapporteur is still authoring it, but it is not required to stay DRAFT until evaluator scoring is complete. Once the Rapporteur is satisfied with the report content, the Rapporteur may finalize the Committee Report for signatures during IN_PROGRESS. Required signers may then sign that finalized report immediately, even when one or more evaluator records are still DRAFT. Evaluation finalization and Committee Report signing are intentionally parallel workstreams.

### 3.3 AWAITING_CONCLUSION — Finalization Mode

AWAITING_CONCLUSION is a convergence gate, not a forced serial workflow.

During the live defense, these two workstreams may progress independently:

1. **Evaluation workstream**
   - Chairman and assigned evaluator Panelists complete their own evaluations;
   - each evaluator e-signs/finalizes their own record when ready;
   - once all required evaluator records are FINALIZED, the Oral Examination Summary is generated automatically/idempotently from those finalized records.

2. **Committee Report workstream**
   - Rapporteur authors the Committee Report;
   - once the report content is complete, the Rapporteur chooses **Finalize Committee Report**;
   - finalizing the report makes that report content read-only and creates/reconciles the stage-aware required Committee Report signature slots;
   - required signers may review and sign immediately;
   - a Chairman/Panelist does **not** need to finalize their own evaluation before signing the finalized Committee Report;
   - when all required report signature slots are signed, the Committee Report reaches its completed/finalized signing state.

For the current institutional matrix, the Oral Examination Summary remains generated from finalized evaluator rows using the confirmed FIX-4 computation:

- Summary Group A = finalized evaluator Group I Average;
- Summary Group B = finalized evaluator Group II Average;
- per-evaluator Summary Average = `(Group A + Group B) / 2`;
- Group I, Group II, and Summary Average are rounded to **2 decimal places**;
- Rating and Remarks remain deferred/null and do not block Summary generation or workflow progression;
- the Summary generator must be idempotent/race-safe when the last required evaluator finalizes.

The detailed computation authority is:
`docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-4-oral-summary-computation-design.md`.

The Chairman's Formal Verdict remains the strict convergence gate. PASSED or REDEFENSE_REQUIRED may be recorded only when all authoritative pre-conclusion requirements are satisfied:

- every required evaluator record is FINALIZED/e-signed;
- the Oral Examination Summary exists for the current schedule;
- the Committee Report exists and has been finalized for signing;
- every required Committee Report signature is complete;
- the Committee Report has reached its finalized/completed signing state;
- no prior DefenseConclusion exists.

Scores never auto-decide the verdict.

Internal implementation may retain `freeze`, frozen snapshot/hash, `FOR_SIGNATURE`, `RapReport`, and related legacy names. Those are integrity/lifecycle implementation concepts, not required faculty-facing wording.

### 3.4 CONCLUDED — Historical View-Only Mode

After the Chairman records the verdict:

- the defense session is CONCLUDED;
- evaluations are read-only;
- manuscript annotations/comments are read-only;
- Committee Report / RAP is read-only;
- signatures and timestamps are read-only;
- the formal verdict is read-only;
- no collaboration socket room is required when the attempt is reopened later.

The same workspace route may be reused as a historical viewer.

### 3.5 CANCELLED

Cancelled sessions must not accept new academic evaluation, RAP, signature, or collaboration writes. Historical operational metadata may remain readable according to existing authorization rules.

---

## 4. Committee assignment and workspace access

Committee assignment remains scoped to each defense schedule/attempt.

The system must not permanently bind one committee to the entire thesis journey.

Canonical behavior:

- Title Defense: Admin explicitly assigns the valid Title committee for that schedule.
- Proposal Defense: the active Adviser remains the authoritative automatic Adviser participant; Admin assigns the remaining committee according to the existing policy.
- Final Defense: same Proposal/Final committee policy.
- Re-defense: a new schedule/attempt receives a new assignment set.
- Admin may choose the same people again, but the system creates/uses the new schedule's assignments.
- A future convenience action may offer Use Previous Committee as a prefill, but it must not reuse old assignment rows or rewrite old history.
- Legitimate pre-start replacements remain possible through Admin committee management.
- Once the defense starts, normal roster editing is locked; any exceptional substitution requires a separate explicit amendment design.

A current committee member may be different from a prior-stage or prior-attempt member. Relevant historical manuscript/RAP/comment context remains available to the current authorized committee for revision verification even when membership changed.

---

## 5. Immersive Defense Workspace UX

### 5.1 Navigation model

The canonical route remains a dedicated defense workspace, for example:

    /panelist/defense-workspace/:scheduleId

Opening the workspace should navigate within the same authenticated application. It should not automatically open a new browser tab.

The active defense workspace uses an immersive, sidebar-free layout. The normal Panelist portal sidebar should not consume horizontal space while the committee is actively reviewing the defense.

A compact workspace header provides:

- Back to My Defenses;
- student name;
- defense stage/type;
- attempt indicator when relevant;
- date/time/venue context;
- current session mode/status;
- the current user's functional role;
- concise readiness indicators.

### 5.2 Desktop layout

The target desktop mental model is:

    LEFT = what I need to do
    CENTER = what we are reviewing
    RIGHT = what the committee is discussing

Layout:

    [Collapsible Role Rail] [Main Workspace] [Collapsible Shared Comments Rail]

The main workspace has two primary tabs:

- Committee Report
- Student Document

### 5.3 Collapsible role rail

For Chairman/Panelist:

- My Evaluation;
- Draft/finalized state;
- criteria;
- recommendations;
- evaluator autosave status only (for example Saving..., Saved, Offline, Save failed);
- one explicit **Review & Finalize** action while the evaluation is editable;
- compact finalized/locked confirmation after successful finalization.

The evaluator rail must not show a redundant manual **Save now** control when evaluation autosave is active.

For Rapporteur:

- Committee Report status using plain faculty-facing terms such as Draft, Ready for Signatures, Awaiting Signatures, and Complete;
- save/autosave state while editable;
- Preview Report / read-only report review;
- one explicit **Finalize Committee Report** action once the Rapporteur is satisfied with the report content;
- report finalization must not be blocked merely because evaluator records or the Oral Examination Summary are still incomplete;
- source-comment count or report-item summary where useful;
- signature-progress summary once the report enters the signing lifecycle.

Do not expose internal lifecycle wording such as **Freeze for Signatures**, **Confirm Freeze**, **Frozen version 1**, raw content-version numbers, snapshot/hash terminology, or unexplained RAP labels to ordinary faculty users.

Exact institutional-form preview, PDF generation, print CSS, and download/print rendering are deferred to a later unified Official Defense Forms / Document Processing phase.

For Adviser/Facilitator:

- role/status information and applicable read/sign actions only; no fabricated evaluator controls.

The rail can be hidden so the user can focus on the manuscript. Hiding the rail is presentation state only; it never changes academic workflow state.

When hidden, a compact indicator remains visible, for example Evaluation: Draft or Evaluation: Finalized.

### 5.3.1 Evaluation review, signature, and finalization UX

Evaluation finalization uses progressive disclosure and must not expand a signature form inline inside the narrow role rail.

Canonical evaluator interaction for both Chairman and Panelist:

```text
Edit evaluation
  -> autosave privately in background
  -> Review & Finalize
  -> Step 1: Review Evaluation
  -> Continue to Sign
  -> Step 2: E-Signature
  -> Confirm Finalize
  -> evaluation locked
```

Rules:

- Clicking **Review & Finalize** opens a centered modal/dialog; it does not finalize anything by itself.
- Step 1 summarizes the evaluator's current criteria, Group I / Group II values or averages according to the confirmed scoring model, and Recommendations.
- Step 1 actions are **Cancel** and **Continue to Sign**.
- Step 2 collects the evaluator's **drawn signature only** for the individual Oral Examination evaluation.
- The evaluator must not retype their own name as signature evidence. The printed evaluator name is system-derived from the authenticated schedule/committee assignment and is paired with the drawn signature when the official form is rendered.
- This rule applies to the individual evaluation only; shared signature components may retain other modes for other authorized document/signature workflows.
- The draw surface should be large enough for comfortable signing and centered within the modal rather than constrained to the left rail.
- Step 2 actions are **Back** and **Confirm Finalize**.
- **Confirm Finalize** is the final irreversible action and is the only point at which the existing finalize endpoint may be invoked.
- Before the final request, the client must drain/flush the evaluator's newest pending autosave through the existing serialized autosave pipeline. If that save fails, finalization must not proceed.
- Closing/cancelling the modal does not persist signature evidence and does not finalize the evaluation.
- After finalization, the evaluator controls become read-only and the rail shows a compact finalized state rather than an editable signature UI.
- The Chairman uses the same interaction for the Chairman's own individual evaluation.
- The Chairman's separate **Formal Verdict** control remains a distinct later workflow and must not be folded into the evaluation-signature modal.

Layout guardrails:

- the role rail is a scrollable stack of non-overlapping cards/sections;
- Evaluation Completion, Formal Verdict, Committee Roster, and similar Chairman-only controls remain separate from the evaluator finalization modal;
- opening the modal must not resize or overlap the underlying rail;
- the background workspace may remain visible but visually subdued while focus is trapped in the modal;
- keyboard focus, Escape/cancel behavior, labels, error states, and responsive sizing must remain accessible.

Detailed bounded design:
`docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-2-evaluation-finalization-ux-design.md`.

### 5.3.2 Chairman Formal Verdict readiness UX

The Chairman's Formal Verdict card is a faculty-facing readiness surface, not a diagnostic view of internal report/document lifecycle states.

Before the formal result controls become available, show only two concise readiness rows:

- **Evaluations** — `<finalized evaluators> of <required evaluators> finalized`;
- **Committee Report Signatures** — `<signed required report slots> of <required report slots> completed`.

If Committee Report signature slots do not yet exist, do not show misleading `0 of 0`. Show **Committee Report Signatures — Waiting for report** until the report has reached the state where required signer slots are known.

Do not expose these internal technical readiness terms as separate Chairman checklist rows:

- Oral Examination Summary ready;
- Committee Report frozen;
- RAP finalized.

Those backend requirements remain mandatory and server-authoritative. They are simply summarized into faculty-facing progress rather than presented as implementation terminology. The Committee Report row must not imply that report signing waits for evaluation completion; the two workstreams are independent until the final verdict gate.

When every authoritative conclusion gate is satisfied, expose the Formal Result selector and **Record Formal Verdict** action. Scores still never auto-decide the verdict.

### 5.3.3 Committee Roster collapse affordance

Committee Roster remains collapsible, but the control must visibly communicate that behavior.

Use a clear expand/collapse affordance such as a chevron next to **Committee Roster**. Prefer preserving native `<details>/<summary>` semantics and rotate/change the chevron for open state rather than building unnecessary custom accordion state.

Bounded refinement design:
`docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-3-signature-verdict-roster-ux-design.md`.

Latest acceptance reconciliation:
`docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-acceptance-reconciliation-2026-10-18.md`.

### 5.3.4 Committee Report signing presentation — FIX-5

The canonical Committee Report signer policy and backend signature gates do not change. FIX-5 changes only how signing is presented to faculty and how completed signature evidence is summarized across user surfaces.

For an authenticated committee member viewing a frozen Committee Report:

- keep the report body readable in the workspace;
- do **not** render the complete required-signer roster, other signers' names, or other signers' exact timestamps as a large inline block;
- aggregate progress such as `4 of 6 required signatures completed` may remain visible because it communicates readiness without turning the faculty workspace into an audit registry;
- a required signer sees only their own actionable state: **Sign Committee Report** while unsigned, then **You signed this Committee Report** with their own timestamp after signing;
- a committee viewer who is not a required signer sees no signing control;
- once the report is fully signed/finalized, faculty-facing copy uses **Committee Report finalized** rather than unexplained `RAP finalized`.

The finalized Committee Report is already visible in the workspace before the signing action. The signing interaction therefore opens directly to a single signature step:

1. open a centered modal from **Sign Committee Report**;
2. the modal opens directly to the signature pad and states the irreversible consequence;
3. collect a **draw-only** e-signature using the shared signature pad with typed signing disabled;
4. **Confirm Signature** invokes the existing authorized Committee Report signature endpoint;
5. opening or cancelling the modal never signs anything.

The full signer-level operational audit remains appropriate in **Admin Defense Records**, where the Committee Report section shows:

```text
Signer | Role | Signature Status | Signed At
```

This visibility split is presentation/privacy discipline, not a new authorization model. Raw signature images remain protected evidence and are not displayed in committee progress lists or realtime events.

### 5.3.5 Faculty/Admin terminology boundary — FIX-5

The project uses `RapReport`, `RapSignature`, and related `RAP` names internally for persistence and historical implementation compatibility. No authoritative project document establishes an official user-facing expansion of the acronym that should be shown to faculty or Admin users.

Until an exact institutional form title is separately confirmed, user-facing product copy should prefer:

- **Committee Report**;
- **Committee Report Signatures**;
- **Committee Report finalized**.

Avoid unexplained UI labels such as:

- `RAP / Committee Report`;
- `RAP finalized`;
- `RAP is created after the formal conclusion`.

The last statement is also workflow-stale: the Committee Report is authored, frozen, signed, and finalized **before** the Chairman may record the formal verdict.

Detailed bounded design:
`docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-5-committee-report-signing-defense-records-ux-design.md`.

### 5.4 Shared comments rail

The right-side Shared Comments rail is the committee discussion/reference surface.

When **Student Document** is active, the rail shows:

- Selected thread
- All comments
- author and defense role
- page/anchor context
- timestamps
- replies

Selecting a highlight focuses its thread. Selecting a comment in the list scrolls/focuses the corresponding PDF anchor.

For the **Rapporteur**, the Shared Comments rail remains available while either main tab is active:

- **Student Document:** comments remain directly connected to manuscript highlights/anchors; selecting a comment focuses the exact PDF context.
- **Committee Report:** the same committee comments remain visible as reference material while the Rapporteur writes. Eligible comments may expose **Insert into Report** without requiring a tab switch back to Student Document.

Long comments must not make the workspace unusable. The rail may show a compact preview with **Show more / Show less**, but the full comment remains available in the thread. If Insert into Report is used, the full source comment content is inserted/copied rather than only the truncated preview.

The comments rail can be hidden in either tab to maximize the main workspace. Hiding it is presentation state only and never changes the underlying comment/report workflow.

### 5.5 Responsive behavior

Desktop is the primary live-defense target.

On narrower screens:

- the role rail may become a drawer/sheet;
- the comments rail may become a drawer/sheet;
- the main document/report remains the primary surface;
- academic actions must remain available without horizontal layout breakage.

No workflow rule may depend on screen size.

---

## 6. Role behavior in the collaborative workspace

| Role | Official evaluation | Student document annotation | View report draft | Edit report draft | RAP signature | Formal verdict |
|---|---|---|---|---|---|---|
| Chairman | Yes | Yes | Yes | No | Yes | Yes |
| Panelist | Yes | Yes | Yes | No | Yes | No |
| Rapporteur | No | View + comment/reply | Yes | Yes | Yes | No |
| Adviser, Proposal/Final | No under current evaluator policy | View-only in initial design | Yes | No | Yes | No |
| Facilitator | No | View-only | Yes | No | No | No |

Notes:

- Adviser annotation/comment authority is not expanded by this document. It may be revisited only after explicit project/client approval.
- Facilitator is not an evaluator and is not a required RAP signer under the current policy.
- Student does not receive access to live committee annotations/comments under this design.
- Admin Defense Records remains a records/operations surface; Admin is not turned into a live committee collaborator by this design.

---

## 7. Individual Oral Examination evaluation UX

### 7.1 Institutional-form familiarity

The digital evaluator rail should visually follow the supplied individual Panelist evaluation form so committee members recognize the same grouping and scale.

Target grouping:

**Group I**

1. Timeliness and relevance of study to educational goals
2. Organization
3. Depth or comprehensiveness of treatment
4. Relevance of conclusions and recommendations
5. Evidence of original thinking

**Group II**

1. Presentation
2. Mastery of Subject Matter
3. Communication Skill
4. Attitude / Receptive to suggestions

The supplied paper reference presents rating columns:

| Value | Label |
|---:|---|
| 1.00 | E |
| 1.25 | HS |
| 1.50 | VS |
| 1.75 | S |
| 2.00 | BS |
| 2.50 | F |

The desktop UI should therefore prefer a familiar matrix/radio-grid presentation rather than unrelated free-form numeric inputs.

### 7.2 Scoring semantics audit required before implementation

CURRENT_IMPLEMENTATION_FACT:

The current oral-evaluation rules on refactor/unified-defense-lifecycle store criterion values using point limits such as 10 and 15 and calculate group subtotals. This does not directly match the supplied paper form's 1.00–2.50 matrix.

Therefore:

- do not silently reinterpret existing persisted values;
- do not perform a destructive schema/data migration based only on visual similarity;
- Phase 0 must reconcile the authoritative institutional scoring semantics with the current persisted model;
- the target UI should remain familiar to the paper form, but the exact backend mapping must be explicitly decided and tested before production migration.

### 7.3 Evaluation lifecycle

For every required evaluator:

    NOT_STARTED
      -> DRAFT
      -> REVIEW
      -> E-SIGNED + FINALIZED
      -> LOCKED

Rules:

- official scoring is available only while the defense is IN_PROGRESS;
- drafts may be saved repeatedly;
- **CDW-LIVE-1 target:** while DRAFT and editable, criteria/recommendations autosave privately through the evaluator's existing REST draft path using debounced/serialized saves; autosave must not expose another evaluator's private draft;
- finalization requires complete required criteria and valid e-signature evidence;
- finalization is server-authoritative and locks the record;
- no other committee member may edit an evaluator's record;
- shared manuscript comments are not a substitute for the evaluator's formal Recommendations field;
- other panelists do not receive live access to another evaluator's private numeric selections merely because comments are shared;
- the Oral Examination Summary is derived only from finalized evaluator records;
- evaluation completion never auto-decides the verdict.

---

## 8. Student Document collaboration model

### 8.1 Exact-document binding

Every annotation belongs to:

- one defense schedule/attempt;
- one exact ThesisDocument identifier/version;
- one PDF page;
- one text/area anchor;
- one author assignment/user.

An annotation created against an earlier manuscript must never automatically move to a later manuscript.

### 8.2 Recommended annotation anchor

A robust annotation record should retain enough information to restore the highlight after reload and zoom:

- page number;
- selected text when text exists;
- page-relative rectangle/quad coordinates;
- optional surrounding text prefix/suffix for resilience;
- document identifier;
- anchor format/version.

The PDF remains unchanged. The viewer renders an annotation overlay.

### 8.3 Shared comments

Chairman and Panelists may highlight text and create shared comments. The Rapporteur may view all such threads and may comment/reply according to the role matrix.

Initial thread behavior should prioritize academic traceability:

- create highlight + initial comment;
- reply in a flat thread;
- retain author identity/role and timestamps;
- no hard deletion of published academic comments;
- if edit support is later added, the prior content must remain auditable;
- the initial implementation may omit edit/delete entirely rather than weaken history integrity.

### 8.4 Collaboration lock

Annotations/comments are writable during:

- SCHEDULED pre-defense review;
- IN_PROGRESS live defense;
- AWAITING_CONCLUSION only while the RAP remains DRAFT.

When the Rapporteur freezes the report for signatures, new academic annotations/comments for that attempt become read-only so the signed report cannot diverge from a continuing deliberation stream.

CONCLUDED attempts are always read-only.

---

## 9. Rapporteur Committee Report / RAP workspace

### 9.1 Rapporteur-specific experience

The Rapporteur does not receive an evaluator scoring rail.

The Rapporteur uses the same workspace shell but sees:

- Report Controls in the left rail;
- Committee Report tab as editable while DRAFT;
- Student Document tab for direct manuscript review;
- a persistent/collapsible Shared Comments rail in both tabs.

The intended Rapporteur mental model is:

    LEFT   = report status/actions
    CENTER = report composer OR student PDF
    RIGHT  = committee comments/reference

The Rapporteur may switch between Committee Report and Student Document without leaving the defense workspace. This is intentional: comments alone may not contain enough surrounding manuscript context, so the Rapporteur must be able to inspect the exact highlighted paragraph/page before deciding how to represent it in the official report.

Chairman and Panelists can view the Committee Report draft but cannot directly edit authoritative report content.

### 9.2 System-owned report with a free-form Rapporteur body

The report is a system-owned institutional record, but the **narrative body is authored freely by the assigned Rapporteur**.

The system owns and renders fixed metadata/workflow elements such as:

- student/researcher identity;
- defense type/stage;
- program;
- defense date/time/venue;
- committee roster/roles;
- prepared-by Rapporteur identity and timestamps;
- RAP lifecycle/readiness;
- required signature identities/status.

These fixed elements are not ordinary editable text inside the Rapporteur's document body.

The Rapporteur owns the report body itself. The system must **not** force mandatory body sections such as Committee Suggestions, General Observations, Research/Title Recommendations, or any other fixed heading. The Rapporteur may create whatever headings, paragraphs, lists, ordering, and wording are appropriate for the committee record.

Target authoring experience:

- familiar rich-text editing comparable to the basic composing experience of Word/Google Docs;
- headings/paragraphs;
- bold/italic/underline;
- bullet and numbered lists;
- indentation and alignment where supported;
- undo/redo;
- safe copy/paste;
- save draft;
- **CDW-LIVE-1 target:** debounced server autosave with clear Unsaved / Saving / Saved / Offline state;
- no redundant manual **Save now** control while report autosave is active; keep visible save-state feedback and conflict/offline recovery;
- **CDW-LIVE-1 target:** authorized committee viewers may see an ephemeral near-realtime read-only live preview of the Rapporteur's current unsaved body while the report remains editable;
- no requirement to reproduce full word-processing/page-layout capabilities.

The system is not a full Microsoft Word/Google Docs clone. Page-layout editing, arbitrary floating objects, live multi-author editing of the report body, and other office-suite features are outside the scope.

The report body remains exclusively Rapporteur-controlled while DRAFT. CDW-LIVE-1 does not change that authority: Panelists/Chairman remain read-only even when they receive a live preview. The live preview is ephemeral display state only; the saved REST/database DRAFT remains authoritative. Chairman/Panelists may view it but do not edit it.

The Rapporteur authoring surface must **not** imitate the full page geometry of the institutional paper form. The editor is content-focused. It may show a compact, non-editable defense context such as student name, defense type, program, and date so the Rapporteur always knows which attempt is being documented, but it should not make the Rapporteur retype or manually maintain the institutional metadata.

The live CDW-5 preview is a clean **content/read-model preview**, not an attempt to reproduce the institutional paper form. Exact institutional rendering is intentionally deferred so the project can later implement Evaluation forms, Oral Examination Summary forms, the Committee Report / GS Form No. 22, and other official defense documents under one consistent document-processing architecture.

A later official-form renderer may compose authoritative system metadata with the Rapporteur-authored body and may include the form identity/header, Name, Type of Defense, Program, Date, committee roster / Panelist-Conforme area, relevant research/title context, Prepared by, and other fixed institutional fields. These fixed fields remain system-owned and must not become editable Rapporteur body content.

Neither CDW-5 nor RAP-C1 should turn sample document headings into mandatory database fields. For example, Statement of the Problem, General Observation, or similar headings may appear when the Rapporteur chooses to author them, but the system must not require those headings merely because they appeared in one institutional sample.

### 9.3 Optional Insert into Report from a committee comment

A shared manuscript annotation/comment may offer **Insert into Report** as an optional Rapporteur productivity action.

The intent is convenience, not automatic synchronization.

When used:

- the selected comment text is copied/inserted into the Rapporteur's report body at the current editor insertion point or another clearly chosen location;
- the original annotation/comment remains unchanged;
- the inserted text becomes ordinary editable report content under the Rapporteur's control;
- the Rapporteur may rewrite it, combine it with other comments, move it, format it, or delete it;
- sourceAnnotationId/sourceCommentId may be retained as non-visible traceability metadata when practical;
- later edits to the source comment do not silently rewrite already-inserted report text.

No annotation/comment is automatically promoted into the official report. The Rapporteur alone decides what enters the report and how it is worded.

This action may be deferred from the first report-editor package if necessary. Manual reading and authoring remains a valid foundation.

### 9.4 Draft visibility

While DRAFT:

- Rapporteur may save repeatedly;
- Chairman/Panelists can view the current draft read-only;
- polling/refetch is acceptable for the foundation;
- later Socket.IO may make draft changes appear nearly immediately.

The draft is not an official signed institutional record.

### 9.5 Report preview and deferred official-form rendering

CDW-5 must separate **authoring/review** from later institutional document rendering.

Current CDW-5 requirement:

- Rapporteur may open a clean read-only Preview Report while the report is DRAFT;
- Chairman/Panelists may view the current DRAFT read-only;
- the preview may show compact system-owned defense context plus the report body;
- the preview is not required to reproduce page size, institutional header, Panelist / Conforme table, signature placement, exact typography, or pagination.

Deferred to a later unified Official Defense Forms / Document Processing source of truth and implementation:

- exact GS Form No. 22 layout;
- Individual Oral Examination Evaluation printable form;
- Oral Examination Summary printable form;
- institutional headers and revision labels;
- typography, spacing, margins, pagination, and print CSS;
- PDF/download generation and official print fidelity;
- template-version management;
- authorized rendering of signature evidence in official forms.

Future access policy is already decided at a high level: the Rapporteur is not excluded from official output merely because Admin owns the records/archive surface. The later document-processing design should support authorized Rapporteur view/print/download of the report and Admin archival/official-record access. Committee-wide download/print entitlement remains a separate policy question.

The Panelist / Conforme presentation belongs to that future generated official form, not to a manually editable table inside the Rapporteur editor.

The assigned Rapporteur remains the authoritative Prepared by identity. If the institutional template contains an Approved by / OIC-Dean area, the future renderer may reserve/display that institutional area, but **Dean digital signing/approval remains unresolved**. It must not become a RAP finalization gate or a fabricated signature slot until EARIST confirms the policy.

### 9.6 Signature-progress visibility for the Rapporteur

Once the Committee Report has been finalized and signature slots exist, the Rapporteur must be able to see concise signing progress.

Faculty-facing workspace UI may show:

- aggregate progress such as `4 of 6 signatures completed`;
- the current authenticated user's own required/signed state and own signed timestamp when applicable;
- a simple lifecycle label such as **Ready for Signatures**, **Awaiting Signatures**, or **Complete**.

Ordinary faculty-facing UI must not expose:

- raw `contentVersion` / **V1** / **version 1** labels;
- frozen snapshot/hash identifiers;
- raw `signatureData` or base64 evidence;
- a full cross-signer audit roster/timestamp table.

Version/hash metadata remains valid internal integrity data and may be shown only in an explicitly administrative/audit/debug surface when there is a real operational need.

REST/database state remains authoritative. Polling/refetch and the accepted realtime invalidation behavior remain sufficient for signing correctness.

### 9.7 CDW-LIVE-1 — live report review and autosave boundary

**IMPLEMENTED / ACCEPTED — CDW-LIVE-1A, 1B, and 1C independently ACCEPTED; core CDW-LIVE-1 ACCEPTED / CLOSED; bounded manual-QA refinements are accepted through FIX-6. The project owner waived an additional full pre-CDW-9 multi-user replay based on targeted regression evidence + independent source review; CDW-9A through CDW-9D are ACCEPTED / CLOSED; CDW-9E is NEXT / AUTHORIZED — NOT YET IMPLEMENTED.**

Detailed design:

    docs/superpowers/cdw-live-1/cdw-live-1-live-report-and-draft-autosave-design.md

The assigned Rapporteur remains the only report-body editor.

While the report is DRAFT and editable:

- the Rapporteur's local edits may be streamed as an **ephemeral read-only live preview** to currently authorized committee viewers;
- the preview may carry the normalized report body, but it is not persisted by Socket.IO and must not be inserted into the authoritative React Query report cache;
- the preview must be visibly distinguishable from the last server-confirmed saved draft;
- the Rapporteur's actual DRAFT is autosaved through the existing authorized REST/database write path;
- the existing body-version/CAS rule remains authoritative for save conflicts;
- a persisted save continues to emit `report.draft.updated`, after which viewers refetch REST state and the saved version supersedes the temporary preview.

This feature is **single-writer / multi-viewer**. Panelists, Chairman, Adviser, Facilitator, or other viewers do not gain report edit authority.

Report finalization remains the irreversible authoring boundary. Once the Committee Report is finalized for signatures, or the attempt is concluded/cancelled, live preview and autosave editing stop immediately. This boundary is independent of evaluator finalization.

Generic live cursors, presence, typing indicators, and multi-author report editing remain deferred.

---

## 10. Canonical RAP lifecycle

The target lifecycle is:

    DRAFT
      -> FOR_SIGNATURE
      -> PARTIALLY_SIGNED
      -> FINALIZED

Legacy statuses may remain readable where current data requires them, but new workflow should use the above semantic path.

### 10.1 RAP must be verdict-independent

The Committee Report is prepared and signed before the Chairman records PASSED or REDEFENSE_REQUIRED.

Therefore the frozen RAP content must not require the formal outcome to exist.

The current implementation's Formal Outcome line is transitional behavior and must not be part of the new pre-conclusion signed snapshot.

The later Chairman verdict belongs to DefenseConclusion and the official defense-record package. The system must not mutate a frozen/signed RAP after the verdict merely to insert that outcome.

### 10.2 Finalize Committee Report for signatures

The faculty-facing action is **Finalize Committee Report**.

Rapporteur finalization requires:

- the report is still DRAFT/editable;
- the user is the assigned Rapporteur;
- required report content is present;
- the latest Rapporteur draft has been persisted successfully.

Rapporteur finalization does **not** require:

- every evaluator record to be FINALIZED;
- the Oral Examination Summary to exist;
- the current Rapporteur/Chairman/Panelists to have completed their own evaluation first.

Finalization must produce an immutable report snapshot/version for integrity and signature binding. Internal implementation may continue to call this operation `freeze`.

Recommended integrity metadata remains:

- frozen/finalized timestamp;
- actor id;
- content version;
- immutable snapshot JSON/text;
- stable content hash.

Each Committee Report signature must remain attributable to that same immutable report version/hash. These integrity identifiers are internal by default and must not be rendered as `V1`, `Frozen version 1`, or similar faculty-facing copy.

### 10.3 Required RAP signers

Title Defense:

- Chairman;
- all assigned evaluator Panelists;
- Rapporteur.

Proposal / Final Defense:

- active Adviser participant;
- Chairman;
- all assigned evaluator Panelists;
- Rapporteur.

Not required under current policy:

- Facilitator.

Dean approval/signature remains a separate institutional question and is not automatically inserted as a normal committee signature slot. The official renderer may preserve/reserve a Dean approval area when the current institutional form requires it, but the system must not infer a digital Dean-signing workflow or block RAP finalization on that area until client policy is explicitly confirmed.

### 10.4 Signing UX

Committee Report signing belongs inside the active Defense Workspace.

A required signer must:

1. open/review the finalized Committee Report;
2. see that the report can no longer be edited;
3. provide their own e-signature;
4. confirm;
5. receive a signed state.

A required signer may sign the finalized Committee Report even when that signer's own individual evaluation is still DRAFT.

Every signer still signs the same immutable report version/hash internally. The Rapporteur may monitor aggregate signer completion from the workspace but must not receive raw signature payloads from other signers.

Faculty-facing copy must use plain task language. Canonical wording for this flow:

- **Finalize Committee Report**
- **Finalize Report**
- **Ready for Signatures**
- **Awaiting Signatures**
- **Sign Committee Report**
- **Confirm Signature**
- **Signed**
- **Committee Report Complete**

Do not show ordinary faculty users:

- Freeze for Signatures;
- Confirm Freeze;
- frozen snapshot;
- Frozen version / V1 / version number;
- RAP Report / RAP finalized where **Committee Report** is the intended product term.

There is no valid new-attempt state where the defense is CONCLUDED while a required Committee Report signature remains pending.

The existing `/panelist/signatures` page may remain as a secondary task inbox/history surface, but it must not be the primary blind post-defense signing flow. A pending task should open the exact Defense Workspace/report.

### 10.5 No silent reopening

Once FOR_SIGNATURE has begun, the report body cannot be silently edited.

A future explicit correction/version-invalidation workflow may be designed if EARIST requires it. Until then, the implementation must prefer blocking and administrative escalation over mutating content already offered for signature.

---

## 11. Centralized conclusion readiness

The backend must provide one authoritative conclusion-readiness decision.

Conclusion readiness is where the two parallel workstreams converge. It must not be reused as a prerequisite that blocks Rapporteur report finalization or Committee Report signing.

Chairman conclusion is allowed only when all are true:

- the current user is the assigned Chairman for the exact schedule;
- the session is in the correct conclusion-ready phase;
- evaluatorAssignments is greater than zero;
- every required evaluator record is FINALIZED and e-signed;
- the Oral Examination Summary exists and corresponds to the current schedule;
- the Rapporteur report exists for the current schedule;
- the report is frozen;
- every required RAP signature slot is signed;
- RAP status is FINALIZED;
- no DefenseConclusion already exists.

If finalized evaluator records exist but the derived Oral Examination Summary is missing because of a transient generation failure, the readiness service should safely self-heal/generate the Summary before declaring the workflow permanently blocked.

The UI should consume server-derived readiness/capabilities rather than independently re-implementing all conclusion rules.

No score average or rating may choose PASSED or REDEFENSE_REQUIRED automatically.

---

## 12. Defense History and revision traceability

Defense history is a first-class part of the workspace, not only a re-defense feature.

### 12.1 Historical package per attempt

Each defense attempt preserves:

- exact submitted manuscript/version;
- exact committee roster/roles;
- finalized individual evaluations/signatures;
- Oral Examination Summary;
- manuscript annotations/comments;
- finalized Committee Report / RAP;
- RAP signature slots/evidence;
- formal verdict;
- attempt/schedule timestamps and metadata.

### 12.2 Same-stage re-defense history

When a current attempt follows REDEFENSE_REQUIRED:

- the previous same-stage attempt is available in read-only mode;
- current committee members may view the previous manuscript;
- previous RAP/recommendations are visible;
- previous annotations/comments are visible;
- the current attempt receives a completely new annotation/evaluation/RAP/signature set.

Nothing from the prior attempt is reopened or reused as mutable current data.

### 12.3 Previous-stage revision verification

History also supports normal PASSED progression.

Example:

    Proposal Defense PASSED
      -> RAP records required revisions
      -> Student + Adviser revise manuscript
      -> Final Defense
      -> current committee can inspect Proposal manuscript + Proposal RAP + historical annotations beside the current Final manuscript

This supports the project rule that ordinary revisions do not create a separate REVISION_REQUIRED verdict.

The verdict remains PASSED. The requested changes live in RAP/history and are verified against the later authoritative manuscript.

### 12.4 History UI

Within Student Document:

- Current Manuscript remains the default;
- Defense History opens relevant prior records;
- immediately preceding same-stage attempt is prioritized for re-defense;
- immediately preceding academic stage is prioritized for normal progression;
- older history remains available as secondary context.

A Compare action may open:

- previous manuscript on one side;
- current manuscript on the other;
- previous annotations/RAP as read-only reference.

Initial comparison is manual.

DEFERRED:

- automatic PDF visual diff;
- semantic diff;
- AI determination that a recommendation was satisfactorily addressed.

### 12.5 Historical access and privacy

A replacement/current Panelist may see the prior manuscript, RAP recommendations, formal outcome, and committee annotations needed to verify revisions.

Detailed prior individual evaluator scores must not automatically be exposed to newly assigned members unless a separate authorization rule permits it.

Historical attempts do not join real-time collaboration rooms.

---

## 13. Realtime architecture

Realtime is an enhancement to a correct persisted workflow, not the source of truth.

**CDW-8 technical integration design:** `docs/superpowers/cdw-8/cdw-8-realtime-integration-design.md`.  
**CDW-8 acceptance report:** `docs/superpowers/cdw-8/cdw-8c-acceptance-report.md`.

CDW-8 is implemented and accepted at production implementation HEAD `a9a179446284ea928faca8991de34deadc856e1b`, with the CDW-8C acceptance package finalized at `f6011c1eaa73706cce0fb950ceea2a64dad80fc7`. These technical documents supplement this Source of Truth and do not override its academic/domain rules.

Canonical architecture:

    Client command
      -> authenticated REST endpoint
      -> authorization
      -> database transaction/commit
      -> emit realtime event
      -> other authorized clients invalidate/refetch authoritative REST state

Rules:

- REST/business services remain authoritative for academic writes;
- database state remains authoritative;
- Socket.IO must never become a second business-rule implementation;
- persisted domain events are emitted only after successful persistence;
- reconnect always triggers authoritative refetch;
- the nine accepted CDW-8 persisted-domain events prefer identifiers/version metadata over duplicated records;
- **CDW-LIVE-1 may add one transport-only `report:preview` message carrying authorized report body content for ephemeral display. It is not a persisted domain event, is not replayed, is not logged as report text, and never becomes the authoritative saved DRAFT without the normal REST save path.**

Implemented room:

    defense:<scheduleId>

Room membership requires authentication plus current schedule-assignment authorization.

Realtime may be active for SCHEDULED, IN_PROGRESS, and AWAITING_CONCLUSION while collaboration/signatures are still active. CONCLUDED historical reopening does not require room membership.

Implemented canonical persisted-domain events:

- defense.started
- annotation.created
- annotation.comment.created
- report.draft.updated
- report.ready_for_signature
- evaluation.finalized
- rap.signature.recorded
- rap.finalized
- defense.concluded

The CDW-LIVE-1 design does **not** add a tenth persisted-domain event. Its proposed `report:preview` is an ephemeral socket transport message for a single Rapporteur writer and authorized read-only viewers.

Presence indicators, live cursors, generic typing indicators, CRDT/Yjs document editing, simultaneous manuscript editing, and multi-author report editing remain DEFERRED.

---

## 14. Technology direction and current implementation boundary

### 14.1 HISTORICAL_BASELINE — pre-CDW state on 2026-10-15

The following facts describe the implementation baseline that motivated CDW-0 through CDW-7. They are retained for migration/refactor history and **must not be read as the current branch state**:

- the Defense Workspace embedded the student PDF in an iframe;
- there was no persisted defense-annotation model;
- the Rapporteur UI was a notes textarea;
- RAP creation still followed post-conclusion legacy paths;
- the pending-signature page used a placeholder report preview.

### 14.2 IMPLEMENTED_FOUNDATION — CDW-0 through CDW-8 accepted

At accepted production implementation HEAD `a9a179446284ea928faca8991de34deadc856e1b` (with CDW-8C acceptance package HEAD `f6011c1eaa73706cce0fb950ceea2a64dad80fc7`), the collaborative foundation now includes:

- an EARIST-controlled PDF.js-based Defense Workspace viewer with application-controlled navigation, text selection/highlight anchors, comments, and exact attempt/document binding;
- persisted `DefenseAnnotation` and `DefenseAnnotationComment` collaboration data with backend authorization;
- an immersive role-aware workspace for Chairman, Panelists, Rapporteur, Facilitator, and stage-aware Adviser participation;
- official numerical evaluation only for Chairman + Panelists and only while `IN_PROGRESS`, with evaluator privacy and finalized-record immutability;
- a Rapporteur-owned **free-form rich-text Committee Report / RAP authored inside GS-IS**;
- deliberate "Insert into Report" copying from stored comments without live binding to the source comment;
- RAP freeze/version/hash, stage-aware signer slots, exact frozen-content signature binding, and `FINALIZED` RAP before formal verdict;
- Chairman-only `PASSED` / `REDEFENSE_REQUIRED` conclusion, with no score-derived verdict;
- concluded-attempt immutability across current and legacy mutation paths;
- attempt-based Defense History with exact historical manuscript binding, historical RAP/legacy-note provenance, read-only annotations/comments, replacement-committee read access, and manual Compare with Current;
- Socket.IO realtime attached to the existing backend HTTP server with shared JWT identity, exact current `PanelAssignment` room authorization, stale-member eviction, and the nine canonical privacy-safe post-commit events;
- one Defense Workspace-level Socket.IO client that only invalidates/refetches existing React Query state; REST/database state remains authoritative and the existing polling intervals remain the correctness fallback.

The original uploaded manuscript remains immutable. Highlights/comments are separate persisted overlays. The Rapporteur editor is intentionally document-like, not a full office-suite/page-layout editor, and exact Microsoft Word line breaking is not a correctness target.

### 14.3 Deferred / separate future work

The following are **not missing CDW-1 through CDW-8 requirements** and must remain separate from the accepted foundation:

- CDW-LIVE-1 live Rapporteur preview + report/evaluation autosave is accepted/closed and is current behavior;
- CDW-9 hardening / production-readiness work, executed as bounded packages CDW-9A through CDW-9F per the implementation plan; CDW-9A through CDW-9D are ACCEPTED / CLOSED; CDW-9E is NEXT / AUTHORIZED — NOT YET IMPLEMENTED; CDW-9F remains PLANNED / NOT YET IMPLEMENTED;
- exact institutional **official-form rendering** for Committee Report/RAP, Individual Evaluation, and Oral Examination Summary, including authoritative pagination/geometry, PDF/print/download output, signature placement, and template versioning;
- automatic PDF/text/semantic manuscript diff;
- AI determination of revision/recommendation compliance;
- Dean digital approval/signature unless separately confirmed;
- presence indicators, live cursors, typing indicators, CRDT/Yjs, and simultaneous manuscript editing.

The canonical RAP source remains the in-system report record. External Word/DOCX/PDF authoring or upload is **not** a parallel authoritative RAP source unless a future project decision explicitly changes that rule.

---

## 15. Security and integrity invariants

1. Every workspace read/write is authorized against the exact schedule and current authenticated user.
2. Committee role comes from the schedule's assignment, not a broad account role alone.
3. Annotation writes must validate that the target document is the exact authorized document for the schedule.
4. No cross-thesis or cross-attempt annotation access.
5. Users may sign only their own RAP signature slot.
6. Evaluation finalization is own-record only.
7. Rapporteur report edit/freeze is assigned-Rapporteur only.
8. Chairman conclusion is assigned-Chairman only.
9. Finalized evaluation, frozen RAP, signed RAP, and concluded history are immutable through normal APIs.
10. Student-facing endpoints do not expose live committee comments by default.
11. Historical replacement-panel access is read-only and limited to context allowed by this design.
12. Client timestamps never replace server-authoritative signature/finalization timestamps.

---

## 16. Compatibility and migration rules

The implementation must preserve existing historical data.

- Do not drop legacy DefenseOutcome values solely because new attempts use PASSED / REDEFENSE_REQUIRED.
- Do not drop legacy selected-title fields solely because new Title attempts do not require a binding selected title.
- Existing concluded attempts that were created under older RAP sequencing remain readable.
- Do not fabricate annotations for old attempts.
- Do not fabricate missing evaluator records or signatures for old attempts.
- New collaborative models apply prospectively unless a safe explicit backfill is designed.
- Existing finalized official records must remain reproducible/readable after the workspace refactor.
- Legacy Rapporteur notes/RAP text may be rendered as historical content without pretending they were authored using the new structured composer.

---

## 17. Open questions and intentionally deferred features

OPEN_QUESTION:

- whether the Adviser should be allowed to create shared manuscript annotations in Proposal/Final;
- whether the Facilitator should ever receive collaborative comment authority;
- the institutional correction process if a frozen RAP must be withdrawn/revised after signatures start;
- Dean electronic approval/signature mechanics on the final institutional RAP output;
- final authoritative mapping between the supplied 1.00–2.50 evaluation matrix and the current persisted 10/15-point criterion model.

DEFERRED:

- automatic manuscript diff;
- AI verification of revision compliance;
- live cursors/presence/typing indicators;
- collaborative editing of the student's manuscript;
- automatic merging of historical annotations into a revised manuscript;
- rich nested comment trees beyond simple threads unless later needed.

---

## 18. Acceptance invariants

The collaborative Defense Workspace is not considered complete unless all of the following can be demonstrated:

- assigned committee can review/comment on the current manuscript before the defense date;
- official scoring remains closed until the defense starts;
- Panelist/Chairman evaluation finalization is distinct from RAP signing;
- evaluation UI follows the confirmed scoring semantics and familiar Group I/II form structure;
- shared comments persist after reload and are visible to authorized committee members;
- comments remain bound to the exact manuscript/attempt;
- Rapporteur can see shared comments while composing the report and while reviewing the Student Document;
- Rapporteur can switch between report composer and exact manuscript context without leaving the Defense Workspace;
- long comments remain fully readable and Insert into Report uses the full stored comment body;
- Rapporteur can author a free-form rich-text report body;
- the Defense Workspace uses an EARIST-native collaborative PDF viewer rather than browser-native PDF chrome as the primary review UI;
- Panelists can see the report draft read-only;
- once CDW-LIVE-1 is implemented, authorized report viewers can follow the Rapporteur's unsaved wording as a clearly labeled ephemeral live preview without gaining edit authority;
- once CDW-LIVE-1 is implemented, report and own-evaluation DRAFT changes autosave to the authoritative REST/database draft while irreversible actions remain explicit;
- the Rapporteur can finalize the Committee Report once the report content is ready without waiting for evaluator finalization or Summary readiness;
- required Committee Report signers can sign the finalized report even when their own evaluation remains DRAFT;
- all signers review the same immutable finalized Committee Report content;
- Rapporteur signs their own required Committee Report slot separately;
- missing any required RAP signature blocks Chairman conclusion;
- Facilitator does not become a required RAP signer;
- Title has no Adviser RAP slot;
- Proposal/Final require the active Adviser RAP slot;
- the frozen RAP does not depend on a Chairman verdict and is not mutated after verdict;
- PASSED / REDEFENSE_REQUIRED remains Chairman-only;
- a concluded defense has no pending required RAP signature;
- concluded workspaces reopen read-only without requiring realtime;
- same-stage re-defense history is preserved and viewable;
- previous-stage history supports manual revision verification after PASSED;
- changing current committee membership does not rewrite historical committee records;
- REST/DB workflow remains correct when Socket.IO is unavailable; the accepted polling fallback continues to provide convergence.

---

## 19. Implementation authority

Implementation sequencing is defined in:

docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md

The implementation plan must be executed in bounded packages. No coding agent should implement the entire collaboration, RAP, history, and realtime scope in one unbounded change.
