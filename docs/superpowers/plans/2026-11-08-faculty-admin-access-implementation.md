# Faculty and Administrator Access — Implementation Plan

- Date: 2026-11-08 (Asia/Manila)
- Repository: `MuelTech/graduate-system`
- Audit baseline / verified live `main`: `045316540d97364214792c7d441ae20a1e426d4c`
- Branch: `feat/faculty-admin-access`
- Status: FACULTY-0 accepted; FACULTY-1 accepted; FACULTY-2 accepted for continuation; FACULTY-3 accepted for continuation; FACULTY-4 accepted for continuation; FACULTY-5 accepted for continuation; FACULTY-6 accepted for continuation after implementation, independent remote commit-diff/source review, and bounded least-privilege correction review; FACULTY-7 accepted for continuation after implementation, independent remote commit-diff/source review, and bounded least-privilege correction review; FACULTY-8 accepted for continuation at correction HEAD `76cc0ae8da9e2aca109ccd729356f793faf909b6` after independent remote commit-diff/source review and bounded GS-011 frozen-attempt identity correction review; FACULTY-9 accepted for continuation at `a22777becfb901973d2aec3e1548e360a60d25d0` after independent remote commit-diff/source review; FACULTY-10 accepted for continuation at `772e2837ec1ffc6cce4f64a12201480f065a3c33` after independent remote commit-diff/source review; FACULTY-11 accepted for continuation at `8c554405d39fc9685e71ba380512c4dd0bd9e03d` after independent remote commit-diff/source review. FACULTY-12 accepted for continuation at `c0059b9ebd0de569bb07d34a224506e0aa44f779` after independent remote commit-diff/source review. FACULTY-13 accepted for continuation at `584360296c43a63c74045d6eacc111a05bcf548c`; FACULTY-14 accepted for continuation at `cbf15478e38d3c483c417e45888aefd6577ed303`; FACULTY-15 accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`.

**Historical FACULTY-0 stop boundary:** FACULTY-0 authorized documentation only and ended before implementation. That boundary was satisfied before FACULTY-1 was separately authorized.

**Execution checkpoint — 2026-11-08**
- ✅ FACULTY-0 — Repository audit and implementation plan accepted.
- ✅ FACULTY-1 — Direct-access foundation accepted at `56b1ecbcb7806c1a3df9477d4b14f4cfa914f62e`.
- ✅ FACULTY-2 — Current-account auth / credential boundary accepted for continuation at `62de9f536608b122fc0618cc4761c139baee34c9`; [implementation report](../reports/2026-11-08-faculty-2-current-account-authentication.md). Independent remote commit-diff review passed; project owner confirmed normal login behavior. Exhaustive browser edge-case QA was not claimed.
- ✅ FACULTY-3 — Accepted for continuation at `6d03ab79d56439e805114a9d5bfc5f08664379ac`. [Implementation report](../reports/2026-11-08-faculty-3-identity-compatibility.md). Independent remote commit-diff/source review passed; project owner confirmed existing Panelist login, Profile, and My Defenses remained normal. Enum/readers only; zero account conversions; isolated real-DB rehearsal safely skipped. FACULTY-4 implementation is tracked below.
- ✅ FACULTY-4 — Accepted for continuation at `33b3910e90f9008f93a5b203c113088a7e2f4d46`. [Implementation report](../reports/2026-11-08-faculty-4-administrator-management.md). Independent remote commit-diff/source/security review passed. Management remains code-owned/dormant; no live bootstrap or Restricted provisioning. Isolated MariaDB contention was safely skipped and remains a deployment-readiness gate.
- Direct-access enforcement remains off; no live Full/Restricted Administrator or Faculty Essay Evaluation access is activated.

## 1. Authority, baseline and scope

The [Faculty/Admin Source of Truth](../FACULTY_ADMIN_ACCESS_SOURCE_OF_TRUTH.md) owns product behavior. The [approved design](../specs/2026-11-08-faculty-admin-access-design.md), current [Defense](../DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md), [Collaborative Defense](../COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md), [Document Lifecycle](../DOCUMENT_LIFECYCLE_SOURCE_OF_TRUTH.md), [Exam Content](../EXAM_CONTENT_SOURCE_OF_TRUTH.md), [copy](../USER_FACING_COPY_SOURCE_OF_TRUTH.md), [UI/UX](../ui-ux/SYSTEM_UI_UX_PLAYBOOK.md), and [verification](../ENGINEERING_VERIFICATION_POLICY.md) authorities apply within their boundaries. The [checklist](../GSIS_IMPLEMENTATION_CHECKLIST.md) records implementation status rather than redefining policy.

The companion [repository audit](../reports/2026-11-08-faculty-admin-access-audit.md) contains evidence paths, architecture findings G1–G14, migration history and verification limits. Read it before using any package below. All current-state assertions refer to the verified baseline, not a production-data inspection.

Target invariants remain:

- exactly four conceptual system roles: Applicant, Student, Faculty, Admin;
- separate Faculty and Admin accounts, credentials/session identities and portals;
- configured Faculty access initially means Essay Evaluation only;
- Essay Evaluation is school-wide across all pending eligible entrance-exam essays; Program is not an authorization boundary and no Faculty-to-Program evaluator relation is required;
- Adviser/Chairman/Panelist/Rapporteur/Facilitator authority comes from exact authoritative relationships and assignments;
- External Faculty cannot be new Advisers; availability is Admin-controlled and does not erase existing relationships;
- Full/Restricted Administrator are access levels within ADMIN; direct per-account administrative capabilities;
- at least one active Full Administrator; no Restricted self-elevation; auditable access changes;
- backend authority, frontend effective-access projection, fail-closed missing/unknown authority;
- history and accepted scoring/signature/academic workflows remain intact.

No new Program Chair role, Adviser load cap, academic Admin override, workspace chooser, alternate user-facing terminology or global defense-Panelist rename is planned.

## 2. Verified starting architecture and conflicts

| Area | Verified baseline | Target gap / planned treatment |
| --- | --- | --- |
| Identity | `UserRole` has PANELIST/CUSTOM; User has one role; Panelist profile is unique by User | Normalize legacy academic identity, expand before changing stored values, keep profile table/IDs |
| Auth | Email login does not validate selected role/activity; JWT/NextAuth claims live 24 hours | Validate selected portal server-side and refresh current identity/access rather than trusting stale role claims |
| Credential state | Panelist-only frontend password gate; predictable Panelist provisioning password | Preserve existing credential hashes/flags; establish role-independent credential-state protection and secure privileged provisioning |
| Faculty portal | Static `/panelist` navigation; dashboard composes assignment/request/review work | Dynamic work projection; add configured essays without replacing workflow authorization |
| Essay | ADMIN-only route **and transaction-level** actor check | Faculty grant plus school-wide pending-eligible essay queue; Program is not an authorization boundary; exact frozen prompt/answer/max and B8 scorer retained |
| Adviser | Sole active AdviserAssignment; signed GS-020 with CONFORME then Dean approval | Preserve those authorities; remove self-toggle, fix directory bypass, recheck eligibility for new assignment |
| Defense | Schedule → active PanelAssignment → PanelRole; own evaluation/report/signature/verdict checks | Preserve role/lifecycle semantics; update identity predicates and current account checks, not committee policy |
| Admin | Broad ADMIN checks across many route namespaces and record/file services | Business-action capabilities at routes, service boundaries, file reads and operational projections |
| Custom Roles | Tables exist; runtime resolver absent; management UI is a mock | Reuse explicit-grant concept and audit infrastructure; retain tables as evidence, implement direct grants |
| Access UX | `403` causes client sign-out; static Admin dashboard/nav | Denial stays authenticated; safe effective-access endpoint, filtered aggregates and navigation |
| Audit | Generic settings endpoints can delete audit rows | Access-change evidence must survive generic delete paths |

The accepted Exam B7/B8 implementation already handles immutable grading and automatic entrance-exam results; do not revert it to an earlier pending-score design. Defense verdicts remain Chairman decisions and are never inferred from exam/defense score mechanics.

## 3. Technical direction

### 3.1 Direct account configuration

Proposed implementation shape, to be specified exactly in FACULTY-1:

1. Keep `User.role` as account identity. Add an Admin-only one-to-one access record keyed by `userId`, with internal level `FULL` or `RESTRICTED`. An absent/invalid record grants no **target** administrative access. Do not infer Full from a role name, email, creator ID, seed fixture or unknown metadata.
2. Add direct capability-grant rows keyed uniquely by `(userId, capabilityKey)`, with granting/updating actor/time. Validate keys against a code-owned typed catalog and allowed account category. A Faculty essay grant cannot be written onto an Admin or CUSTOM account; an administrative grant cannot make Faculty an Admin.
3. Full resolves the explicitly enumerated approved **administrative** catalog, including access management. It does not use a wildcard that could include future academic capabilities. Restricted resolves only known directly granted administrative keys. Missing/unknown keys fail closed; edit/manage permissions require their corresponding reads explicitly or through catalog-defined expansion.
4. Adviser availability remains the existing profile flag, governed by a Faculty-management capability. Effective availability is false for External Faculty. It is not a grant, load counter or current-assignment test.
5. Do not rename the Panelist table/relation just to make the new UI say Faculty. Introduce a narrow academic-account normalizer for legacy PANELIST and future FACULTY during transition; never normalize `PanelRole.PANELIST` away.

Do not overload `RoleFeatureAccess` by assigning a private CustomRole to each account. It has a role owner, arbitrary text keys, no pair uniqueness and no working enforcement layer to preserve. Reuse its explicit-access semantics as migration input, not as a second target authority. Preserve `CUSTOM`, `customRoleId`, `CustomRole` and `RoleFeatureAccess` storage through this initiative unless a later separately approved contraction proves they are unused and safely archived.

This direction is a plan, not a schema edit. Exact names may follow repository conventions; visible labels remain the approved product terms.

### 3.2 Current identity and backend enforcement

JWT proves token authenticity and user identity; it must not be the final source of current role, activity, grants or assignment authority. Resolve current User and target access on protected requests. Do not copy grants into long-lived tokens as immutable authority. In-request memoization is acceptable; no cross-request cache may delay revocation without an explicit invalidation/version mechanism and tests.

Authentication checks credential state before ordinary portal/API work. Allow only the exact authenticated credential-change/logout/session-recovery paths while `mustChangePassword` is true. Preserve Applicant → Student credential handoff and do not force password replacement merely because PANELIST becomes FACULTY. Public registration stays Applicant-only.

Routes declare stable capabilities for administrative work; business services receive a server-derived actor/access context and recheck sensitive mutations within their transaction. Do not trust role/grant/user IDs in request bodies. Preserve existing resource ownership and lifecycle checks after capability checks. Internal-only functions must have explicit trusted call boundaries rather than optional actor arguments reachable from public controllers.

Sensitive grant changes and protected writes need a consistent per-account locking or version/CAS fence. Re-read authority after acquiring the relevant lock; a permission result obtained before waiting must not authorize a later commit after revocation.

Recheck current activity, academic identity and exact active assignment for sockets, room joins/delivery and report previews. Existing assignment eviction is retained. Account disable/role change must remove live authority without waiting 24 hours or fabricating a replacement committee.

Return distinct unauthenticated/expired-session versus authenticated-forbidden outcomes. Keep existing intentional not-found privacy behavior for inaccessible records. Frontend helpers must not log out a valid user for a capability denial.

### 3.3 Proposed capability catalog and current route owners

These internal keys define the planned technical catalog for implemented repository actions. They are not UI labels or new institutional roles. Any additional baseline action found during implementation must be explicitly mapped before activation, not granted by default. Read prerequisites supply only minimum task context, not unrelated Applicant/Student registries.

| Keys | Current areas / actions | Important boundary |
| --- | --- | --- |
| `applicants.view` | `/admin/applicants` list/detail | Applicant profile reads only; does not create public Applicant accounts |
| `students.view`, `students.comprehensive_exam.manage` | `/admin/students`, `/student/:id/comprehensive-exam`, Student journey read | Preserve current recording workflow; known attempt-history defects are separate |
| `waivers.view`, `waivers.manage` | `/waivers`, Applicant waiver aliases | Same key for all validate/reject aliases |
| `cor.view`, `cor.verify` | `/cor/pending`, verify/reject, Applicant COR aliases/promotion | Exact current COR + transaction/credential handoff remains mandatory |
| `exam.schedules.view`, `exam.schedules.manage` | slots, bookings, assignment options/assignment, amendments, appeals | Read options may include minimum Applicant identity; no full registry grant implied |
| `exam.records.view` | exam application list/detail and Admin execution read | No academic essay input, no answer keys through ordinary record projection |
| `exam.starts.authorize` | per-application Start Now | Existing Manila-date/admission/time gates retained |
| `exam.results.finalize`, `exam.results.reconsider` | existing B8 recovery and B9 separate institutional decision | Deterministic scoring/reconsideration only; no essay/MCQ editing |
| `exam.questions.view`, `exam.questions.manage` | bank, private media, question-set membership/publication | Explicit Admin content authority; never granted to essay evaluators |
| `exam.configuration.manage` | exam configuration read/write | Frozen attempt basis remains immutable |
| `faculty.view`, `faculty.manage` | existing Admin Panelist CRUD, future Faculty configuration | View excludes credentials; manage cannot grant Admin access or assign committees/advisees |
| `adviser.requests.view`, `adviser.requests.review` | Admin request/assignment overview, Dean review and hardened assign alias | CONFORME/signature/new-assignment eligibility remain required |
| `defense.applications.view`, `defense.applications.review` | pending/approved/all/detail/summary, status/reject/history | Review does not conclude or schedule the defense |
| `defense.schedules.view`, `defense.schedules.manage` | scheduled detail/submission, policy/candidate searches, schedule/correction | Automatic Adviser, quotas, SCHEDULED-only correction and audit retained |
| `defense.records.view` | Admin records, criteria/summary/GS-006/007/bundle outputs, Committee Report monitoring | Read/official output only; no evaluator/Rapporteur/Chairman authority |
| `repository.view`, `repository.manage` | private Admin archive/list and publication/metadata actions | Preserve publication/privacy rules; no blanket respondent-data disclosure |
| `memos.manage` | create/archive memos and approved attachments | Role/audience filtering on ordinary reads remains separate |
| `settings.view`, `settings.manage` | allowlisted ordinary system settings | High-privilege identity/access settings are excluded; unknown keys denied |
| `email.configuration.manage`, `email.logs.view` | email-template administration, email-log reads | Does not authorize sending external messages or claim delivery integration accepted |
| `storage.health.view`, `storage.integrity.scan` | health and integrity scan | Operational capability; protect sensitive diagnostics |
| `audit.view` | settings audit-log read projection | Protected access-change events must not be deletable through generic endpoints |
| `administrator_access.manage` | new Administrators list/detail/provision/status/access editor | Full Administrator only; never grantable to Restricted |
| `essay.evaluate` | new Faculty essay queue/detail and existing grading service | Configured Faculty only; school-wide pending eligible entrance essays across Programs; immutable grade; no exam administration |

Catalog rules:

- Full-only high-privilege configuration and access management use explicit level checks in addition to typed action checks; the Restricted editor never offers access-management authority.
- Administrative dashboard is a composition of granted modules, not a new all-data permission. Fetch only authorized sections/counts. Likewise candidate lookup/read prerequisites for scheduling must not force `faculty.manage`.
- Resource-class document reads reuse the owning business capability: COR → `cor.view`/verification context, defense supporting evidence → relevant application/schedule read, official Defense output → `defense.records.view`, GS-020 → `adviser.requests.view`, GS-017 → its authorized application/schedule/record context. One authorized context may suffice; no `ADMIN` or generic `documents.*` bypass.
- Faculty file/GS-017/GS-020 rights stay exact assignment/request/issuer-bound. An essay grant does not confer manuscript, signature or COR access.
- Analytics is currently mock presentation; `analytics.view` may be a reserved future catalog key, disabled in the real capability editor until an accepted backend/read model exists. Curriculum management is also reserved/unimplemented, not a new CRUD package here.
- Legacy expert assignment, retired distribution/queue APIs and any unidentified generic setting/audit-delete action are excluded from Restricted grants until explicitly classified. Return their existing retired response or deny; do not resurrect a deprecated workflow.
- Result-email authorization/integration is separately deferred. Do not grant Restricted or Faculty access to that action under a generic exam permission. Preserve the known issue in Email Integration tracking; any legacy Full-only compatibility exposure is not certification of that path.
- `canEdit` from a legacy role is not mechanically equivalent to every `.manage` key. Export unknown/duplicate feature keys for explicit mapping.

### 3.4 Faculty effective work and frontend projection

Provide one authenticated backend effective-access projection with account identity, administrative access level/capabilities where appropriate, configured Faculty essay access and safe workflow-work summaries. It must expose no raw signatures, arbitrary Student IDs, grants from another account, or private evaluator drafts. Return no granted work on resolution failure; use a loading/error state instead of stale authorized menus.

Faculty work sources:

| Work | Derivation | Authority for the actual operation |
| --- | --- | --- |
| Essay Evaluations | Direct `essay.evaluate` grant | Current active Faculty + current grant; list/detail/write use the same school-wide pending-eligibility predicate, with Program available only as optional context/filtering |
| Active Advisees / manuscript reviews | Sole active AdviserAssignment for each Student | Existing active-Adviser and exact reviewed-document service rules |
| Adviser Requests / own issued records | Requests addressed to that Faculty / explicit issuer-record rights | Existing exact-request response/GS-020 and issuer GS-017 visibility; no current-advisee power inferred |
| My Defenses | Active exact-schedule assignments and legitimately readable concluded assignments | Exact assignment role, attempt, lifecycle, own evaluator/signature/report/verdict rules |

My Advisees must remain reachable for an addressed request even before a relationship exists, and for existing explicitly authorized records; current availability or External status must not erase those rights. This is accepted Adviser workflow compatibility, not an Adviser permission checkbox. Do not invent recency cutoffs for historical rights.

Faculty Dashboard/Home always exists, including a truthful no-work state. Show only relevant work cards; zero pending essays remains a valid Essay Evaluations empty state for an enabled evaluator. Availability alone must not show arbitrary advisee data. Preserve accepted common Profile/Notifications and other authorized account surfaces without turning them into academic grants. Committee roles remain visible only in their actual context.

Admin effective access filters navigation, deep route rendering, mutation controls and dashboard requests. Restricted Admin with no grants still gets a safe landing/account surface, without full dashboard leakage. Client cache keys include account identity; clear sensitive caches on logout/account change, and refresh access on grant mutation, foreground/resume, authorization denial and relevant assignment changes. Cached effective work never authorizes a backend request.

Keep technical `/panelist` routes as compatibility during this initiative; user-facing account terminology becomes Faculty in bounded UI packages. It is acceptable to keep `/panelist/defense-workspace/[scheduleId]` canonical internally while changing account-facing labels. Preserve schedule IDs, query contexts, deep-link active state and notification/email destinations. A broad URL/file-structure rewrite is not required.

### 3.5 Full Administrator mutation safety

All create/update/status/demotion/delete/role-change paths affecting Admin accounts must pass the same access-management service. Restricted cannot call it even for self. Full access does not permit replacing Faculty-only academic identities.

For each sensitive mutation:

1. Authenticate current active actor and verify Full access inside the transaction.
2. Serialize against a persistent shared access-management lock (for example a dedicated singleton row), then lock/reload actor, target and active Full records in a consistent order. Revalidate the actor's current Full authority after acquiring that lock. A naive count before two concurrent demotions is insufficient.
3. Compute resulting active Full population using `User.isActive` plus Full access metadata. Reject any transaction that leaves zero. Account disable and role change count as removal, just like demotion/deletion.
4. Validate all grants/categories and reject unknown/high-privilege grants to Restricted. Never mass-assign request bodies into User/access records.
5. Write target changes and access audit evidence atomically, with actor, target, time and exact before/after level/grants/status. Audit failure rolls back the change. Grant changes/disable invalidate access immediately for subsequent protected operations.
6. Protect these audit events from existing single/bulk deletion APIs, including a Full Administrator using a generic Settings route. Do not redesign all audit retention under this feature.

No runtime endpoint may use bootstrap as a self-elevation escape hatch. Initial approved Full accounts are an operator-controlled, explicit migration manifest, rehearsed and audited. DR-1 must be resolved first.

## 4. Migration and compatibility strategy

### 4.1 Separate reviewability from production activation

Packages may land as additive, independently tested changes before the feature is activated. Until all administrative paths are guarded, **do not expose/provision live Restricted Administrators**. New APIs/UI remain inaccessible to ordinary users until their prerequisites and environment activation gate are satisfied. A rollout gate is deployment control, never a substitute for permissions or an academic override.

The target resolver must not silently interpret an unmigrated ADMIN as Full. Existing legacy behavior may remain on the explicitly unactivated legacy application path during development; before activation, remove that bypass from **all** entry points and prove unmapped accounts fail closed. No partially activated state with Restricted accounts and legacy role-only APIs is releasable. Each package records whether it is source-ready, locally rehearsed, or activated; these are different evidence classes.

### 4.2 Preflight and immutable manifest

Before any data mutation, export a protected operator report with:

- User role/activity/credential flags and Panelist profile link/flags; detect missing/multiple profile links and role/profile mismatches;
- all existing Admin accounts, proposed explicit Full/Restricted mapping and assurance of one active Full;
- all CUSTOM Users, customRole links, role activity, feature keys/flags, duplicates/unknowns and proposed per-account disposition;
- active and historical AdviserAssignment/PanelAssignment rows, duplicate active Advisers, External-with-Adviser anomalies, current pending GS-020 requests and historical ADMIN/CUSTOM academic assignments;
- counts and IDs for grader attribution, report/signature ownership, certifications, official/signed GS-020 records, exact manuscript links and audit actors;
- actual migration ledger, schema/enum values and application versions using the DB.

Do not put real names/emails/signature data into public reports or fixtures. The committed plan uses no production PII. Manifest processing must be resumable, idempotent and reject changed input/state rather than silently guessing grants. Preserve an operator-only original-role/grant mapping for reconciliation/rollback.

### 4.3 Expand, support both, then convert

1. Add direct access metadata/grants without changing existing identities, credentials, profile IDs or legacy tables. Keep missing target grants denied; use synthetic fixtures for tests.
2. Add FACULTY to the MySQL User enum while retaining PANELIST/CUSTOM. Deploy readers/normalizers before any writer emits FACULTY. Do not edit old migrations or `PanelRole`.
3. Update auth, API/service predicates, document/record authorization, realtime, notifications/memo audiences, candidate searches, frontend types/navigation and seed/test expectations to support the transition. Credentials remain attached to the same User.
4. Rehearse the **entire** committed migration chain on isolated MySQL/MariaDB and on a production-like snapshot, with before/after integrity checks. Test old-token handling, rejected stale privileged roles, active assignments and historical PDFs. Do not use a reset/reseed as the migration.
5. Bootstrap named approved Admin metadata and map approved direct grants. Reconcile legacy CUSTOM accounts individually. Academic + operational duties require separately approved accounts; never bulk-convert CUSTOM to Full or Faculty or copy its arbitrary grant set.
6. Change each existing broad PANELIST User's stored role in place to FACULTY, keeping User/profile/relationship/credential IDs. Record audit and manifest evidence; do not rewrite historical defense roles, snapshots, signatures or hashes. Normalize legacy External availability only with explicit recorded before/after evidence; do not end historical/current assignments as a side effect.
7. Require fresh authentication at cutover where token claims no longer match the permitted current account identity. The transition may explicitly allow legacy PANELIST claims for the same now-Faculty User only through the narrow academic normalizer; never allow stale ADMIN/CUSTOM privilege. Define and test the chosen cutover session behavior before execution.
8. Activate only after backend coverage, frontend parity and owner decisions/QA pass. Preserve legacy read-compatible routes/models. User-facing Custom Roles/Other Roles can retire after account reconciliation, with safe redirects/denials for old URLs.

No destructive enum/table contraction is required. A future removal package needs proof of zero remaining rows/callers/tokens, archived mapping evidence and separately approved rollback/retention policy.

### 4.4 Rollback and recovery

Back up DB and private document storage consistently before cutover; verify restore in isolation. MySQL enum/table DDL may implicitly commit, so do not promise one encompassing rollback transaction. Data-conversion batches need durable checkpoints and conditional updates.

Before role conversion, application rollback can retain unused additive tables/enum values. After conversion, the rollback application must be compatibility-capable; do not deploy the original PANELIST-only binary against FACULTY rows. Prefer disabling new entry points or a forward repair. Any role-data reversal must use the preserved manifest, retain grants/audit/history, and never drop FACULTY while rows still use it. No rollback may expose Restricted accounts through broad legacy ADMIN APIs. If that cannot be guaranteed, keep access closed while restoring a compatible release.

## 5. Decision Required register

This register preserves both remaining policy/environment gaps and resolved decisions for traceability. It is not permission to redesign the approved model. Resolve only the remaining decision needed for the next package; independent documentation/foundation work may continue when separately authorized.

| ID | Decision / evidence needed | Blocks |
| --- | --- | --- |
| DR-1 — **POLICY APPROVED; ACCOUNT/BOOTSTRAP PENDING** | At least one active Full Administrator is required for privileged Administrator Management. Initial account must be explicitly designated by the project owner and established through a controlled, operator-authorized, auditable bootstrap. Never infer from Gmail/email, role name, seed, creator, or account order. | Actual initial account designation, live bootstrap, Restricted provisioning and cutover |
| DR-2 — **DEVELOPMENT RETIREMENT APPROVED; LIVE DISPOSITION PENDING** | Completely retire CUSTOM/CustomRole/RoleFeatureAccess and legacy Other Roles from the target architecture. Development-only CUSTOM test accounts may be removed through separately controlled cleanup and replaced by approved Faculty/Admin seeds. No automatic conversion or permission translation. Preserve unrelated academic/Defense/audit history and historical migrations. | FACULTY-17 implementation; any actual development account cleanup requires its own explicit operation authorization; live/production account disposition remains unresolved |
| DR-3 — **RESOLVED** | Faculty Essay Evaluation is school-wide: configured Faculty evaluators may see and evaluate all pending eligible entrance-exam essays across Programs. Program is not an authorization boundary; no evaluator-to-Program relation or Program Chair role is required. Initial evaluator designation remains an operator/cutover mapping task. | Resolved; no longer blocks Faculty essay queue/read/write design |
| DR-4 — **POLICY APPROVED; ENGINEERING IMPLEMENTATION PENDING** | Separate Faculty and Admin User records may share the same Gmail/email. Login role must select the correct account. Each record retains its own ID, password, session, grants and audit attribution. Authentication and recovery must be role-scoped; preserve same-role uniqueness and Applicant/Student promotion semantics. | Dual-duty same-email authentication, provisioning, recovery, schema uniqueness and session tests; must be implemented before affected dual-account provisioning/activation |
| DR-5 — **POLICY APPROVED; IMPLEMENTATION VERIFICATION PENDING** | Admin may assign External Faculty as Chairman, Panelist, Rapporteur or Facilitator for an exact Defense schedule. External Faculty may never be Adviser or receive student advisees. Roles remain contextual assignments, not permanent account permissions. | Verify/correct Defense committee assignment eligibility and tests before enabling affected External assignments |
| DR-6 — **POLICY APPROVED; IMPLEMENTATION VERIFICATION PENDING** | If requested Adviser becomes inactive/unavailable after CONFORME but before Dean approval, existing authorized Admin/Dean reviewer may reject the pending request with a reason. Preserve request and signed CONFORME unchanged; Student may submit a new request to another eligible Internal Faculty member. | Verify/correct rejection recovery path and regression tests in Adviser request/approval workflow |
| DR-7 — **POLICY APPROVED; IMPLEMENTATION VERIFICATION PENDING** | An Internal Faculty member who has ever held an authoritative AdviserAssignment cannot be reclassified as External, even after assignment completion. Enforce server-side with no Admin override. | Verify/correct Faculty classification mutation and historical-assignment tests |

Existing open ODP role-label confirmation, institutional Dean signatures, post-start committee substitution, evaluator excusal/quorum, comprehensive-exam history, account reactivation and Email Integration remain with their owning initiatives. Do not resolve them through this access plan. Retain current accepted ODP working mapping and all unmodified workflow rules.

Account inactivity always denies new protected access in the target. Its academic recovery consequences remain separate policy: disabling an account does not delete its assignments or permit Admin to impersonate its academic actions.

## 6. Dependency-ordered work packages

All packages require explicit separate authorization, verified current branch/base, a clean or understood worktree, bounded diff review, and commit/push followed by a stop. Expected areas are integration seams, not permission for unrelated refactors. New file paths are proposals; existing paths are grounded in the audit. The default verification follows the Engineering Verification Policy. Shared auth/schema changes deliberately require broader checks; focused UI work does not require repeated full backend suites.

Sequence: **1 foundation → 2 auth → 3 identity compatibility → 4 Admin authority → 5 admission guards → 6 exam Admin guards → 7 defense Admin guards → 8 document guards → 9 operational guards → 10 Faculty configuration → 11 Faculty Management UI → 12 essay backend → 13 effective-access reads → 14 Faculty portal → 15 Administrators/Admin UI → 16 data cutover rehearsal → 17 complete Custom Roles subsystem retirement → 17A same-Gmail role-scoped Faculty/Admin identity and recovery → 17B DR-5/6/7 implementation-alignment verification/corrections → 18 integrated acceptance/controlled activation.** FACULTY-17A and 17B are bounded follow-up packages added by this documentation revision; they do not replace or rewrite accepted historical package reports.

### FACULTY-1 — Direct-access foundation

- **Status:** ✅ Accepted after implementation, independent source review, recovery verification and focused MariaDB-isolation guard verification. Accepted checkpoint: `56b1ecbcb7806c1a3df9477d4b14f4cfa914f62e`.
- **Scope:** specify typed catalog/implications, add constrained direct-user grants/Admin-level metadata and shared access resolver; establish target activation boundary and protected access-event taxonomy. Deliver operator preflight format without running it on live data.
- **Non-goals:** role conversion, live grants/bootstrap, login changes, module guard migration, UI.
- **Dependencies:** accepted FACULTY-0; no unresolved decision may be filled with invented data.
- **Expected areas:** `backend/prisma/schema.prisma`, new additive migrations, `backend/src/middlewares/` and new access service/rules/interfaces, focused tests.
- **Migration impact:** new additive structures only; existing roles/profile/legacy grants remain intact. No default Full or essay grant.
- **Authorization/UI impact:** testable fail-closed target resolver; no live Restricted accounts or user-facing activation.
- **Verification:** catalog/category/unknown-key tests, uniqueness tests, Prisma generate/validate, backend build, isolated full-chain migration rehearsal and preservation counts.
- **Stop condition:** foundation reviewed with no authority enabled solely by migration; stop before auth work.

### FACULTY-2 — Current-account authentication and credential boundary

- **Scope:** validate selected email-login role and account activity; current-account actor loading/revocation; credential-state gates; safe 401/403 distinction; session synchronization contract and API helper behavior; minimal authenticated self-access response with current identity/capabilities for later management controls.
- **Non-goals:** Faculty data rename, login redesign, self-service recovery, Admin permissions editor, workflow changes.
- **Dependencies:** 1. Temporary credential handling follows checklist 17/21; do not overwrite existing credentials as a shortcut.
- **Expected areas:** auth routes/service/repository/controller/interfaces and self-access DTO, shared JWT/middleware, `frontend/src/auth.ts`, middleware/session types, client/server API helpers, change-password flow.
- **Migration impact:** none unless a narrowly justified access-version field is specified/reviewed; no password-hash backfill.
- **Authorization/UI impact:** role mismatch/inactive/stale privilege denied; password state enforced consistently; valid forbidden actions do not sign out.
- **Verification:** all role/credential combinations, forged body role, stale/disabled token, password-gated API bypass, COR promotion/existing-password regressions, expired token and valid 403 handling; related auth/document/socket suites and both builds.
- **Stop condition:** current identity is authoritative and credential handoff preserved; no portal or permission rollout.

### FACULTY-3 — Faculty identity compatibility readers

- **Status:** ✅ Accepted for continuation at `6d03ab79d56439e805114a9d5bfc5f08664379ac` after independent remote commit-diff/source review and project-owner sanity QA. See [report](../reports/2026-11-08-faculty-3-identity-compatibility.md). Both account identities are supported, with technical paths/profile/defense roles preserved. Enum migration is source-validated only; isolated real-DB rehearsal was safely skipped. No existing account conversion; FACULTY-4 implementation is tracked below.

- **Scope:** expand enum with FACULTY; support both academic account values through bounded normalizers across backend predicates, session routing/types, notifications/memos and realtime; preserve technical `/panelist` paths.
- **Non-goals:** existing User conversion, PanelRole rename, profile-table rename, production backfill, broad UI rewrite.
- **Dependencies:** 1–2.
- **Expected areas:** Prisma additive migration, academic identity helper, routes/services/repositories with account PANELIST checks, realtime, notification/memo contracts, frontend types/middleware and synthetic seeds/tests.
- **Migration impact:** enum expansion only; no existing stored role/profile/assignment updates.
- **Authorization/UI impact:** legacy/future academic identity accepted without allowing ADMIN/CUSTOM academic impersonation; exact assignments still required.
- **Verification:** both identities across Adviser/Defense/GS-017/GS-020/files/sockets, stale ADMIN claim denial, role-specific memo delivery, no PanelRole/history conversion; broad related suites, both builds, enum migration rehearsal.
- **Stop condition:** all readers/writers needed for safe future conversion are identified and compatible; no existing account converted.

### FACULTY-4 — Full Administrator management service and safeguards

- **Status:** ✅ Accepted for continuation at `33b3910e90f9008f93a5b203c113088a7e2f4d46` after independent remote commit-diff/source/security review. See [report](../reports/2026-11-08-faculty-4-administrator-management.md). Full-only backend, singleton fence, actor revalidation, last-active-Full and protected atomic audit are implemented and synthetic-test verified. Production management remains disabled. Isolated real-DB contention was safely skipped and remains a deployment-readiness gate; no live bootstrap/conversion/Restricted rollout. FACULTY-5 implemented / pending independent review.

- **Scope:** implement Full-only Administrator account/access/status backend service, safe random temporary privileged credentials, serializable last-active-Full guard and atomic audit; protect access events from generic audit deletion.
- **Non-goals:** live bootstrap, Restricted rollout, UI, general account recovery or global audit-retention redesign.
- **Dependencies:** 1–3; DR-1 required for any environment bootstrap, not synthetic tests.
- **Expected areas:** new Admin-access routes/controller/service/repository, auth provisioning helpers, settings audit deletion repository/service, tests.
- **Migration impact:** add shared locking structure if absent; no implicit bootstrap or default-grant backfill.
- **Authorization/UI impact:** Full-only API; deny Restricted self/other grants, role escalation and generic settings bypass. Keep inaccessible outside reviewed target test/rollout state.
- **Verification:** two competing demotions/disables/deletes leave one active Full; actor demoted concurrently; unknown grants/body mass assignment denied; audit failure rolls back; audit single/bulk deletion cannot erase access events; credentials require change.
- **Stop condition:** synthetic real-DB contention and negative HTTP/service checks pass; no live Restricted account exists yet.

### FACULTY-5 — Admission and Student administrative guards

- **Status:** ✅ Accepted for continuation at `e0fb5ad4ade4cb3c190310e9d7819afad4e99704` after independent remote commit-diff/source review. See [implementation report](../reports/2026-11-08-faculty-5-admission-student-guards.md). All 18 admission/Student administrative aliases are mapped to bounded catalog capabilities with service checks and current-actor revalidation where the existing transaction permits it. Guard enforcement remains code-owned/dormant; no live Restricted access, Admin mapping, schema change or FACULTY-6 work. FACULTY-6 implemented / pending independent review.
- **Scope:** map Applicant/Student reads, waiver/COR verification, promotion and comprehensive-exam recording aliases to catalog actions, including minimum read dependencies.
- **Non-goals:** admission-policy redesign, continuing-Student onboarding, comprehensive-exam history repair, password recovery UI.
- **Dependencies:** 1–4.
- **Expected areas:** admin-applicant/admin-student, cor/waiver/student routes/controllers/services/repositories.
- **Migration impact:** none.
- **Authorization/UI impact:** direct target-context denials at every alias; preserve existing applicant/student ownership and COR transaction. No broad registry access from a verification grant.
- **Verification:** exact positive/negative HTTP and service matrix per key, alias bypass attempts, current actor revocation, COR identity/password handoff and waiver regressions.
- **Stop condition:** every admission/student administrative endpoint is mapped/tested; do not implement new workflow behavior.

### FACULTY-6 — Examination administrative guards

- **Status:** ✅ Accepted for continuation at correction HEAD `987b75bbceb1822798e5d2ce7fafe858fb956456` (original implementation `7fd57d941309170612c72941e50eb308eaf1cfff`) after independent remote commit-diff/source review and bounded least-privilege correction review. See [implementation report](../reports/2026-11-08-faculty-6-examination-administrative-guards.md). All 32 mapped Admin exam surfaces and 2 explicit legacy exclusions remain source-ready/dormant; the Exam Records list projection is explicitly bounded and no credential/internal account fields are exposed. No Admin mapping, Restricted activation, Faculty essay implementation, schema change or FACULTY-7 work. FACULTY-7 implemented / pending independent review.
- **Scope:** capability enforcement for schedules/bookings/assignment/amendments, records/execution, Start Now, configuration, bank/media/publication, B8 result recovery and B9 reconsideration.
- **Non-goals:** Faculty essay authority/UI, email integration, new scheduling policies, scorer changes.
- **Dependencies:** 1–5.
- **Expected areas:** exam/exam-engine routes, controllers, exam and execution/configuration/question-set/media repositories/services.
- **Migration impact:** none.
- **Authorization/UI impact:** restricted action boundaries; existing in-transaction `role=ADMIN` checks also require exact capability. No essay authority implied by Full or exam-record access in the target.
- **Verification:** denial per key and alias, current-grant changes during mutations, immutable MCQ/attempt/result basis, B3–B9 affected regressions and real DB tests when locking paths change; no result-email grant exposed.
- **Stop condition:** administrative exam catalog covered; Faculty essay access remains closed until 12.

### FACULTY-7 — Defense and Adviser administrative guards

- **Status:** ✅ Accepted for continuation at correction HEAD `ec68ff3d9ef4202f1321418467ed08e4cc642286` (original implementation `ff12c6cbe92ed7cda312c9e8af5b44f39b531fef`) after independent remote commit-diff/source review and bounded least-privilege correction review. See [implementation report](../reports/2026-11-08-faculty-7-defense-adviser-administrative-guards.md). FACULTY-8 is accepted for continuation at correction HEAD `76cc0ae8da9e2aca109ccd729356f793faf909b6`; FACULTY-9 is accepted for continuation at `a22777becfb901973d2aec3e1548e360a60d25d0`; FACULTY-10 is accepted for continuation at `772e2837ec1ffc6cce4f64a12201480f065a3c33`; FACULTY-11 is accepted for continuation at `8c554405d39fc9685e71ba380512c4dd0bd9e03d`; FACULTY-12 accepted for continuation at `c0059b9ebd0de569bb07d34a224506e0aa44f779`; FACULTY-13 accepted for continuation at `584360296c43a63c74045d6eacc111a05bcf548c`; FACULTY-14 accepted for continuation at `cbf15478e38d3c483c417e45888aefd6577ed303`; FACULTY-15 accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`.

