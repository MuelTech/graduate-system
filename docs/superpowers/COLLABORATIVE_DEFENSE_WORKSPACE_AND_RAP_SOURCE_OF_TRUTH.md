# EARIST Collaborative Defense Workspace and RAP
## Canonical Source of Truth

**System:** EARIST Graduate School Information System (GS-IS)  
**Scope:** Collaborative Defense Workspace, evaluator experience, manuscript annotations, Rapporteur Committee Report / RAP, signatures, conclusion readiness, and defense-history review  
**Parent workflow authority:** docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md  
**Active design branch:** refactor/unified-defense-lifecycle  
**Intended implementation branch:** refactor/collaborative-defense-workspace  
**Document status:** CONFIRMED_PROJECT_DESIGN unless a section is explicitly marked OPEN_QUESTION, DEFERRED, or CURRENT_IMPLEMENTATION_FACT  
**Version:** 1.0-draft  
**Last updated:** 2026-10-15

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
- the future real-time synchronization layer.

The previously planned standalone WF-C1c package is absorbed into this design. Its core academic invariant remains mandatory: required evaluator records and the required RAP/signatures must be complete before the assigned Chairman records the formal verdict.

No separate specification document is required at this time. This Source of Truth defines the functional and UX behavior; the dated implementation plan defines how it will be built.

### 0.1 Status vocabulary used in this document

- CONFIRMED_PROJECT_DESIGN — agreed project behavior and implementation target.
- CURRENT_IMPLEMENTATION_FACT — observed behavior in refactor/unified-defense-lifecycle at the documentation baseline.
- OPEN_QUESTION — requires explicit institutional/client confirmation before authority is expanded.
- DEFERRED — intentionally outside the first implementation.

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

5. **RAP signatures**
   - Required signers review the same frozen report snapshot.
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

The report remains DRAFT during this phase.

### 3.3 AWAITING_CONCLUSION — Finalization Mode

When all required evaluator assignments are finalized and the Oral Examination Summary is ready, the attempt enters the formal finalization phase.

The Rapporteur completes the Committee Report and chooses Finalize for Signatures.

That action:

- validates all required evaluator records are finalized;
- validates the Oral Examination Summary exists or can be safely generated from finalized evaluator records;
- freezes the report content;
- creates or reconciles the stage-aware required RAP signature slots;
- changes the report to FOR_SIGNATURE;
- locks the report body and the attempt's collaboration layer against new academic comments that could diverge from the frozen report.

Required members then review the same frozen report and sign their own slots.

When all required signature slots are signed, the RAP becomes FINALIZED.

Only then may the Chairman record PASSED or REDEFENSE_REQUIRED.

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

- My Evaluation
- Draft/finalized state
- criteria
- recommendations
- save/review/e-sign/finalize controls

For Rapporteur:

- Report status
- draft/frozen status
- save/finalize controls
- source-comment count or report-item summary

For Adviser/Facilitator:

- role/status information and applicable read/sign actions only; no fabricated evaluator controls.

The rail can be hidden so the user can focus on the manuscript. Hiding the rail is presentation state only; it never changes academic workflow state.

When hidden, a compact indicator remains visible, for example Evaluation: Draft or Evaluation: Finalized.

### 5.4 Shared comments rail

When Student Document is active, the right rail shows:

- Selected thread
- All comments
- author and defense role
- page/anchor context
- timestamps
- replies

Selecting a highlight focuses its thread. Selecting a comment in the list scrolls/focuses the corresponding PDF anchor.

The comments rail can also be hidden to maximize document width.

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
- Student Document tab with shared committee annotations/comments.

Chairman and Panelists can view the Committee Report draft but cannot directly edit authoritative report content.

### 9.2 Structured report

The report should be a system-owned structured record inspired by the supplied GS Form No. 22 / Suggestions of the Evaluation Committee rather than a generic Word-like editor.

Recommended content areas:

- student/researcher identity;
- defense type/stage;
- program;
- defense date/time/venue;
- research/title context;
- committee suggestions;
- general observations;
- Title-stage suggested wording/research-direction notes when applicable;
- source links to selected manuscript annotations when an item was derived from a comment;
- prepared-by Rapporteur identity and timestamps;
- RAP signature/readiness metadata.

The report may support manually authored items and items derived from annotations.

### 9.3 Add to Report

A shared annotation may offer Add to Report to the Rapporteur.

This action:

- does not remove or mutate the original annotation;
- creates a report item or linked draft reference;
- allows the Rapporteur to rewrite/normalize official wording;
- preserves sourceAnnotationId or equivalent traceability when practical.

