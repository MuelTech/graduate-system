# Faculty and Administrator Access — Implementation Plan

- Date: 2026-11-08 (Asia/Manila)
- Repository: `MuelTech/graduate-system`
- Audit baseline / verified live `main`: `045316540d97364214792c7d441ae20a1e426d4c`
- Branch: `feat/faculty-admin-access`
- Status: FACULTY-0 accepted; FACULTY-1 implemented, independently reviewed and accepted; FACULTY-2 implemented under bounded authorization; independent review is pending. FACULTY-3 has not started and requires separate authorization.

**Historical FACULTY-0 stop boundary:** FACULTY-0 authorized documentation only and ended before implementation. That boundary was satisfied before FACULTY-1 was separately authorized.

**Execution checkpoint — 2026-11-08**
- ✅ FACULTY-0 — Repository audit and implementation plan accepted.
- ✅ FACULTY-1 — Direct-access foundation accepted at `56b1ecbcb7806c1a3df9477d4b14f4cfa914f62e`.
- 🟡 FACULTY-2 — Current-account auth / credential boundary implemented; [implementation report](../reports/2026-11-08-faculty-2-current-account-authentication.md); independent review pending.
- ⏸️ FACULTY-3 — Not started; requires separate authorization.
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
| DR-1 | Identify actual initial Full Administrator account(s), remaining Admin mapping and operator bootstrap authority. Seed account is not evidence. | Live Admin bootstrap, Restricted provisioning, cutover |
| DR-2 | Inspect real CUSTOM users/roles/grants; approve each target account identity and direct grant set, including mixed duties, inactive/unmapped accounts and unknown/duplicate keys. | CUSTOM conversion, removal of Other Roles, final activation if unresolved live users remain |
| DR-3 — **RESOLVED** | Faculty Essay Evaluation is school-wide: configured Faculty evaluators may see and evaluate all pending eligible entrance-exam essays across Programs. Program is not an authorization boundary; no evaluator-to-Program relation or Program Chair role is required. Initial evaluator designation remains an operator/cutover mapping task, not a scope-policy question. | Resolved; no longer blocks Faculty essay queue/read/write design |
| DR-4 | Choose approved unique identifiers for separate Faculty/Admin accounts when the same person currently uses one email. Preserve separate accounts; current unique email constraint cannot support identical emails twice. | Dual-duty provisioning/import; do not silently relax email uniqueness or invent aliases |
| DR-5 | Confirm exact permitted External committee roles beyond the supported External Panelist scenario if new assignment validation requires them. Current generic candidate/role code does not prove institutional eligibility. Preserve existing exact history. | New/changed External Chairman/Rapporteur/Facilitator eligibility; no expansion by absence of a check |
| DR-6 | Confirm disposition/UX when availability or activity changes after a signed request/CONFORME but before Dean approval. New assignment must satisfy Internal/active/available target rules, but accepted signed evidence must not be edited or deleted. | Eligibility-change recovery at Dean approval; ordinary eligible requests remain unchanged |
| DR-7 | Confirm handling of Internal → External reclassification with existing active Adviser relationships or legacy External-Adviser anomalies. Preserve history; never silently revoke, reassign or legitimize an invalid relationship. | Such reclassification/repair cases, not ordinary Faculty profile reads |

Existing open ODP role-label confirmation, institutional Dean signatures, post-start committee substitution, evaluator excusal/quorum, comprehensive-exam history, account reactivation and Email Integration remain with their owning initiatives. Do not resolve them through this access plan. Retain current accepted ODP working mapping and all unmodified workflow rules.

Account inactivity always denies new protected access in the target. Its academic recovery consequences remain separate policy: disabling an account does not delete its assignments or permit Admin to impersonate its academic actions.

## 6. Dependency-ordered work packages

All packages require explicit separate authorization, verified current branch/base, a clean or understood worktree, bounded diff review, and commit/push followed by a stop. Expected areas are integration seams, not permission for unrelated refactors. New file paths are proposals; existing paths are grounded in the audit. The default verification follows the Engineering Verification Policy. Shared auth/schema changes deliberately require broader checks; focused UI work does not require repeated full backend suites.

Sequence: **1 foundation → 2 auth → 3 identity compatibility → 4 Admin authority → 5 admission guards → 6 exam Admin guards → 7 defense Admin guards → 8 document guards → 9 operational guards → 10 Faculty configuration → 11 Faculty Management UI → 12 essay backend → 13 effective-access reads → 14 Faculty portal → 15 Administrators/Admin UI → 16 data cutover rehearsal → 17 Custom Roles UX retirement → 18 acceptance/activation.**

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

