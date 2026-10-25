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
- 🚧 **ACTIVE PACKAGE** — current approved design/implementation focus; work is in progress and must not be treated as accepted until implementation, verification, and project-owner review are complete.
- ⏳ **PLANNED** — agreed direction / known requirement, not yet implemented.
- ❓ **DECISION REQUIRED** — client/project-owner policy or architecture must be settled first.
- 🐞 **KNOWN GAP / BUG** — current behavior is insufficient or incorrect.
- 🚫 **DEFERRED** — intentionally postponed.

---

## Current implementation focus — Defense Schedule & Committee Correction

**Current phase:** The Pre-Defense Document Integrity initiative is accepted and merged to `main` through PR #41 at merge commit `3aa00efb6264a5f92dd09d4f9feade143682a68f`. DEF-CORR-1 Checkpoint C is implemented but remains an active package awaiting independent remote review and project-owner acceptance. PREDEF-3 remains deferred.
**Target implementation branch:** `feat/defense-schedule-committee-correction`.
**Starting HEAD:** `3aa00efb6264a5f92dd09d4f9feade143682a68f`.
**Implementation plan:** `docs/superpowers/plans/2026-10-24-defense-schedule-committee-correction.md`  
**Goal:** allow authorized Admins to correct an already-scheduled defense's date/time/venue and manually assigned committee before the defense starts, while preserving committee policy, historical attribution, and an automatic immutable audit trail.

| Status | Package | Scope |
| --- | --- | --- |
| ✅ | PREDEF — Pre-Defense Document Integrity & Visibility | PREDEF-1A, PREDEF-1B0, PREDEF-1B/1C, PREDEF-2, and PREDEF-UI-COPY are accepted and merged through PR #41. Exact manuscript authority, GS-017 integration, scheduled submission context, Student Defense Application visibility, and the accepted PREDEF wording/flow are now part of `main`. |
| 🚧 | DEF-CORR-1 — Manage Schedule & Committee | Active package: Admin-only correction while the exact session remains `SCHEDULED`. Editable scope is defense date, time, Venue / Meeting Details, Chairman, Panelists, Rapporteur, and Facilitator. Proposal/Final Adviser remains automatic from the authoritative AdviserAssignment. No mandatory reason field. Every successful correction must atomically write actor + exact schedule + before/after state to AuditLog and revalidate the canonical committee policy. |
| 🚫 | PREDEF-3 — Certified-manuscript correction / exact-document rebinding fallback | Deferred rare recovery case. Do not mix it into DEF-CORR-1. |
| ⏳ | Post-start committee amendment | Separate future recovery package for exceptional substitution after the session has left `SCHEDULED`; normal DEF-CORR-1 editing must lock from `IN_PROGRESS` onward. |

### DEF-CORR-1 current audit baseline

| Action | Current actor/history coverage | DEF-CORR-1 direction |
| --- | --- | --- |
| Defense Application approval/rejection | Existing `AuditLog.actorId` + canonical defense-review action | Preserve unchanged. |
| Initial defense scheduling | `DefenseSchedule.setById` + `createdAt` identify the scheduling Admin | Add a canonical schedule-created AuditLog event going forward; do not remove `setById`. |
| Initial committee assignment | Created in the same scheduling transaction, therefore attributable to the scheduler, but no dedicated roster audit event exists | Include the initial roster in the schedule-created audit snapshot. |
| Post-scheduling schedule/committee correction | Not implemented | Add one transactional correction mutation with automatic immutable before/after audit. |
| Historical pre-defense annotations/comments | Assignment-bound author identity exists | Never rewrite author identity when a member is replaced; preserve referenced historical assignment rows while removing future active-session authority. |

### DEF-CORR-1 implementation checkpoints

DEF-CORR-1 stays on **one branch** and remains **one acceptance package**. The following are sequential review boundaries so the coding agent does not attempt the entire cross-cutting change in one pass.

| Status | Checkpoint | Scope / stop condition |
| --- | --- | --- |
| ✅ | A — Backend authority + assignment lifecycle | Implemented and accepted for continuation at `ed3d6c3e70231a67c045eead9b6609a8baceeac5`. Added `PanelAssignment.isActive` + additive migration `20261024230000_panel_assignment_active_lifecycle`, active-authority filtering, Admin-only `PATCH /defense/schedules/:scheduleId`, canonical committee revalidation, exact schedule/manuscript preservation, initial-schedule + correction AuditLog events, and historical-assignment preservation. Verification: 27 focused tests passed; full backend 192 files / 2,473 tests passed / 5 conditional skips / 0 failures; Prisma generate/validate, TypeScript, and backend build passed. |
| ✅ | B — Manage Schedule & Committee UI | Implemented and accepted for continuation at `c408488ddbac186b167961086512d8d143d4d01f`. Scheduled detail remains read-only by default; `Manage Schedule & Committee` is available only while the exact session is `SCHEDULED`; correction preloads the exact schedule/current active roster, reuses the accepted schedule/committee/review components, keeps Proposal/Final Adviser Automatic and out of the PATCH payload, confirms changes, refreshes the exact schedule after save, and preserves Cancel/no-op behavior. Verification: frontend typecheck passed, scoped ESLint passed, Checkpoint B verifier 11/11 passed, combined scheduling/adviser verification 18/18 passed, production build passed, and local browser/manual QA passed with the QA record restored afterward. No backend contract change or new migration was introduced. |
| 🔍 | C — Notifications + consolidated integrity verification | Implemented at `0403144`; awaiting independent remote review and project-owner acceptance. Reused existing `NotificationType.DEFENSE_SCHEDULE` / `DEFENSE_ASSIGNMENT` for best-effort correction notices; fixed initial scheduling to use the actual `defense_schedule` template; verified removed-member denial and added-member authority; ran full backend/frontend verification and final browser QA. No notification-system redesign or schema change. |

