# GS-IS Implementation Checklist

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** `MuelTech/graduate-system`  
**Tracking branch at creation:** `feat/official-defense-document-integration`  
**Created:** 2026-10-24  
**Purpose:** living implementation/status index for completed work, known gaps, planned features, client-policy questions, collaborator work, and future review packages.

> This checklist is a tracking index, not a replacement for detailed source-of-truth documents. If a checklist item conflicts with a dedicated workflow/specification document, the dedicated source of truth wins until the conflict is explicitly reconciled.

## Status legend

- ✅ **ACCEPTED** — implemented and accepted for the currently documented scope.
- 🟡 **PARTIAL** — some supporting code/data/UI exists, but the target feature is not complete.
- 🔍 **REVIEW REQUIRED** — implementation exists or is being developed, but must be independently audited before acceptance.
- ⏳ **PLANNED** — agreed direction / known requirement, not yet implemented.
- ❓ **DECISION REQUIRED** — client/project-owner policy or architecture must be settled first.
- 🐞 **KNOWN GAP / BUG** — current behavior is insufficient or incorrect.
- 🚫 **DEFERRED** — intentionally postponed.

---

# 1. Official Defense Documents

| Status | Item | Current / target state |
| --- | --- | --- |
| ✅ | Individual Oral Examination Criteria PDF | Server-generated official evaluator form from exact finalized evaluator record. |
| ✅ | Bundled Individual Evaluations PDF | One Admin download/print packet for Chairman + Panelists, one evaluator form per page. |
| ✅ | Oral Examination Summary PDF (GS-011) | Exact persisted summary/schedule-bound source; current integration accepted. |
| ✅ | Defense Application PDF (GS-006 / GS-007 family) | Admin generation/download integrated for exact schedule. |
| ✅ | Readable official filenames | Student + defense stage + document type; UUID remains internal. |
| ✅ | Vector check marks | Evaluator selection and Defense Application stage markers use vector checks, not text X. |
| ✅ | Defense Application filing identity | Student cellphone, Student email, and exact stage filing/resubmission timestamps are mapped. |
| ✅ | Filing timestamp history | Title / Proposal / Final have independent nullable server-owned submission timestamps; successful resubmission updates only the exact stage. |
| ✅ | Legacy filing behavior | Pre-migration records with no authoritative timestamp remain blank rather than receiving fabricated dates. |
| ✅ | Paper-only instruction cleanup | `Note: Please write legibly` removed from generated Defense Application. |
| ❓ | Defense Application Amount Paid | Client authority/capture policy still required. Do not infer from printed fee table or receipt presence. |
| ❓ | Defense Application O.R. No. | Client authority/capture policy still required. Do not infer from upload filename/metadata. |
| ⏳ | Defense Application Dean name | Must come from an authoritative institutional office-holder source, not renderer hardcoding. |
| ⏳ | Defense Application VPAA name | Same institutional office-holder configuration requirement. |
| ⏳ | Defense Application President name | Same institutional office-holder configuration requirement. |
| ⏳ | GS-011 Dean name | Must use authoritative institutional configuration. |
| ⏳ | GS-011 Adviser stage behavior | Proposal/Final resolve exact schedule Adviser. Title Defense has no Adviser and must not fabricate one; renderer/display behavior must become explicitly stage-aware. |
| ⏳ | Course & Major authoritative formatting | Replace dependence on one static/freeform program string with future academic master-data authority where applicable. |
| 🚫 | GS Form No. 22 / Committee Report official PDF | Deferred document renderer/integration package. |
| 🚫 | Generated official-document persistence/versioning | Current accepted forms are primarily on-demand; immutable generated-copy/version lifecycle remains separate work. |

### Form-related source-of-truth rule

Names, programs, signatures, payment metadata, and institutional approvals must come from authoritative system records/configuration. Renderers must not invent values solely to fill printed fields.

---