- **Scope:** guard application review, scheduling/correction, committee candidate queries, records administration and Dean review/legacy assign wrapper; recheck proposed manual participant identity/activity/profile at writes.
- **Non-goals:** committee quotas, external-role expansion, Adviser replacement, post-start substitution, scoring/verdict/report redesign.
- **Dependencies:** 1–6. DR-5 is now owner-approved: External Faculty may be assigned Chairman, Panelist, Rapporteur, or Facilitator, never Adviser. Verify/correct any mismatch through bounded follow-up FACULTY-17B; do not rewrite this accepted historical package report.
- **Expected areas:** thesis route/controller/service/repositories, scheduling correction, committee candidate helpers, Adviser Request Dean boundary.
- **Migration impact:** none; retain assignment IDs/history.
- **Authorization/UI impact:** Admin capabilities permit operations only; never academic evaluator/Rapporteur/Chairman powers. Assignment eligibility and automatic Adviser remain separate checks.
- **Verification:** read/review/schedule separation, all aliases, arbitrary non-Faculty/inactive participant IDs, exact SCHEDULED correction, removed-member denial, automatic Adviser, last stage/attempt integrity and independent Chairman verdict.
- **Stop condition:** all operational boundaries covered without altering accepted defense state machines.

### FACULTY-8 — Private files and official-record guard closure

