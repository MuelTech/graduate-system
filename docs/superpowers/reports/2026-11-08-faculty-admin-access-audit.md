# FACULTY-0 — Faculty/Admin access repository audit

- Date: 2026-11-08 (Asia/Manila)
- Repository: `MuelTech/graduate-system`
- Verified live starting `main`: `045316540d97364214792c7d441ae20a1e426d4c`
- Working branch: `feat/faculty-admin-access`
- Status: source audit complete; implementation pending; no production changes authorized or made.

Implementation handoff: [bounded implementation plan](../plans/2026-11-08-faculty-admin-access-implementation.md).

## 1. Evidence boundary and authorities

Live GitHub `main` was resolved through the GitHub connector, then independently checked with `git fetch origin main` and `git ls-remote origin refs/heads/main`. Both returned the expected SHA. Local HEAD matched; the worktree was clean. The new branch was created from that commit after checking that no remote branch with this name existed. No applicable `AGENTS.md` was found in the repository or inspected ancestor directories.

This is an audit of the live repository snapshot, not of a deployed database or running production service. No database connection, deployment inspection, migration application, seed execution, or browser session was used. Account counts, existing CUSTOM membership/grants, actual Full Administrator bootstrap candidates, and data anomalies remain unverified environment facts. Seed fixtures and hardcoded UI examples are not evidence of real users or institutional authority.

Read authorities:

- [Faculty/Admin Source of Truth](../FACULTY_ADMIN_ACCESS_SOURCE_OF_TRUTH.md), including its explicit precedence and migration invariants.
- [Approved Faculty/Admin design](../specs/2026-11-08-faculty-admin-access-design.md).
- [Implementation checklist](../GSIS_IMPLEMENTATION_CHECKLIST.md), including current accepted Exam/Adviser/Defense checkpoints and outstanding credential/account lifecycle issues.
- [Copy Source of Truth](../USER_FACING_COPY_SOURCE_OF_TRUTH.md) and [UI/UX playbook](../ui-ux/SYSTEM_UI_UX_PLAYBOOK.md).
- [Defense Workflow Source of Truth](../DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md), particularly current corrections 0.3–0.4, Adviser/GS-020 section 9, committee section 12, and evaluator/conclusion/signature sections 13–15.
- [Collaborative Defense/Committee Report Source of Truth](../COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md).
- [Document Lifecycle Source of Truth](../DOCUMENT_LIFECYCLE_SOURCE_OF_TRUTH.md) and [Exam Content Source of Truth](../EXAM_CONTENT_SOURCE_OF_TRUTH.md).
- [Engineering Verification Policy](../ENGINEERING_VERIFICATION_POLICY.md), `CONTEXT.md` for orientation, and the accepted Adviser/GS-020 implementation plans as historical integration evidence.

There is no separate current authentication source-of-truth document among the canonical files found. Current credential authority is distributed across checklist sections 17/21, Document Lifecycle section 4.2, and the implemented COR credential handoff. Old `CONTEXT.md` phase statements and superseded Panelist specs do not reopen completed initiatives. Older Defense/playbook passages still mention selected-title requirements, post-conclusion RAP, or earlier scorer counts; later explicit corrections and accepted code govern those topics. No canonical policy is rewritten by this report.

## 2. Verified architecture

### 2.1 Identity and persistence

Evidence: [Prisma schema](../../../backend/prisma/schema.prisma), models `User`, `Panelist`, `CustomRole`, `RoleFeatureAccess`, `AdviserAssignment`, `PanelAssignment`; enums `UserRole`, `PanelRole`.

| Concern | Current repository behavior | Consequence for target |
| --- | --- | --- |
| Account role | `UserRole = ADMIN, STUDENT, PANELIST, CUSTOM, APPLICANT`; one `User.role` | Faculty migration concerns account identity, not defense-role enums |
| Faculty precursor | `Panelist` maps to `panelists`, has unique `userId` and separate profile ID | Keep profile/user IDs; immediate table/model renaming is unnecessary |
| Profile flags | `isExternal=false`, `isAvailableAsAdviser=true`, `isActive=true` defaults | External effective availability must be false even if legacy stored data disagrees |
| Account status | `User.isActive` and `Panelist.isActive` are separate | Resolve mismatches; status-only Admin updates currently change User status, not both flags |
| Administrator | Plain `User` with `role=ADMIN`; no Admin access-level/profile/grant entity | Full/Restricted is new internal access metadata within ADMIN |
| Custom Role | Optional `User.customRoleId`; role-owned feature rows with `featureKey`, `featureLabel`, `canView`, `canEdit` | No direct per-user grant model; no uniqueness on `(roleId, featureKey)` |
| Defense identity | `PanelAssignment.userId` references User; exact `scheduleId`, contextual `PanelRole`, `isActive` | Preserve IDs, contextual roles and active/inactive attribution |
| Adviser identity | `AdviserAssignment.adviserId` references User; active/history rows per Student | Availability is eligibility for new relationships, not existing relationship authority |