Checkpoint A/B acceptance is for continuation only; it does not equal full DEF-CORR-1 acceptance. Checkpoint C is implemented, but DEF-CORR-1 becomes ✅ only after final independent remote review and project-owner acceptance.

### Checkpoint A implementation evidence

- **Accepted-for-continuation ending HEAD:** `ed3d6c3e70231a67c045eead9b6609a8baceeac5`.
- **Production/schema commit:** `c2cc59c54201c660a1144829d31655bd2520e236`.
- **Follow-up test commit:** `ed3d6c3e70231a67c045eead9b6609a8baceeac5`.
- **Migration:** `20261024230000_panel_assignment_active_lifecycle` adds `panel_assignments.is_active BOOLEAN NOT NULL DEFAULT true` without destructive rewrite/backfill.
- **Authority behavior:** current roster/live authority filters to active assignments; replaced assignments remain preserved by exact ID for historical annotation/comment and official-record attribution; previously inactive users may be safely reactivated under the existing schedule/user uniqueness constraint.
- **Correction API:** Admin-only `PATCH /defense/schedules/:scheduleId`, allowed only while the exact session remains `SCHEDULED`, with Proposal/Final Adviser resolved server-side and Title remaining Adviser-free.
- **Audit:** `DEFENSE_SCHEDULE_CREATED` and `DEFENSE_SCHEDULE_CORRECTED`; correction before/after snapshots are written transactionally so audit failure rolls back the mutation.
- **Verification evidence:** 27 focused tests passed / 0 failed; full backend suite 192 files passed / 2,473 tests passed / 5 conditional skips / 0 failures; `prisma generate`, `prisma validate`, `tsc --noEmit`, and backend build passed.
- **Local database note:** the new `20261024230000_panel_assignment_active_lifecycle` migration was subsequently applied before Checkpoint B runtime/browser QA.
- **Not executed:** live multi-connection contention test, browser/manual QA, hosted CI.
- **Deferred to C:** correction notification/email refinement.
- **Scope confirmed:** frontend/UI work was not started in Checkpoint A.

### Checkpoint B implementation evidence

- **Accepted-for-continuation ending HEAD:** `c408488ddbac186b167961086512d8d143d4d01f`.
- **Files changed:** Scheduling page + shared review/types + Scheduled detail + new bounded correction editor + focused verifier; no backend source/schema/migration changes.
- **Interaction:** Scheduled detail remains read-only until Admin deliberately chooses **Manage Schedule & Committee**; edit mode exists only for `SCHEDULED`.
- **Payload:** exact schedule-scoped PATCH sends date/time/venue + manual Chairman/Panelist/Rapporteur/Facilitator assignments only. Proposal/Final Adviser is displayed as Automatic and excluded from the payload; Title has no Adviser seat.
- **Refresh behavior:** successful save invalidates/refetches the exact scheduled detail and affected Scheduling/Application caches, keeps the same selected schedule, and exits edit mode.
- **Conflict behavior:** backend `409` triggers authoritative refresh; if the session has left `SCHEDULED`, correction closes and the latest state is shown.
- **Verification:** frontend `tsc --noEmit` passed; scoped ESLint passed; Checkpoint B verifier **11/11** passed; combined Adviser/scheduling verification **18/18** passed; production build passed.
- **Manual/browser QA:** executed locally and passed for Proposal correction, member replacement, Automatic Adviser, persisted re-entry, Cancel discard, no-op Save guard, and non-`SCHEDULED` lock; QA record restored afterward.
- **Not executed:** hosted CI / production-runtime validation.
- **Future hardening note:** the complete-state PATCH has no optimistic concurrency/version token, so simultaneous Admin edits can still produce last-write-wins behavior. This is not part of DEF-CORR-1 Checkpoint C unless separately approved.
- **Scope confirmed:** no notification/email refinement, Audit Log UI, post-start substitution, Adviser correction, scoring/RAP/conclusion/PDF change, schema change, or migration was introduced in Checkpoint B.

### Checkpoint C implementation evidence