No annotation is automatically promoted into the official report.

### 9.4 Draft visibility

While DRAFT:

- Rapporteur may save repeatedly;
- Chairman/Panelists can view the current draft read-only;
- polling/refetch is acceptable for the foundation;
- later Socket.IO may make draft changes appear nearly immediately.

The draft is not an official signed institutional record.

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

### 10.2 Freeze for signatures

Rapporteur Finalize for Signatures requires:

- the report is still DRAFT;
- the user is the assigned Rapporteur;
- all required evaluator assignments are FINALIZED;
- the Oral Examination Summary exists or can be safely generated from those finalized records;
- required report content is present.

Freeze must produce an immutable report snapshot/version.

Recommended integrity metadata:

- frozenAt;
- frozenById;
- content version;
- frozen snapshot JSON/text;
- stable content hash.

Each RAP signature should be attributable to that same frozen version/hash.

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

Dean approval/signature remains a separate institutional question and is not automatically inserted as a normal committee signature slot.

### 10.4 Signing UX

RAP signing belongs inside the active Defense Workspace.

A required signer must:

1. open/review the actual frozen Committee Report;
2. see that the content is locked;
3. provide their own e-signature;
4. confirm;
5. receive a signed/locked state.

There is no valid new-attempt state where the defense is CONCLUDED while a required RAP signature remains pending.

The existing /panelist/signatures page may remain as a secondary task inbox/history surface, but it must not be the primary blind post-defense signing flow. A pending task should open the exact Defense Workspace/report.

### 10.5 No silent reopening

Once FOR_SIGNATURE has begun, the report body cannot be silently edited.

A future explicit correction/version-invalidation workflow may be designed if EARIST requires it. Until then, the implementation must prefer blocking and administrative escalation over mutating content already offered for signature.

---

## 11. Centralized conclusion readiness

The backend must provide one authoritative conclusion-readiness decision.

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

Canonical architecture:

    Client command
      -> authenticated REST endpoint
      -> authorization
      -> database transaction/commit
      -> emit realtime event
      -> other authorized clients invalidate/refetch or apply safe cache update

Rules:

- REST/business services remain authoritative for writes;
- database state remains authoritative;
- Socket.IO must never become a second business-rule implementation;
- events are emitted only after successful persistence;
- reconnect always triggers authoritative refetch;
- event payloads should prefer identifiers/version metadata over large duplicated records.

Suggested room:

    defense:<scheduleId>

Room membership requires authentication plus current schedule-assignment authorization.

Realtime may be active for SCHEDULED, IN_PROGRESS, and AWAITING_CONCLUSION while collaboration/signatures are still active. CONCLUDED historical reopening does not require room membership.

Candidate events:

- annotation.created
- annotation.comment.created
- report.draft.updated
- report.ready_for_signature
- evaluation.finalized
- rap.signature.recorded
- rap.finalized
- defense.concluded

Presence indicators, live cursors, typing indicators, CRDT/Yjs document editing, and simultaneous manuscript editing are DEFERRED.

---

## 14. Technology direction

CURRENT_IMPLEMENTATION_FACT:

- the current Defense Workspace embeds the student PDF in an iframe;
- the shared DocumentViewer also renders PDFs through an iframe;
- the repository already uses pdfjs-dist for native PDF text extraction on the backend;
- there is no persisted defense-annotation model;
- the current Rapporteur UI is a notes textarea;
- current RAP creation is named/implemented as post-conclusion behavior;
- the current pending-signature page contains a placeholder report preview rather than the actual report body.

Target direction:

- use a PDF.js-based browser rendering/text layer for the collaborative workspace so text selection and annotation overlays are under application control;
- evaluate a maintained open-source React PDF highlighting/annotation library through a bounded proof of concept before committing to it;
- keep EARIST visual design, comments, authorization, persistence, and report workflow under project control;
- use React Query/refetch/polling for the foundation;
- add Socket.IO only after the persisted UI/API workflow passes acceptance testing.

Do not implement a full document editor.

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
- Rapporteur can see shared comments and build a structured report;
- Panelists can see the report draft read-only;
- the report can be frozen only after required evaluations and Summary readiness;
- all signers review the same frozen RAP snapshot;
- Rapporteur signs their own required RAP slot separately;
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
- REST/DB workflow remains correct before Socket.IO is introduced.

---

## 19. Implementation authority

Implementation sequencing is defined in:

docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md

The implementation plan must be executed in bounded packages. No coding agent should implement the entire collaboration, RAP, history, and realtime scope in one unbounded change.