Most academic references point to User or assignment IDs, rather than to the Panelist profile ID. `User.email` is unique, which matters for separate Faculty/Admin accounts for the same real person: one identical email cannot currently provision both accounts. This requires an explicit account-identifier decision, not an unapproved uniqueness change.

### 2.2 Authentication, sessions, route protection

Evidence: [auth service](../../../backend/src/services/auth.service.ts), [auth repository](../../../backend/src/repositories/auth.repository.ts), [auth middleware](../../../backend/src/middlewares/auth.middleware.ts), [shared JWT verifier](../../../backend/src/utils/jwt.ts), [NextAuth](../../../frontend/src/auth.ts), [frontend middleware](../../../frontend/src/middleware.ts), [login](../../../frontend/src/app/(auth)/login/page.tsx), [session types](../../../frontend/src/types/next-auth.d.ts).

1. Applicant login resolves Pinnacle Applicant ID; Student login resolves trimmed Student Number. Both check stored account role. Student password is preserved through COR promotion; DOB is profile data.
2. All other selected login roles use email/password. The email branch does **not** validate the selected role against `User.role`, reject unknown selections, or check `User.isActive` before issuing a token. Repository email lookup is unfiltered.
3. The backend issues a 24-hour JWT with `userId`, stored `role`, and `mustChangePassword`. The shared verifier returns `userId` and `role`; generic `authenticateJWT`/`requireRole` do not refresh the database identity, account status, password flag or permissions.
4. NextAuth retains the backend access token in its own 24-hour JWT session; it lowercases the account role. Callbacks copy initial claims without a current-account/effective-access refresh. The session has no capability payload or access version.
5. Login redirects using the **selected** role (`/${role}/dashboard`). Middleware checks actual session role by portal prefix and redirects using the token role. `Other Roles` sends users to `/other/dashboard`; there is no implemented other/custom portal in the audited tree, and a CUSTOM token can lead to `/custom/dashboard`.
6. Middleware matches Applicant, Student, Admin, Panelist, and change-password paths. Forced password change is hardcoded to `panelist`; normal backend route authentication does not enforce that credential state. A role migration must preserve and deliberately repair this boundary.
7. Panelist provisioning uses an uppercase surname password, returns it, and sets `mustChangePassword=true`. Optional Admin password replacement does not establish a new generic temporary-credential lifecycle. Do not reuse this predictable credential pattern for Administrators.
8. [Client API helper](../../../frontend/src/lib/api.client.ts) signs out on both `401` and `403`. [Server helper](../../../frontend/src/lib/api.server.ts) redirects on `401` and throws on other errors. Restricted-access denials must remain distinguishable from expired sessions.

Frontend layouts are client navigation shells; hiding a link cannot authorize an API. Backend URLs are mounted under `/api` by the application; the route index mounts administrative APIs across several namespaces, not only `/admin`.

### 2.3 Current Faculty precursor portal

Evidence: [Panelist layout](../../../frontend/src/app/(portal)/panelist/layout.tsx), [dashboard service](../../../backend/src/services/panelist-dashboard.service.ts), [dashboard rules](../../../backend/src/services/panelist-dashboard.rules.ts), [dashboard repository](../../../backend/src/repositories/panelist-dashboard.repository.ts), and pages under `frontend/src/app/(portal)/panelist/`.

