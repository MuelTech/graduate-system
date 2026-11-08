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

### Current-state reconciliation rule

This checklist is a **current-state index**, not a chronological source of truth.
When a later explicit acceptance/merge checkpoint supersedes an earlier
progression checkpoint, the later checkpoint governs the current status.

- Historical progression notes may be retained for traceability, but they do
  **not** count as active pending work once clearly marked superseded.
- Current pending work is represented by the latest applicable non-✅ status:
  🟡 partial, 🔍 review required, 🚧 active, ⏳ planned, ❓ decision required,
  🐞 known gap, or 🚫 deferred.
- A package-level ✅ acceptance supersedes earlier statements such as
  “manual QA pending”, “review pending”, or “phase incomplete” for that same
  accepted scope.
- Acceptance of one subsystem does not imply whole-system production readiness.

---

## Recently completed implementation — Official Adviser Request Form (GS-020)

**Current phase:** GS020-1A renderer is accepted at `76bdd3c4f3c4525e528679009a1a93e123b81d26`, and GS020-1B Student signing / immutable finalized record / authorized View-Download integration is accepted at `0b3c9f756d66d16b9a27a680264780599bca9242` after automated verification, independent remote source review, and project-owner acceptance on 2026-10-25. The completed package was merged to `main` through PR #43 at merge commit `61c3e55aa3587b764144f91c93786598c0c38a1a`. Full end-to-end manual/browser QA was explicitly waived rather than reported as passed. The underlying Student request → Adviser CONFORME/DECLINE → Dean APPROVE/REJECT → active AdviserAssignment workflow remains authoritative.
**Accepted implementation branch:** `feat/official-adviser-request-form` (merged through PR #43).
**Starting `main` / branch HEAD:** `17d7953f40c6c26833f451cea395f3333a220be2`.
**Implementation plan:** `docs/superpowers/plans/2026-10-25-gs020-adviser-request-official-form.md`
**Goal:** reconstruct the current official GS-020 form, require an explicit Student e-signature for the exact Adviser Request before submission, freeze an immutable finalized GS-020 snapshot only after Adviser `CONFORMED` + Dean `APPROVED`, and provide authorized read-only View/Download access without storing a permanent PDF binary in the first implementation.

| Status | Package | Scope |
| --- | --- | --- |
| ✅ | GS020-1A — Official GS-020 renderer | Accepted at `76bdd3c4f3c4525e528679009a1a93e123b81d26`. Pure typed-input → PDF-bytes renderer, representative normal/long/signature/blank samples, focused renderer verification, independent remote source review, and project-owner visual acceptance completed. No live workflow/API/frontend/schema integration was included. |
| ✅ | GS020-1B — Finalized record integration | Accepted at `0b3c9f756d66d16b9a27a680264780599bca9242`. Exact-request Student e-signature, write-once signed state, atomic Dean approval + immutable official snapshot + AdviserAssignment, on-demand PDF generation, and ownership/role-scoped Adviser Request View/Download are implemented. Legacy unsigned requests are not backfilled/fabricated. Full manual/browser QA was waived by the project owner. |
| ⏳ | Institutional Dean display integration | For this package, keep the printed Dean identity/signature area blank because no authoritative institutional office-holder source is configured yet. A future System Settings / Institutional Officials package may populate new snapshots only; it must not rewrite older finalized GS-020 snapshots. |

### GS020-1A acceptance evidence

- Implementation commit: `76bdd3c4f3c4525e528679009a1a93e123b81d26`.
- Focused renderer verification reported: **22 passed / 0 failed**; forms script typecheck, backend build, and rasterized sample generation passed.
- Independent remote source review found the implementation bounded to renderer/types/tests/sample tooling/package-local documentation only, with no Prisma/API/workflow/frontend/schema/snapshot integration.
- Project owner reviewed the generated form and accepted the visual result on 2026-10-25.
- GS020-1B subsequently proceeded only after explicit authorization and is now accepted as recorded below.

### GS020-1B acceptance evidence

- Implementation commit: `0b3c9f756d66d16b9a27a680264780599bca9242`.
- Automated verification reported: **255 focused backend checks passed**; full backend suite **2,571 passed / 5 skipped / 0 failed** across 198 files; new frontend verifier **18 passed**; combined affected frontend verifiers **118 passed**; Prisma generate/validate and backend/frontend build/type/lint checks passed.
- Migration `20261025180000_adviser_request_signed_records` was reported applied successfully to local MySQL; no legacy signatures or snapshots were backfilled.
- Independent remote review confirmed exact signed-state preservation, one finalized record per request, atomic approval/snapshot/assignment, fail-closed legacy behavior, role/ownership authorization, raw-signature privacy, and reuse of the accepted renderer.
- Project owner accepted GS020-1B on 2026-10-25 and explicitly waived further full manual/browser QA. A legacy-account spot check confirmed that older active AdviserAssignments without authoritative new signing/snapshot evidence do not receive a fabricated finalized record.
- Hosted CI was not present/verified for the implementation commit at review time.
- User-facing record wording remains **Adviser Request** with **View Adviser Request** / **Download Adviser Request**; form code/revision stays inside the official PDF.

### GS-020 accepted design boundaries

- **Finalized-only official document:** no official downloadable GS-020 before Adviser `CONFORMED` + Dean `APPROVED`.
- **Student e-signature:** after choosing an eligible Adviser and reviewing the exact request, the Student must explicitly sign the request before submission; the signature evidence and `signedAt` belong to that exact request.
- **Adviser authority:** Student selection is a request/nomination only. The requested Adviser must still explicitly CONFORME or decline. The supplied form does not establish a separate Adviser signature-image requirement, so do not invent one.
- **Dean authority:** existing Dean/Admin approval remains authoritative workflow evidence, but printed Dean name/signature remain blank until an approved institutional-office-holder source exists.
- **Immutable snapshot, not stored PDF:** after final approval, preserve the exact GS-020 display data/signature evidence/form revision as an immutable snapshot and render the PDF reproducibly on demand. Do not rebuild an old GS-020 from mutable current/latest profile or office-holder data.
- **Visibility:** owning Student, the requested Adviser for that request, and authorized Admin may View/Download the same finalized GS-020 record. Other defense participants do not gain access merely from committee membership.
- **Student placement:** the primary Student surface remains `/student/thesis/adviser-request`; the finalized record appears there after approval rather than on a separate mandatory-upload page.
- **No upload loop:** GS-020 is system-owned output. The Student must never download it merely to upload it back.
- **Historical preservation:** later Adviser replacement/relationship changes must not rewrite or delete the old finalized GS-020.
- **Official-form fidelity:** do not add fields that are not supported by the supplied form solely because related data exists elsewhere in GS-IS.

## Recently completed implementation — Defense Schedule & Committee Correction

**Current phase:** The Pre-Defense Document Integrity initiative is accepted and merged to `main` through PR #41 at merge commit `3aa00efb6264a5f92dd09d4f9feade143682a68f`. DEF-CORR-1 is accepted and merged to `main` through PR #42 at merge commit `5a6131a7da997019b1d31e1387789bd75ec9f26e` after Checkpoints A/B/C, independent remote review, and project-owner manual UI acceptance on 2026-10-25. PREDEF-3 remains deferred.
**Accepted implementation branch:** `feat/defense-schedule-committee-correction` (merged through PR #42).
**Starting HEAD:** `3aa00efb6264a5f92dd09d4f9feade143682a68f`.
**Implementation plan:** `docs/superpowers/plans/2026-10-24-defense-schedule-committee-correction.md`  
**Goal:** allow authorized Admins to correct an already-scheduled defense's date/time/venue and manually assigned committee before the defense starts, while preserving committee policy, historical attribution, and an automatic immutable audit trail.

| Status | Package | Scope |
| --- | --- | --- |
| ✅ | PREDEF — Pre-Defense Document Integrity & Visibility | PREDEF-1A, PREDEF-1B0, PREDEF-1B/1C, PREDEF-2, and PREDEF-UI-COPY are accepted and merged through PR #41. Exact manuscript authority, GS-017 integration, scheduled submission context, Student Defense Application visibility, and the accepted PREDEF wording/flow are now part of `main`. |
| ✅ | DEF-CORR-1 — Manage Schedule & Committee | Accepted and merged through PR #42 at `5a6131a7da997019b1d31e1387789bd75ec9f26e`. Admin correction remains limited to exact `SCHEDULED` sessions; Proposal/Final Adviser stays automatic; exact attempt/manuscript identity and historical assignment attribution are preserved; AuditLog records immutable before/after state. |
| 🚫 | PREDEF-3 — Certified-manuscript correction / exact-document rebinding fallback | Deferred rare recovery case. Do not mix it into DEF-CORR-1. |
| ⏳ | Post-start committee amendment | Separate future recovery package for exceptional substitution after the session has left `SCHEDULED`; normal DEF-CORR-1 editing must lock from `IN_PROGRESS` onward. |

### DEF-CORR-1 current audit baseline

| Action | Current actor/history coverage | DEF-CORR-1 direction |
| --- | --- | --- |
| Defense Application approval/rejection | Existing `AuditLog.actorId` + canonical defense-review action | Preserve unchanged. |
| Initial defense scheduling | `DefenseSchedule.setById` remains preserved and `DEFENSE_SCHEDULE_CREATED` now records the authenticated Admin plus exact initial schedule/active-roster snapshot | Accepted DEF-CORR-1 behavior; no legacy backfill. |
| Initial committee assignment | Initial active roster is included in the same transactional `DEFENSE_SCHEDULE_CREATED` audit snapshot | Accepted DEF-CORR-1 behavior. |
| Post-scheduling schedule/committee correction | Admin-only transactional correction is implemented for exact `SCHEDULED` sessions with immutable `DEFENSE_SCHEDULE_CORRECTED` before/after audit | Accepted DEF-CORR-1 behavior. |
| Historical pre-defense annotations/comments | Assignment-bound author identity exists | Never rewrite author identity when a member is replaced; preserve referenced historical assignment rows while removing future active-session authority. |

### DEF-CORR-1 implementation checkpoints

DEF-CORR-1 stays on **one branch** and remains **one acceptance package**. The following are sequential review boundaries so the coding agent does not attempt the entire cross-cutting change in one pass.

| Status | Checkpoint | Scope / stop condition |
| --- | --- | --- |
| ✅ | A — Backend authority + assignment lifecycle | Implemented and accepted for continuation at `ed3d6c3e70231a67c045eead9b6609a8baceeac5`. Added `PanelAssignment.isActive` + additive migration `20261024230000_panel_assignment_active_lifecycle`, active-authority filtering, Admin-only `PATCH /defense/schedules/:scheduleId`, canonical committee revalidation, exact schedule/manuscript preservation, initial-schedule + correction AuditLog events, and historical-assignment preservation. Verification: 27 focused tests passed; full backend 192 files / 2,473 tests passed / 5 conditional skips / 0 failures; Prisma generate/validate, TypeScript, and backend build passed. |
| ✅ | B — Manage Schedule & Committee UI | Implemented and accepted for continuation at `c408488ddbac186b167961086512d8d143d4d01f`. Scheduled detail remains read-only by default; `Manage Schedule & Committee` is available only while the exact session is `SCHEDULED`; correction preloads the exact schedule/current active roster, reuses the accepted schedule/committee/review components, keeps Proposal/Final Adviser Automatic and out of the PATCH payload, confirms changes, refreshes the exact schedule after save, and preserves Cancel/no-op behavior. Verification: frontend typecheck passed, scoped ESLint passed, Checkpoint B verifier 11/11 passed, combined scheduling/adviser verification 18/18 passed, production build passed, and local browser/manual QA passed with the QA record restored afterward. No backend contract change or new migration was introduced. |
| ✅ | C — Notifications + consolidated integrity verification | Implemented at `0403144` and accepted after independent remote review + project-owner manual UI acceptance. Reused existing `NotificationType.DEFENSE_SCHEDULE` / `DEFENSE_ASSIGNMENT` for best-effort correction notices; fixed initial scheduling to use the actual `defense_schedule` template; verified removed-member denial and added-member authority; ran full backend/frontend verification and final browser QA. No notification-system redesign or schema change. |

DEF-CORR-1 is now ✅ **ACCEPTED on the feature branch**. Final independent remote review passed, and the project owner manually verified/accepted the UI result on 2026-10-25. The accepted pre-documentation implementation HEAD is `9615af591d47e4d004fb74926031a9192770886d`. The feature is merged to `main` through PR #42.

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
- **Final review:** independent remote review passed. Follow-up copy corrections removed inaccurate/redundant scheduling-success wording; final pre-documentation implementation HEAD: `9615af591d47e4d004fb74926031a9192770886d`.
- **Project-owner acceptance:** manual UI result reviewed and accepted on 2026-10-25.
- **Status:** DEF-CORR-1 is fully accepted and merged to `main` through PR #42 at `5a6131a7da997019b1d31e1387789bd75ec9f26e`.

### Accepted-package guardrail

DEF-CORR-1 is accepted for its documented scope on the feature branch. Acceptance does **not** broaden the feature: post-start substitution, Adviser correction, PREDEF-3 rebinding, scoring/conclusion changes, notification-system redesign, and optimistic-concurrency/version-token hardening remain separate future work. The accepted feature is now part of `main`; future changes must preserve the documented scope boundaries.

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
| ✅ | Adviser Certification PDF (GS-017) + Adviser certification guardrail | PREDEF-1A renderer, PREDEF-1B0 exact manuscript-title authority, and PREDEF-1B/1C live certification/visibility integration are accepted and merged through PR #41. GS-017 is generated from the exact issued `reviewedDocumentId`, the Adviser sees the exact title/file before Certify & Sign, and Adviser/Student/Admin receive the accepted bounded read-only record visibility. GS-017 remains system-owned and is never a Student upload requirement. |
| ✅ | Adviser Request PDF (GS-020) | Completed and merged through PR #43. The official EARIST-QSF-GS-020 Rev. 00 renderer, exact-request Student e-signature, immutable finalized snapshot after Adviser `CONFORMED` + Dean `APPROVED`, and on-demand read-only View/Download for Student/requested Adviser/Admin are implemented. Dean printed identity/signature remains blank until authoritative Institutional Officials configuration exists. |
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

# 4. Faculty and Administrator Access Management

**Canonical authority:** `docs/superpowers/FACULTY_ADMIN_ACCESS_SOURCE_OF_TRUTH.md`  
**Design specification:** `docs/superpowers/specs/2026-11-08-faculty-admin-access-design.md`

## Approved target

The conceptual system-role model remains exactly:

- Applicant
- Student
- Faculty
- Admin

The current broad `PANELIST` account identity is planned to migrate to **FACULTY** with compatibility/history preservation. Defense-specific Panelist/Chairman/Rapporteur/Facilitator/Adviser roles remain assignment-driven and are not permanent Faculty permissions.

Faculty and Admin are separate account roles in the approved target. Faculty does **not** receive Admin access. If one real person legitimately performs both functions, the approved target uses separate Faculty and Admin accounts.

### Current repository facts

- `UserRole` source includes `ADMIN`, `STUDENT`, `PANELIST`, `CUSTOM`, `APPLICANT`, and additive `FACULTY` (FACULTY-3; deployment/conversion not performed).
- `CustomRole` and `RoleFeatureAccess` already exist with `canView` / `canEdit` feature access.
- Defense assignment roles are separately represented by `PanelRole`: `CHAIRMAN`, `PANELIST`, `ADVISER`, `RAPPORTEUR`, `FACILITATOR`.
- current Panelist profile already contains `isExternal` and `isAvailableAsAdviser`.
- external panelists are already excluded from adviser candidacy.

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | Broad PANELIST identity → FACULTY | Approved target. Requires repository-grounded migration/compatibility design; do not blindly rename APIs/routes/data because Panelist remains a valid defense-assignment term. |
| ✅ | Faculty/Admin product architecture | Decision resolved by the canonical Faculty/Admin source of truth. Four roles remain Applicant / Student / Faculty / Admin; Faculty and Admin stay separate account roles. |
| ✅ | Direct-access foundation | FACULTY-1 accepted at `56b1ecbcb7806c1a3df9477d4b14f4cfa914f62e`: additive direct per-user grant/Admin-level storage, typed capability catalog, fail-closed resolver, protected access-event taxonomy and preflight format are in place. Enforcement remains intentionally off. |
| ✅ | Current-account auth / credential boundary | FACULTY-2 accepted for continuation at `62de9f536608b122fc0618cc4761c139baee34c9` after focused automated verification and independent remote commit-diff review. Selected role/activity validation, fresh REST/socket account checks, generic password gate, safe self-access/session refresh, and 401/403 separation are in place. Project owner confirmed normal login behavior; exhaustive browser edge-case QA was not claimed. See [report](reports/2026-11-08-faculty-2-current-account-authentication.md). No permission rollout. |
| ✅ | Faculty identity compatibility readers | FACULTY-3 accepted for continuation at `6d03ab79d56439e805114a9d5bfc5f08664379ac` after independent remote commit-diff/source review and project-owner sanity QA. Both legacy PANELIST and future FACULTY use bounded account readers and retained `/panelist` workflows with exact ownership/assignment checks. Forward migration expands the enum only; zero Users converted, no profile/history changes, no live grants. Focused compatibility checks/builds pass; broad-suite pre-existing failures are documented. Isolated real-DB rehearsal was safely skipped and remains a deployment-readiness limitation. See [report](reports/2026-11-08-faculty-3-identity-compatibility.md). FACULTY-4 implementation is tracked below. |
| ✅ | Full Administrator management foundation | FACULTY-4 accepted for continuation at `33b3910e90f9008f93a5b203c113088a7e2f4d46` after independent remote commit-diff/source/security review. Full-only backend uses strict DTOs, random temporary credentials, a transactional singleton fence, fresh actor checks, last-active-Full protection, atomic audit, and protected generic audit deletion. Management/direct-access rollout remain dormant; no real bootstrap/conversion or live Restricted accounts. 343 focused tests pass; 5 isolated MariaDB tests were safely skipped because no isolated endpoint is configured and remain a deployment-readiness gate. See [report](reports/2026-11-08-faculty-4-administrator-management.md). No UI; FACULTY-5 implemented / pending independent review. |
| ✅ | Admission and Student administrative guards | FACULTY-5 accepted for continuation at `e0fb5ad4ade4cb3c190310e9d7819afad4e99704` after independent remote commit-diff/source review. All 18 Applicant/Student/COR/waiver/comprehensive recording endpoints and aliases declare catalog capabilities with service checks and existing-transaction actor revalidation. Production remains dormant; no live Restricted access or Admin mapping, schema/migration, frontend work or FACULTY-6 implementation. Real DB contention remains a later readiness concern only. See [report](reports/2026-11-08-faculty-5-admission-student-guards.md). FACULTY-6 implemented / pending independent review. |
| ✅ | Examination administrative guards | FACULTY-6 accepted for continuation at correction HEAD `987b75bbceb1822798e5d2ce7fafe858fb956456` (original implementation `7fd57d941309170612c72941e50eb308eaf1cfff`) after independent remote commit-diff/source review and bounded least-privilege correction review. All 32 mapped Admin exam endpoints plus the 2 explicit legacy exclusions have route/business guards; interactive mutation transactions revalidate behind the shared access fence. The Exam Records list projection is explicitly bounded to the UI/business contract and does not expose credential/internal account fields. Focused implementation verification was 25 files / 718 tests PASS; correction verification was 4 files / 162 tests PASS; backend build and diff checks passed. Real DB contention was safely skipped because no isolated server is configured and remains a readiness limitation. Production remains dormant; no Admin mapping, live Restricted access, Faculty essay implementation, schema/migration, frontend or FACULTY-7 work. See [report](reports/2026-11-08-faculty-6-examination-administrative-guards.md). FACULTY-7 implemented / pending independent review. |
| ✅ | Defense and Adviser administrative guards | FACULTY-7 accepted for continuation at correction HEAD `ec68ff3d9ef4202f1321418467ed08e4cc642286` (original implementation `ff12c6cbe92ed7cda312c9e8af5b44f39b531fef`) after independent remote commit-diff/source review and bounded least-privilege correction review. The 25-endpoint capability matrix and 15 deferred/retired classifications were reviewed; operational Admin authority remains separate from exact academic assignments. Sensitive Dean/application/scheduling/correction writes revalidate current actor behind the shared access fence; manual committee identities are rechecked at the write boundary. Three legacy application lists now use explicit bounded Thesis/Student/User/Program/title/Adviser projections and omit `thesisDocuments` entirely. Agent-reported verification: original 36 focused files / 745 tests PASS; correction 7 files / 183 tests PASS; backend builds and diff checks passed. Real DB contention safely skipped due to no isolated endpoint; no schema/migration, frontend, live Admin mapping or Restricted activation. See [report](reports/2026-11-08-faculty-7-defense-adviser-administrative-guards.md). FACULTY-8 is accepted for continuation at correction HEAD `76cc0ae8da9e2aca109ccd729356f793faf909b6`; see the following checkpoint row. |
| ✅ | Private files and official-record guards | FACULTY-8 accepted for continuation at correction HEAD `76cc0ae8da9e2aca109ccd729356f793faf909b6` (original implementation `f94d02f87c471602a7a2a6e3f9a5775653790ac9`) after independent remote commit-diff/source review and bounded GS-011 frozen-attempt identity correction review. The five FACULTY-8 generic private-file classes plus GS-017, GS-020 and official Defense read/PDF boundaries were reviewed for current-account authority, least privilege, ownership/issuer preservation, cross-Student/attempt denial, raw-signature privacy and exact historical output. The correction adds fail-closed `scheduleId` / `defenseType` validation at both GS-011 source and mapping boundaries without mutating historical snapshots. Agent-reported package verification remains 847 passed / 5 Windows symlink skips with a 284-test affected rerun; correction verification was 2 files / 107 tests passed, backend build and `git diff --check` passed. Hosted CI/manual/browser/real-DB checks remain unclaimed. Enforcement remains code-owned/dormant; no schema/migration/frontend/FACULTY-9 work. See [report](reports/2026-11-08-faculty-8-private-file-official-record-guards.md). FACULTY-9 is tracked in the next row. |
| ✅ | Settings, operational surfaces and aggregate containment | FACULTY-9 accepted for continuation at `a22777becfb901973d2aec3e1548e360a60d25d0` after independent remote commit-diff/source review. Exact capability/key policies guard Settings, email templates/logs, storage diagnostics, Repository/Databank and Memo management/shared reads/attachments; dashboard queries only authorized module sources. Raw respondent data remains exact current Student-researcher only in the enabled target; Full/repository authority never substitutes for it. Generic audit deletion, Expert assignment and legacy Faculty administration remain denied pending their owning authority/package; protected security/access audit deletion is preserved. Agent-reported verification: 43 affected files / 1,212 tests passed, no skips; final 2-suite rerun 281 passed; backend build and diff checks passed. The independent review verified the pushed source/diff and regression intent, not a second execution of those commands. Hosted CI/manual/browser/real-DB verification remains unclaimed. Enforcement remains code-owned/dormant; no schema/migration/frontend/live provisioning or Restricted rollout. See [report](reports/2026-11-09-faculty-9-operational-aggregate-guards.md). FACULTY-10 is tracked in the following row. |
| ✅ | Faculty configuration and new-Adviser eligibility backend | FACULTY-10 accepted for continuation at `772e2837ec1ffc6cce4f64a12201480f065a3c33` after independent remote commit-diff/source review. Bounded `faculty.view`/`faculty.manage` backend replaces the legacy exclusion with current-account authority, secure random temporary credentials, academic-target validation, strict profile/status/classification/availability and school-wide `essay.evaluate` configuration. Legacy unaudited Faculty writers and unrestricted Adviser-directory access are retired in the enabled target. Fenced mutations and protected atomic audit preserve credentials/history. Enabled self-service availability is denied; candidate/request/approval checks share canonical eligibility, with DR-6/DR-7 fail-closed conflicts that preserve signed evidence and current/historical relationships. Management remains code-owned/dormant; no real grants/provisioning, schema/migration, data conversion or live rollout. Agent-reported verification: 45 affected files / 1,586 tests passed, zero failures/skips; final FACULTY-10 run 4 files / 185 tests passed; backend build and diff checks passed. The independent review verified the pushed source/diff and regression intent, not a second execution of those local commands. Hosted CI/browser/manual/real-DB contention verification remains unclaimed. See [report](reports/2026-11-09-faculty-10-configuration-adviser-eligibility.md). FACULTY-11 is accepted for continuation at `8c554405d39fc9685e71ba380512c4dd0bd9e03d`; FACULTY-12 accepted for continuation at `c0059b9ebd0de569bb07d34a224506e0aa44f779`; FACULTY-13 remains deferred / not started. |
| ✅ | Faculty configured access backend | Initial direct Faculty access remains **Essay Evaluation** through the established `essay.evaluate` capability. FACULTY-10 accepted the backend configuration path at `772e2837ec1ffc6cce4f64a12201480f065a3c33`; only that approved Faculty-category direct grant is accepted. FACULTY-11 accepted the bounded UI presentation/configuration path at `8c554405d39fc9685e71ba380512c4dd0bd9e03d`; raw capability keys are not exposed and live grant activation remains deferred. |
| ✅ | Faculty Essay Evaluation backend | FACULTY-12 accepted for continuation at `c0059b9ebd0de569bb07d34a224506e0aa44f779` after independent remote commit-diff/source review. Dedicated school-wide pending queue/detail/grade and exact frozen essay-media helper use current FACULTY/legacy PANELIST identity, active User/profile, password readiness and the accepted essay grant resolver. B7 frozen/finalized eligibility and the shared B7/B8 writer remain authoritative; Faculty receives no MCQ/result/Admin breakdown. Shared fence and evaluator/profile/application locks revalidate waiting graders; target Admin academic grading remains denied when the FACULTY-12 target is composed; dormant legacy compatibility remains unchanged while all gates are off. Code-owned gate remains false; no live grant activation, frontend, schema/migration or Program evaluator mapping. Agent-reported verification: 23 suites / 916 tests passed; 5 isolated MariaDB contention cases safely skipped because no separate test server was configured; backend build and diff checks passed. Independent review verified the pushed source/diff and regression intent, not a second execution of those commands. Real InnoDB lock-race proof remains an activation-readiness gate. Hosted CI was not observed; browser/manual QA was not applicable to this backend-only package. See [report](reports/2026-11-09-faculty-12-essay-evaluation-backend.md). FACULTY-13 remains deferred / not started pending project-owner approval. |
| ⏳ | Dynamic Faculty dashboard/navigation | Dashboard and sidebar must reflect effective Faculty work from Essay Evaluation access plus authoritative Adviser/Defense assignments. Do not show irrelevant zero-value work areas. |
| ✅ | Defense roles are contextual | Chairman / Panelist / Rapporteur / Facilitator / Adviser are not permanent Faculty permission checkboxes; authority continues to come from exact workflow assignments. |
| ⏳ | Internal / External Faculty migration | Preserve affiliation classification. External Faculty may participate in permitted defense work but cannot be assigned as Adviser. |
| ⏳ | Admin-controlled Available as Adviser | Authorized Admin controls whether an **Internal** Faculty member is currently available to receive a new Adviser assignment. External Faculty are never available as Adviser. |
| ✅ | Dedicated Faculty Management | FACULTY-11 accepted for continuation at `8c554405d39fc9685e71ba380512c4dd0bd9e03d` after independent remote commit-diff/source review. Faculty list/detail/create/edit, status/classification, Essay Evaluation, Internal-only Adviser availability, one-time temporary-credential handoff, and the User Management `Faculty` label are implemented against the accepted FACULTY-10 contract. A bounded server-derived `{ canManage }` projection controls mutation presentation without exposing raw Admin grants or pulling generic permission-aware navigation forward; optional assignments remain deferred because no safe bounded summary exists. Legacy surname-password copy and editable password management are removed. Agent-reported verification: 20 focused frontend checks, 156 focused backend tests, TypeScript/scoped ESLint, frontend/backend builds and diff checks passed; 3 synthetic Chrome scenarios passed and screenshots were inspected by the implementation agent. Independent review verified the pushed source/diff and regression intent, not a second browser execution or screenshot inspection. Hosted CI was not observed; project-owner manual acceptance remains separate. Management remains code-owned/dormant with controlled 503 behavior, not a live rollout. See [report](reports/2026-11-09-faculty-11-management-ui.md). FACULTY-12 implemented / pending independent review; FACULTY-13 deferred / not started. |
| ⏳ | Dedicated Administrators Management | Admin accounts are managed separately with **Full Administrator** / **Restricted Administrator** access levels and direct per-Admin capabilities. |
| ✅ | Full Administrator terminology/authority | Approved administrative authority model. Full Administrator is not a fifth role; it is an Admin account with complete approved administrative capabilities plus Administrator-access management. |
| ⏳ | Restricted Administrator capabilities | Restricted Admin sees/uses only explicitly granted administrative modules/actions; backend enforcement is required. |
| ⏳ | Custom Roles retirement | User-facing Custom Roles is retired in the target UX. Existing `CUSTOM` / `CustomRole` / `RoleFeatureAccess` must be audited for reuse/migration rather than blindly deleted. |
| ⏳ | Backend permission enforcement | API authorization must enforce Faculty/Admin capabilities and assignment-scoped authority; hiding frontend links is insufficient. |
| ⏳ | Login role migration | Target login choices are Applicant / Student / Faculty / Administrator. No second post-login workspace chooser is required. |
| ⏳ | Repository audit + implementation plan | Coding agent should first audit current auth/schema/routes/workflows and produce dependency-ordered bounded packages. No production implementation is authorized by documentation alone. |

## Important boundary: configured access vs assigned work

Configured Faculty access currently approved for this feature:

- Essay Evaluation.

Assigned work remains authoritative for:

- Adviser;
- Chairman;
- Panelist;
- Rapporteur;
- Facilitator;
- other defense-specific roles supported by the existing workflow.

Faculty Management may summarize assignments, but it must not become a second assignment authority.

---

# 5. Adviser Availability and Faculty Policy

The Faculty/Admin source of truth resolves the previously open adviser-capacity direction for this feature.

| Status | Item | Current / target state |
| --- | --- | --- |
| 🐞 | Remove self-controlled adviser availability | Faculty should not control adviser availability with their own on/off toggle in the target model. |
| ⏳ | Admin-controlled **Available as Adviser** | Authorized Admin determines whether an Internal Faculty member may receive new Adviser assignments. |
| ✅ | External adviser prohibition | External Panelist / future External Faculty must not become thesis/dissertation Advisers or appear as valid Adviser candidates. |
| ✅ | No adviser load cap in this feature | Do **not** add an Admin-configurable adviser load limit/capacity rule as part of Faculty/Admin access work. Current no-load-cap behavior remains until separately approved. |
| ⏳ | Adviser candidate filtering | Candidate lists must exclude External, inactive, or unavailable Faculty and continue to enforce existing Adviser workflow requirements server-side. |
| ⏳ | Assignment-derived Adviser UI | `My Advisees` and Adviser authority come from actual AdviserAssignment relationships, not a manual "Adviser Page Access" permission. |
| 🔍 | Existing Adviser workflow audit | Audit GS-020/request/Dean-approval/AdviserAssignment behavior during the technical planning package to preserve accepted authority and compatibility. |

Changing `Available as Adviser` must not erase existing/historical Adviser assignments. Availability means eligibility for a **new** assignment, not ownership of an existing Student relationship.

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

**Content authority:** `docs/superpowers/EXAM_CONTENT_SOURCE_OF_TRUTH.md`  
**Phase A implementation plan:** `docs/superpowers/plans/2026-10-29-exam-content-integration.md`

Current repository facts:

- `ExamQuestion`, `ExamOption.isCorrect`, essay answers, exam applications/slots, program exam totals, passing score, and essay-grading-related records already exist.
- Current question/Admin/Applicant rendering is primarily text-oriented and does not yet represent the verified mixed-content assessment package completely.
- The project owner completed and manually checked a structured extraction package. Canonical future import inputs are the verified `manifest.json + assets/`.
- The project owner confirmed client authorization to commit the actual verified package to the private repository for development synchronization. Treat that package as controlled import source data, not as `frontend/public` runtime assets.
- Supporting extraction CSV/notes files are review/provenance artifacts, not required production importer inputs once the manifest is finalized.
- Existing schema/backend pieces do **not** prove the full Admin authoring/scheduling/exam lifecycle is complete.

## 7.1 Phase A — Mixed-Content Exam Integration

**Current status: ✅ ACCEPTED / CLOSED — 2026-10-31.**

This section is retained as the accepted implementation record for the
mixed-content examination workstream.

**Historical implementation branch:** `feat/exam-content-integration`

EXAM-CONTENT-1 through EXAM-CONTENT-7 are accepted. Earlier package sequencing
and stop/review boundaries below are historical evidence, not active pending
work.

| Status | Package / Item | Current / target state |
| --- | --- | --- |
| ✅ | Extraction pipeline / verified input package | Source-image extraction and exact visual cropping were validated; project-owner review confirmed the output. Treat the package as integration input, not runtime integration proof. |
| ✅ | Mixed-content exam question data model | Phase A accepted the mixed-content architecture, structured stimuli, private media, verified importer, Admin authoring/preview, Applicant renderer, corrected 72-question bank and semantic source-typography fidelity. Later Phase B exact-attempt binding/immutability completes the accepted core exam-content lifecycle. |
| ✅ | EXAM-CONTENT-1 — Mixed-content question architecture | **ACCEPTED 2026-10-29.** Implemented at `3506707552e66c03d8e59bb9afdf394077995b9f`; independent source/manifest/migration review PASS; development DB migration `20261029000000_exam_mixed_content` applied successfully; all 7 legacy questions defaulted to `NONE`; selected-option referential check found 0 broken references. |
| ✅ | EXAM-CONTENT-2 — Private exam media | **ACCEPTED 2026-10-29.** Implemented at `c080222877380b2124c40ef49e6fbf04aa0fe2c9`; independent storage/authorization/retrieval/migration review PASS; development DB migration `20261029010000_exam_private_media` applied successfully; project-owner XAMPP post-migration integrity checks passed with no broken media references reported. |
| ✅ | EXAM-CONTENT-3 — Verified manifest importer | **ACCEPTED 2026-10-29.** Implemented at `80816ad130dfdfa61fadb7e97fc4aa5d309d51f3`; independent importer/package/media/idempotency/migration review PASS; real package reconciled at 72 VERIFIED questions and 108 image assets; development DB migration `20261029020000_exam_import_identity` applied successfully; post-migration pre-import checks remained at the expected zero state. |
| ✅ | EXAM-CONTENT-4 — Admin Question Bank mixed-content support | **ACCEPTED 2026-10-29.** Implemented at `23180a40b3b236fe66432bd33fea9ab14fecb1b9`; independent Admin renderer/editor/private-media review PASS; focused 184-test evidence and backend/frontend builds PASS; project-owner browser/visual QA approved the rendered Admin Question Bank. |
| ✅ | EXAM-CONTENT-5 — Applicant Exam mixed-content renderer/UI | **ACCEPTED 2026-10-29.** Implementation `ae54992cb87acad6e420c8788f14910c1035adf9`; independent review PASS; owner browser QA PASS for legacy text, structured MATRIX, image stimulus, image options, persisted `F/G/H/J/K` labels, and away/back selection retention. Full-browser reload persistence remains a documented Phase B issue. |
| ✅ | EXAM-CONTENT-6 — Verified bank import + content QA | **ACCEPTED, including corrected-bank closure 2026-10-31.** Original EC6 acceptance remains historically valid; the later Q24 physical-source truncation was corrected through the accepted replacement path: one-off reconciler removed, development OLSAT bank safely reset after dependency checks, corrected canonical package clean-imported through the normal importer, 72 questions / 360 options / 108 media verified, 72/72 answer mappings matched, zero broken refs, and repeat import returned `ALREADY_IMPORTED`. Pagination/color acceptance remained closed throughout. |
| ✅ | EXAM-CONTENT-7 — Semantic source-typography fidelity | **ACCEPTED 2026-10-31.** EC7A–D remain independently reviewed PASS. EC7E at `052ddcf1ce96c625da8a2618f131c98c017d1051` plus evidence delivery `f8b0ffa7618249763bf41ca4f43041c77310307f` completed Items consolidation, generic unnumbered LOGICAL_PREMISES rendering, canonical Q40 source order, corrected manifest/package/emphasis binding, clean development-bank replacement, and idempotency verification. Independent remote review PASS; project owner reviewed the resulting output, confirmed the correction, and authorized Phase A closure. |

### EXAM-CONTENT-1 review checkpoint

- Branch: `feat/exam-content-integration`
- Reviewed commit: `3506707552e66c03d8e59bb9afdf394077995b9f`
- Independent implementation/source review: **PASS**
- Verified-manifest structured subtypes represented/validated: `MATRIX`, `WORD_BANK`, `NUMBER_SEQUENCE`, `ALPHANUMERIC_SEQUENCE`, `WORD_SERIES`, `GROUPED_NUMBER_ROWS`, `LETTER_SEQUENCE`, `LOGICAL_PREMISES`
- Development DB migration rehearsal: **PASS**
  - `npx prisma migrate deploy` applied `20261029000000_exam_mixed_content` successfully.
  - `npx prisma migrate status` reported: database schema is up to date.
- Post-migration integrity verification: **PASS**
  - legacy question stimulus state: `NONE = 7`;
  - broken `selected_option_id` references: `0`.
- Formal EXAM-CONTENT-1 acceptance: **ACCEPTED — 2026-10-29**
- EXAM-CONTENT-2 authorization: **COMPLETED / ACCEPTED**

### EXAM-CONTENT-2 acceptance checkpoint

- Branch: `feat/exam-content-integration`
- Reviewed implementation commit: `c080222877380b2124c40ef49e6fbf04aa0fe2c9`
- Independent implementation/source review: **PASS**
- Managed private-storage and image-policy review: **PASS**
- Admin/Applicant authorization review: **PASS**
- Retrieval-integrity/non-leakage review: **PASS**
- Development DB migration rehearsal: **PASS**
  - `npx prisma migrate deploy` applied `20261029010000_exam_private_media` successfully.
  - `npx prisma migrate status` reported: database schema is up to date.
- Project-owner XAMPP post-migration integrity checks: **PASS**
  - no imported exam media was expected yet;
  - no broken question/option media references were reported.
- Formal EXAM-CONTENT-2 acceptance: **ACCEPTED — 2026-10-29**
- EXAM-CONTENT-3 authorization: **COMPLETED / ACCEPTED**

### EXAM-CONTENT-3 acceptance checkpoint

- Branch: `feat/exam-content-integration`
- Reviewed implementation commit: `80816ad130dfdfa61fadb7e97fc4aa5d309d51f3`
- Independent implementation/source review: **PASS**
- Real committed package verification: **PASS**
  - 72 questions, all `VERIFIED`;
  - 108 referenced/committed image assets;
  - no missing or extra committed assets.
- Structured-content and answer-label mapping review: **PASS**
- Path-containment/source-integrity review: **PASS**
- Private-media/idempotency/transaction-compensation review: **PASS**
- Focused automated verification and read-only real-package preflight: **PASS**
- Development DB migration rehearsal: **PASS**
  - `npx prisma migrate deploy` applied `20261029020000_exam_import_identity` successfully.
  - `npx prisma migrate status` reported: database schema is up to date.
- Project-owner XAMPP post-migration pre-import checks: **PASS**
  - import marker count remained `0`;
  - sourced-question count remained `0`;
  - sourced-question-number count remained `0`;
  - broken import references remained `0`.
- Full 72-question development DB import: **NOT RUN / deferred to EXAM-CONTENT-6**
- Formal EXAM-CONTENT-3 acceptance: **ACCEPTED — 2026-10-29**
- EXAM-CONTENT-4 authorization: **COMPLETED / ACCEPTED**

### EXAM-CONTENT-4 acceptance checkpoint

- Branch: `feat/exam-content-integration`
- Reviewed implementation commit: `23180a40b3b236fe66432bd33fea9ab14fecb1b9`
- Independent implementation/source review: **PASS**
- Admin mixed-content DTO/type alignment: **PASS**
- Option identity/label/order/media preservation review: **PASS**
- Eight structured-stimulus preview/editor paths: **PASS**
- Authenticated private-image preview and object-URL lifecycle: **PASS**
- Admin-only secure image-upload integration: **PASS**
- Focused automated verification: **PASS** — 8 files / 184 tests.
- Backend/frontend compile/build/lint verification: **PASS**
- Project-owner browser/visual QA: **PASS**
  - updated Admin Question Bank rendered the seven existing development/demo questions;
  - owner approved the visible Admin Question Bank result.
- Full 72-question development DB import: **NOT RUN / deferred to EXAM-CONTENT-6**
- Development/demo bank cleanup boundary:
  - keep the seven existing development/demo DB questions through EXAM-CONTENT-5 for Applicant baseline/regression QA;
  - after EXAM-CONTENT-5 acceptance, remove/clean those demo questions;
  - verify demo-question count = `0` before EXAM-CONTENT-6 controlled import;
  - do not delete code-level automated-test fixtures under `backend/tests/fixtures/`.
- Formal EXAM-CONTENT-4 acceptance: **ACCEPTED — 2026-10-29**
- EXAM-CONTENT-5 authorization: **COMPLETED / ACCEPTED**

### EXAM-CONTENT-5 acceptance checkpoint

- Branch: `feat/exam-content-integration`
- Reviewed implementation commit: `ae54992cb87acad6e420c8788f14910c1035adf9`
- Independent implementation/source review: **PASS**
- Applicant mixed-content renderer integration: **PASS**
- Persisted source-label/order and option-ID selection authority: **PASS**
- Shared structured/image renderer reuse and correctness non-exposure: **PASS**
- Focused automated verification: **PASS** — 7 files / 92 tests.
- Frontend TypeScript/build/targeted lint verification: **PASS**
- Project-owner Applicant browser QA: **PASS**
  - existing development/demo text questions rendered successfully;
  - temporary structured `MATRIX` stimulus rendered successfully;
  - persisted `F / G / H / J / K` labels rendered correctly;
  - temporary image stimulus rendered successfully;
  - image answer options rendered successfully;
  - selected answers remained selected after navigating away and back within the active page session.
- Known Phase B gaps remain explicitly deferred:
  - MCQ answers are lost after a full browser reload because selections are not yet persisted/recovered;
  - complete MCQ autosave/recovery and refresh/reconnect restoration are not yet implemented;
  - the current three-hour timer remains hard-coded/duplicated rather than driven by accepted Admin configuration;
  - authoritative Admin exam-duration configuration and server-authoritative attempt/timer lifecycle remain Phase B work.
- Formal EXAM-CONTENT-5 acceptance: **ACCEPTED — 2026-10-29**
- EXAM-CONTENT-6 authorization: **AUTHORIZED NEXT**

### EXAM-CONTENT-6 owner-QA checkpoint

- Verified import/evidence commit: `5313c5934b3f3f6a2f98a316246810b284ab0e05`
- Controlled development-bank import/reconciliation: **PASS**
  - 72 authoritative OLSAT questions;
  - source identities 1–72 with no duplicates/nulls;
  - 108 imported-bank media references;
  - 72/72 verified correct-answer mappings;
  - all eight structured subtypes reconciled;
  - identical second import returned `ALREADY_IMPORTED`;
  - authoritative manifest/assets remained unchanged.
- Project-owner real-bank browser/content QA: **PARTIAL PASS WITH FOLLOW-UP FINDINGS**
  - real imported questions are visible in the Admin Question Bank;
  - `72 questions · Page 1 of 9` is correct;
  - Previous/Next functionality exists, but controls are only at the bottom after eight long cards and are not discoverable enough;
  - Admin and Applicant question/instruction body text currently use EARIST primary red; normal assessment text should use a neutral readable body color;
  - physical-source comparison confirmed semantically meaningful bold/underline in question/instruction text;
  - physical-source comparison also confirmed meaningful bold in some textual answer choices;
  - current plain-text representation does not preserve those emphasis semantics.
- Bounded EXAM-CONTENT-6 UI follow-up:
  - implementation commit: `78c76fb6bd84b17368ca94ebacd8f5a6ad778437`;
  - top and bottom pagination controls share the existing page state and preserve `PAGE_SIZE = 8`;
  - Admin, Applicant MCQ, and Applicant essay question/instruction text now use neutral body text;
  - EC7 `SemanticText` wiring remains intact;
  - independent actual-source review: **PASS**;
  - project-owner visual/browser review: **PASS / satisfied with output**;
  - no backend/schema/migration/import/media/API/Phase-B changes.
- Formal EXAM-CONTENT-6 acceptance history: **ACCEPTED — 2026-10-30 on then-known evidence**
- Post-acceptance physical-source correction: **CLOSED / ACCEPTED — 2026-10-31**
  - physical source authority: `Paul is younger than Dick and John`;
  - Q24-specific reconciliation implementation `9430c833f11c46b3de43a2eb0e9b8e6486b55233`: remains **SUPERSEDED / NOT ACCEPTED as retained architecture**;
  - replacement CORR2 path: **PASS** — one-off machinery removed, dependency gate passed, development OLSAT bank reset, normal clean import completed;
  - final verified state: 72 questions / 360 options / 108 media, 72/72 correct-answer mappings, zero broken refs, Q24 corrected, repeat import `ALREADY_IMPORTED`;
  - accepted pagination/color work remains closed.
- EXAM-CONTENT-7 implementation/review checkpoint:
  - original BOLD/UNDERLINE implementation: **PASS**;
  - EC7A ITALIC + structured textual-stimulus support: **INDEPENDENT REVIEW PASS**;
  - 12-page physical-source audit: **DONE**;
  - EC7B real owner-verified map creation + source binding + read-only preflight: **INDEPENDENT REVIEW PASS**;
  - EC7C real DB application/idempotency: **INDEPENDENT REVIEW PASS**;
  - EC7D structured-stimulus Admin authoring simplification: **INDEPENDENT REVIEW PASS**;
  - post-EC7D owner finding correctly identified Numbered List as not source-demonstrated and Q40 source order as non-faithful;
  - EC7E Items Consolidation + Q40 Source Fidelity implementation: **COMPLETE** at `052ddcf1ce96c625da8a2618f131c98c017d1051`;
  - EC7E evidence delivery: `f8b0ffa7618249763bf41ca4f43041c77310307f`;
  - EC7E Admin-visible layouts: **Grid / Table, Items**;
  - all eight legacy internal structured subtypes remain compatible: **PASS**;
  - `LOGICAL_PREMISES` renders as plain stacked lines without automatic numbering: **PASS**;
  - canonical Q40 order: `Assume that —` → three premises → `We know that —` → unchanged choices: **PASS**;
  - other 28 structured source payloads exact unchanged round-trip/renderability: **PASS**;
  - Q25/Q45 reviewed structured emphasis preserved: **PASS**;
  - corrected manifest/package/emphasis source binding: **PASS**;
  - clean development replacement restored 72 questions / 360 options / 108 bank media and 72/72 answer mappings with zero broken bank references: **PASS**;
  - repeated import: **ALREADY_IMPORTED**;
  - repeated emphasis apply: **ALREADY_APPLIED**, zero changes;
  - EC7E focused verification: **14 files / 280 tests PASS**; backend build, frontend TypeScript, scoped ESLint and formatting checks PASS;
  - independent remote source review: **PASS — no blocking issue**;
  - project owner reviewed the resulting EC7E output, confirmed it was correct, and authorized Phase A documentation closure;
  - formal EC7 acceptance: **ACCEPTED — 2026-10-31**.
- Phase A final acceptance: **ACCEPTED — 2026-10-31**
- Historical next workstream at Phase A closure: **Phase B — Exam Engine / Scheduling Audit**. Phase B was subsequently implemented and accepted for the agreed non-email core scope on 2026-11-06.

**Phase A acceptance boundary:** Phase A acceptance covers content
representation/import/rendering and verified source fidelity. At the time of
Phase A closure it did not, by itself, establish the complete examination
lifecycle. That lifecycle boundary was subsequently addressed by the accepted
Phase B core scope. Whole-system production readiness remains a separate
cross-system gate and is not implied by Phase A or Phase B acceptance.

## 7.2 Phase B — Exam Engine / Scheduling Audit

**2026-11-07 EXAM-SCHEDULE-BOOKINGS-1: ✅ ACCEPTED — INDEPENDENT REVIEW PASS; PROJECT-OWNER FUNCTIONAL/MANUAL + VISUAL QA PASS.**
Post-Phase-B Admin usability follow-up on the existing branch
`feat/exam-schedule-booking-visibility` from merged `main`
`3a456567a7469c4cdc0ac69c012fdf2e79ee6a4c`. The [bounded specification](specs/2026-11-06-exam-schedule-booking-visibility.md)
adds read-only **View bookings** visibility to Entrance Exam Schedules so Admin
can inspect current seat holders, Pinnacle Applicant ID, neutral **Booking
recorded** time from `EntranceExamApplication.createdAt`, current Exam State and
the linked Exam Record. The [implementation report](reports/2026-11-06-exam-schedule-booking-visibility.md)
records the ADMIN-only per-schedule current-occupant read projection, shared
Users/Pencil tooltip controls and focused booking Dialog. No schema migration
was added. Focused verification: **6 files / 165 tests PASS**; backend/frontend
TypeScript, scoped frontend ESLint and diff checks **PASS**. Production-build
outcome is recorded in the report. Independent remote source/diff review:
**PASS**. During project-owner browser QA, the visible
`Philippine Time (Asia/Manila)` caption was found redundant. Bounded FIX-1
removes only that caption while keeping the authoritative Manila timestamp
formatter unchanged. The original Users / **View bookings** icon design is
preserved. The focused UI contract source was updated; no new automated FIX-1
PASS is claimed from the ChatGPT GitHub connector session. Project-owner browser
recheck after FIX-1: **PASS**. Functional/manual and visual acceptance:
**PASS — 2026-11-07**. This post-Phase-B scheduling visibility package is
**ACCEPTED FOR MERGE**.

Existing Program/capacity,
booking atomicity, same-day assignment, seat release, exam execution, scoring,
reconsideration and Email Integration behavior remain protected. Released
historical applications must not be presented as current occupants. Phase B core
acceptance is not reopened.

**🚫 DEFERRED — EXAM-SCHEDULE-CREATE-ASSIGN: Create Schedule + Assign Applicant.**
Future bounded functional package for the Admin **Assign Applicant** flow when no
eligible same-day schedule exists. The intended direction is an explicit
**Create & Assign** action: Program is derived from the selected Applicant,
today may be prefilled where policy allows, and the Admin must still choose the
schedule time and capacity before creation. The created Exam Schedule remains a
shared institutional schedule that may accept additional eligible Applicants;
it must not become an Applicant-owned/private schedule. Silent automatic schedule
creation is not approved. Existing Program/alignment/waiver, capacity,
transaction/locking, blocking-record and same-day rules must remain authoritative.
This deferred package is separate from EXAM-SCHEDULE-BOOKINGS-1 and requires
explicit owner authorization before implementation.

**2026-11-06 B10 / PHASE B CORE EXAM ACCEPTANCE: ACCEPTED FOR MERGE — EMAIL INTEGRATION DEFERRED.**
The owner-authorized [EXAM-B10-MQA-UI presentation/content refinement](reports/2026-11-06-exam-b10-mqa-ui.md)
and bounded FIX-1 are accepted at implementation HEAD
`a1947677ca8bbdeb31cd3a02c1cef32c8ff8515b`. The package applies canonical
wording, Applicant submission hierarchy and Admin record information architecture
without backend/domain/schema/email changes. Focused UI contracts: **6 files /
136 tests PASS**; FIX-1 assignment contract: **13/13 PASS**; frontend TypeScript,
scoped ESLint, production build (68 pages for the main UI package) and diff checks
PASS. Independent remote review: **PASS**. Project-owner functional/manual
acceptance: **PASS — 2026-11-06**. Project-owner visual/UI acceptance:
**PASS — 2026-11-06**. Coding-agent browser/manual QA remains unclaimed.
The agreed B10/Phase B core Entrance Examination scope is **ACCEPTED FOR MERGE**.
Email Integration and the known result-email authorization/integration limitation
remain **DEFERRED — OUTSIDE THE ACCEPTED CORE EXAM SCOPE**; hosted CI and
whole-system production readiness are not claimed.

### Historical Phase B progression checkpoints — superseded by final B10 acceptance

> The checkpoints in this subsection record the state at the time they were
> written. Statements such as “Phase B incomplete”, “review pending”, or
> “owner QA pending” are **historical and superseded** by the 2026-11-06
> B10 / Phase B core acceptance above. They are retained only for traceability.

**2026-11-05 EXAM-B10-CORR-1 result: B10 CORE AUTOMATED GATE PASS — INDEPENDENT REVIEW PENDING — OWNER MANUAL/BROWSER QA PENDING — EMAIL INTEGRATION DEFERRED.**
The owner-authorized presentation-only apostrophe escape at
`frontend/src/components/exam-content/applicant-appointment-gate.tsx:137`
resolves the pre-existing ESLint error. Focused relevant ESLint passed with
0 errors / 5 unchanged warnings; frontend TypeScript, production build (68 pages),
affected UI contracts (2 files / 55 tests) and `git diff --check` passed.
No behavior/API/schema/data/email change. The
[bounded correction evidence](reports/2026-11-05-exam-b10-lifecycle-acceptance.md#12-exam-b10-corr-1--applicant-missed-appeal-jsx-lint-correction)
supersedes the historical incomplete lint status below. Owner manual/browser QA:
**PENDING OWNER EXECUTION**; F4/I4 remain **DEFERRED — EMAIL INTEGRATION FEATURE**.
B10 is not accepted and Phase B is incomplete.

**2026-11-05 resumed B10 checkpoint: CORE AUTOMATED GATE INCOMPLETE — EXISTING ESLINT ERROR.**
Core behavior checks passed: full backend unit suite **258 files / 3,958 passed /
5 skipped / 0 failed**; real MariaDB B3 **18**, B6 **20** with nested B5 **11** /
B4 **11** / B0A **5** / B2 **4**, B7 **26**, extended B8 **36**, B9 **51**;
standalone Phase A verifier **11/11**, frontend TypeScript and production build
PASS. Added three integrated core DB journeys and 33 core HTTP cases; removed the
diagnostic email test from the active suite after explicit owner deferral. The
email defect remains open and no runtime source changed. Relevant ESLint failed
on the existing unescaped apostrophe in `applicant-appointment-gate.tsx:137`
(one error, five unrelated unused-variable warnings). No overall automated PASS
or new core functional defect is claimed. See the
[resumed evidence matrix](reports/2026-11-05-exam-b10-lifecycle-acceptance.md#11-resumed-core-gate--2026-11-05).
Independent review and core owner manual/browser QA remain pending; Email
Integration is deferred. Phase B is incomplete.

**2026-11-05 B10 scope decision: CORE EXAM GATE RESUMPTION AUTHORIZED — EMAIL INTEGRATION DEFERRED.**
The first B10 run correctly found a real current-actor authorization gap in the result-email queue path. The project owner clarified that email integration is collaborator-owned, not yet functional/accepted, and belongs to the separate Email Integration feature rather than an Exam Phase B correction. The finding remains documented and is not treated as fixed. **Result-email queue/delivery/current-actor behavior is excluded from B10 core-exam acceptance and from any Phase B production-readiness claim.** B10 now resumes the remaining core examination lifecycle gates. The deliberately failing B10 email regression is diagnostic evidence for the future Email Integration feature, not a required core-gate PASS. Phase B remains incomplete until the resumed core automated gate, independent review and project-owner manual/browser QA pass for the agreed non-email scope.

**Phase A is accepted as of 2026-10-31. Initial Phase B source audit completed 2026-11-01 on `feat/exam-engine-scheduling-audit` from verified `main` at `9ab8aa037b9c5a9f746bd0e6aef72478a3b76564`; independent review of the audit/plan is PASS. Owner clarifications for timezone, essay composition, scoring configuration, lifecycle recovery, Applicant self-registration, and same-day Admin assignment/Start Now exceptions are recorded in the Phase B plan and [admission clarification report](reports/2026-11-02-exam-admission-owner-clarifications.md). EXAM-B0A is implemented and independently reviewed on the separately authorized `feat/exam-engine-scheduling` branch from merged audit baseline `a6dc6f57c6e8130482c814e90703765972fddaa9`. The independent remote source review is PASS, and the project owner accepted B0A for Phase B progression on 2026-11-02 while explicitly deferring manual/browser QA to a later consolidated Phase B gate. EXAM-B0A, EXAM-B0B, EXAM-B1, EXAM-B2 and EXAM-B3 are accepted for Phase B progression; Phase B as a whole remains incomplete and not production-ready.**

- Audit report: [Exam engine / scheduling findings](reports/2026-11-01-exam-engine-scheduling-phase-b-audit.md).
- Proposed bounded packages: [Phase B implementation plan](plans/2026-11-01-exam-engine-scheduling-phase-b.md). Sequence: B0A answer/state containment → B0B pending-result protection → B1 configuration → B2 selection/received content → B3 booking/time + bounded same-day Admin assignment follow-up → B4 attempt/timer → B5 drafts/recovery → B6 submit/expiry → B7 essay evaluation → B8 scoring/results → B9 amendments/appeals/reconsideration → B10 acceptance gate.
- Owner clarifications: authoritative timezone = `Asia/Manila`; physical form = one essay assessment; exact essay prompt is intentionally content-authority driven. B7 uses only the non-null positive `essayMaximumScore` frozen at B4 start. **B8 scoring policy is owner-confirmed 2026-11-05:** no fixed score constants; use the attempt's frozen `mcqPointsPerCorrectItem`, frozen essay maximum, B7 essay score and a frozen Admin-configured percentage passing threshold. Total earned points are additive MCQ points + essay score. PASS/FAIL uses the exact decimal earned/possible ratio against the configured percentage with no decision rounding; display rounding is presentation-only. New attempts require complete scoring configuration; older attempts with incomplete frozen basis fail closed rather than borrowing current settings.
- Admin UI ownership: **Exam Questions / Exam Question Bank → Exam Configuration** owns exam duration, MCQ points per correct item, essay maximum score and passing threshold. `Asia/Manila` is read-only/system-defined. Do not add a separate configuration sidebar item and do not use Exam Records as the global settings editor.
- Applicant registration/admission ownership: Applicants self-register in GS-IS using an existing EARIST Pinnacle Applicant ID. Graduate School staff do not create GS-IS Applicant accounts. Regular self-booking remains unchanged; same-day Admin schedule assignment and per-Applicant Start Now authorization are separate, bounded exceptions described in the admission clarification report.
- Finalized FAILED-result reconsideration belongs to the individual **Exam Record** under B9: preserve original score/threshold/computed FAILED, require justification/actor/timestamp, and record a separate **PASSED — RECONSIDERED** institutional decision. The 2026-11-05 B9 owner policy authorizes current active ADMIN only; Program Chair/Faculty permissions and revoke/review remain future work.
- Lifecycle/recovery baseline: refresh/reopen preserves the same attempt/deadline and acknowledged answers; reconnect resynchronizes; server restart cannot reset time; timeout does not depend on the browser; lost submit responses recover the same terminal state; stale multi-tab/device writes cannot overwrite newer/final state; pending essay grading is never FAILED.
- EXAM-B0A checkpoint: [Answer payload and submitted-state containment](reports/2026-11-02-exam-b0a-answer-containment.md). Focused verification: **14 files / 203 tests PASS**, including **5 real-database tests**, plus backend build. Independent remote source review: **PASS — no blocking issue**. Project-owner decision: **ACCEPTED FOR PHASE B PROGRESSION**. Manual/browser QA is **DEFERRED / NOT EXECUTED** and is not reported as PASS; it will be consolidated into a later Phase B lifecycle/manual gate unless an intermediate package requires immediate UI validation. No schema, UI, content-bank or policy change was included.
- EXAM-B0B checkpoint: [Pending-result and notification containment](reports/2026-11-02-exam-b0b-result-containment.md). Focused verification: **12 files / 182 tests PASS**, backend build, frontend TypeScript and scoped ESLint PASS. Independent remote source review: **PASS — no blocking issue**. Project-owner decision: **ACCEPTED FOR PHASE B PROGRESSION**. Pending/inconsistent results are unavailable to Applicants and cannot queue result email; completed consistent PASSED/FAILED behavior is preserved. Manual/browser QA is **DEFERRED / NOT EXECUTED** and is not reported as PASS; it remains part of the later consolidated Phase B lifecycle/manual gate unless an intermediate package requires immediate UI validation.
- EXAM-B1 checkpoint: [Current examination configuration foundation](reports/2026-11-02-exam-b1-configuration.md). Focused verification: **21 files / 351 tests PASS**, **11 Question Bank verifier tests PASS**, backend/frontend static checks and production build PASS. Independent remote source review: **PASS — no blocking issue**. Project-owner decision: **ACCEPTED FOR PHASE B PROGRESSION**. The Question Bank's Exam Configuration dialog saves typed nullable draft values through an ADMIN-only API, with fixed `Asia/Manila`, no fake policy defaults, and unresolved passing-threshold unit/value left unconfigured. No runtime consumer changes and no schema migration. Manual/browser QA is **DEFERRED / NOT EXECUTED** and is not reported as PASS; it remains part of the later consolidated Phase B lifecycle/manual gate unless an intermediate UI-sensitive package requires immediate validation.
- EXAM-B2 checkpoint: [Question selection and immutable content foundation](reports/2026-11-02-exam-b2-question-sets.md). Independent remote source review: **PASS — no blocking issue**. Project-owner decision: **ACCEPTED FOR PHASE B PROGRESSION**. The accepted package provides initially empty explicit membership, ADMIN-only publication, immutable content/key with source question/option/media retention, history deletion guards, same-page Question Set UI, additive migration rehearsal/application, and focused verification. **B2 creates immutable content authority; B4 will bind and activate it per attempt.** Live Applicant question/media reads intentionally remain legacy/unbound. Manual/browser QA is **DEFERRED / NOT EXECUTED** and is not reported as PASS; no composition policy, historical received set, or attempt is fabricated.
- EXAM-B3 checkpoint: [Canonical schedule time and atomic booking admission](reports/2026-11-02-exam-b3-booking-admission.md). Independent remote source review: **PASS — no blocking issue found**. Project-owner decision: **ACCEPTED FOR PHASE B PROGRESSION**. The accepted package starts at `d094b92d92a3c69367ef707c0a3673516ae00ec1` and implementation commit is `f7cd211149cd5edf0d2feee9bbd97e70707c3947`; the shared branch was 17 commits ahead of `main` and zero behind at B3 review. Strict `Asia/Manila` wall-clock conversion fixes same-day admission and Applicant display; authenticated Student/Program/alignment checks, Student → Slot row locks, READ COMMITTED rereads, conditional reservation/application rollback, counter integrity and booked-edit safeguards are enforced. Existing nine local slot counters agreed with assignments; no historical repair or migration. Focused verification: **42 unit/contract/HTTP files / 814 tests**, **10 B3 real-MariaDB checks**, **5 B0A real-DB regressions**, **4 B2 migration/integrity regressions**, and **11 Question Bank verifier checks PASS**; backend build, frontend TypeScript/scoped lint and diff check PASS. Accepted UIUX-2H layout/actions remain intact. Manual/browser QA is **DEFERRED / NOT EXECUTED** and is not reported as PASS; it remains part of the consolidated Phase B owner QA gate. Hosted CI: **NOT EXECUTED / no hosted PASS claimed**. The original B3 baseline remains accepted; the bounded Admin same-day schedule-assignment follow-up below is **IMPLEMENTED / PUSHED — INDEPENDENT REVIEW AND PROJECT-OWNER ACCEPTANCE PENDING**.
- B3 same-day assignment follow-up: [Owner-confirmed admission rules](reports/2026-11-02-exam-admission-owner-clarifications.md). **ACCEPTED FOR PHASE B PROGRESSION — 2026-11-02.** ADMIN may assign a registered, eligible Applicant without a blocking application to an existing active same-day slot with remaining, reconciled capacity even when its scheduled wall-clock time is earlier than now. **Accepted UI:** one **Assign Applicant** primary action in the upper-right of the existing Entrance Exam Records PageHeader opens a dialog to search registered Applicants, review authoritative identity/Program/eligibility, select an eligible same-day slot, review its unchanged original date/time and capacity, and confirm. The new record appears in the existing table after success; the table/filter/row-action composition remains unchanged. No assignment action is added to Applicant Profile and no new sidebar destination is created. All B3 Student/Program/alignment/blocking-status/active-slot/counter/locking/capacity/atomicity safeguards remain mandatory. Applicants self-register; staff do not create accounts.
- B4 owner-confirmed start behavior: per-Applicant ADMIN Start Now authorization can bypass only the scheduled-time gate for the same Manila date, including early or late same-day arrival. Existing bookings remain unchanged. Applicants without a booking must first receive the B3 same-day assignment. Staff authorization does not start the timer; the Applicant starts, and the server records actual start plus the valid B1-configured duration. There is no shared school-closing deadline. Different-date missed appointments remain B9 work.
- **2026-11-02 B3 follow-up checkpoint:** **ACCEPTED FOR PHASE B PROGRESSION.** [Implementation evidence](reports/2026-11-02-exam-b3-same-day-admin-assignment.md). Independent remote source review: **PASS — no blocking issue found**. The Entrance Exam Records PageHeader opens the registered-Applicant assignment dialog. ADMIN-only options/assignment endpoints reuse B3 admission with Student → Slot locks, READ COMMITTED rereads, actual-count reconciliation, conditional reservation and atomic creation. Only today's Manila-date time filter differs; ordinary self-booking still rejects past starts. Focused checks: **12 files / 232 tests PASS**, including **11 new UI contract checks**; **16 real-MariaDB integration checks PASS** with verified synthetic cleanup and unchanged protected snapshots. Backend build, frontend TypeScript/scoped ESLint/production build and diff check PASS. No migration. Project-owner manual/browser QA: **PASS after the bounded removal of redundant visible `Asia/Manila` labels**. Backend `Asia/Manila` calendar/time authority is unchanged. Hosted CI: **NOT EXECUTED / no hosted PASS claimed**.
- **EXAM-B4 checkpoint (2026-11-03): ACCEPTED FOR PHASE B PROGRESSION.** [Server-owned execution report](reports/2026-11-02-exam-b4-server-owned-attempt.md). Independent remote source review: **PASS — no blocking issue found**. One execution per existing application records separate ADMIN authorization, actual Applicant start, individual deadline, B1 value snapshot and exact immutable B2 revision. Explicit owned Start/read/content/answer contracts replace implicit legacy URLs; media uses the exact active binding. Additive migration was rehearsed with the complete committed migration chain on a disposable MariaDB database. After B4 acceptance, the project owner reported successfully applying the committed migration to the configured development database with `npx prisma migrate deploy`; this owner-reported runtime preparation was not independently verified by the remote source review. Frontend restores timing/content, with no B5 answer recovery or B6 automatic finalization. **Project-owner manual/browser QA: DEFERRED / NOT EXECUTED by owner decision; consolidate it into the later Phase B lifecycle/manual acceptance gate.** Hosted CI: NOT EXECUTED / no hosted PASS claimed. This acceptance is for Phase B progression only, not production readiness.
- **B4 owner clarification, 2026-11-03:** normal start is allowed at or after the original appointment on the same Manila date; early start requires per-application ADMIN authorization. No additional late-entry cutoff is introduced. Same-day late authorization remains available, but is not required once the normal start gate is satisfied. Different-date new starts reject. Existing started executions retain their full duration across midnight. This supersedes the earlier shorthand that all late starts require authorization.
- **EXAM-B5 checkpoint (2026-11-04): ACCEPTED FOR PHASE B PROGRESSION.** [Draft persistence/recovery evidence](reports/2026-11-03-exam-b5-draft-recovery.md). Independent remote source review: **PASS — no blocking issue found**. Additive answer revision baseline, exact-active-application draft read/write, MCQ select/change/null clear, essay edits/blank clear, stale conflict rejection, hydration/navigator recovery, bounded serialized autosave, visible save states, reconnect resync and final-submit drain are implemented. Drafts and final submission share B0A locking with READ COMMITTED post-lock reads. Verification: **48 exam-domain files / 1025 tests PASS**, **B5 11 real-MariaDB checks PASS** including nested B4/B0A/B2 regressions, migration-chain rehearsal, fresh-connection readback, backend/frontend static/build checks and Phase A verifier PASS. **Configured development DB B5 migration remains owner-action pending / not independently confirmed applied.** Project-owner manual/browser QA remains **DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate**. Hosted CI: NOT EXECUTED / no hosted PASS claimed. This acceptance is for Phase B progression only, not production readiness.
- **EXAM-B6 checkpoint (2026-11-04): ACCEPTED FOR PHASE B PROGRESSION.** [Finalization evidence](reports/2026-11-04-exam-b6-finalization.md). Independent remote source review: **PASS — no blocking issue found**. One application-locked transaction consumes persisted B5 drafts, applies strict B4 deadline precedence, records `APPLICANT_SUBMITTED` or `TIME_EXPIRED`, transitions to TAKEN with one PENDING raw-MCQ score and returns one stable receipt. Incomplete explicit submission requires acknowledgment; unattended expiry uses startup catch-up and a separate 30-second sweep. Legacy terminal records retain null evidence; never-started appointments are excluded. Automated/unit/HTTP/UI, disposable MariaDB contention, restart and migration rehearsal evidence is recorded separately in the report. **Configured development DB remains owner-action pending for any unapplied B5/B6 migrations; remote review did not verify local migration state.** Project-owner manual/browser QA remains **DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate**. Hosted CI: **NOT EXECUTED / no hosted PASS claimed**. This acceptance is for Phase B progression only, not production readiness. B7/B8/B9/B10 remain unauthorized until separately approved.

- **EXAM-B7 checkpoint (2026-11-05): ACCEPTED FOR PHASE B PROGRESSION.** [Full report](reports/2026-11-04-exam-b7-essay-evaluation.md). Independent remote source review: **PASS — no blocking issue found**. Additive nullable evaluation timestamp, exactly-one-essay publication/new-start guards, exact frozen prompt/finalized-response/captured-maximum authority, ADMIN-only immutable evaluation, safe detail projection and read-only completion UI are implemented. Evaluation never computes total/PASS/FAIL or enables result/email. Disposable MariaDB migration preservation and actual competing-grader lock contention are documented separately from automated UI/static/build checks. **Configured development DB remains owner-action pending for any unapplied B5/B6/B7 migrations; remote review did not verify local migration state. Project-owner manual/browser QA: DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate. Hosted CI: NOT EXECUTED / no hosted PASS claimed.** This acceptance is for Phase B progression only, not production readiness. B8 implementation remains gated on owner-confirmed PD-2/PD-3 scoring values/units/rounding; B9/B10 remain unauthorized.

- **EXAM-B8 checkpoint (2026-11-05): ACCEPTED FOR PHASE B PROGRESSION.** [Authoritative scoring and publication report](reports/2026-11-05-exam-b8-authoritative-scoring.md). Independent remote source review: **PASS — no blocking issue found**. The owner-confirmed configuration-driven policy supersedes earlier B8 policy-gate wording above. Passing threshold is nullable or a percentage in `(0,100]`, with fixed `PERCENT`; all four configuration values are required for new starts. Historical null-threshold bindings retain timing/draft/receipt/evaluation reads but cannot be scored using current settings. One application-locked scorer recomputes frozen MCQ correctness, reconciles B6 raw count, adds exact B7 essay points, compares with isolated Decimal arithmetic, and atomically records immutable basis/time and matching PASSED/FAILED states. B7 evaluation invokes it before commit; ADMIN-only **Finalize Result** recovers an already-evaluated pending record through the same scorer. Admin/Applicant share the same persisted breakdown; legacy maxima/thresholds remain unknown. Valid-result email uses retained deterministic BullMQ identity and truthful queued evidence. **Project owner reports the configured development database migrations are now applied through B8; this runtime preparation is owner-reported and was not independently verified by remote source review.** Project-owner manual/browser QA remains **DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate**. Hosted CI: **NOT EXECUTED / no hosted PASS claimed**. This acceptance is for Phase B progression only, not production readiness. B9 policy resolution/implementation is next; B10 remains separately unauthorized.

- **EXAM-B9 checkpoint (2026-11-05): ACCEPTED FOR PHASE B PROGRESSION.** Implementation `1b9270ea528beefcd3ce8efb89eb65db5311fd0c`; documentation commit `0ea23fce9d3464d1803e4568b47a01992bd3d7b9`; [full amendments/reconsideration report](reports/2026-11-05-exam-b9-amendments-reconsideration.md). Independent remote source review: **PASS — no blocking issue found**. Explicit seat release, preserved appointment history, exact prior-date missed appeals, atomic replacement capacity, no-retake blocking and separate immutable **PASSED — RECONSIDERED** authority are accepted for Phase B progression. Valid reconsidered passes are consistently recognized by result/COR/Admin Applicant/Applicant progression while original B8 FAILED evidence remains unchanged. **Project owner reports the configured development DB migration `20261105010000_exam_amendments_reconsideration` was successfully applied with `npx prisma migrate deploy`; Prisma reported all migrations successfully applied. This runtime state is owner-reported and not independently verified by remote source review. Project-owner manual/browser QA remains DEFERRED / NOT EXECUTED — B10 consolidated Phase B lifecycle/manual acceptance gate. Hosted CI: NOT EXECUTED / no hosted PASS claimed.** B10 is now the authorized final Phase B gate; automated isolated regression may proceed before dev migration, but owner/browser runtime QA requires the committed B9 migration applied first.

| Status | Item | Audit target |
| --- | --- | --- |
| ✅ | Admin exam configuration | Accepted through B1/B4/B8 and final B10 acceptance. **Exam Questions / Exam Question Bank → Exam Configuration** owns exam duration, MCQ points per correct item, essay maximum score and percentage passing threshold. `Asia/Manila` is fixed/read-only. Scoring uses the frozen configured values and exact decimal earned/possible comparison; decision rounding is not used. |
| ✅ | Timer source of truth | B4 accepted and covered by final B10 owner QA. Actual server start + valid B1 duration establishes one persisted deadline; reload/reconnect cannot restart time. Early same-day starts require ADMIN authorization; normal starts at/after the appointment on that date need no override, per the 2026-11-03 owner clarification. No shared closing deadline. |
| ✅ | Same-day Admin schedule assignment | **ACCEPTED FOR PHASE B PROGRESSION — 2026-11-02.** ADMIN-only existing-Applicant/current-Manila-day assignment retains all B3 safeguards and original appointment values. **Assign Applicant** on the existing Entrance Exam Records PageHeader opens search → authoritative identity/Program/eligibility → eligible slots/capacity → review/confirmation. Success refreshes the unchanged table and resets filters/page to show the new record. Ordinary self-booking remains future-only. [Evidence](reports/2026-11-02-exam-b3-same-day-admin-assignment.md). Independent review PASS and project-owner browser/manual QA PASS after the copy-only timezone-label refinement. |
| ✅ | Applicant registration ownership | Owner-confirmed and preserved through final Phase B acceptance: Applicants self-register using an existing EARIST Pinnacle Applicant ID. Graduate School staff do not create GS-IS Applicant accounts. |
| ✅ | Timeout behavior | B6 accepted and covered by final B10 owner QA. Recorded started executions finalize from acknowledged drafts without a browser; never-started appointments are excluded. |
| ✅ | MCQ autosave + recovery | B5 accepted and covered by final B10 owner QA. Exact owned active drafts restore selections/navigator, retain clear/version state, reject stale writes and coordinate pending saves with final submission. |
| ✅ | Essay lifecycle | **EXAM-B7 accepted and covered by final B10 owner QA.** New publication and B4 first binding require exactly one essay; historical invalid bound compositions require staff review. Admin evaluates the exact frozen B2 prompt/finalized B5/B6 response using only the captured B4 essay maximum. One locked READ COMMITTED transaction writes score/evaluator/completion time once; repeat/concurrent grading rejects. Application stays TAKEN, score stays PENDING, total stays null and result/email remain unavailable until B8. |
| ✅ | Submission rules | B6 accepted for Phase B progression after independent remote source review PASS. Explicit incomplete acknowledgment, persisted-answer-only finalization, immutable reason/receipt, lost-response recovery and terminal draft rejection are implemented. |
| ✅ | Exam scheduling | Original B3 admission/time/capacity and same-day Admin assignment are accepted. **B9 ACCEPTED FOR PHASE B PROGRESSION — 2026-11-05.** Exact never-started cancellation/reschedule and prior-Manila-date missed appeals preserve original appointments, release seats once and create/link a new PENDING replacement only on approved reschedule. Student → sorted slots → exact application locking and unreleased-seat counts preserve capacity. FAILED/MISSED block booking; only CANCELLED/RESCHEDULED history is nonblocking. No ExamPeriod/retake/reset subsystem. [B9 evidence](reports/2026-11-05-exam-b9-amendments-reconsideration.md). |
| ✅ | Question activation / selection | Accepted through B2 + B4 and final B10 acceptance. Admin publication preserves explicit saved question membership; the exact immutable published content is bound to the Applicant attempt at authoritative start so later bank/config changes cannot rewrite an active or finalized attempt. |
| ✅ | Scoring / answer integrity | **B8 accepted for Phase B progression.** New results use frozen B2/B4/B6/B7 evidence, exact Decimal arithmetic, configured MCQ points/essay maximum/percentage threshold and immutable scoring basis; later bank/config changes cannot retroactively alter the computed result. Legacy final records retain honest unknown provenance where B8 evidence is absent. |
| ✅ | Finalized FAILED-result reconsideration | **B9 ACCEPTED FOR PHASE B PROGRESSION — 2026-11-05.** Current active ADMIN may record one separate **PASSED — RECONSIDERED** decision only for valid B8 computed FAILED. Original application/score FAILED, answers, numbers, basis, threshold and scoredAt remain unchanged. Applicant/Admin projections, both COR gates, Admin Applicant list/filter/count/detail and Applicant progression recognize validated effective pass. Existing queued-email evidence is retained; generic B8 result-email action rejects after decision. Reason/actor/time/audit required; no revoke/regrade, Program Chair authority or legacy reinterpretation. |
| ✅ | Automated regression / acceptance coverage | **B10 / Phase B core acceptance completed 2026-11-06.** Core automated verification, independent remote source/diff review, project-owner functional/manual QA and project-owner visual/UI acceptance passed for the agreed non-email scope. The accepted EXAM-B10-MQA-UI correction and Admin assignment copy FIX-1 are included. Email Integration remains a separate deferred feature and hosted CI/whole-system production readiness are not claimed by this row. |
| ⏳ | Program Chair examination permissions | Future Faculty permission architecture should govern applicant exam checking/essay grading where appropriate. |

**Current Exam boundary:** the agreed non-email Phase B core is accepted. Do not
equate that subsystem acceptance with **whole-system production readiness**.
Email Integration, Program Chair/Faculty permissions, the deferred
EXAM-SCHEDULE-CREATE-ASSIGN package, and the cross-system production-readiness
items in Section 21 remain separate work.

---

# 8. Email, Notifications, Announcements, Memos, and Analytics

These areas include collaborator-owned/currently evolving work. Do not mark them accepted solely because models/pages/routes exist.

| Status | Item | Current / target state |
| --- | --- | --- |
| 🔍 | Email integration | **Explicitly deferred from Exam Phase B/B10 core acceptance.** Collaborator-owned email integration is not yet functional/accepted. Complete current-actor authorization, worker/queue startup, delivery/retry/failure behavior and end-to-end recipient/template verification in the dedicated Email Integration feature. The B10 stale-ADMIN-token finding remains open here and is not considered fixed. |
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
| ✅ | Post-scheduling, pre-defense committee correction / member replacement (DEF-CORR-1) — accepted and merged through PR #42; correction is allowed only while the exact session remains `SCHEDULED`. |
| ⏳ | Faculty becomes unavailable after scheduling. |
| ❓ | Evaluator non-participation / excusal and quorum handling | Future policy package distinct from member replacement: define who may formally excuse an assigned Chairman/Panelist who did not evaluate, the minimum evaluator quorum, how the completion denominator/average changes, and how official records show the missing score/signature without fabricating evidence. Not part of DEF-CORR-1. |
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
| ✅ | Post-scheduling, pre-defense committee correction / member replacement workflow (DEF-CORR-1) — accepted and merged through PR #42. |
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

0. Complete **Phase A — Applicant Examination Mixed-Content Integration** using `EXAM_CONTENT_SOURCE_OF_TRUTH.md` and the 2026-10-29 implementation plan (EXAM-CONTENT-1 through EXAM-CONTENT-6).
1. Immediately after Phase A acceptance, complete **Phase B — Exam Engine / Scheduling Audit** covering timer, autosave/recovery, essay lifecycle, submission/timeout rules, scheduling semantics, question activation/selection, and regression coverage before treating Applicant Examination as production-ready.
2. Continue collecting missing-feature/process notes from the project owner.
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
- FACULTY-2 enforces current `mustChangePassword` for every account role in REST and frontend middleware; independent review is pending;
- Change Password uses the existing generic page and re-login completion; only exact password-change/self-session REST paths bypass the credential gate;
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
| ✅ | Role-specific forced password gate | Removed by accepted FACULTY-2: current stored credential state gates every role instead of hardcoding Panelist. |
| ✅ | Credential-state-based forced password change | Accepted in FACULTY-2: backend and frontend enforce the current stored flag for all existing roles, with only the exact authenticated self-session/password-change exceptions and local NextAuth logout. Focused automated coverage passed; exhaustive browser edge-case QA remains separate from this package acceptance. |
| ✅ / 🟡 | Applicant-created password → Student promotion | Current Student promotion keeps the Applicant's existing password. A promoted Student should not be forced to change a password merely because the role changed if the password was self-created and `mustChangePassword` is false. |
| ⏳ | Temporary/generated password policy | Faculty or any account provisioned with a temporary/default password should set `mustChangePassword = true` and be forced through the change-password flow before normal portal access. |
| ⏳ | Student temporary/reset credential behavior | If a Student is ever issued a temporary/reset password by an authorized workflow, the same generic `mustChangePassword` gate should apply. |
| ⏳ | Change-password UX redesign | Align the page visually with the redesigned auth surfaces and ensure safe return/login behavior after completion. |
| ✅ / 🟡 | Auth regression coverage | FACULTY-2 focused login/current-account/session/helper, credential-gate, COR continuity and related document/socket tests passed, and independent remote commit-diff review passed. Project owner confirmed normal login behavior. Broader browser/auth matrix, future Faculty identity, and capability rollout remain separate. |

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

# 18. Continuing Student / Pre-GSIS Onboarding and Legacy Academic Baseline

This package exists for Graduate School students who are already enrolled or already partway through thesis/dissertation when GS-IS is introduced and therefore may have no Applicant, Entrance Examination, Adviser Request, or prior-defense history inside GS-IS.

Current repository facts:

- `Student.pinnacleApplicantId` is nullable, and a Student can exist without an `EntranceExamApplication`; the data model can therefore represent a legitimate Student whose admission/exam history predates GS-IS.
- the current COR flow cannot be reused unchanged for this case because COR upload/verification is attached to an existing Student and the current promotion path requires Applicant state plus a passed Entrance Examination;
- the centralized Thesis Journey must not infer formal progression from `ThesisRecord.stage/status` alone;
- the normal GS-020 flow creates a new Adviser relationship through Student request → Adviser `CONFORMED` → Dean `APPROVED`, but a continuing Student may already have an officially assigned Adviser before entering GS-IS.

## Target principle

**Do not fabricate historical workflows merely to satisfy the current database.** Establish a controlled, auditable pre-GSIS baseline, then use the normal authoritative GS-IS workflows for all activity from the onboarding/cutover point forward.

## CONT-STUDENT-1 — Continuing Student COR-Based Direct Onboarding

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | Public continuing-student entry page | Provide a dedicated public/static onboarding surface for an already-enrolled Graduate School Student who was never processed as an Applicant in GS-IS. This is separate from normal Applicant registration. |
| ⏳ | Basic submission data | Collect the minimum identity/contact data needed for review, including email and the COR upload. OCR/extraction may suggest Student Number, name, program, academic year/semester, and other supported COR fields, but extracted values are never automatically authoritative. |
| ⏳ | Pending onboarding record | A public submission must create a pending/staging onboarding record, not an authoritative Student account immediately. Rejected or abusive submissions must not pollute the Student registry. Exact model naming is not yet locked. |
| ⏳ | Public-upload protection | Apply throttling/rate limiting, strict file type/content validation, bounded file size, private managed storage, and normal upload-security controls. CAPTCHA and pre-upload email verification may be added if needed; exact rate limits are implementation details, not academic policy. |
| ⏳ | Admin verification authority | Admin reviews the submitted COR and confirms/corrects Student Number, identity, email, and Program before approval. OCR is assistive only. |
| ⏳ | Duplicate prevention | Before approval, detect existing Student Number/account/email conflicts and route them to controlled recovery rather than creating duplicate Student identities. |
| ⏳ | Direct Student creation | After Admin approval, create/link the authoritative User + Student directly as the enrolled Student identity. Do not fabricate an Applicant ID, Entrance Examination application, score, or PASSED result merely because the normal new-applicant path contains those records. |
| ⏳ | Honest absent admission history | For a continuing Student whose admission/exam history predates GS-IS, display the absent history as **not recorded in GS-IS / predates GS-IS**, never as failed, pending, or not taken unless such a state is actually authoritative. |
| ⏳ | Account-access handoff | After approval, provide the Student a controlled account-access/password setup path consistent with the credential-state rules in §17. Do not use predictable default credentials. |
| ⏳ | Onboarding audit trail | Preserve submission, Admin reviewer, approval/rejection, timestamps, and relevant reason/remarks. |

### CONT-STUDENT-1 boundary

```text
Normal new Applicant
Applicant → Entrance Exam → COR verification → Student

Continuing / existing Student
Public continuing-student submission → COR → Admin verification → Student
```

Both paths converge on the same Student portal and downstream academic workflows. The continuing-student path is a migration/adoption path, not a second permanent Student portal.

## CONT-STUDENT-2 — Legacy Academic / Thesis Standing Initialization

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | Admin-only baseline initialization | After continuing-student approval, authorized Admin may initialize the Student's real current academic/thesis standing when that standing predates GS-IS. |
| ⏳ | Current thesis/defense stage | Support initialization at the real current stage, including Title, Proposal, or Final as applicable. A Student already at Proposal/Final must not be forced back to Title solely because earlier GS-IS records do not exist. |
| ⏳ | Prior-stage legacy completion | Earlier completed stages may be represented as **completed before GS-IS / legacy baseline**. Do not create fake `DefenseSchedule`, evaluator records, Committee Reports, signatures, or `DefenseConclusion` rows for defenses that did not occur inside GS-IS. |
| ⏳ | Thesis Journey legacy authority | Extend the centralized Thesis Journey so an Admin-verified pre-GSIS baseline can satisfy the appropriate prior-stage progression requirement without treating mutable `ThesisRecord.stage/status` alone as formal proof. |
| ⏳ | Historical artifact treatment | Past defense artifacts do not need to be digitally reconstructed merely to onboard the Student. Where legacy documents are available they may be referenced/attached as supporting history, but the system must remain explicit that the actual defense occurred before GS-IS. |
| ⏳ | Existing Adviser initialization | If the continuing Student already has an Adviser, Admin may select the existing Faculty account and establish the active AdviserAssignment as a pre-GSIS/Admin-initialized relationship. |
| ✅ / ⏳ | No fabricated GS-020 for legacy Adviser | Do not manufacture a GS-020, Student request signature, Adviser `CONFORMED` event, or Dean approval for an Adviser relationship that already existed before GS-IS. The relationship should instead show that it was assigned before GS-IS. Implementation is still pending. |
| ⏳ | No-Adviser path | If the continuing Student has no existing Adviser, use the normal GS-020 Adviser Request workflow rather than the legacy initialization shortcut. |
| ⏳ | Current/future GS-017 remains normal | A Proposal/Final Student with a legacy Adviser can still use the normal GS-017 exact-manuscript certification workflow for manuscripts reviewed after onboarding. Legacy adviser origin does not weaken current manuscript certification requirements. |
| ⏳ | Student-owned current requirements | From the initialized current stage forward, the Student uploads the normal current-stage requirements/manuscript and follows the ordinary GS-IS workflow. |
| ⏳ | Legacy shortcut scope | Pre-GSIS initialization is only for the initial migration/onboarding baseline. New Adviser designations/replacements and future defense progression after onboarding must use the normal approved workflows rather than repeatedly invoking the legacy shortcut. |
| ⏳ | Controlled correction + audit | Baseline/adviser initialization must record Admin actor, timestamp, source/provenance, and reason/remarks. Later correction must be controlled and auditable, especially once dependent GS-IS activity exists. |

### Continuing Student example

```text
Student is already at FINAL before GS-IS adoption
        ↓
COR verified / Student account approved
        ↓
Admin initializes:
  Title    = completed before GS-IS
  Proposal = completed before GS-IS
  Current  = FINAL
  Adviser  = existing pre-GSIS Faculty assignment
        ↓
No fake Title/Proposal defense history
No fake GS-020
        ↓
Student uploads current Final requirements/manuscript
        ↓
Adviser performs current GS-017 certification
        ↓
Normal Final Defense application/scheduling/evaluation/report/verdict flow
```

### Guardrail

Missing pre-GSIS workflow artifacts are **not incomplete current requirements** when Admin has initialized the legitimate continuing-student baseline. The UI/read models must distinguish **not recorded in GS-IS / completed before GS-IS** from normal in-system pending/failed states.

---
# 19. Student Inactivity, Drop/Stop-Out, and Return/Reactivation

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

# 20. Returning Graduate / Multiple Academic Careers

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

# 21. Production Readiness, Security, and Operations

These items are not all end-user features, but they are required before the system should be treated as production-ready.

## 21.1 Authentication and Account Recovery

Current repository facts:

- JWT/session lifetime is currently 24 hours;
- FACULTY-2 implements the generic current-account `mustChangePassword` gate, pending independent review;
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

## 21.2 Health, Reliability, and Background Jobs

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

## 21.3 Monitoring, Logging, and Audit Operations

| Status | Item | Current / target state |
| --- | --- | --- |
| 🟡 | Domain audit infrastructure | `AuditLog` is already used in several workflows. |
| ⏳ | Structured production logging | Replace reliance on ad-hoc `console.log/error` for operational diagnosis with structured logs and severity. |
| ⏳ | Request/correlation IDs | Trace a user/API request across logs and background jobs without exposing sensitive data. |
| ⏳ | Error monitoring/alerting | Operators need actionable alerts for application crashes, repeated 5xx responses, failed jobs, unavailable dependencies, storage pressure, and similar incidents. |
| ⏳ | Metrics/dashboard | Track API health/latency/error rates, queue status, storage capacity, database health, and other operational signals. |
| ⏳ | Admin/operator audit viewer | Define a restricted audit surface for security/operational investigations; current audit records should not be exposed as a misleading generic user activity feed. |
| ❓ | Audit retention policy | Define how long security/domain audit records must be retained and who may access/export them. |

## 21.4 Backup, Restore, and Disaster Recovery

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

## 21.5 Deployment and Release Engineering

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

## 21.6 File Security, Storage, and Data Governance

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

## 21.7 Production QA and Release Acceptance

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | End-to-end role journeys | Execute realistic Applicant → Student → Adviser → Defense → completion scenarios using production-like data and permissions. |
| ⏳ | Multi-user defense QA | Perform real concurrent Chairman/Panelist/Rapporteur/Admin browser QA for defense collaboration/signing, not only unit/source verification. |
| ⏳ | Authorization regression matrix | Verify every major route/action against unauthorized roles and cross-student/cross-defense access attempts. |
| ⏳ | Browser/responsive/accessibility gate | Establish supported browser/device baseline and complete keyboard/accessibility/responsive checks for critical workflows. |
| ⏳ | Performance/load test | Measure realistic concurrent use, large PDFs/files, defense polling/realtime, exam submissions, and Admin lists before production sizing. |
| ⏳ | Production smoke test | After each release, verify authentication, database connectivity, representative document upload/download, email/notification path, and critical dashboard/defense flows. |

---

# 22. Additional Functional Gaps Found During Production Review

| Status | Item | Current / target state |
| --- | --- | --- |
| 🐞 / 🔍 | Comprehensive Exam history/strike behavior | Canonical UI/UX documentation records that Comprehensive Exam recording can overwrite the latest record, making full attempt history/strike counts unreliable; controls/eligibility also need server-side review. This requires a separate functional package. |
| ⏳ | Account disable/reactivate policy | Define operational behavior when an Applicant/Student/Faculty account is disabled, including active sessions, assignments, scheduled defenses, and later reactivation. |
| ⏳ | Operator/system configuration inventory | Identify which production values must be Admin-configurable versus environment-only: adviser caps, academic master data, institutional officials, schedules/windows, email settings, and other confirmed policy values. Avoid hardcoding institutional policy. |

---

# 23. System Wording, Terminology, and Content Consistency

This is a cross-cutting UI/UX requirement. The system should not expose inconsistent, overly technical, stale, or role-confusing language even when the underlying workflow is correct.

Canonical wording guidance is governed by [USER_FACING_COPY_SOURCE_OF_TRUTH.md](USER_FACING_COPY_SOURCE_OF_TRUTH.md). The UI/UX playbook references that source for visible wording; this checklist tracks remaining system-wide application.

| Status | Item | Current / target state |
| --- | --- | --- |
| ⏳ | System terminology audit | Review visible labels, statuses, buttons, helper text, dialogs, empty states, errors, and navigation across Applicant, Student, Faculty, and Admin surfaces. |
| ⏳ | Panelist → Faculty wording migration | Replace outdated account-level `Panelist` wording where it means the broader future Faculty identity, while preserving defense-specific `Panelist` when it refers to an actual committee assignment. |
| ⏳ | User-facing vs implementation language | Keep API/model/internal lifecycle terms out of ordinary UI unless they serve a real administrative/audit need. |
| ⏳ | Consistent action verbs | Use one accepted phrase for the same action across pages, dialogs, notifications, and emails. |
| ⏳ | Consistent status labels | Map raw enums/internal states to clear user-facing wording without changing domain meaning. |
| ⏳ | Role-aware wording | Copy must reflect the actor's actual responsibility and avoid describing permissions/actions that the actor does not own. Never tell an Admin to “contact the schedule administrator” when the Admin already owns schedule management. |
| ⏳ | Microcopy compression | Status/helper/empty-state copy should use the shortest truthful wording: one state, one message; do not restate inverse conditions, obvious consequences, or surrounding dialog/page context. |
| ⏳ | Blocked-state explanations | When an action is unavailable, state the authoritative blocker directly. Add the next responsible actor/action only when genuinely useful and not already obvious from nearby controls. |
| ⏳ | Irreversible-action copy | Confirmations for finalize/sign/conclude/reject/reactivate/permission-change actions must state the real consequence clearly. |
| ⏳ | Error and recovery copy | Replace generic or technical errors with concise, actionable messages while preserving safe server-side detail handling. |
| ⏳ | Email/notification wording consistency | Email subjects/bodies and in-app notifications should use the same approved terminology as the portal. |
| ⏳ | Official-document wording boundary | Generated official forms follow the official EARIST template/approved exceptions; portal wording changes must not silently rewrite official form language. |
| ⏳ | Accessibility/plain-language pass | Labels, instructions, and validation messages should remain concise, understandable, and compatible with accessible controls. |
| ⏳ | Wording regression review | Every UI/UX package should include a terminology/copy check so fixed wording does not drift back on later pages. |

## Wording authority

Use [USER_FACING_COPY_SOURCE_OF_TRUTH.md](USER_FACING_COPY_SOURCE_OF_TRUTH.md) for canonical microcopy rules, approved examples, role-aware information boundaries, and the required copy-review gate.

This checklist should track completion/status only; do not duplicate detailed examples here because duplicate wording guidance can drift.

The wording audit must preserve institutional and academic terminology. It is a consistency/refinement task, not permission to rename confirmed EARIST concepts casually.