- **Implementation commit:** `0403144`.
- **Notification audit:** the initial scheduling path called nonexistent `defense_scheduled` with panelist-oriented tags; the seeded template is `defense_schedule` with `student_name`, `defense_date`, `defense_time`, and `venue`. The initial path now uses that template and sends to the Student.
- **In-app behavior:** correction notifications reuse existing `NotificationType.DEFENSE_SCHEDULE` and `DEFENSE_ASSIGNMENT`.
- **Effects:** schedule changes notify the Student/current active committee; added members receive one assignment notice; removed members receive one removal notice; role changes use one assignment notice; unchanged members receive no assignment notice.
- **Deduplication:** one intentional notice per affected user; schedule+roster corrections do not duplicate assignment and schedule messages.
- **Failure boundary:** notifications are best-effort after the committed transaction. Notification failure cannot roll back correction, AuditLog, or roster authority.
- **Email decision:** correction email was intentionally not expanded because no compatible assignment/removal template exists. Initial scheduling email was corrected to the real seeded student template.
- **Authority verification:** removed member returned `403` from the exact Defense Workspace; added member returned `200` with the new `PANELIST` role; historical attribution and unchanged-member dedup remain test-covered.
- **Adviser invariant:** Proposal/Final Adviser remains automatic/server-derived and excluded from client correction; Title remains Adviser-free.
- **Backend verification:** full suite 194 files / 2,483 tests passed / 5 environment-conditional skips / 0 failures; Checkpoint C focused tests 31/31 passed; Prisma generate/validate passed; migration status up to date; TypeScript/build passed.
- **Frontend verification:** TypeScript, scoped ESLint, Checkpoint B + Adviser/scheduling verifiers 18/18, and production build passed.
- **Browser/manual QA:** executed locally and passed for correction, notifications, removed-member `403`, added-member `200` as `PANELIST`, unchanged-member single notice, and non-`SCHEDULED` lock. Test fixture restored afterward.
- **Not executed:** hosted CI.
- **Remaining risk:** simultaneous Admin edits remain last-write-wins; initial-scheduling committee email is not expanded because only a student-facing seeded schedule template exists.
- **Status:** Checkpoint C implemented — awaiting independent remote review and project-owner acceptance. Overall DEF-CORR-1 is not yet accepted or merged.

### Active-package guardrail

`🚧` means the feature is approved for implementation but is **not yet accepted**. DEF-CORR-1 moves to ✅ only after bounded implementation, focused/proportional automated verification, independent remote source review, required manual/browser QA, and project-owner acceptance. Do not broaden this package into post-start substitution, Adviser correction, PREDEF-3 rebinding, scoring/conclusion changes, or notification-system redesign.

---

# 1. Official Defense Documents

| Status | Item | Current / target state |
| --- | --- | --- |
| ✅ | Individual Oral Examination Criteria PDF | Server-generated official evaluator form from exact finalized evaluator record. |
| ✅ | Bundled Individual Evaluations PDF | One Admin download/print packet for Chairman + Panelists, one evaluator form per page. |
| ✅ | Oral Examination Summary PDF (GS-011) | Exact persisted summary/schedule-bound source; current integration accepted. |
| ✅ | Defense Application PDF (GS-006 / GS-007 family) | Admin generation/download integrated for exact schedule. |
| ✅ | Student read-only completed Defense Application record | PREDEF-2 accepted and merged: owning Student can View/Download the completed Defense Application in the existing scheduled status surface; dedicated ownership-checked availability/PDF routes use the accepted exact application source/mapper/renderer. No upload control is introduced. Do not add redundant prose explaining that no upload/submission is required when the visible read-only actions already communicate that state. Incomplete forms withhold controls. |
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
| ✅ | GS-011 stage-aware Adviser layout | Accepted after implementation, independent remote source review, and project-owner visual QA: explicit `stage` contract; Title omits the entire `Concurred In` / Adviser signature rule / `Thesis/Dissertation Adviser` block and moves Dean `Attested` into the freed lower-page region; Proposal/Final keep the block and require exactly one ADVISER `PanelAssignment` on the exact defense schedule. Missing/ambiguous Adviser seats fail closed; no current/live Adviser fallback. |
| 🟡 | Adviser Certification PDF (GS-017) + Adviser certification guardrail | PREDEF-1A renderer is accepted, but live integration remains incomplete. PREDEF-1B0 first establishes exact version-bound manuscript-title authority; PREDEF-1B/1C then maps the issued `reviewedDocumentId` document into the accepted renderer, shows exact title + file before Certify & Sign, and provides bounded Adviser/Student/Admin record visibility. GS-017 remains system-owned and is never a Student upload requirement. |
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

Current repository and institutional-reference facts:

- `Program` already stores `programName`, `programType`, and a nullable `department` string.
- The project-owner-supplied Graduate School program reference explicitly shows Graduate School programs and Major/Specialization groupings, but does not establish a separate Department layer.
- The project-owner-supplied MAT-Math curriculum reference identifies **Master of Arts in Teaching Major in Mathematics (MAT-Math)** with effective date **S.Y. 2024-2025**.
- That MAT-Math reference organizes the curriculum into Foundation, Major, Cognate, and Thesis groups totaling **30 units**, and separately lists graduation requirements including Comprehensive Examination, Thesis, and at least one publication.
- Therefore the current normalized direction is **Graduate School → optional Department (only if later verified) → Program → Major/Specialization → Curriculum Version → Curriculum Courses**. Department must not be invented merely because the current `Program.department` string exists.