- **Status:** ✅ Accepted for continuation at correction HEAD `76cc0ae8da9e2aca109ccd729356f793faf909b6` (original implementation `f94d02f87c471602a7a2a6e3f9a5775653790ac9`) after independent remote commit-diff/source review and bounded GS-011 frozen-attempt identity correction review; [implementation report](../reports/2026-11-08-faculty-8-private-file-official-record-guards.md). Enforcement remains dormant; FACULTY-9 is accepted for continuation at `a22777becfb901973d2aec3e1548e360a60d25d0`; FACULTY-10 is accepted for continuation at `772e2837ec1ffc6cce4f64a12201480f065a3c33`; FACULTY-11 is accepted for continuation at `8c554405d39fc9685e71ba380512c4dd0bd9e03d`; FACULTY-12 accepted for continuation at `c0059b9ebd0de569bb07d34a224506e0aa44f779`; FACULTY-13 accepted for continuation at `584360296c43a63c74045d6eacc111a05bcf548c`; FACULTY-14 accepted for continuation at `cbf15478e38d3c483c417e45888aefd6577ed303`; FACULTY-15 accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`.

- **Scope:** replace broad Admin branches in document streaming, GS-017, GS-020 and official Defense read/PDF services with resource/context capabilities; retain Faculty ownership/request/issuer checks.
- **Non-goals:** new document entitlements, renderer/template changes, public storage, signed-record backfills, generic file manager.
- **Dependencies:** 1–7.
- **Expected areas:** document service/controller, Adviser certification/request record services, official-defense services, owning read models/routes.
- **Migration impact:** none; immutable bytes/snapshots/hashes unchanged.
- **Authorization/UI impact:** direct file/PDF URL no longer bypasses Restricted permissions; no essay-only access to COR or academic signatures.
- **Verification:** every model registry class and official output, owner/requested-Adviser/issuer/current-Adviser/committee/Admin matrix, cross-Student/attempt denial, inactive actor, raw-signature privacy and exact historical output reproducibility.
- **Stop condition:** file and official-record surfaces match catalog and preserve historical authority.

### FACULTY-9 — Settings, operational surfaces and aggregate containment

- **Status:** ✅ Accepted for continuation at `a22777becfb901973d2aec3e1548e360a60d25d0` after independent remote commit-diff/source review. [Implementation report and complete action/capability ledger](../reports/2026-11-09-faculty-9-operational-aggregate-guards.md). Settings/key policy, separate email-template/log authority, storage diagnostics, Repository/Databank, Memo/audience/file checks and capability-filtered dashboard queries were independently reviewed. Raw respondent data remains exact current Student-researcher only in the enabled target; unauthorized dashboard sources are not queried. Unclassified legacy Expert/Faculty administration and generic audit deletion remain denied in the target, while protected access/security audit evidence remains protected. Enforcement stays code-owned/dormant; no schema/migration/frontend/live mapping or Restricted activation. FACULTY-10 is accepted for continuation at `772e2837ec1ffc6cce4f64a12201480f065a3c33`; FACULTY-11 is accepted for continuation at `8c554405d39fc9685e71ba380512c4dd0bd9e03d`; FACULTY-12 accepted for continuation at `c0059b9ebd0de569bb07d34a224506e0aa44f779`; FACULTY-13 accepted for continuation at `584360296c43a63c74045d6eacc111a05bcf548c`; FACULTY-14 accepted for continuation at `cbf15478e38d3c483c417e45888aefd6577ed303`; FACULTY-15 accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`.