- Static navigation exposes Dashboard, Profile, My Defenses, My Advisees, E-Signatures, Repository, Announcements and Notifications to every Panelist. No Essay Evaluations destination or configured Faculty grant exists.
- Dashboard aggregates own schedule assignments, pending/signed Committee Report slots, addressed Adviser Requests, and Proposal/Final Adviser review tasks. It has no essay work source. Existing dashboard task logic partially duplicates workspace capability logic; it is a projection, not permission authority.
- Defense Workspace is immersive/sidebar-free. My Defenses is the main assignment entry point. Materials/scoring index routes redirect to My Defenses; nested scoring/lobby compatibility routes preserve exact schedule context.
- My Advisees already consolidates Active Advisees, Adviser Requests and Manuscript Reviews with URL-addressable request/review contexts. Legacy Adviser Requests/Reviews routes redirect to those contexts.
- The profile still exposes a self-service Available-as-Adviser toggle. UI disables it for External profiles, but the direct backend update does not enforce that restriction.
- Notification role props, memo audience handling, frontend types, query keys, redirects and links contain account-level PANELIST assumptions. `MemoAudience.PANELISTS` and historical notification contents are compatibility surfaces, not grounds for global text replacement.

The playbook records the old Panelist dashboard as implemented but not an approved UI reference. Faculty dashboard work needs its own bounded IA/QA review; it cannot claim inherited visual acceptance.

### 2.4 Entrance examination and essay authority

Evidence: [exam routes](../../../backend/src/routes/exam.routes.ts), [exam repository](../../../backend/src/repositories/exam.repository.ts), [exam service](../../../backend/src/services/exam.service.ts), [essay input rules](../../../backend/src/services/exam-essay-evaluation.rules.ts), Exam Record detail and shared essay panel under `frontend/src/`.

- `GET /exam/applications` and `GET /exam/applications/:id` are ADMIN-only operational reads. Essay evaluation lives inside the Admin Exam Record detail.
- `POST /exam/scores/:id/grade` is ADMIN-only at the route. `ExamRepository.gradeEssay` additionally loads the current User **inside the locked transaction**, requiring active ADMIN. A route-only change cannot enable Faculty safely.
- The grading body accepts **only** `essayScore`; no Faculty remarks/rubric redesign is established. The service reads the exact frozen prompt, finalized answer and captured maximum, rejects repeated/concurrent evaluation, records `gradedById`/`essayEvaluatedAt`, then invokes the accepted B8 scorer within the same transaction.
- B8 automatically computes the MCQ component from frozen keys/answers, adds the essay points, applies frozen configuration using exact Decimal comparison and persists result evidence. This is entrance-exam scoring; the prohibition on automatic Defense verdicts is a separate rule.
- `POST /exam/scores/:id/finalize` is active-ADMIN result recovery through the same scorer. Reconsideration is a separate current-active-ADMIN B9 operation. Neither operation belongs to configured Faculty Essay Evaluation.
- No evaluator-to-Program assignment/scoping relation or essay Program authorization predicate was found. Program filters and Applicant/program matching in scheduling are not evaluator authority. The hardcoded Custom Roles page's Program Chair description is not policy.
- Legacy queue/review READ endpoints were retired. The `/exam/scores` mutation namespace is intentional compatibility, not an instruction to recreate Score Management.
- Result email queuing does not receive/check the current actor in the same way as grading. The checklist explicitly defers this known integration gap to Email Integration. Faculty work must not inherit that endpoint or claim the email subsystem fixed.

### 2.5 Adviser eligibility, GS-020 and My Advisees

Evidence: [Adviser Request service](../../../backend/src/services/adviser-request.service.ts), [request rules](../../../backend/src/services/adviser-request.rules.ts), [single-active resolver](../../../backend/src/services/active-adviser.rules.ts), [workspace service](../../../backend/src/services/adviser-workspace.service.ts), [GS-020 records](../../../backend/src/services/adviser-request-record.service.ts), [thesis service](../../../backend/src/services/thesis.service.ts).