| Status | Item | Current / target state |
| --- | --- | --- |
| 🟡 | Program data | Program model exists; current data still needs an Admin-managed master-data direction. |
| ❓ | Department layer | Verify from an authoritative EARIST organizational/academic source before normalizing or requiring Department. The supplied Graduate School program reference does not establish a Department layer. |
| ⏳ | Program management | Admin CRUD / active-state authority for Graduate School programs. |
| ⏳ | Major / specialization management | Structured relationship where a program requires a major/specialization; the supplied Graduate School program reference confirms this concept for several programs. |
| ⏳ | Graduate School → Program → Major/Specialization structure | Treat this as the currently evidenced academic hierarchy. Insert Department only if an authoritative institutional source later confirms it. |
| ⏳ | Curriculum master / version | A Program + Major/Specialization may have one or more effective curriculum versions. The MAT-Math reference establishes an example effective version for S.Y. 2024-2025. |
| ⏳ | Curriculum course groups | Support authoritative curriculum groupings such as Foundation, Major, Cognate, Thesis, and future institution-defined categories without hardcoding one program's structure globally. |
| ⏳ | Curriculum course/unit requirements | Store course code, title, units, group, ordering, required/optional status, and group/overall unit requirements from the authoritative curriculum version. |
| ⏳ | Student curriculum assignment | Bind each Student academic career to the applicable curriculum version rather than deriving the degree checklist from the latest COR. |
| ⏳ | Curriculum Checklist / Academic Progress UI | Show the full assigned degree curriculum with Completed / In Progress / Remaining status and earned-vs-required units. This is broader than the Student's current-semester COR. |
| ⏳ | COR ↔ curriculum reconciliation | COR remains current enrollment evidence; enrolled subjects may be matched to curriculum courses, but the latest COR must not become the curriculum authority. |
| ⏳ | Comprehensive Exam eligibility integration | Future eligibility should consume authoritative academic progress plus the accepted institutional exam rules, not merely current enrollment state. |
| ⏳ | Thesis / defense eligibility integration | Where institutional policy requires prerequisite course/unit completion, derive it from the assigned curriculum version and authoritative Student progress. |
| ⏳ | Graduation requirement tracking | Track non-course requirements separately from course completion where applicable, including Comprehensive Examination, Thesis, publication, and future program-specific requirements. |
| ⏳ | Curriculum history / version preservation | Existing Students remain bound to their applicable curriculum version when a newer curriculum is introduced; do not silently rewrite historical academic requirements. |
| ⏳ | Defense form Course & Major display | Derive Course/Major from authoritative academic master data instead of renderer-specific string manipulation. |
| ❓ | Historical academic labels | Decide whether renamed programs/majors require historical snapshots for previously generated records and completed academic careers. |

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
| 🐞 | Ready for Scheduling requirement visibility | Continue auditing the exact Ready/Scheduling handoff so Admin has sufficient current-stage evidence context before confirming the schedule. |
| ✅ | Scheduled-defense submission context | PREDEF-2 accepted and merged: Scheduling & Panels → Scheduled retains exact schedule manuscript/title/file identity, exact matching Proposal/Final GS-017, and stage-current COR/receipt with read-only replacement history. Missing/invalid manuscript bindings and ambiguous evidence/certifications fail closed. Title shows the exact Title package and no GS-017. Schedule ID supplies existing attempt identity; no new attempt-number policy or committee-correction authority. |
| ⏳ | Stage requirements panel | Scheduling workspace should expose the exact current-stage application requirements/documents needed for review without duplicating application authority. |
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
| 🚧 | Post-scheduling, pre-defense committee correction / member replacement (DEF-CORR-1; active on `feat/defense-schedule-committee-correction`). |
| ⏳ | Faculty becomes unavailable after scheduling. |
| ⏳ | Schedule cancellation / reschedule recovery. |
| 🚫 | Certified-manuscript correction / post-scheduling exact-document rebinding (PREDEF-3) — deferred rare fallback; prefer prevention through Adviser exact-document confirmation and Admin review. |
| ⏳ | Missing/corrupted/unreadable uploaded document recovery; treat this separately from the deferred certified-manuscript correction/rebinding fallback. |
| ✅ / 🟡 | Rejected application → corrected resubmission exists; continue auditing UX/history consistency. |
| ⏳ | Wrong program/academic master-data assignment correction. |
| ⏳ | Duplicate/stuck application recovery. |
| ⏳ | Student inactivity/return/reactivation without destructive reset. |
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
| ✅ | Historical manuscript comparison for prior vs current defense attempt — manual side-by-side `Compare with Current` is implemented using exact attempt-bound historical manuscripts; automatic text/visual/semantic diff and recommendation-compliance judgment remain deferred. |
| 🚧 | Post-scheduling, pre-defense committee correction / member replacement workflow (DEF-CORR-1 active). |
| 🚫 | CRDT/Yjs multi-author report editing remains deferred unless reprioritized. |

---

# 12. Document Lifecycle / Records