- **Scope:** enforce remaining settings/key allowlists, email-template/log reads, storage, repository, memo management and audit reads; filter Admin dashboard queries by effective modules; close unclassified Restricted entry points.
- **Non-goals:** implementing Analytics/Curriculum, email delivery, expert-evaluation workflow, audit-retention redesign.
- **Dependencies:** 1–8.
- **Expected areas:** settings/admin-dashboard/admin-storage/email/repository/databank/memo routes/services/repositories and generic document-context helpers as needed.
- **Migration impact:** none.
- **Authorization/UI impact:** no hidden aggregate leakage, generic setting access escalation or audit-evidence deletion; no accidental access through broad ADMIN fallbacks.
- **Verification:** direct URL/service denial, unknown/sensitive settings rejected, dashboard data minimization, private repository evidence and memo audiences; route inventory has no unclassified Restricted-reachable action.
- **Stop condition:** administrative backend coverage ledger complete before any Restricted rollout.

### FACULTY-10 — Faculty configuration and new-Adviser eligibility backend

- **Status:** ✅ Accepted for continuation at `772e2837ec1ffc6cce4f64a12201480f065a3c33` after independent remote commit-diff/source review. [Implementation report and bounded action/capability ledger](../reports/2026-11-09-faculty-10-configuration-adviser-eligibility.md). `faculty.view`/`faculty.manage` guard bounded Faculty DTOs, secure random provisioning, strict profile/status/classification/availability and only the approved school-wide `essay.evaluate` grant. Legacy unaudited Faculty writers and unrestricted Adviser-directory access are retired in the enabled target. Self-service Adviser availability is denied when the target is enabled; candidate listing, signed request submission and Dean approval share current fail-closed Adviser eligibility with transactional rechecks. DR-6/DR-7 preserve signed evidence and existing relationships while blocking unsafe new assignment/reclassification. Faculty Management remains code-owned/dormant (503 until coordinated activation); no real provisioning/grant activation, data conversion, schema/migration or frontend work. Agent-reported verification: 45 affected files / 1,586 tests passed with zero skips/failures; final FACULTY-10 rerun 4 files / 185 tests passed; backend build and diff checks passed. The independent review verified the pushed source/diff and regression intent, not a second execution of those commands. Hosted CI/browser/manual/real-DB contention verification remains unclaimed. FACULTY-11 is accepted for continuation at `8c554405d39fc9685e71ba380512c4dd0bd9e03d`; FACULTY-12 accepted for continuation at `c0059b9ebd0de569bb07d34a224506e0aa44f779`; FACULTY-13 accepted for continuation at `584360296c43a63c74045d6eacc111a05bcf548c`; FACULTY-14 accepted for continuation at `cbf15478e38d3c483c417e45888aefd6577ed303`; FACULTY-15 accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`.

- **Scope:** Admin-managed Faculty profile/status/classification, direct Essay Evaluation grants, adviser availability; remove/deny self-service availability writes; align all new-assignment candidate/approval checks.
- **Non-goals:** assigning Students/committees from Faculty Management, load caps, editing signed requests, rewriting existing assignments.
- **Dependencies:** 1–9. DR-6/7 are now owner-approved; verify/correct the exact reject-after-CONFORME recovery and permanent Internal-after-AdviserAssignment classification lock through bounded follow-up FACULTY-17B. Preserve accepted signed evidence and existing assignments.
- **Expected areas:** admin-panelist and panelist routes/controllers/services/repositories, canonical Adviser candidate/approval service, legacy available directory.
- **Migration impact:** no relationship rewrite; any External-flag correction is explicit audited data work in 16.
- **Authorization/UI impact:** `faculty.manage` controls profile/grants/availability; External effective availability false. Admin grant writes cannot confer academic authority on Admin itself.
- **Verification:** direct self-toggle rejected, Internal/External and account/profile-active filtering on list/request/approval, availability revocation before approval, availability change preserves current/historical assignments and GS-020, unknown/committee permission fields rejected.
- **Stop condition:** backend configuration and eligibility invariants proven; no UI changes or live essay grants implied.

### FACULTY-11 — Faculty Management UI

- **Status:** ✅ Accepted for continuation at `8c554405d39fc9685e71ba380512c4dd0bd9e03d` after independent remote commit-diff/source review. [Implementation report](../reports/2026-11-09-faculty-11-management-ui.md). Faculty list/detail/create/edit and the User Management `Faculty` label use the accepted FACULTY-10 contract; the page-specific protected `canManage` read supplies only bounded view/manage presentation and does not expose raw Admin capabilities. One-time temporary credentials remain local to the post-create handoff, password editing and legacy surname-password copy are removed, and Internal-only Adviser availability / Essay Evaluation map to the accepted backend contract. Optional assignment context remains deferred because no safe bounded summary exists. Agent-reported verification: 20 focused frontend checks, 156 focused backend tests, TypeScript/scoped ESLint, frontend/backend builds and diff checks passed; 3 synthetic Chrome scenarios passed with screenshots inspected by the implementation agent. Independent review verified the pushed source/diff and regression intent, not a second execution of those commands or screenshot inspection. GitHub hosted CI was not observed; project-owner manual acceptance remains separate. Management stays code-owned/dormant with controlled 503 behavior; no live activation, schema/migration/data conversion or FACULTY-12 work. FACULTY-12 accepted for continuation at `c0059b9ebd0de569bb07d34a224506e0aa44f779`; FACULTY-13 accepted for continuation at `584360296c43a63c74045d6eacc111a05bcf548c`; FACULTY-14 accepted for continuation at `cbf15478e38d3c483c417e45888aefd6577ed303`; FACULTY-15 accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`.