- Canonical candidacy uses the Student's passed, concluded Title schedule and same-schedule finalized Committee Report. Candidate seats are active assignments in the working ODP mapping `CHAIRMAN`/`PANELIST`; active account + Panelist profile, Internal status, profile activity and availability are checked. No adviser load cap is implemented or authorized.
- Request creation is signed and identity-bound. Requested Adviser response is own-request only; CONFORME/DECLINE is separate from Dean/Admin approval/rejection.
- Dean approval locks the Student, rereads request state, rejects an existing active relationship, rechecks that the requested profile exists and is not External, validates exact signed evidence and atomically creates the finalized GS-020 snapshot and active AdviserAssignment.
- Approval does **not** recheck every candidacy field such as current availability/account/profile activity inside that transaction. The target says availability controls receipt of a new assignment; pending-request races therefore need an explicit revalidation rule and tests.
- `ThesisService.assignAdviser` is already a hardened legacy wrapper for the same Dean approval. It ignores arbitrary body `adviserId`; do not reintroduce a direct assignment shortcut.
- `ThesisRepository.getAvailableAdvisers`, exposed by `/thesis/adviser/available`, still reads a broad available directory and omits the canonical candidate query's full Internal/account-active filtering. It must not become a future Faculty candidate authority.
- Existing current Adviser authority is the **sole** active AdviserAssignment; multiple active rows fail closed. `ThesisRecord.assignmentId` is legacy compatibility linkage.
- Availability changes must not remove existing assignments, revoke a valid relationship merely because availability becomes false, or rewrite historical GS-020. Proposal/Final exact reviewed-document certification remains immutable.
- My Advisees contains addressed requests **before** an assignment exists. Requested-Adviser visibility and issuer/exact-record historical rights are distinct from current-advisee authority. A simplistic `hasActiveAdvisees` navigation guard would strand accepted GS-020 work.
- GS-020 final snapshots preserve exact identity, evidence hash, signature and timestamps. Student/requested-Adviser/authorized-Admin visibility is explicit. No committee-wide GS-020 access; legacy unsigned requests receive no fabricated records; printed Dean remains blank.

### 2.6 Defense committee and contextual authority

Evidence: [committee policy](../../../backend/src/services/defense-committee.policy.ts), [workspace](../../../backend/src/services/defense-workspace.service.ts), [conclusion service](../../../backend/src/services/defense-conclusion.service.ts), [oral evaluation](../../../backend/src/services/oral-evaluation.service.ts), [signature policy](../../../backend/src/services/rap-signature.policy.ts), [schedule correction](../../../backend/src/services/defense-schedule-correction.service.ts), [thesis repository](../../../backend/src/repositories/thesis.repository.ts).

| Contextual assignment | Current authority to preserve |
| --- | --- |
| Chairman | Own evaluation; assigned schedule start; formal verdict only after authoritative readiness |
| Panelist | Own evaluation and permitted academic review; no Chairman verdict |
| Rapporteur | Own schedule's report authoring/finalization; required report signature; no numerical evaluation |
| Facilitator | Permitted read/facilitation context; no numerical evaluation or required report signature |
| Adviser | Automatic Proposal/Final seat from active AdviserAssignment; required report signature; no numerical evaluation of own advisee |

Title: Master's 1 Chairman + 4 Panelists + Facilitator + Rapporteur; Doctoral 1 + 5 + 1 + 1. Proposal/Final: automatic Adviser + Chairman + 3/4 Panelists + Facilitator + Rapporteur. Totals stay 7/8. Adviser availability is not a committee permission or evaluator switch.

The workspace resolves active exact-schedule PanelAssignment before assembling a role-safe DTO. Evaluation is own-record, report editing/finalization is Rapporteur-owned, required signing is own-slot and frozen-content-bound, and only the assigned Chairman can conclude. Evaluations and Committee Report signing run in parallel; all required records converge before verdict. Admin operational privilege does not replace any of these identities.

Scheduled roster correction is allowed only while SCHEDULED. Inactive replaced rows preserve annotation/comment attribution; the `(scheduleId,userId)` unique constraint permits reactivation of an existing row. Changing role or identity indiscriminately would corrupt ownership/signature history.

Candidate search filters active PANELIST Users/profiles. Both initial scheduling and correction validate committee composition, but the inspected write paths do not independently validate every submitted manual participant's current academic-account/profile eligibility; foreign keys and quotas alone do not prove Faculty authority. No External-specific Chairman/Rapporteur/Facilitator eligibility matrix is encoded by the committee policy. Supported External Panelist participation must be preserved without treating this absence as approval to broaden other roles.

Realtime uses the shared JWT verifier and active exact-schedule membership on join/delivery. [Realtime store](../../../backend/src/realtime/defense-realtime.store.ts) does not additionally load current User role/activity or profile status. Removed assignments are filtered/evicted; account disable/role changes also need current-identity enforcement, including long-lived sockets and ephemeral report preview.