- **Scope:** expand enum with FACULTY; support both academic account values through bounded normalizers across backend predicates, session routing/types, notifications/memos and realtime; preserve technical `/panelist` paths.
- **Non-goals:** existing User conversion, PanelRole rename, profile-table rename, production backfill, broad UI rewrite.
- **Dependencies:** 1–2.
- **Expected areas:** Prisma additive migration, academic identity helper, routes/services/repositories with account PANELIST checks, realtime, notification/memo contracts, frontend types/middleware and synthetic seeds/tests.
- **Migration impact:** enum expansion only; no existing stored role/profile/assignment updates.
- **Authorization/UI impact:** legacy/future academic identity accepted without allowing ADMIN/CUSTOM academic impersonation; exact assignments still required.
- **Verification:** both identities across Adviser/Defense/GS-017/GS-020/files/sockets, stale ADMIN claim denial, role-specific memo delivery, no PanelRole/history conversion; broad related suites, both builds, enum migration rehearsal.
- **Stop condition:** all readers/writers needed for safe future conversion are identified and compatible; no existing account converted.

### FACULTY-4 — Full Administrator management service and safeguards

- **Scope:** implement Full-only Administrator account/access/status backend service, safe random temporary privileged credentials, serializable last-active-Full guard and atomic audit; protect access events from generic audit deletion.
- **Non-goals:** live bootstrap, Restricted rollout, UI, general account recovery or global audit-retention redesign.
- **Dependencies:** 1–3; DR-1 required for any environment bootstrap, not synthetic tests.
- **Expected areas:** new Admin-access routes/controller/service/repository, auth provisioning helpers, settings audit deletion repository/service, tests.
- **Migration impact:** add shared locking structure if absent; no implicit bootstrap or default-grant backfill.
- **Authorization/UI impact:** Full-only API; deny Restricted self/other grants, role escalation and generic settings bypass. Keep inaccessible outside reviewed target test/rollout state.
- **Verification:** two competing demotions/disables/deletes leave one active Full; actor demoted concurrently; unknown grants/body mass assignment denied; audit failure rolls back; audit single/bulk deletion cannot erase access events; credentials require change.
- **Stop condition:** synthetic real-DB contention and negative HTTP/service checks pass; no live Restricted account exists yet.

### FACULTY-5 — Admission and Student administrative guards

- **Scope:** map Applicant/Student reads, waiver/COR verification, promotion and comprehensive-exam recording aliases to catalog actions, including minimum read dependencies.
- **Non-goals:** admission-policy redesign, continuing-Student onboarding, comprehensive-exam history repair, password recovery UI.
- **Dependencies:** 1–4.
- **Expected areas:** admin-applicant/admin-student, cor/waiver/student routes/controllers/services/repositories.
- **Migration impact:** none.
- **Authorization/UI impact:** direct target-context denials at every alias; preserve existing applicant/student ownership and COR transaction. No broad registry access from a verification grant.
- **Verification:** exact positive/negative HTTP and service matrix per key, alias bypass attempts, current actor revocation, COR identity/password handoff and waiver regressions.
- **Stop condition:** every admission/student administrative endpoint is mapped/tested; do not implement new workflow behavior.

### FACULTY-6 — Examination administrative guards

- **Scope:** capability enforcement for schedules/bookings/assignment/amendments, records/execution, Start Now, configuration, bank/media/publication, B8 result recovery and B9 reconsideration.
- **Non-goals:** Faculty essay authority/UI, email integration, new scheduling policies, scorer changes.
- **Dependencies:** 1–5.
- **Expected areas:** exam/exam-engine routes, controllers, exam and execution/configuration/question-set/media repositories/services.
- **Migration impact:** none.
- **Authorization/UI impact:** restricted action boundaries; existing in-transaction `role=ADMIN` checks also require exact capability. No essay authority implied by Full or exam-record access in the target.
- **Verification:** denial per key and alias, current-grant changes during mutations, immutable MCQ/attempt/result basis, B3–B9 affected regressions and real DB tests when locking paths change; no result-email grant exposed.
- **Stop condition:** administrative exam catalog covered; Faculty essay access remains closed until 12.

### FACULTY-7 — Defense and Adviser administrative guards