| Status | Item |
| --- | --- |
| ✅ | Managed private document storage metadata and current/superseded evidence model. |
| ✅ | Exact reviewed-document binding for Adviser Certification. |
| ✅ | Stage-scoped evidence for defense applications. |
| ⏳ | Unified Admin Student document/submission visibility surface. |
| ✅ | Panelist prior/current manuscript comparison for re-defense/history — manual side-by-side comparison is implemented; historical manuscript remains read-only and exact-attempt bound. |
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
4. Redesign public Landing / Login / Applicant Sign-up and credential-state routing around the future Faculty model.
5. Redesign Adviser eligibility/capacity under the future Faculty model.
6. Design institutional officials + academic master-data authority needed by official forms.
7. Review collaborator work: email, notifications, announcement, memo, analytics.
8. Fix Admin scheduling-stage requirement/document visibility.
9. Design Admin Student document/submission overview and fallback matrix.
10. Define Student inactivity/return/reactivation policy and Admin recovery flow.
11. Revisit reusable signature profile architecture.
12. Continue Chatbot/RAG implementation planning/audit.
13. Resolve Defense Application Amount Paid / O.R. client policy when available.
14. Run a system-wide wording/terminology audit as UI surfaces are redesigned and Faculty terminology is introduced.
15. Complete production-readiness/security/operations audit and convert blockers into bounded packages.
16. After core workflows stabilize, design returning-graduate / multiple-academic-career architecture.

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

---

# 17. Public Website, Login, Sign-up, and Credential UX

Current repository facts:

- the current Login page explicitly presents Applicant, Student, Administrator, Panelist, and Other Roles choices;
- Applicant authenticates with Applicant ID + password;
- Student authenticates with Student Number + existing password;
- Admin/Panelist/other roles use email + password;
- the current middleware forces first-login password change only when `role === "panelist"` and `mustChangePassword === true`;
- the current Change Password page itself is generic, but route access/enforcement is Panelist-specific;
- Applicant registration is the public sign-up flow and creates an Applicant account; Faculty/Admin account creation must not become public sign-up accidentally;
- COR promotion currently preserves the Applicant's existing password when the account becomes a Student.

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | Graduate School landing-page redesign | Redesign the public Graduate School landing experience to match the final GS-IS visual identity and clearly guide Applicant / Student / Faculty users. |
| ⏳ | Login-page redesign | Redesign visual hierarchy, credential guidance, responsive behavior, and error/success states. |
| ⏳ | Sign-up / Applicant registration redesign | Refresh the public Applicant registration experience while preserving verified registration rules and program-selection authority. |
| ⏳ | Panelist → Faculty terminology migration in auth UX | Login labels, redirects, routes, messages, session typing, guards, tests, and navigation must be reviewed when the account identity changes to Faculty. |
| ❓ | Future login entry model | Decide whether Admin remains a visible login choice or Faculty signs in once and receives Admin/module access from permissions. Do not lock this until the Faculty permission architecture is finalized. |
| ⏳ | Permission-aware post-login routing | Future Faculty users may have multiple capabilities. Redirect/navigation should not assume one mutually exclusive role maps to exactly one dashboard. |
| 🐞 | Role-specific forced password gate | Current middleware hardcodes forced password change to Panelist only. This will be incorrect after the Faculty refactor and is too narrow even for other temporary-password accounts. |
| ⏳ | Credential-state-based forced password change | Enforce `mustChangePassword` for any authenticated account that is explicitly flagged, regardless of Applicant/Student/Faculty/Admin identity, subject to safe exceptions for the change-password route itself. |
| ✅ / 🟡 | Applicant-created password → Student promotion | Current Student promotion keeps the Applicant's existing password. A promoted Student should not be forced to change a password merely because the role changed if the password was self-created and `mustChangePassword` is false. |
| ⏳ | Temporary/generated password policy | Faculty or any account provisioned with a temporary/default password should set `mustChangePassword = true` and be forced through the change-password flow before normal portal access. |
| ⏳ | Student temporary/reset credential behavior | If a Student is ever issued a temporary/reset password by an authorized workflow, the same generic `mustChangePassword` gate should apply. |
| ⏳ | Change-password UX redesign | Align the page visually with the redesigned auth surfaces and ensure safe return/login behavior after completion. |
| ⏳ | Auth regression coverage | Update login, middleware, NextAuth/session, role/permission routing, forced-password, and COR credential-handoff tests when Faculty/auth redesign is implemented. |

### Credential rule to preserve

`mustChangePassword` should represent **credential state**, not a permanent user role.

Conceptually:

```text
self-created trusted password
        → mustChangePassword = false

temporary/default/admin-issued password
        → mustChangePassword = true
        → authentication succeeds
        → only Change Password is allowed
        → successful password change
        → mustChangePassword = false
        → normal authorized portal access
```

Changing an account from Applicant to Student, or from the current Panelist concept to the future Faculty concept, must not by itself trigger password replacement unless the credential state actually requires it.

Public Applicant sign-up and privileged Faculty/Admin provisioning must remain separate security boundaries.

---

# 18. Student Inactivity, Drop/Stop-Out, and Return/Reactivation

Current repository facts:

- `AdmissionStatus` currently supports `APPLICANT`, `ENROLLED`, `GRADUATED`, and `DISMISSED`;
- there is no accepted first-class state yet for a Student who temporarily stops/drops but remains eligible to return;
- `ResidencyTracking` is currently tied one-to-one to the Student;
- thesis, adviser, COR, requirement, exam, and document history are already related to the same Student record and must not be deleted merely because the Student becomes inactive.

## Target principle