# 2. Institutional Officials / Official-Form Signatories

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | Institutional office-holder configuration | Admin-manageable authoritative names for Dean, Graduate School; Vice President for Academic Affairs; President; and future official offices as needed. |
| ⏳ | Effective office-holder history | Determine whether effective dates/history are needed so old official records can preserve the correct office holder. |
| ❓ | Institutional official signature policy | Name authority and signature authority are separate. Confirm which official forms are digitally signed by Dean / VPAA / President. |
| ⏳ | Official-form integration | Forms consume configured office-holder identity only after the configuration/source is implemented and approved. |

---

# 3. Academic Structure / Program Master Data

Current repository facts:

- `Program` already stores `programName`, `programType`, and a nullable `department` string.
- There is no accepted normalized Department → Program → Major/Specialization management architecture yet.

| Status | Item | Current / target state |
| --- | --- | --- |
| 🟡 | Program data | Program model exists; current data still needs an Admin-managed master-data direction. |
| ⏳ | Department management | Admin CRUD / active-state authority for departments. |
| ⏳ | Program management | Admin CRUD / active-state authority for Graduate School programs. |
| ⏳ | Major / specialization management | Structured relationship where a program requires a major/specialization. |
| ⏳ | Department → Program → Major hierarchy | Final normalized relationship to be designed before migration. |
| ⏳ | Defense form Course & Major display | Derived from authoritative academic master data instead of renderer-specific string manipulation. |
| ❓ | Historical academic labels | Decide whether renamed programs/majors require historical snapshots for previously generated records. |

---

# 4. Faculty Identity, Multi-Permission Access, and Defense Assignment

## Working target

The current broad system role `PANELIST` is planned to evolve toward a **FACULTY identity/account concept**.

System/module permissions must be kept separate from defense committee assignment roles.

### Current repository facts

- `UserRole` currently includes `ADMIN`, `STUDENT`, `PANELIST`, `CUSTOM`, and `APPLICANT`.
- `CustomRole` and `RoleFeatureAccess` already exist with `canView` / `canEdit` feature access.
- Defense assignment roles are separately represented by `PanelRole`: `CHAIRMAN`, `PANELIST`, `ADVISER`, `RAPPORTEUR`, `FACILITATOR`.

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | Replace broad PANELIST identity with FACULTY concept | Migration/compatibility design required; do not rename blindly because many existing APIs/routes/data references use PANELIST. |
| ❓ | Final Faculty permission architecture | Project owner will decide the final approach. Track the feature now; do not prematurely lock exact permission keys/schema. |
| 🟡 | Existing custom-role infrastructure | `CUSTOM`, `CustomRole`, and `RoleFeatureAccess` may be reusable/refactorable, but they are not yet accepted as the final Faculty permission architecture. |
| ⏳ | Multiple permissions per Faculty | One Faculty account may receive multiple system/module capabilities rather than one mutually exclusive operational role. |
| ⏳ | Faculty with selected Admin access | Faculty may be granted selected Admin features according to approved permissions. |
| ⏳ | Program Chair access | Program Chair is a system/academic capability (for example applicant/exam review), not a defense committee role. |
| ⏳ | Permission-aware navigation | Faculty UI/navigation should expose only authorized modules/actions. |
| ⏳ | Backend permission enforcement | API authorization must enforce the same capabilities; hiding frontend links is insufficient. |
| ❓ | Permission-management authority | Define who can grant/revoke high-privilege permissions and prevent privilege escalation. |

## Important boundary: defense roles are NOT Faculty permissions

Do **not** model Chairman / Panelist / Rapporteur / Facilitator as permanent Faculty access permissions merely because a Faculty member can serve in those roles.

Actual role authority remains the specific defense schedule assignment:

`DefenseSchedule → PanelAssignment → PanelRole`

A Faculty member may be Chairman in one defense and Panelist or another permitted assignment in a different defense.

---

# 5. Adviser Eligibility and Capacity

Current repository facts:

- current Panelist profile contains `isExternal`;
- current flow contains `isAvailableAsAdviser`;
- a Panelist-facing profile toggle currently exists;
- external panelists are already excluded from adviser candidacy;
- existing adviser rules explicitly state there is **no adviser load cap** yet.

Target direction discussed for the new Faculty model:

| Status | Item | Current / target state |
| --- | --- | --- |
| 🐞 | Remove self-controlled adviser availability | Faculty should not control adviser availability with their own on/off toggle under the new policy. |
| ⏳ | Admin-controlled adviser eligibility | Admin decides whether an internal Faculty member may receive new advisees. |
| ✅ | External adviser prohibition (current policy) | External panelists/future external Faculty must not become thesis/dissertation advisers. |
| ⏳ | Adviser load limit | Admin-configurable maximum active advisees per eligible Faculty member. |
| ⏳ | Current adviser load | Compute from authoritative active AdviserAssignments; avoid manual counters unless justified. |
| ⏳ | Capacity enforcement | Block new request/approval/assignment when the adviser has reached the configured limit. |
| ⏳ | Candidate filtering | Adviser candidate lists must exclude external, inactive, ineligible, or capacity-full Faculty. |
| ❓ | Active-advisee counting rule | Define exactly which AdviserAssignments count toward capacity and when capacity is released. |
| 🔍 | Existing Adviser workflow audit | Review current GS-020/request/Dean-approval flow against the future Faculty/capacity policy before implementing the refactor. |

---

# 6. Reusable E-Signature Architecture

## Current behavior

The existing Panelist E-Signatures page is **document-specific**. The signer currently draws a signature and sends `signatureData` for that signing action. It is not currently a reusable profile-signature vault.

| Status | Item | Current / target state |
| --- | --- | --- |
| ✅ | Explicit per-document signing | Current flows record signatures only after an explicit signing/finalization action. |
| 🟡 | Current draw-signature UX | Works for existing document-specific flows but requires drawing again. |
| ⏳ | Saved signature profile | Faculty can create a reusable signature asset once. |
| ⏳ | Draw saved signature | Supported source for reusable signature profile. |
| ⏳ | Upload saved signature | Supported source for reusable signature profile, subject to validation/security rules. |
| ⏳ | Replace/update saved signature | Controlled profile operation. |
| ⏳ | Signature version/snapshot | Signed records must preserve the exact signature evidence/version used at signing time. |
| ⏳ | Explicit Apply/Sign confirmation | Reusable signature must never silently auto-sign a document. |
| ⏳ | Signer + signedAt + exact document binding | Timestamp remains important, but timestamp alone is insufficient evidence. |
| ⏳ | Migrate applicable workflows | Evaluate Individual Evaluation, Committee Report, Adviser certifications, and future official approvals separately. |
| ❓ | Dean/VPAA/President digital signature use | Requires explicit institutional policy before reuse on forms. |

---

# 7. Applicant / Entrance Examination

Current repository facts:

- `ExamQuestion`, `ExamOption.isCorrect`, essay answers, exam applications/slots, program exam totals, passing score, and essay-grading-related records already exist.
- Presence of schema/backend pieces does **not** prove the full Admin authoring/scheduling/exam lifecycle is complete.

| Status | Item | Current / target state |
| --- | --- | --- |
| 🟡 | Exam question data model | Question and option/correct-answer structures exist. |
| 🔍 | Admin question-management audit | Verify whether Admin can fully create/edit/order/activate MCQ questions and correct answers. |
| 🔍 | Essay-question management audit | Verify complete Admin authoring/configuration of essay questions. |
| 🔍 | Applicant examination UX audit | Verify actual end-to-end test-taking behavior, validation, completion, score state, and failure handling. |
| 🟡 | Essay grading | Existing grading records/UI work exists; audit Program Chair/grader authority against future Faculty permissions. |
| 🔍 | Exam scheduling | Audit slot creation, capacity, eligibility, applicant booking/assignment, status transitions, edit/cancel behavior, and edge cases. |
| ⏳ | Program Chair examination permissions | Future Faculty permission architecture should govern applicant exam checking/essay grading where appropriate. |