- **Scope:** Faculty list/detail, account status, Internal/External, Essay Evaluation access, Available as Adviser, bounded read-only assignment summaries.
- **Non-goals:** committee/adviser assignment editors, broad portal redesign, Administrator management.
- **Dependencies:** 10; DR-4 before dual-account provisioning affected by identical email.
- **Expected areas:** existing Admin users/panelists pages/components and Admin User Management navigation; retain legacy technical routes where useful.
- **Migration impact:** none.
- **Authorization/UI impact:** view/manage controls follow effective permissions; no permanent Panelist/Chairman/Rapporteur/Adviser-page checkboxes.
- **Verification:** focused UI contracts/typecheck/scoped lint; desktop/mobile/keyboard, loading/error/empty, status/grant change refresh and shortest-truthful-copy review; backend rejection shown accurately.
- **Stop condition:** Faculty Management independently reviewed; no Faculty portal/essay implementation.

### FACULTY-12 — Faculty Essay Evaluation backend

- **Status:** ✅ FACULTY-12 accepted for continuation at `c0059b9ebd0de569bb07d34a224506e0aa44f779` after independent remote commit-diff/source review. [Implementation report and action ledger](../reports/2026-11-09-faculty-12-essay-evaluation-backend.md). Dedicated pending queue/detail/grade and exact essay-media read require current compatible Faculty identity/profile plus the configured school-wide essay grant. The shared B7 pending resolver and locked B7/B8 writer preserve frozen content, finalized response, captured maximum and immutable scoring. Shared access fence / evaluator User / profile / application lock order rechecks authority after waits. Target Admin grading remains denied at old route/service/repository boundaries, including when only the Faculty target is composed. Source stays code-owned/dormant; no real grants, frontend or schema/migration. Final affected verification: 23 suites / 916 tests passed, 5 isolated MariaDB cases safely skipped because no separate test server is configured; backend build and diff checks passed. Real InnoDB contention remains unverified and is a deployment/activation-readiness gate; do not claim the lock-race proof until the isolated five-case MariaDB harness is executed. FACULTY-13 accepted for continuation at `584360296c43a63c74045d6eacc111a05bcf548c`; FACULTY-14 accepted for continuation at `cbf15478e38d3c483c417e45888aefd6577ed303`; FACULTY-15 accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`.

- **Scope:** narrow Faculty queue/detail projection and immutable grade authority through the existing transactional evaluation/scoring path; require current Faculty and configured `essay.evaluate` grant for list/detail/write; expose all pending eligible entrance-exam essays across Programs.
- **Non-goals:** manual MCQ checks, new rubric/remarks, regrading, Faculty reconsideration/Start Now/question-bank/email powers, resurrected Score Management, Faculty-to-Program evaluator assignment.
- **Dependencies:** 1–10; DR-3 is resolved; no live grant activation before release gate.
- **Expected areas:** exam routes/controller/service/repository, essay DTOs/rules and existing grading actor check.
- **Migration impact:** none for evaluator scope; do not add an evaluator-to-Program relation. Preserve `gradedById` and all result evidence.
- **Authorization/UI impact:** essay grant is Faculty-only and school-wide for pending eligible essays; Program may be exposed as context/filtering only. Target ADMIN grading is denied, including Full. Operational result recovery remains separate. Current Admin grade history remains unchanged.
- **Verification:** grant/no-grant, Admin/Student/External account-category cases, school-wide cross-Program visibility for pending eligible essays, exclusion of non-pending/ineligible attempts, the same eligibility predicate in list/read/write, revoked grant during lock wait, competing graders, frozen prompt/answer/max and B8 MCQ/result regressions.
- **Stop condition:** safe essay API reviewed with no new scoring policy, Program-scoped authorization, or email integration.

### FACULTY-13 — Effective-access and Faculty-work read models

- **Status:** ✅ Accepted for continuation at `584360296c43a63c74045d6eacc111a05bcf548c` after independent remote commit-diff/source review. [Implementation report and source ledger](../reports/2026-11-09-faculty-13-effective-access-read-models.md). Additive `/auth/me` preserves the existing self-access contract and adds only minimized Faculty work relevance/counts from current configured Essay Evaluation access, sole active Adviser relationships, exact addressed GS-020 ownership, own issued GS-017 issuer scope, and exact readable Defense assignments. Invalid/unavailable configured access returns null Faculty work; domain/read failures fail closed rather than masquerading as zero work. The projection is presentation-only and never authorizes guessed Essay/Adviser/Defense resources. Agent-reported verification: 30 affected files / 922 tests passed; final focused suite 72 tests passed; backend build and diff check passed. Independent review verified the pushed source/diff and ownership/fail-closed semantics, not a second execution of those local commands. Hosted CI was not observed; browser/manual QA was not executed because this package is backend/read-model only. No frontend, schema/migration, grant provisioning or live activation. FACULTY-12 real-MariaDB contention readiness gate remains open. FACULTY-14 accepted for continuation at `cbf15478e38d3c483c417e45888aefd6577ed303`; FACULTY-15 accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`.