A returning Student must **resume from preserved authoritative history**. Admin reactivation must not be implemented as a destructive “reset student” action.

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | Temporary inactive / stopped-out lifecycle | Introduce an explicit non-destructive state or lifecycle representation for a Student who stops enrollment but may return. Exact terminology/policy must be confirmed with EARIST. |
| ❓ | ON LEAVE vs STOPPED/INACTIVE semantics | Confirm whether Graduate School distinguishes approved leave from ordinary non-enrollment/stop-out, and whether both require separate states. |
| ✅ | Preserve historical records principle | Existing thesis/defense/documents/COR/adviser/exam history must remain intact when the Student becomes inactive. |
| ⏳ | Admin Reactivate / Return Student flow | Provide a controlled review/action instead of resetting Student data. |
| ⏳ | Reactivation validation | Check current program validity, residency, curriculum, adviser status/capacity, thesis stage, pending requirements, and current enrollment/COR evidence as applicable. |
| ⏳ | Resume authoritative thesis progress | Do not automatically restart Title/Proposal/Final. Resume from the existing authoritative stage unless Graduate School policy explicitly requires revalidation/reset. |
| ⏳ | Adviser revalidation on return | If the existing Adviser is no longer eligible/active/available, use a controlled replacement workflow while preserving adviser history. |
| ❓ | Residency counting during inactivity | Confirm whether inactive/leave periods count toward maximum residency or may suspend/extend the clock. Never silently reset `residencyStartDate`. |
| ⏳ | Reactivation audit evidence | Record previous status, new status, actor, timestamp, and required reason/remarks. |
| ⏳ | Returning-student notifications | Notify relevant Student/Admin/Faculty parties when reactivation is approved or additional action is required. |
| 🔍 | Dismissed Student return policy | `DISMISSED` should not automatically be treated like ordinary stop-out. Confirm whether reinstatement/appeal is allowed and under what authority. |

### Guardrail

```text
Student stops / becomes inactive
        ↓
preserve all records
        ↓
Admin reviews return eligibility
        ↓
reactivate / resume with audit trail
```

Never:

```text
Student stops
        ↓
Reset Student
        ↓
erase thesis / adviser / files / academic history
```

---

# 19. Returning Graduate / Multiple Academic Careers

This is a known architectural requirement but may be implemented **after the core GS-IS workflows stabilize**.

Current repository facts:

- `Student.userId` is currently unique, so one User maps to one Student row;
- current Student fields such as `programId`, `studentNumber`, `admissionStatus`, `enrollmentDate`, and `residencyStartDate` represent one current academic journey;
- the current model therefore does not cleanly represent one person who has a completed Master's career and a new Doctoral application at the same time.

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | Same account for returning graduate | A Master's graduate applying for Doctoral should reuse the existing person/User account rather than create a duplicate identity. |
| ⏳ | Multiple admission applications | Support a new Doctoral application without overwriting the completed Master's history. |
| ⏳ | Multiple academic careers/program histories | Introduce a future AcademicCareer / StudentProgram-style layer so one Student/person can have separate Master's and Doctoral histories. Exact model naming/design is not yet locked. |
| ⏳ | Preserve completed degree history | Previous program, thesis, defenses, documents, adviser history, and graduation status remain immutable/history-visible while a new application proceeds. |
| ⏳ | Apply for Another Program workflow | Existing eligible graduates should be routed into a new application flow from their existing account. |
| ⏳ | Duplicate-account prevention | Existing email/identity should prompt sign-in and new-program application rather than creation of a second User. |
| ❓ | Student Number reuse vs new number | Confirm EARIST policy for returning graduates entering a higher degree. |
| ⏳ | Multi-context dashboard | Future UI should distinguish completed academic history from current application/enrollment context. |
| ⏳ | Auth/status decoupling | Applicant/Student state should eventually belong to an academic application/career context rather than forcing one global User role to represent all simultaneous history/current states. |
| 🕒 | Priority | Intentionally scheduled after higher-priority core features, but new work should avoid deepening the permanent assumption that one User can only ever have one academic journey. |


---

# 20. Production Readiness, Security, and Operations

These items are not all end-user features, but they are required before the system should be treated as production-ready.

## 20.1 Authentication and Account Recovery

Current repository facts:

- JWT/session lifetime is currently 24 hours;
- the redesigned generic `mustChangePassword` rule is still pending;
- no accepted self-service forgot-password/reset-token flow was found;
- the canonical UI/UX documentation explicitly leaves Admin-assisted Student password recovery as unimplemented.

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | Secure account recovery | Implement a controlled password-recovery/reset flow. Separate self-service recovery policy from Admin-assisted recovery. |
| ⏳ | Admin-assisted temporary password | Authorized Admin issues a secure random temporary password, sets `mustChangePassword = true`, records audit evidence, and does not expose/reuse a permanent default password. |
| ⏳ | Password-reset session safeguards | Password reset/change should invalidate or otherwise protect against stale authenticated sessions/tokens according to the final auth architecture. |
| ⏳ | Login abuse protection | Add server-side rate limiting/throttling and define lockout/backoff behavior for repeated failed authentication attempts without enabling trivial denial-of-service against legitimate users. |
| ⏳ | Sensitive-action reauthentication | Decide whether high-impact actions such as permission grants, account recovery, or institutional signature changes require recent authentication. |
| ⏳ | Auth audit events | Record security-relevant events such as successful/failed recovery, password changes, permission changes, account disable/enable, and high-privilege access changes. |

## 20.2 Health, Reliability, and Background Jobs

Current repository facts:

- `GET /api/health` exists but currently reports process/API availability only;
- email worker and cron startup imports/calls are currently commented out in `backend/src/index.ts`;
- graceful shutdown handling was not found in the current server entrypoint.

| Status | Item | Current / target state |
| --- | --- | --- |
| 🟡 | Basic health endpoint | `/api/health` exists. |
| ⏳ | Dependency-aware readiness | Add readiness checks appropriate to production dependencies: database, persistent document storage, and any required Redis/queue/email/local-AI service. A process being alive must not imply the whole system is ready. |
| ⏳ | Background worker production startup | Finalize how email queues/cron jobs start, retry, recover after reboot, and avoid duplicate processing. Current startup is not yet authoritative because worker/cron startup is commented out. |
| ⏳ | Graceful shutdown | Handle SIGTERM/SIGINT so HTTP/realtime traffic drains safely and database/queue resources close cleanly during restart/deployment. |
| ⏳ | Job retry/dead-letter behavior | Failed email/notification/background jobs need bounded retries, visible failure state, and Admin/operator recovery where appropriate. |
| ⏳ | Service restart policy | Production services (web/backend/DB/Redis/Ollama if used) must recover after machine reboot without manual developer commands. |

## 20.3 Monitoring, Logging, and Audit Operations

| Status | Item | Current / target state |
| --- | --- | --- |
| 🟡 | Domain audit infrastructure | `AuditLog` is already used in several workflows. |
| ⏳ | Structured production logging | Replace reliance on ad-hoc `console.log/error` for operational diagnosis with structured logs and severity. |
| ⏳ | Request/correlation IDs | Trace a user/API request across logs and background jobs without exposing sensitive data. |
| ⏳ | Error monitoring/alerting | Operators need actionable alerts for application crashes, repeated 5xx responses, failed jobs, unavailable dependencies, storage pressure, and similar incidents. |
| ⏳ | Metrics/dashboard | Track API health/latency/error rates, queue status, storage capacity, database health, and other operational signals. |
| ⏳ | Admin/operator audit viewer | Define a restricted audit surface for security/operational investigations; current audit records should not be exposed as a misleading generic user activity feed. |
| ❓ | Audit retention policy | Define how long security/domain audit records must be retained and who may access/export them. |

## 20.4 Backup, Restore, and Disaster Recovery

Current repository facts:

- production documentation already requires consistent database + private document-storage backups;
- the storage readiness guide explicitly says documentation is not proof that an actual restore rehearsal succeeded.

| Status | Item | Current / target state |
| --- | --- | --- |
| 🟡 | Backup/restore procedure | Operational guidance exists for database + document storage. |
| ⏳ | Automated scheduled backups | Establish production schedule, retention, encryption/access control, and off-host/off-machine copy as appropriate. |
| ⏳ | Verified restore rehearsal | Restore database + private storage into an isolated environment and prove records/files are usable. Repeat periodically. |
| ❓ | RPO / RTO | EARIST/project owner must define acceptable data-loss window and recovery-time objective. |
| ⏳ | Deployment rollback runbook | Define safe rollback behavior for application releases and forward-only database migrations. |

## 20.5 Deployment and Release Engineering

Current repository facts:

- GitHub Actions CI already runs frontend lint/build and backend build/tests on `main`;
- the CI file explicitly states it performs no deployment, live database, Prisma migration, or production-secret handling.

| Status | Item | Current / target state |
| --- | --- | --- |
| ✅ / 🟡 | CI validation foundation | Build/test CI exists; continue expanding release gates deliberately. |
| ⏳ | Staging environment | Maintain a production-like staging environment for migration, auth, email, file-storage, and multi-user acceptance before release. |
| ⏳ | Production deployment pipeline | Define build/artifact/container strategy, deployment command, service restart, migrations, and rollback. |
| ⏳ | Production migration gate | Use committed migrations with `prisma migrate deploy`; validate/rehearse migration chain before releases that change schema. |
| ⏳ | Environment/secrets validation | Fail startup for missing/unsafe required secrets and production configuration; keep secrets outside repository/source. |
| ⏳ | Release checklist/version record | Record deployed commit/version, migration state, backup prerequisite, readiness checks, and post-deploy smoke tests. |
| ⏳ | Dependency/security update policy | Establish periodic dependency vulnerability review and controlled upgrades rather than only updating during feature work. |

## 20.6 File Security, Storage, and Data Governance

Current repository facts:

- managed private storage, magic-byte validation for major managed flows, checksum/integrity metadata, direct `/uploads` blocking, and storage readiness tooling already exist;
- canonical document-lifecycle documentation still lists malware/CDR and retention/deletion policy as unresolved;
- several legacy path-based document models remain storage debt.

| Status | Item | Current / target state |
| --- | --- | --- |
| ✅ / 🟡 | Managed private storage foundation | Significant DL work is accepted; remaining legacy storage debt is already tracked. |
| ⏳ | Malware scanning / CDR decision | Decide and implement the institution-approved file scanning/quarantine strategy before production exposure to untrusted uploads. |
| ⏳ | Upload quarantine/failure handling | Unsafe/failed-scan files must never become authoritative workflow evidence. |
| ⏳ | Storage capacity alerts | Configure capacity thresholds and operational alerts before disk pressure causes failed uploads or data loss. |
| ⏳ | Integrity/orphan operations | Run and operationalize existing readiness/integrity tooling; define operator response to missing/orphan/mismatched objects. |
| ❓ | Records retention/deletion policy | Define retention periods for applications, student records, defense documents, raw research data, logs, and generated official records. |
| ❓ | Privacy/access policy | Confirm access/retention/publication rules for respondent/raw participant data, instruments, repository artifacts, and other sensitive records. |
| ⏳ | Legacy storage migration plan | Prioritize remaining path-only models when they become production blockers; do not silently assume DL metadata covers every file-bearing model. |