### 2.7 Admin access and hidden authorization surfaces

Evidence: [route mounts](../../../backend/src/routes/index.ts), all `backend/src/routes/*.ts`, [Admin layout](../../../frontend/src/app/(portal)/admin/layout.tsx), [document authorization](../../../backend/src/services/document.service.ts), [settings routes](../../../backend/src/routes/settings.routes.ts), official record services.

- Current Admin access is the broad `ADMIN` role, not Full/Restricted. There is no dedicated Administrators page/API or last-Full protection. The seed provisions a test Admin; that is not a production bootstrap designation.
- Admin navigation is static. User Management includes Applicants, Students, Panelists and Custom Roles. Analytics currently imports mock data. No implemented Admin curriculum-management API was found; a target catalog must not imply that Curriculum is already built.
- Generic `requireRole([ADMIN])` protects Applicant/Student management, COR/waiver actions, exam operations, defense administration, settings, repository, storage, memos and email logs. Some services/repositories add live actor checks (notably exam operations); many rely on the route token.
- Document authorization loads User activity, but its blanket `userRole === ADMIN` branch uses the caller-supplied role argument. Restricting `/admin` routes alone leaves document reads broad. GS-017, GS-020 and official Defense records have their own broad Admin branches which also need capability-aware replacement.
- Dashboard aggregates cross-module sensitive counts/queues. A Restricted Admin landing page cannot call the existing full aggregate and merely hide sections afterwards.
- Settings includes generic key writes, email-template writes, audit reads and **single/bulk audit deletion**. A generic Settings capability must not grant Administrator access changes or permit erasure of mandatory access-change evidence. Key allowlisting and protected security audit records are necessary.
- Alternate COR/waiver/comprehensive-exam routes and legacy Adviser assignment/Defense aliases must use the same capability as their canonical action. Existing route-only protection does not cover direct service calls, file streaming or Socket.IO.
- Legacy expert-evaluation assignment routes/models still exist. Canonical workflow explicitly places Expert Evaluation outside core scope; this feature must not add it as an approved new Faculty permission.

### 2.8 Custom Roles: reusable concepts, dormant machinery

The repository-wide source search found `customRoleId`, `CustomRole`, `RoleFeatureAccess` and their relation fields in Prisma/schema/migrations, with **no runtime permission resolver/CRUD route/service using them** in backend or frontend source. [Custom Roles page](../../../frontend/src/app/(portal)/admin/users/roles/page.tsx) uses hardcoded examples, counts and permission arrays; its Create action only closes the modal.

Therefore:

- reuse the idea of explicit capability/business-action grants and existing User/AuditLog infrastructure;
- do not claim existing canView/canEdit checks are already enforced;
- do not attach arbitrary hidden roles to every user as a second target authority;
- plan new constrained direct-user grants and an Admin access-level record, preserving legacy tables/links as read-only migration evidence;
- map legacy grants only after actual data inspection and an explicit per-user role/access decision; arbitrary feature keys/labels and duplicate rows cannot safely become new grants automatically;
- remove the mock product surface and Other Roles entry only after legacy account disposition is reviewed. Physical table/enum deletion is a separate later decision, not a prerequisite for the four-role product experience.

## 3. Gaps against the approved target

| ID | Verified gap | Required bounded direction |
| --- | --- | --- |
| G1 | Account PANELIST/CUSTOM, static portal assumptions | Compatibility normalization and later explicit data cutover; retain defense `PanelRole.PANELIST` |
| G2 | Email login role/status not validated; stale JWT claims | Current-account authentication and role validation; fail-closed effective access |
| G3 | Role-only temporary-password gate | Credential-state enforcement with safe change-password path; preserve COR handoff |
| G4 | No configured Faculty grants | Direct Essay Evaluation grant; no permanent Adviser/committee checkboxes |
| G5 | ADMIN-only academic essay grading | Faculty-specific, configured-access queue/read/write; retain frozen exam rules |
| G6 | Self-controlled availability and insufficient legacy directory filter | Authorized Admin ownership; consistent Internal/active/available new-assignment checks |
| G7 | No Admin access levels or management safeguards | Full/Restricted direct grants; transactional last-active-Full rule and durable audit |
| G8 | Hidden APIs/documents/settings/dashboard bypass route-only plans | Complete action catalog plus server enforcement at every protected boundary |
| G9 | Frontend 403 logs out | Preserve session on forbidden business action and refresh effective access |
| G10 | Mock Custom Role administration, unknown real CUSTOM data | Preserve evidence; explicit reconciliation, then retire user-facing surface |
| G11 | Dynamic navigation can strand addressed requests/history | Workflow-derived work summaries include accepted addressed-request/record rights |
| G12 | Participant write validation/realtime current identity incomplete | Recheck eligible account/profile and exact assignment; no role-policy expansion |
| G13 | Audit delete endpoints can erase new access evidence | Protect access/security-change records from generic deletion |
| G14 | Unique email prevents same-email Faculty/Admin pair | Decision Required on account identifiers before dual-duty provisioning |