- **Scope:** extend the authenticated self-access response from 2 with minimal Faculty work summaries composed from grants, Adviser assignments, addressed requests/issuer records and defense assignments; Admin dashboard-safe projection.
- **Non-goals:** new assignment authority, historical entitlement changes, duplicating journey/readiness state machines.
- **Dependencies:** 1–12.
- **Expected areas:** new access controller/read service/DTO, panelist-dashboard and adviser-workspace read seams, query contracts.
- **Migration impact:** none.
- **Authorization/UI impact:** stable backend projection for navigation/cards/controls; exact APIs still reauthorize. Pending addressed GS-020 work must remain reachable without active advisees.
- **Verification:** canonical responsibility combinations, no-work/error, External with valid defense work, unavailable-but-assigned Adviser, historical own records, duplicate active Adviser fail-closed, no private data in summaries and revocation refresh.
- **Stop condition:** projection independently reviewed; no frontend menu rewrite yet.

### FACULTY-14 — Faculty portal and Essay Evaluations UI

- **Status:** ✅ Accepted for continuation at `cbf15478e38d3c483c417e45888aefd6577ed303` after independent remote commit-diff/source review. [Implementation report and bounded ledger](../reports/2026-11-09-faculty-14-portal-essay-ui.md). Canonical visible Faculty login with server-side FACULTY/PANELIST compatibility, retained technical `/panelist` portal, FACULTY-13-driven navigation/Dashboard, read-only Profile and FACULTY-12 narrow Essay queue/detail/immutable grade/media UI are source-accepted. Account-scoped private caches, foreground/current-access refresh and direct-route presentation guards remove stale work without replacing backend authorization. Agent-reported verification: 42 new frontend checks, 72 related frontend checks, backend 6 suites / 236 tests, 36 synthetic Chrome scenarios plus final 3-scenario visual/copy subset, frontend TypeScript/scoped ESLint/build, backend build and diff check all passed. Independent review verified the pushed source/diff, test intent, cache/access behavior and exact Faculty API wiring; it did not rerun those local commands or inspect the implementation agent's ignored screenshots. Hosted CI was not observed. **Project-owner manual/visual QA remains pending and separate from this continuation acceptance.** No live activation, schema/migration, role/data conversion or FACULTY-15 work. FACULTY-12 isolated MariaDB contention readiness gate remains open. FACULTY-15 accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`.

- **Scope:** Faculty labels/login choice and safe role redirect, dynamic Dashboard/navigation from 13, essay queue/detail using accepted evaluation semantics; remove self-availability control; preserve immersive Defense and My Advisees deep links.
- **Non-goals:** public landing/sign-up redesign, committee/report/scoring UX redesign, technical route tree rename, new user terminology.
- **Dependencies:** 11–13 and 2–3; addressed-request/record navigation behavior from section 3.4 is required.
- **Expected areas:** login role choice, Panelist layout/dashboard/profile, new Faculty essay surfaces/shared rendering, notifications/deep-link helpers.
- **Migration impact:** none.
- **Authorization/UI impact:** evaluator-only, adviser-only, defense-only and mixed views; no irrelevant zero cards/Admin links. Common account surfaces remain appropriate.
- **Verification:** focused contracts, related Adviser/CDW verifiers, typecheck/lint/build for route wiring; browser QA for all canonical scenarios, direct unauthorized routes, revoked access, refresh, responsive/keyboard and copy gate. No exact-string tests for every helper sentence.
- **Stop condition:** bounded Faculty experience accepted; do not activate data conversion or implement Admin UI.

### FACULTY-15 — Administrators Management and permission-aware Admin UI