---

# 8. Email, Notifications, Announcements, Memos, and Analytics

These areas include collaborator-owned/currently evolving work. Do not mark them accepted solely because models/pages/routes exist.

| Status | Item | Current / target state |
| --- | --- | --- |
| 🔍 | Email integration | Review end-to-end delivery for Applicants, Students, and future Faculty users. |
| 🔍 | Email templates / triggers | Verify authoritative events, recipients, retries/failure behavior, and auditability. |
| 🔍 | Notifications | Review collaborator implementation and role/audience correctness. |
| 🔍 | Announcements | Review collaborator implementation and target audiences. |
| 🔍 | Memos | Review collaborator implementation, audience/program targeting, and lifecycle. |
| 🔍 | Analytics & Reports | Review collaborator implementation, metric definitions, source correctness, and UI accuracy. |
| ⏳ | Failed email fallback | Define retry/admin-visible failure/recovery behavior for important communications. |

---

# 9. Admin Defense Workflow and Student Document Visibility

| Status | Item | Current / target state |
| --- | --- | --- |
| 🐞 | Ready for Scheduling requirement visibility | In Assign Panel & Schedule, Admin currently lacks sufficient visibility of the Student's submitted stage requirements. |
| ⏳ | Stage requirements panel | Scheduling workspace should expose the exact current-stage application requirements/documents needed for review. |
| ⏳ | Admin view of all Student submissions | Provide an authoritative Student-/Thesis-centered document/submission view rather than forcing Admin to discover files through unrelated pages. |
| ⏳ | Group documents by lifecycle | Suggested grouping: admission, COR/supporting evidence, Title, Proposal, Final, adviser/certification records, receipts, manuscripts, and relevant history. |
| ⏳ | Historical/superseded document visibility | Admin should be able to distinguish current authoritative evidence from prior versions where workflow/history requires it. |
| ❓ | Download/view permissions | Define which file classes Admin may view/download and whether any sensitive/raw evidence needs tighter controls. |

---

# 10. Admin Fallback / Recovery Operations

Fallbacks must not become unaudited override buttons. Each future fallback requires authorization, audit evidence, and clear invariants.

Track at least:

| Status | Scenario to analyze |
| --- | --- |
| ✅ / 🟡 | Re-defense / prior-attempt preservation already has substantial workflow support; continue history/comparison improvements separately. |
| ⏳ | Post-scheduling committee correction / member replacement. |
| ⏳ | Faculty becomes unavailable after scheduling. |
| ⏳ | Schedule cancellation / reschedule recovery. |
| ⏳ | Missing/corrupted/unreadable uploaded document. |
| ✅ / 🟡 | Rejected application → corrected resubmission exists; continue auditing UX/history consistency. |
| ⏳ | Wrong program/academic master-data assignment correction. |
| ⏳ | Duplicate/stuck application recovery. |
| ⏳ | Legacy record missing newer metadata. |
| ⏳ | Mistaken Admin action: determine which actions can safely be corrected versus intentionally irreversible. |
| ⏳ | Failed external communication/email delivery. |
| ❓ | Formal emergency override policy: who may perform it and what evidence/reason is mandatory. |

---

# 11. Defense Workflow / Collaborative Workspace — Existing Accepted Foundation

The master checklist should retain visibility of major completed foundations so future work does not recreate them.

| Status | Item |
| --- | --- |
| ✅ | Exact schedule/attempt/document binding for defense workspace. |
| ✅ | Collaborative manuscript viewer + shared annotations/comment rail. |
| ✅ | Evaluator DRAFT → FINALIZED lifecycle with e-signature. |
| ✅ | Chairman/Panelist evaluator authority separation from non-evaluator roles. |
| ✅ | Rapporteur Committee Report lifecycle and required signature states. |
| ✅ | Re-defense attempt support and prior-record preservation. |
| ✅ | Adviser Certification exact-document binding for Proposal/Final. |
| ✅ | Admin Defense Record detail and document-section ownership pattern. |
| ⏳ | Historical manuscript comparison for prior vs current defense attempt. |
| ⏳ | Post-scheduling committee correction workflow. |
| 🚫 | CRDT/Yjs multi-author report editing remains deferred unless reprioritized. |