- **Scope:** guard application review, scheduling/correction, committee candidate queries, records administration and Dean review/legacy assign wrapper; recheck proposed manual participant identity/activity/profile at writes.
- **Non-goals:** committee quotas, external-role expansion, Adviser replacement, post-start substitution, scoring/verdict/report redesign.
- **Dependencies:** 1–6; DR-5 before implementing disputed External-role eligibility.
- **Expected areas:** thesis route/controller/service/repositories, scheduling correction, committee candidate helpers, Adviser Request Dean boundary.
- **Migration impact:** none; retain assignment IDs/history.
- **Authorization/UI impact:** Admin capabilities permit operations only; never academic evaluator/Rapporteur/Chairman powers. Assignment eligibility and automatic Adviser remain separate checks.
- **Verification:** read/review/schedule separation, all aliases, arbitrary non-Faculty/inactive participant IDs, exact SCHEDULED correction, removed-member denial, automatic Adviser, last stage/attempt integrity and independent Chairman verdict.
- **Stop condition:** all operational boundaries covered without altering accepted defense state machines.

### FACULTY-8 — Private files and official-record guard closure

- **Scope:** replace broad Admin branches in document streaming, GS-017, GS-020 and official Defense read/PDF services with resource/context capabilities; retain Faculty ownership/request/issuer checks.
- **Non-goals:** new document entitlements, renderer/template changes, public storage, signed-record backfills, generic file manager.
- **Dependencies:** 1–7.
- **Expected areas:** document service/controller, Adviser certification/request record services, official-defense services, owning read models/routes.
- **Migration impact:** none; immutable bytes/snapshots/hashes unchanged.
- **Authorization/UI impact:** direct file/PDF URL no longer bypasses Restricted permissions; no essay-only access to COR or academic signatures.
- **Verification:** every model registry class and official output, owner/requested-Adviser/issuer/current-Adviser/committee/Admin matrix, cross-Student/attempt denial, inactive actor, raw-signature privacy and exact historical output reproducibility.
- **Stop condition:** file and official-record surfaces match catalog and preserve historical authority.

### FACULTY-9 — Settings, operational surfaces and aggregate containment

- **Scope:** enforce remaining settings/key allowlists, email-template/log reads, storage, repository, memo management and audit reads; filter Admin dashboard queries by effective modules; close unclassified Restricted entry points.
- **Non-goals:** implementing Analytics/Curriculum, email delivery, expert-evaluation workflow, audit-retention redesign.
- **Dependencies:** 1–8.
- **Expected areas:** settings/admin-dashboard/admin-storage/email/repository/databank/memo routes/services/repositories and generic document-context helpers as needed.
- **Migration impact:** none.
- **Authorization/UI impact:** no hidden aggregate leakage, generic setting access escalation or audit-evidence deletion; no accidental access through broad ADMIN fallbacks.
- **Verification:** direct URL/service denial, unknown/sensitive settings rejected, dashboard data minimization, private repository evidence and memo audiences; route inventory has no unclassified Restricted-reachable action.
- **Stop condition:** administrative backend coverage ledger complete before any Restricted rollout.

### FACULTY-10 — Faculty configuration and new-Adviser eligibility backend

- **Scope:** Admin-managed Faculty profile/status/classification, direct Essay Evaluation grants, adviser availability; remove/deny self-service availability writes; align all new-assignment candidate/approval checks.
- **Non-goals:** assigning Students/committees from Faculty Management, load caps, editing signed requests, rewriting existing assignments.
- **Dependencies:** 1–9; DR-6/7 before affected pending-request/reclassification cases ship.
- **Expected areas:** admin-panelist and panelist routes/controllers/services/repositories, canonical Adviser candidate/approval service, legacy available directory.
- **Migration impact:** no relationship rewrite; any External-flag correction is explicit audited data work in 16.
- **Authorization/UI impact:** `faculty.manage` controls profile/grants/availability; External effective availability false. Admin grant writes cannot confer academic authority on Admin itself.
- **Verification:** direct self-toggle rejected, Internal/External and account/profile-active filtering on list/request/approval, availability revocation before approval, availability change preserves current/historical assignments and GS-020, unknown/committee permission fields rejected.
- **Stop condition:** backend configuration and eligibility invariants proven; no UI changes or live essay grants implied.

### FACULTY-11 — Faculty Management UI