## 20.7 Production QA and Release Acceptance

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | End-to-end role journeys | Execute realistic Applicant → Student → Adviser → Defense → completion scenarios using production-like data and permissions. |
| ⏳ | Multi-user defense QA | Perform real concurrent Chairman/Panelist/Rapporteur/Admin browser QA for defense collaboration/signing, not only unit/source verification. |
| ⏳ | Authorization regression matrix | Verify every major route/action against unauthorized roles and cross-student/cross-defense access attempts. |
| ⏳ | Browser/responsive/accessibility gate | Establish supported browser/device baseline and complete keyboard/accessibility/responsive checks for critical workflows. |
| ⏳ | Performance/load test | Measure realistic concurrent use, large PDFs/files, defense polling/realtime, exam submissions, and Admin lists before production sizing. |
| ⏳ | Production smoke test | After each release, verify authentication, database connectivity, representative document upload/download, email/notification path, and critical dashboard/defense flows. |

---

# 21. Additional Functional Gaps Found During Production Review

| Status | Item | Current / target state |
| --- | --- | --- |
| 🐞 / 🔍 | Comprehensive Exam history/strike behavior | Canonical UI/UX documentation records that Comprehensive Exam recording can overwrite the latest record, making full attempt history/strike counts unreliable; controls/eligibility also need server-side review. This requires a separate functional package. |
| ⏳ | Account disable/reactivate policy | Define operational behavior when an Applicant/Student/Faculty account is disabled, including active sessions, assignments, scheduled defenses, and later reactivation. |
| ⏳ | Operator/system configuration inventory | Identify which production values must be Admin-configurable versus environment-only: adviser caps, academic master data, institutional officials, schedules/windows, email settings, and other confirmed policy values. Avoid hardcoding institutional policy. |

---

# 22. System Wording, Terminology, and Content Consistency

This is a cross-cutting UI/UX requirement. The system should not expose inconsistent, overly technical, stale, or role-confusing language even when the underlying workflow is correct.

Canonical wording guidance already exists in the UI/UX playbook. This checklist tracks the remaining system-wide application of those rules.

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | System terminology audit | Review visible labels, statuses, buttons, helper text, dialogs, empty states, errors, and navigation across Applicant, Student, Faculty, and Admin surfaces. |
| ⏳ | Panelist → Faculty wording migration | Replace outdated account-level `Panelist` wording where it means the broader future Faculty identity, while preserving defense-specific `Panelist` when it refers to an actual committee assignment. |
| ⏳ | User-facing vs implementation language | Keep API/model/internal lifecycle terms out of ordinary UI unless they serve a real administrative/audit need. |
| ⏳ | Consistent action verbs | Use one accepted phrase for the same action across pages, dialogs, notifications, and emails. |
| ⏳ | Consistent status labels | Map raw enums/internal states to clear user-facing wording without changing domain meaning. |
| ⏳ | Role-aware wording | Copy must reflect the actor's actual responsibility and avoid describing permissions/actions that the actor does not own. |
| ⏳ | Blocked-state explanations | When an action is unavailable, explain the authoritative reason and next responsible actor/action when useful. |
| ⏳ | Irreversible-action copy | Confirmations for finalize/sign/conclude/reject/reactivate/permission-change actions must state the real consequence clearly. |
| ⏳ | Error and recovery copy | Replace generic or technical errors with concise, actionable messages while preserving safe server-side detail handling. |
| ⏳ | Email/notification wording consistency | Email subjects/bodies and in-app notifications should use the same approved terminology as the portal. |
| ⏳ | Official-document wording boundary | Generated official forms follow the official EARIST template/approved exceptions; portal wording changes must not silently rewrite official form language. |
| ⏳ | Accessibility/plain-language pass | Labels, instructions, and validation messages should remain concise, understandable, and compatible with accessible controls. |
| ⏳ | Wording regression review | Every UI/UX package should include a terminology/copy check so fixed wording does not drift back on later pages. |

## Wording guardrails

Prefer:

```text
clear task label
+ authoritative status
+ available action
+ concise consequence / recovery guidance when needed
```

Avoid:

```text
raw enum names
database/model terminology
route/API language
engineering implementation details
duplicated explanatory paragraphs
different names for the same system concept
```

Examples of already accepted direction include:

- **Committee Report** instead of exposing internal `RapReport` terminology to ordinary Faculty users;
- **Finalize Committee Report** instead of engineering wording such as “freeze”;
- **Ready for Signatures / Awaiting Signatures** instead of exposing raw report-state enums;
- technical hashes, snapshot versions, and internal version counters remain hidden unless an Admin/audit/debug context genuinely needs them.

The wording audit must preserve institutional and academic terminology. It is a consistency/refinement task, not permission to rename confirmed EARIST concepts casually.