- **Status:** ✅ Accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf` after independent remote commit-diff/source review. See [FACULTY-15 implementation report](../reports/2026-11-09-faculty-15-administrator-management-ui.md). Dedicated Administrators Management and permission-aware Admin presentation are source-accepted against the existing FACULTY-1/4/9/13 contracts. Full-only account/access management, Restricted capability-filtered navigation/actions, safe zero-grant landing, aggregate containment, current-access refresh and account/access-fingerprint private-cache isolation were independently verified in the pushed source. Agent-reported verification: 49 new frontend checks, 87 related frontend checks, 9 backend suites / 390 tests, 29 synthetic Chrome scenarios plus focused repeats, frontend TypeScript/scoped ESLint/build, backend build and diff check passed. Independent review inspected the pushed source/diff and committed verifier/browser-test intent; it did not rerun those local commands or inspect ignored screenshots. Hosted CI was not observed. **Project-owner manual/browser/visual QA remains pending and separate from this continuation acceptance.** All three activation gates remain false; no real Full/Restricted provisioning, conversion, schema/migration or FACULTY-16 work occurred. FACULTY-4 and FACULTY-12 isolated real-MariaDB readiness gates remain open.

- **Scope:** dedicated Administrators list/detail/status/access editor; Full/Restricted labels, safe last-Full conflict feedback, filtered Admin sidebar/actions and dashboard requests.
- **Non-goals:** arbitrary Custom Role creation, Admin academic workspace, Analytics/Curriculum implementation, public signup for Admin.
- **Dependencies:** 4–9, 13–14; DR-1 policy is approved but actual bootstrap/account designation remains a FACULTY-18/live-environment gate. DR-4 policy is approved; role-scoped same-Gmail engineering implementation is tracked in FACULTY-17A before affected dual-account provisioning.
- **Expected areas:** new Admin users/administrators pages/components, Admin layout/dashboard, capability presentation/query hooks.
- **Migration impact:** none.
- **Authorization/UI impact:** only Full manages accounts/access; Restricted sees granted modules and safe empty landing. API is authoritative even for guessed management URLs.
- **Verification:** real Full/Restricted UI journeys on synthetic accounts, deny self-elevation/API tampering, last-Full races reflected correctly, current-session revocation, capability-minimum reads, mobile/keyboard/loading and copy review.
- **Stop condition:** full UI/backend parity reviewed; no live Restricted provisioning until 18 activation gate.

### FACULTY-16 — Operator preflight, reconciliation and data-cutover rehearsal

- **Status:** ✅ FACULTY-16 accepted for continuation at `f86a52fc375d8c1b08ccc8fd1d6408658dd5665a` after independent remote commit-diff/source review of the original implementation and bounded source-provenance correction. The correction makes the tracked launcher reject dirty/hidden-index checkouts and execute the pinned committed Git-object module graph rather than ignored `dist` output; the regenerated evidence records the executed code/test commit and source hashes. Agent-reported final clean committed replay: 4 files / 74 tests passed (66 unit + 8 isolated MariaDB), backend build, focused typecheck, launcher syntax/help and diff checks passed. Independent review verified the pushed source/diff/tests/evidence but did not rerun those commands. Hosted CI was not observed. Owner/manual QA remains unclaimed; no actual environment inventory/cutover occurred. At FACULTY-16 completion, DR-1/2 and applicable DR-4–DR-7 were unresolved/held out; subsequent owner decisions are recorded in the current DR register and do not retroactively alter FACULTY-16 execution boundaries. DR-3 remains resolved. FACULTY-4/FACULTY-12 exact contention readiness gates remain OPEN; all three activation gates remain false. No FACULTY-17/18 work.

- **Scope:** implement dry-run/idempotent operator manifest tooling, inventory actual authorized environment when separately permitted, bootstrap mappings and PANELIST/CUSTOM conversion rehearsal; record integrity/rollback evidence.
- **Non-goals:** destructive resets, guessing CUSTOM grants or Full accounts, deleting legacy tables, modifying signed history, automatic academic repair.
- **Dependencies:** 1–15; DR-1/2 and all remaining data-dependent DR-4–7 cases must be resolved or explicitly held out with safe denied access. DR-3 is already resolved. No implicit approval to touch production DB from this plan.
- **Expected areas:** operator scripts/CLI, additive migration/backfill files if required, migration fixtures/tests and deployment/runbook docs.
- **Migration impact:** explicit audited User role/direct-grant data changes in rehearsal; exact counts and before/after checks. Preserve all authoritative foreign keys, credentials, records and signatures.
- **Authorization/UI impact:** approved initial evaluators/Admin levels only; unmapped identities denied. Session cutover and compatibility binaries proven.
- **Verification:** disposable clean-chain + snapshot upgrade, repeat-run no-op, interrupted/resumed batches, state drift rejection, historical outputs/hashes stable, zero dangling relationships and duplicate accounts, restoration/compatible rollback rehearsal.
- **Stop condition:** reviewed operator evidence and concrete cutover manifest ready; stop before live execution/activation unless that exact environment action is separately authorized.

### FACULTY-17 — Complete Custom Roles subsystem retirement

- **Status:** **FACULTY-17 implemented; independent scoped review of critical migration/authentication/UI/Defense-preservation paths completed with no remaining blocker after a separate About-page copy correction; owner-reported local migration deployment recorded; project-owner QA and formal acceptance pending.** See the [implementation report](../reports/2026-11-10-faculty-17-custom-roles-retirement.md) and its chronological deployment addendum. The scoped review was not an exhaustive line-by-line audit of all 37 changed files. The owner deployment was local development only; it is not production rollout, account cleanup, live cutover or activation.

- **Scope:** remove the mock Custom Roles navigation/page/API and obsolete user-facing copy; retire the legacy Other Roles/CUSTOM authentication path; remove `UserRole.CUSTOM`, `User.customRoleId`, `CustomRole`, and `RoleFeatureAccess` from the target Prisma/database schema; update seeds, fixtures, tests and compatibility routes to the four-role model; add safe legacy URL redirects/denials with no new authority.
- **Non-goals:** deleting unrelated User accounts, academic/Defense/audit history, historical migration files, or changing `PanelRole` / `PanelAssignment`; automatic account conversion; production data cleanup; live cutover.
- **Dependencies:** 15–16; DR-2 development retirement policy approved. Any development-only CUSTOM account cleanup is a separate explicitly authorized operation. No production inventory or production cleanup is authorized by this package.
- **Expected areas:** Admin roles page/navigation, auth service/repository and role selector contracts, Prisma schema, forward migration, seed/fixtures/tests, obsolete public copy/FAQ, compatibility routes and docs.
- **Migration impact:** new forward Prisma migration removes only the obsolete CUSTOM enum value/column/FK/index and CustomRole/RoleFeatureAccess tables after repository-wide consumer/FK audit. Never edit/delete historical migration files. Prove no target runtime consumer remains. Preserve User IDs/credentials and all unrelated academic, Defense, signed, audit and historical evidence.
- **Authorization/UI impact:** four conceptual login roles only; direct Faculty/Admin access editor owns configuration; Defense `PanelRole.PANELIST` and contextual Chairman/Panelist/Rapporteur/Facilitator/Adviser assignments remain unchanged. External Faculty may receive Chairman/Panelist/Rapporteur/Facilitator assignments but never Adviser.
- **Verification:** old links/bookmarks, retired CUSTOM login/API denial, four-role login, forward migration from clean chain and populated synthetic legacy schema, no dangling FKs, preservation of User/academic/Defense/audit records, PanelRole/PanelAssignment unchanged, seed rebuild, typecheck/lint/focused route contracts and owner visual review.
- **Stop condition:** complete legacy subsystem retirement is source-reviewed and synthetic migration evidence is recorded; no production cleanup, live cutover, or next package.

### FACULTY-17A — Same-Gmail role-scoped Faculty/Admin accounts

- **Status:** **FACULTY-17A implemented; independent scoped source review passed with no blocking issue; owner-reported local migration deployment recorded; project-owner smoke QA and formal acceptance pending.** See the [implementation report](../reports/2026-11-10-faculty-17a-role-scoped-identity.md) and its chronological deployment addendum. The review was scoped to the high-risk migration, identity, authentication, provisioning, session, password-change and preservation paths, not an exhaustive line-by-line audit of all 28 changed files. No actual Faculty/Admin account provisioning or activation occurred; FACULTY-17B/18 remain separate.

- **Scope:** implement DR-4's approved separate-account/same-email policy. Replace global email-only account resolution with a role-scoped identity contract that can resolve one Faculty User and one Admin User sharing the same normalized Gmail/email while preserving distinct IDs, passwords, sessions, access grants and audit attribution.
- **Non-goals:** combined Faculty/Admin account/session, workspace switcher, duplicate accounts within the same role, changing Applicant ID or Student Number login, weakening Applicant-to-Student promotion, or automatically merging existing accounts.
- **Dependencies:** FACULTY-17; DR-4 policy approved. Complete technical design review before schema/auth changes.
- **Expected areas:** Prisma uniqueness/index migration, auth repository/service/controller contracts, NextAuth/session synchronization, Faculty/Admin provisioning, duplicate validation, existing authenticated password-change isolation and tests. Record the future role-scoped self-service recovery requirement for AUTH-RECOVERY-1/Email Integration; do not implement reset-token or email-delivery infrastructure in FACULTY-17A.
- **Migration impact:** replace global email uniqueness only with a carefully validated role-scoped constraint that permits the approved Faculty/Admin pair and prevents same-role duplicates. Preserve Applicant/Student same-record promotion and all existing identities. Do not assume a simple `@@unique([email, role])` is sufficient without auditing enum transitions and current records.
- **Authorization/UI impact:** login role selector disambiguates the account server-side; no account shares credentials, sessions, grants or audit identity. Existing authenticated password changes remain bound to the session's User ID. Future self-service recovery must identify the selected account role and never reset the wrong account; the reset-token/email recovery flow is deferred to AUTH-RECOVERY-1/Email Integration.
- **Verification:** same email Faculty/Admin login in both selector directions; wrong-role rejection; same-role duplicate rejection; separate password/session/grant/audit isolation; password recovery correctness; Applicant/Student promotion and existing login regressions; migration from populated synthetic database.
- **Stop condition:** same-email dual-account flow is source-reviewed and fully tested; no actual dual-duty account provisioning or live rollout.

### FACULTY-17B — DR-5/DR-6/DR-7 implementation alignment

- **Status:** ✅ **FACULTY-17B accepted for continuation at `cbc5b2e267fe25da5c4cf656a32dd6e261370a7c` after independent remote commit-diff/source review.** See the [implementation report](../reports/2026-11-10-faculty-17b-dr5-dr6-dr7-alignment.md). Parallel read-only investigation, initial implementation at `5c993122aa3c385e83df05ebbb1e15e6331118fd`, and the bounded DR-5 correction were reviewed against the pushed source. **DR-5** now preserves all four permitted External contextual Defense roles (`CHAIRMAN`, `PANELIST`, `RAPPORTEUR`, `FACILITATOR`) while failing closed if an active Adviser relationship resolves to External Faculty across auto-derived Proposal/Final Defense Adviser seats, schedule correction, My Advisees/effective-access, Proposal/Final Adviser review, and Adviser-derived document authority; existing Internal Advisers remain valid even when unavailable for new assignments. **DR-6** requires a recorded rejection reason after CONFORME while preserving signed evidence, no automatic transfer, and Student retry. **DR-7** permanently blocks Internal-to-External reclassification after any authoritative current or historical `AdviserAssignment`, with no Admin override. Agent-reported focused verification: 20 backend test files / 626 tests passed, backend build PASS, diff check PASS. Independent review inspected the pushed source/diff and regression coverage, not a second execution of those commands. No schema/migration or actual database operation; all activation gates remain `false`; FACULTY-4/FACULTY-12 real-MariaDB readiness gates remain open; FACULTY-18 not implemented.

- **Scope:** verify and make bounded corrections to the owning Defense assignment, Adviser request/Dean approval, and Faculty classification mutation paths so the newly approved DR-5/DR-6/DR-7 policies are enforced consistently.
- **Non-goals:** redesigning Defense committee policy, changing existing role meanings, editing/deleting signed evidence, automatic Adviser replacement, automatic relationship cleanup, or changing accepted historical reports.
- **Dependencies:** FACULTY-7 and FACULTY-10 accepted; DR-5/6/7 owner policies approved.
- **Expected areas:** Admin Defense committee assignment validation, Adviser request rejection/reason and Dean approval path, Faculty Internal/External classification service/API/UI, regression tests and owning source-of-truth references.
- **Migration impact:** no data rewrite. Preserve all historical PanelAssignment, AdviserAssignment, GS-020 signatures/snapshots and audit evidence.
- **Authorization/UI impact:** External Faculty may be assigned Chairman, Panelist, Rapporteur or Facilitator on an exact schedule but never Adviser; an ineligible pending request after CONFORME may be rejected by the existing authorized reviewer with a reason; an Internal Faculty who has ever held an authoritative AdviserAssignment cannot be reclassified External, with no Admin override.
- **Verification:** positive/negative role assignment matrix for Internal/External; External Adviser denial at list/request/approval boundaries; rejection after CONFORME preserves exact signed state and permits a new Student request; historical AdviserAssignment prevents reclassification even after completion; direct API/service bypass tests.
- **Stop condition:** all three owner decisions are enforced and independently source-reviewed; no historical record repair or live activation.

### FACULTY-18 — Integrated acceptance and controlled activation

- **Scope:** execute final cross-domain authorization, migration and multi-account UI acceptance; assemble coverage ledger/release checklist; perform only explicitly authorized environment cutover/activation from reviewed 16 manifest.
- **Non-goals:** new functionality, cleanup, institution-policy decisions, hidden repairs, deployment without environment authorization.
- **Dependencies:** FACULTY-0–17B plus **UIUX-3E completed, independently reviewed, and explicitly accepted by the project owner before FACULTY-18 starts**; all blocking decisions for the specific target environment resolved; independently reviewed remote HEADs and appropriate owner UI acceptance. DR-1 actual Full Administrator designation/bootstrap and any live DR-2 account disposition require separate explicit environment authorization. FACULTY-4/FACULTY-12 exact real-MariaDB readiness gates must be closed with their required evidence. If live action is not authorized, deliver reviewable release evidence and stop.
- **Expected areas:** tests/verifiers and release/acceptance docs; production corrections require a bounded fix to the owning package.
- **Migration impact:** apply only reviewed migrations/manifest in the specifically authorized environment after consistent backup/restore proof; no new unreviewed schema.
- **Authorization/UI impact:** no legacy broad ADMIN bypass coexists with Restricted accounts; role-only identity does not imply academic authority; final frontend/backend parity.
- **Verification:** broad backend suite, affected frontend verifiers, both type/build checks, isolated real-DB migration/contention tests, all scenarios in section 7, actual browser/manual QA and independent source review. Record hosted CI separately.
- **Stop condition:** acceptance/release state reported accurately and no remaining required work hidden; stop. Further contractions/features require new authorization.

### UIUX-3E — Faculty Portal UI/UX refinement (separate prerequisite before FACULTY-18)

- **Status:** **IMPLEMENTED / PENDING INDEPENDENT REVIEW** on `feat/faculty-admin-access` (see the [implementation report](../reports/2026-11-10-uiux-3e-faculty-portal-refinement.md)); **not visually accepted and not promoted to an Approved Reference Implementation**. Includes bounded corrections for production Adviser waiting classification (`adviser-dean:`, `manuscript-revision:`), authoritative `Panelist.isExternal` isolation across direct Adviser inbox, Adviser workspace, Defense-preserving dashboard, and `/auth/me` (`EffectiveAccessService`), and fail-closed `PanelistRepository.assertActiveInternalFaculty(userId)` (requiring Panelist existence, `isActive === true`, and `isExternal === false`, while preserving `isExternalFaculty()` for Defense callers) on GS-020 (`AdviserRequestRecordService`) and GS-017 (`AdviserCertificationRecordService`). Automated verification: `verify-faculty-14-portal.mjs` 45/45 PASS, prior focused backend Vitest suites across `/auth/me`, dashboard/workspace/inbox, GS-020, and GS-017 (11 files / 335 tests PASS), follow-up active-Internal-Panelist Vitest suites (5 files / 168 tests PASS), backend `tsc --noEmit` PASS, prior frontend `tsc --noEmit`/ESLint/`npm run build` PASS, and `git diff --check` PASS (`verify-adv7-navigation-consolidation.mjs` 6/8 inferred pre-existing regex mismatch in initial run). Synthetic Playwright browser verification was **not run** for the bounded corrections and is not claimed as browser QA PASS; hosted CI was not observed; independent source/diff review and project-owner browser/visual acceptance remain pending before FACULTY-18 starts.

The project owner moved the previously post-FACULTY-18 dashboard refinement forward and combined it with the Faculty sidebar flicker/layout-shift correction. Track the bounded package in docs/superpowers/ui-ux/UI_UX_AUDIT.md (UIUX-3E) and docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md.

**Part A — Sidebar navigation stability:** investigate the reported flicker/vertical shifting during route navigation. Current source suggests the Faculty access reader temporarily sets the work projection to null while /auth/me refreshes, while sidebar links are filtered from that transient projection; confirm the runtime cause in a real browser. Preserve the last confirmed same-account navigation presentation during routine refresh without using it to authorize protected content or API operations. Remove links when a successful fresh response confirms access loss; fail closed on revocation or access-resolution failure. Preserve account-switch/logout isolation, mobile drawer, desktop collapse, keyboard/focus, active-route matching, and immersive Defense Workspace behavior.

**Part B — Richer Faculty Dashboard:** refine—not blindly restore—the earlier operational overview: relevant Your Work summaries; conditional Upcoming Defenses and Pending Tasks; actionable Needs Your Attention; conditional Active Defense; next Upcoming Defense Session plus a bounded list; compact/collapsible Waiting on Others with an independent count; and recent account-scoped Notifications.

Preserve FACULTY-13/14 dynamic relevance, no irrelevant zero-value cards, External Faculty Adviser restrictions, minimized account-scoped read models, exact backend authorization, Faculty/Admin same-Gmail cache isolation, and the distinction between actionable Pending Tasks and waiting-only information. No new grants, capabilities, workflow mutations, role, portal tree, or activation policy is authorized.

UIUX-3E requires focused automated checks, real-browser desktop/mobile/keyboard/access-revalidation QA, independent source/diff review, and explicit project-owner browser/visual acceptance. **It is a separate prerequisite before FACULTY-18, not part of FACULTY-18 implementation or activation.** Complete and accept UIUX-3E before starting FACULTY-18.

## 7. Required verification matrix

Each backend row includes direct HTTP, guessed resource ID and direct service-boundary checks where applicable. Browser navigation does not substitute for these tests.

| Scenario | Positive evidence | Required denial / preservation |
| --- | --- | --- |
| Essay Evaluator only | Dashboard + Essay Evaluations; school-wide read/grade for all pending eligible entrance essays across Programs | No Admin, non-pending/ineligible attempt, committee or MCQ edit authority |
| Internal available, no assignments | Eligible passed-Title ODP candidate when all current gates pass | No arbitrary My Advisees Student access; availability is not relationship authority |
| Pending addressed GS-020, no advisee yet | Request context reachable; exact request response | No active relationship until CONFORME + Dean approval; no request-content mutation under signature |
| Adviser becomes inactive/unavailable after CONFORME | Authorized reviewer can reject pending request with reason; Student can submit a new request | Original request and signed CONFORME remain unchanged; no automatic transfer |
| Internal Adviser with any historical AdviserAssignment | Internal classification remains locked | No reclassification to External, including after assignment completion; no Admin override |
| Assigned Adviser now unavailable for new work | Current assigned research/review work retained | External/new-assignment rules and history preservation remain; no COR/payment blanket access |
| External with permitted Defense assignment | Exact Chairman/Panelist/Rapporteur/Facilitator My Defenses/role work | Never Adviser candidate/new assignment; no student advisees |
| Multiple Faculty responsibilities | Union of relevant work/navigation | Each resource still rechecks its own source; no union-induced privilege escalation |
| Faculty without work | Dashboard/Profile/common allowed surfaces | No irrelevant zero-value academic cards or guessed API access |
| Removed committee member | Existing attributed history stays owned by original assignment | No future active-session REST/socket/preview writes/reads through removed authority |
| Different roles on different schedules | Chairman actions only on Chairman schedule; own evaluator/report/signature operations | Cross-schedule/role and cross-evaluator attempts fail |
| Full Administrator | Complete approved operational access and management editor | No Faculty essay/Adviser/Chairman override; cannot erase mandatory access audit |
| Restricted Administrator | Only explicit keys, minimum task contexts and filtered aggregates | Hidden direct APIs/files/PDFs/settings/aliases denied; no access management/self-elevation |
| Two concurrent Full removals | Exactly one valid change where required | Never zero active Full; audit atomicity and lock ordering verified |
| Stale or revoked identity/grants | Current allowed actions remain usable | Disable/demotion/revocation effective on next protected operation and live transports; valid 403 does not sign out |
| Same real person, Faculty + Admin accounts | Same Gmail/email may resolve to two separate User records by selected login role; independent passwords, sessions, grants and audit identities | No same-role duplicate, role confusion, wrong-account recovery, merged grants or workspace switcher |
| PANELIST → FACULTY | Same User/profile/credentials/history IDs | PanelRole.PANELIST, historical text, hashes, signatures and exact documents unchanged |
| CUSTOM retirement | Forward migration removes obsolete CUSTOM enum/column/models/tables after consumer/FK audit | No historical migration rewrite, unrelated User/history deletion, or changes to PanelRole/PanelAssignment |
| Upgrade/restart/rollback | Idempotent reviewed migration and compatible binaries | No role reset, duplicate accounts, lost records or Restricted access through legacy code |

Use existing auth, Adviser, exam essay/scoring/amendment, committee/record/document and realtime tests listed in the audit. Add behavior tests for new risks, especially race/revocation/alias boundaries, rather than only source-string mirrors. Real MySQL/MariaDB contention is required for last-Full and sensitive grade/access races; SQLite or mocked transactions cannot prove it.

The final coverage ledger must enumerate **every** administrative method/path, inherited router middleware, service actor check, document model class, official output and transport. Each entry has one capability/ownership policy, positive/negative tests and package owner. An unclassified entry blocks activation. This audit's route-family table is a planning map, not a claim that future detailed coverage is already complete.

## 8. FACULTY-0 delivery and stop record

Deliverables are this plan and the companion audit only. Existing canonical source-of-truth/specification/checklist content remains unchanged; no implementation acceptance is asserted.

FACULTY-0 checks: exact documentation diff, repository-relative links/code references, headings, package scope/dependency/stop completeness, and `git diff --check`. Application tests/builds, database migration/rehearsal, production inventory, manual/browser QA and hosted CI are **not executed** for this documentation-only package.

After commit/push, report verified starting main SHA, branch, ending commit, exact documents, architecture findings, sequence, decisions/risks and clean worktree/push state. Ending SHA is reported after commit rather than embedded as a self-referential hash in this file. **Stop; do not proceed to FACULTY-1.**