- **Scope:** Faculty list/detail, account status, Internal/External, Essay Evaluation access, Available as Adviser, bounded read-only assignment summaries.
- **Non-goals:** committee/adviser assignment editors, broad portal redesign, Administrator management.
- **Dependencies:** 10; DR-4 before dual-account provisioning affected by identical email.
- **Expected areas:** existing Admin users/panelists pages/components and Admin User Management navigation; retain legacy technical routes where useful.
- **Migration impact:** none.
- **Authorization/UI impact:** view/manage controls follow effective permissions; no permanent Panelist/Chairman/Rapporteur/Adviser-page checkboxes.
- **Verification:** focused UI contracts/typecheck/scoped lint; desktop/mobile/keyboard, loading/error/empty, status/grant change refresh and shortest-truthful-copy review; backend rejection shown accurately.
- **Stop condition:** Faculty Management independently reviewed; no Faculty portal/essay implementation.

### FACULTY-12 — Faculty Essay Evaluation backend

- **Scope:** narrow Faculty queue/detail projection and immutable grade authority through the existing transactional evaluation/scoring path; require current Faculty and configured `essay.evaluate` grant for list/detail/write; expose all pending eligible entrance-exam essays across Programs.
- **Non-goals:** manual MCQ checks, new rubric/remarks, regrading, Faculty reconsideration/Start Now/question-bank/email powers, resurrected Score Management, Faculty-to-Program evaluator assignment.
- **Dependencies:** 1–10; DR-3 is resolved; no live grant activation before release gate.
- **Expected areas:** exam routes/controller/service/repository, essay DTOs/rules and existing grading actor check.
- **Migration impact:** none for evaluator scope; do not add an evaluator-to-Program relation. Preserve `gradedById` and all result evidence.
- **Authorization/UI impact:** essay grant is Faculty-only and school-wide for pending eligible essays; Program may be exposed as context/filtering only. Target ADMIN grading is denied, including Full. Operational result recovery remains separate. Current Admin grade history remains unchanged.
- **Verification:** grant/no-grant, Admin/Student/External account-category cases, school-wide cross-Program visibility for pending eligible essays, exclusion of non-pending/ineligible attempts, the same eligibility predicate in list/read/write, revoked grant during lock wait, competing graders, frozen prompt/answer/max and B8 MCQ/result regressions.
- **Stop condition:** safe essay API reviewed with no new scoring policy, Program-scoped authorization, or email integration.

### FACULTY-13 — Effective-access and Faculty-work read models

- **Scope:** extend the authenticated self-access response from 2 with minimal Faculty work summaries composed from grants, Adviser assignments, addressed requests/issuer records and defense assignments; Admin dashboard-safe projection.
- **Non-goals:** new assignment authority, historical entitlement changes, duplicating journey/readiness state machines.
- **Dependencies:** 1–12.
- **Expected areas:** new access controller/read service/DTO, panelist-dashboard and adviser-workspace read seams, query contracts.
- **Migration impact:** none.
- **Authorization/UI impact:** stable backend projection for navigation/cards/controls; exact APIs still reauthorize. Pending addressed GS-020 work must remain reachable without active advisees.
- **Verification:** canonical responsibility combinations, no-work/error, External with valid defense work, unavailable-but-assigned Adviser, historical own records, duplicate active Adviser fail-closed, no private data in summaries and revocation refresh.
- **Stop condition:** projection independently reviewed; no frontend menu rewrite yet.

### FACULTY-14 — Faculty portal and Essay Evaluations UI

- **Scope:** Faculty labels/login choice and safe role redirect, dynamic Dashboard/navigation from 13, essay queue/detail using accepted evaluation semantics; remove self-availability control; preserve immersive Defense and My Advisees deep links.
- **Non-goals:** public landing/sign-up redesign, committee/report/scoring UX redesign, technical route tree rename, new user terminology.
- **Dependencies:** 11–13 and 2–3; addressed-request/record navigation behavior from section 3.4 is required.
- **Expected areas:** login role choice, Panelist layout/dashboard/profile, new Faculty essay surfaces/shared rendering, notifications/deep-link helpers.
- **Migration impact:** none.
- **Authorization/UI impact:** evaluator-only, adviser-only, defense-only and mixed views; no irrelevant zero cards/Admin links. Common account surfaces remain appropriate.
- **Verification:** focused contracts, related Adviser/CDW verifiers, typecheck/lint/build for route wiring; browser QA for all canonical scenarios, direct unauthorized routes, revoked access, refresh, responsive/keyboard and copy gate. No exact-string tests for every helper sentence.
- **Stop condition:** bounded Faculty experience accepted; do not activate data conversion or implement Admin UI.

### FACULTY-15 — Administrators Management and permission-aware Admin UI