---

# 12. Document Lifecycle / Records

| Status | Item |
| --- | --- |
| ✅ | Managed private document storage metadata and current/superseded evidence model. |
| ✅ | Exact reviewed-document binding for Adviser Certification. |
| ✅ | Stage-scoped evidence for defense applications. |
| ⏳ | Unified Admin Student document/submission visibility surface. |
| ⏳ | Panelist prior/current manuscript comparison for re-defense/history. |
| 🚫 | Generic generated-document archive/version manager remains deferred. |

---

# 13. Chatbot / RAG / OCR

| Status | Item | Current / target state |
| --- | --- | --- |
| 🟡 | Chatbot/RAG | Not yet treated as fully implemented/production-ready. Requires implementation-state audit before package planning. |
| ⏳ | Gmail dataset cleaning | Extract Graduate School-relevant inquiry/answer content and remove irrelevant/noisy records. |
| ⏳ | Embedding/vector pipeline | Finalize local embeddings + vector-store ingestion/update workflow. |
| ⏳ | Local LLM runtime | Development/production runtime integration and service startup/recovery. |
| ⏳ | RAG evaluation | Ground-truth questions, retrieval/answer metrics, hallucination/guardrail evaluation. |
| ⏳ | Production API integration | Authenticated GS-IS chatbot endpoint and operational monitoring. |
| 🟡 | COR extraction | Native PDF extraction exists; OCR fallback/evaluation remains a separate research/implementation track. |
| ⏳ | OCR fallback evaluation | Tesseract/image-PDF fallback and controlled accuracy evaluation, if still in approved scope. |

---

# 14. Review Queue for Collaborator / Existing Features

Before marking these areas accepted, perform bounded source/runtime review:

- Email integration
- Notifications
- Announcement
- Memo
- Analytics & Reports
- Applicant examination/question management
- Exam scheduling
- Any new collaborator migration/API/UI affecting these modules

For each review, record:

1. starting/ending commit;
2. schema/migration impact;
3. auth/permission model;
4. data authority;
5. frontend behavior;
6. tests/build;
7. manual QA;
8. unresolved policy/fallbacks.

---

# 15. Immediate Priority Queue

This list is intentionally orderable and may change.

1. Continue collecting missing-feature/process notes from the project owner.
2. Audit Applicant Examination + Exam Scheduling to separate implemented vs incomplete behavior.
3. Design Faculty identity / multi-permission architecture, taking existing `CustomRole` / `RoleFeatureAccess` into account.
4. Redesign Adviser eligibility/capacity under the future Faculty model.
5. Design institutional officials + academic master-data authority needed by official forms.
6. Review collaborator work: email, notifications, announcement, memo, analytics.
7. Fix Admin scheduling-stage requirement/document visibility.
8. Design Admin Student document/submission overview and fallback matrix.
9. Revisit reusable signature profile architecture.
10. Continue Chatbot/RAG implementation planning/audit.
11. Resolve Defense Application Amount Paid / O.R. client policy when available.

---

# 16. Checklist Maintenance Rule

When a new requirement is discovered:

```text
Discuss / clarify target behavior
        ↓
Add or update this checklist
        ↓
Mark dependency / client decision / audit need
        ↓
Create a bounded implementation plan
        ↓
Implement
        ↓
Independent source review
        ↓
Manual QA where applicable
        ↓
Mark ACCEPTED
```

Do not mark a feature accepted because a page, model, or route merely exists. Acceptance should reflect the bounded feature contract, authoritative data source, authorization, tests, and project-owner QA appropriate to that feature.