## 4. Historical dependencies and migration evidence

Relevant committed migrations include:

- `20260714133043_init`: MySQL UserRole enum, User/Panelist, CustomRole/RoleFeatureAccess, academic foreign keys.
- `20260718232156_add_user_title_suffix`, `20260718235943_add_user_createdby_updatedby`, `20260719010702_add_must_change_password`: identity/provisioning metadata.
- `20260922120000_defense_workflow_status_and_panel_unique`, `20260925135622_gs020_adviser_request_state`: schedule identity/uniqueness and request workflow compatibility.
- `20261016090000_cdw1_collaborative_defense_foundation`, `20261017090000_defense_schedule_manuscript_binding`, `20261018090000_oral_evaluation_scoring_version`: attribution, exact files, versioned score semantics.
- `20261024230000_panel_assignment_active_lifecycle`, `20261025180000_adviser_request_signed_records`: historical assignment preservation and immutable GS-020 evidence.
- `20261104010000_exam_essay_evaluation`, `20261105000000_exam_result_scoring`, `20261105010000_exam_amendments_reconsideration`: grader identity, frozen results and separate institutional decisions.

Do not edit committed historical migrations, run reset/db-push, reseed production, rewrite signed JSON/hashes, or transform every occurrence of PANELIST. The DB is MySQL/MariaDB, so enum expansion/shrink and transactional data backfills must be rehearsed separately; enum DDL is not assumed to roll back like DML.

Preserve User IDs, credentials, profile IDs, creator/updater/actor IDs, AdviserAssignment IDs, requested-Adviser IDs, schedule/assignment IDs, historical active flags, evaluator grader/panel IDs, report/signature ownership, exact manuscript/version bindings, immutable snapshots/hashes and historical text. No missing signatures, old assignments or program scope may be fabricated. Runtime migration counts/integrity remain a future isolated rehearsal and environment-preflight requirement.

## 5. Verification inventory and limits

Existing seams suitable for later regression work:

- `backend/tests/unit/services/auth.login.test.ts`, repository login tests and `middlewares/auth.middleware.test.ts`.
- Adviser request/rules/signing/record, workspace, single-active review and document authorization service tests; `frontend/scripts/verify-adv*.mjs`.
- `exam-essay-evaluation.routes.test.ts`, essay UI contracts, scoring/amendment rules and `backend/tests/integration/exam-essay-evaluation-contention.test.ts` plus result/amendment contention tests.
- Committee policy, Defense Workspace, oral-evaluation, RAP signature/freeze, schedule correction and document-binding tests; realtime auth/authorization/store/preview tests.
- Migration contract tests, including `defcorr1-panel-assignment-active.test.ts` and `cdw9f-migration-readiness.test.ts`; frontend CDW/Adviser verifiers and existing Playwright configuration.

The existing auth tests chiefly cover credential handoff and token verification; they do not establish a complete Faculty/Restricted Admin denial matrix. New tests must exercise live revocation, guessed URLs, service-level calls, files and sockets, not only navigation labels.

CI in `.github/workflows/ci.yml` runs on main pushes and PRs targeting main; it has no database service or deployment/migration step. A feature-branch push by itself is not evidence of hosted CI, migration success or browser QA.

FACULTY-0 validation is limited to documentation diff, reference and whitespace checks. No application tests/builds or runtime QA are claimed. Remaining policy/data questions and the exact next-package stop gates are recorded in the implementation plan. FACULTY-1 has not started.