- **Scope:** dedicated Administrators list/detail/status/access editor; Full/Restricted labels, safe last-Full conflict feedback, filtered Admin sidebar/actions and dashboard requests.
- **Non-goals:** arbitrary Custom Role creation, Admin academic workspace, Analytics/Curriculum implementation, public signup for Admin.
- **Dependencies:** 4–9, 13–14; DR-1 for live bootstrap and DR-4 for affected dual-account provisioning.
- **Expected areas:** new Admin users/administrators pages/components, Admin layout/dashboard, capability presentation/query hooks.
- **Migration impact:** none.
- **Authorization/UI impact:** only Full manages accounts/access; Restricted sees granted modules and safe empty landing. API is authoritative even for guessed management URLs.
- **Verification:** real Full/Restricted UI journeys on synthetic accounts, deny self-elevation/API tampering, last-Full races reflected correctly, current-session revocation, capability-minimum reads, mobile/keyboard/loading and copy review.
- **Stop condition:** full UI/backend parity reviewed; no live Restricted provisioning until 18 activation gate.

### FACULTY-16 — Operator preflight, reconciliation and data-cutover rehearsal

- **Scope:** implement dry-run/idempotent operator manifest tooling, inventory actual authorized environment when separately permitted, bootstrap mappings and PANELIST/CUSTOM conversion rehearsal; record integrity/rollback evidence.
- **Non-goals:** destructive resets, guessing CUSTOM grants or Full accounts, deleting legacy tables, modifying signed history, automatic academic repair.
- **Dependencies:** 1–15; DR-1/2 and all remaining data-dependent DR-4–7 cases must be resolved or explicitly held out with safe denied access. DR-3 is already resolved. No implicit approval to touch production DB from this plan.
- **Expected areas:** operator scripts/CLI, additive migration/backfill files if required, migration fixtures/tests and deployment/runbook docs.
- **Migration impact:** explicit audited User role/direct-grant data changes in rehearsal; exact counts and before/after checks. Preserve all authoritative foreign keys, credentials, records and signatures.
- **Authorization/UI impact:** approved initial evaluators/Admin levels only; unmapped identities denied. Session cutover and compatibility binaries proven.
- **Verification:** disposable clean-chain + snapshot upgrade, repeat-run no-op, interrupted/resumed batches, state drift rejection, historical outputs/hashes stable, zero dangling relationships and duplicate accounts, restoration/compatible rollback rehearsal.
- **Stop condition:** reviewed operator evidence and concrete cutover manifest ready; stop before live execution/activation unless that exact environment action is separately authorized.

### FACULTY-17 — Retire user-facing Custom Roles compatibility surface

- **Scope:** remove mock Custom Roles navigation/page behavior and Other Roles login choice after reconciliation; safe legacy redirects or denied states with no new authority.
- **Non-goals:** dropping CUSTOM enum/tables, deleting role/grant history, automatic account splitting, broad cleanup.
- **Dependencies:** 15–16, DR-2 resolved for affected users; no active legacy users stranded by an unreviewed cutover.
- **Expected areas:** Admin roles page/navigation, login choices, compatibility routes and docs/tests.
- **Migration impact:** none; storage retained unread by target authorization.
- **Authorization/UI impact:** four conceptual login roles; direct Faculty/Admin access editor owns configuration; old URLs cannot bypass Full checks.
- **Verification:** no live Custom Role API introduced, old links/bookmarks, mapped/unmapped CUSTOM login, approved role labels, typecheck/lint/focused route contracts and owner visual review.
- **Stop condition:** product retirement accepted with legacy evidence preserved; no destructive cleanup or next package.

### FACULTY-18 — Integrated acceptance and controlled activation

- **Scope:** execute final cross-domain authorization, migration and multi-account UI acceptance; assemble coverage ledger/release checklist; perform only explicitly authorized environment cutover/activation from reviewed 16 manifest.
- **Non-goals:** new functionality, cleanup, institution-policy decisions, hidden repairs, deployment without environment authorization.
- **Dependencies:** 1–17, all blocking decisions resolved, independently reviewed remote HEADs and appropriate owner UI acceptance. If live action is not authorized, deliver reviewable release evidence and stop.
- **Expected areas:** tests/verifiers and release/acceptance docs; production corrections require a bounded fix to the owning package.
- **Migration impact:** apply only reviewed migrations/manifest in the specifically authorized environment after consistent backup/restore proof; no new unreviewed schema.
- **Authorization/UI impact:** no legacy broad ADMIN bypass coexists with Restricted accounts; role-only identity does not imply academic authority; final frontend/backend parity.
- **Verification:** broad backend suite, affected frontend verifiers, both type/build checks, isolated real-DB migration/contention tests, all scenarios in section 7, actual browser/manual QA and independent source review. Record hosted CI separately.
- **Stop condition:** acceptance/release state reported accurately and no remaining required work hidden; stop. Further contractions/features require new authorization.

## 7. Required verification matrix

Each backend row includes direct HTTP, guessed resource ID and direct service-boundary checks where applicable. Browser navigation does not substitute for these tests.

| Scenario | Positive evidence | Required denial / preservation |
| --- | --- | --- |
| Essay Evaluator only | Dashboard + Essay Evaluations; school-wide read/grade for all pending eligible entrance essays across Programs | No Admin, non-pending/ineligible attempt, committee or MCQ edit authority |
| Internal available, no assignments | Eligible passed-Title ODP candidate when all current gates pass | No arbitrary My Advisees Student access; availability is not relationship authority |
| Pending addressed GS-020, no advisee yet | Request context reachable; exact request response | No active relationship until CONFORME + Dean approval; no request-content mutation under signature |
| Assigned Adviser now unavailable for new work | Current assigned research/review work retained | External/new-assignment rules and history preservation remain; no COR/payment blanket access |
| External with allowed Panelist assignment | Exact My Defenses/role work | Never Adviser candidate/new assignment; no unapproved external-role expansion |
| Multiple Faculty responsibilities | Union of relevant work/navigation | Each resource still rechecks its own source; no union-induced privilege escalation |
| Faculty without work | Dashboard/Profile/common allowed surfaces | No irrelevant zero-value academic cards or guessed API access |
| Removed committee member | Existing attributed history stays owned by original assignment | No future active-session REST/socket/preview writes/reads through removed authority |
| Different roles on different schedules | Chairman actions only on Chairman schedule; own evaluator/report/signature operations | Cross-schedule/role and cross-evaluator attempts fail |
| Full Administrator | Complete approved operational access and management editor | No Faculty essay/Adviser/Chairman override; cannot erase mandatory access audit |
| Restricted Administrator | Only explicit keys, minimum task contexts and filtered aggregates | Hidden direct APIs/files/PDFs/settings/aliases denied; no access management/self-elevation |
| Two concurrent Full removals | Exactly one valid change where required | Never zero active Full; audit atomicity and lock ordering verified |
| Stale or revoked identity/grants | Current allowed actions remain usable | Disable/demotion/revocation effective on next protected operation and live transports; valid 403 does not sign out |
| Same real person, two accounts | Separate approved identifiers, sessions and portals | No role/workspace switcher or merged grant inheritance; clear client query caches |
| PANELIST → FACULTY | Same User/profile/credentials/history IDs | PanelRole.PANELIST, historical text, hashes, signatures and exact documents unchanged |
| CUSTOM reconciliation | Explicit approved account/grant manifest | Unknown/duplicate keys fail closed; no automatic Full/essay access or data deletion |
| Upgrade/restart/rollback | Idempotent reviewed migration and compatible binaries | No role reset, duplicate accounts, lost records or Restricted access through legacy code |

Use existing auth, Adviser, exam essay/scoring/amendment, committee/record/document and realtime tests listed in the audit. Add behavior tests for new risks, especially race/revocation/alias boundaries, rather than only source-string mirrors. Real MySQL/MariaDB contention is required for last-Full and sensitive grade/access races; SQLite or mocked transactions cannot prove it.

The final coverage ledger must enumerate **every** administrative method/path, inherited router middleware, service actor check, document model class, official output and transport. Each entry has one capability/ownership policy, positive/negative tests and package owner. An unclassified entry blocks activation. This audit's route-family table is a planning map, not a claim that future detailed coverage is already complete.

## 8. FACULTY-0 delivery and stop record

Deliverables are this plan and the companion audit only. Existing canonical source-of-truth/specification/checklist content remains unchanged; no implementation acceptance is asserted.

FACULTY-0 checks: exact documentation diff, repository-relative links/code references, headings, package scope/dependency/stop completeness, and `git diff --check`. Application tests/builds, database migration/rehearsal, production inventory, manual/browser QA and hosted CI are **not executed** for this documentation-only package.

After commit/push, report verified starting main SHA, branch, ending commit, exact documents, architecture findings, sequence, decisions/risks and clean worktree/push state. Ending SHA is reported after commit rather than embedded as a self-referential hash in this file. **Stop; do not proceed to FACULTY-1.**
