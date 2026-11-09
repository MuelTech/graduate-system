# FACULTY-17A — Same-Gmail, separate Faculty/Admin accounts

**Status: FACULTY-17A implemented / pending independent review.**

Date: 2026-11-10 (Asia/Manila). Branch: `feat/faculty-admin-access`. Starting local and independently verified actual remote HEAD: `b3d1a14776d2f1e622e63d7fdd984c08313524b5`; worktree clean. The existing canonical FACULTY-17A plan remains the implementation authority; this report records its required technical design review, not a replacement plan.

## Pre-implementation technical design review

Recorded before schema/authentication changes. Repository inspection found a global `users_email_key`, email-only Prisma `findUnique` authentication, email-keyed seed/upsert/fixture consumers, ID-based current-account and password-change paths, and already bounded Faculty/Admin provisioning with P2002-to-409 conflict handling. The initial migration specifies `VARCHAR(191)` email with `utf8mb4_unicode_ci`; no later committed migration changes that collation. Normal provisioning trims text but does not consistently lowercase email; registration checks Gmail and email existence without a shared normalizer. No accepted functional reset-token/email recovery route exists.

### Selected database uniqueness strategy

Use two nullable `VARCHAR(191)` unique keys with explicit `utf8mb4_unicode_ci` collation, maintained on every INSERT and UPDATE by single-statement MySQL/MariaDB BEFORE triggers:

| Current User identity | `email_admin_key` | `email_faculty_key` |
| --- | --- | --- |
| ADMIN | normalized email | NULL |
| FACULTY or legacy PANELIST | NULL | normalized email |
| APPLICANT or STUDENT | normalized email | normalized email |

Normalized email is lowercase with outer ASCII spaces removed, matching SQL `LOWER(TRIM(email))`. Existing Unicode case/accent comparison remains governed by the existing `utf8mb4_unicode_ci` collation; do not silently change that equivalence or rewrite Gmail dots/plus addresses. New inputs must still pass the existing email validation. Existing raw stored emails, IDs, hashes, timestamps and relationship attribution remain unchanged.

Each unique index rejects duplicate non-NULL keys atomically under InnoDB concurrency. Thus Admin+Faculty is the sole allowed same-email pair. Admin duplicates conflict on the first key; Faculty/PANELIST duplicates on the second; Applicants/Students occupy both keys and conflict with every account category, including each other. Same-record Applicant-to-Student promotion retains both keys and the same ID/hash. Role/email updates recompute both keys. Triggers overwrite supplied key values, so callers cannot forge NULL/alternate keys to bypass constraints. No SELECT-before-INSERT trigger or application-only uniqueness check is used. No combination can contain more than the approved pair.

The database mechanics are documented by [MariaDB UNIQUE constraints](https://mariadb.com/docs/server/architecture/server-constraints/unique-constraints-with-mariadb-enterprise-server) and [MySQL BEFORE trigger semantics](https://dev.mysql.com/doc/refman/8.0/en/trigger-syntax.html); the pairing truth table above is this package's design, to be established by isolated execution.

A simple `@@unique([email, role])` was rejected because it permits Applicant/Student/Admin/Faculty cross-role duplicates and treats PANELIST/FACULTY as separate slots. Stored trigger-maintained columns were selected to avoid relying on Prisma generated-column introspection semantics; they are represented as nullable indexed scalars, require no new client extension, and will be verified through actual Prisma deployment, generated-client queries, hostile direct writes and concurrent insert/update tests on disposable MariaDB.

### Forward migration and compatibility

The new migration must first reject normalized collisions, empty normalized identities, unexpected email foreign-key dependencies and a collation/type mismatch before permanent DDL. It adds both columns/indexes while retaining the old global index, installs both triggers, backfills only the new keys, verifies their derived state, then drops `users_email_key` last. No protection gap, User merge, role conversion, password rewrite, normal database reset or historical migration edit is allowed. Quiesce writers and retain a verified backup: MySQL DDL implicitly commits, so failure is not advertised as one rollback transaction. Migration needs ordinary ALTER/CREATE TRIGGER privileges; it does not grant privileges itself.

Authentication will query the appropriate normalized unique key with an explicit current role filter (ADMIN or FACULTY/PANELIST). No other-role fallback or email-only identity selection is permitted. Wrong-password/absent-selected-role responses must use the same generic login error. Registration checks both slots and remains Applicant-only. The database constraints remain the final concurrent duplicate authority; API conflicts map to the existing bounded 409 responses. Seed and fixture writers/readers must select a known role/category rather than reuse ambiguous email-only unique lookups.

Current-account loading, grants, password change and audit attribution remain keyed by authenticated User ID. Same-email accounts keep separate credentials, JWT identities and private cache scopes. They do not become a combined session or workspace switcher. The existing single browser cookie may be replaced only by separately authenticating the other account; it is not two simultaneously combined identities.

The existing isolated operator must recognize the approved pair and reject prohibited normalized identity combinations, without enabling any real provisioning/cutover. Historical raw migration fixtures remain scoped to their historical schemas. The retired CUSTOM subsystem stays retired.

### Recovery and scope boundaries

Authenticated `/auth/change-password` continues to affect only the authenticated User ID. No self-service reset-token/email delivery or Admin-assisted reset flow is added. Future `AUTH-RECOVERY-1` must resolve email plus selected account role before issuing or redeeming a User-ID-bound token, return non-enumerating responses, and preserve account-specific credential/session/audit isolation. Email Integration remains separate.

No actual development/XAMPP, staging or production database inspection or operation is authorized. All SQL execution must use new synthetic data on a separately launched local server/data directory. FACULTY-17B and FACULTY-18, live Full/Restricted provisioning, all activation switches and FACULTY-4/12 readiness gates remain outside this package.

## Implementation and verification

The forward migration implements the reviewed two-slot design with database-owned INSERT/UPDATE derivation. The target Prisma schema removes only global email uniqueness and adds its two indexed scalar projections. No account role/ID/password/profile/history conversion occurs. The migration guards normalized collisions, blank identities, unexpected email FKs and unsupported email type/collation before permanent DDL. It retains the old global unique index until derivation triggers, backfill and verification succeed.

`account-email.ts` owns the matching ASCII-space/lowercase normalization and typed role-scoped lookup. AuthRepository authentication now uses a normalized unique slot plus a current-role predicate; registration's unscoped email query is existence-only over both slots. Missing selected-role identity and incorrect password both return `401 / Invalid login credentials!`, without identifying another account role. Retired CUSTOM selectors still fail before any lookup. Faculty and Admin provisioning normalize email while retaining existing allowlists, authorization/fences, random one-time credentials, atomic audit and bounded P2002-to-409 handling. Public registration remains Gmail-only/Applicant-only and maps a concurrent unique conflict to 409.

No frontend runtime UI/layout/role-selector or NextAuth/session/cache implementation changed. The existing JWT/session callbacks replace identity only after corresponding authentication, reload current state by token User ID, reject foreign-ID responses even at the same email, and keep private queries scoped by account ID/access fingerprint. Real isolated HTTP tests prove that forged role/email/body User IDs cannot select the paired account, grant Admin/Full access or redirect password mutation. Existing audit writers continue to record the explicit actor/target IDs.

Seed/upsert/journey-fixture consumers now use role/category-scoped keys. Their exclusive Applicant/Student lifecycle lookup permits finding the *same* promoted User, without admitting a Faculty/Admin identity or creating a new Applicant for that email. The isolated seed/reseed test promotes a seeded Applicant and verifies preservation of its ID, STUDENT role and password hash across reseeding. No normal database seed/reset was run. Historical migration fixtures use narrow `id` projections while seeding schemas that predate the new columns; preservation comparisons exclude only intentionally added projections. Their academic/audit data and historical migration SQL are unchanged.

The isolated operator now accepts only the approved normalized Admin/Faculty pair rather than assuming global email uniqueness. Its closed committed module graph explicitly includes the pure email helper; source-provenance enforcement is preserved. No account provisioning or live cutover was added to its runtime contract.

## Verification ledger

All execution is agent-local, with synthetic fixtures only. An earlier aggregate exposed a pre-column historical fixture SELECT and a CLI timeout under parallel migration load; the fixture now selects only its historical ID and its existing deployment test has an explicit CLI-appropriate timeout. The corrected historical suite passed. The browser fixture was corrected to return the existing notification array contract and open the collapsed navigation before asserting its link; no product code was changed for those fixture issues.

- Backend: the final 12 focused auth/role/provisioning/session/promotion/operator suites passed 396 checks, zero failures/skips. Final clean committed database/operator execution is recorded below. No repository-wide backend suite was run.
- Frontend: 119 checks passed across the existing session (19), identity compatibility (8), Faculty portal (42) and Administrator access (50) verifiers. This includes a new same-email/foreign-ID response rejection case.
- Browser: 6 Chrome scenarios passed against the loopback synthetic contract: each selected-role identity, each other-account password denial, sign-out/re-authentication with direct-route isolation, and exactly four unchanged selector choices. The implementation agent inspected both account dashboard screenshots; these are not project-owner visual acceptance.
- Isolated MariaDB: the new identity harness passed 51 cases, covering all 25 ordered role pairs, case/space normalization and dot/plus preservation, concurrent inserts/updates/registration, key forgery, role/email changes, both provisioning orders, bounded duplicate conflicts, legacy PANELIST compatibility, actual service/repository authentication, current-account HTTP reads, ID-bound password change, Applicant ID/Student Number/promotion, data preservation, clean-chain/populated migrations, zero Prisma schema drift and role-scoped seed/reseed. The adjusted FACULTY-17 retirement harness passed 10 cases, and the corrected historical foundation harness passed 12 (including 3 server-isolation contract cases).
- Prisma validation/client generation and backend build passed. The changed integration/seed/fixture scripts passed focused TypeScript. Frontend TypeScript, scoped ESLint and production build passed. Existing middleware/module-register deprecation notices remain unchanged.
- Final clean committed identity/operator replay, source hashes, disposable schema cleanup and final source checkpoint are recorded below before delivery.

The isolated server uses new workspace data under `backend/.tmp/faculty17a-server/data`, bound to 127.0.0.1:33318. Test URLs are explicit and UUID schema names are checked. The configured application DATABASE_URL is parsed only to reject its port; the integration harnesses never contact it. The identity test's application database module is replaced by a proxy bound solely to its own disposable Prisma client, including when real auth controllers/services/repositories are exercised. The normal backend and email workers were not started. Only the disposable clean schema was seeded/reseeded.

**Hosted CI:** not observed/claimed. **Independent source review:** pending. **Project-owner manual/browser/visual QA:** pending, not executed by the owner and not recorded as PASS. Actual SQL execution uses isolated MariaDB 10.4.32; an additional MySQL server was not run.

## Recovery and remaining gates

No reset-token, forgot-password/email delivery, Admin-assisted recovery or recovery account-picker implementation was added. Current authenticated password change remains User-ID-bound. Future AUTH-RECOVERY-1 must select the intended normalized email/account category before minting and redeeming a User-ID-bound token and avoid disclosing another role's account. Email Integration remains separate; this package does not certify existing public forgot-password copy or an operational recovery flow.

The three code-owned activation gates remain unchanged and false: ADMINISTRATOR_MANAGEMENT_ENABLED, DIRECT_ACCESS_ENFORCEMENT_ENABLED and OPERATIONAL_ENFORCEMENT_ENABLED. Faculty configuration's existing dormant gate also remains unchanged. FACULTY-4 and FACULTY-12 exact real-MariaDB readiness gates remain OPEN; these identity tests do not close them. DR-4 architecture is implemented for source review only. Actual initial Full designation/bootstrap, any actual/live identity disposition and separately authorized provisioning/cutover remain outstanding environment actions. Approved DR-5/6/7 alignment stays in FACULTY-17B; FACULTY-18 is not implemented.

No actual development/XAMPP, staging or production database was accessed, inspected, inventoried, migrated, reset, seeded or modified. No real account was provisioned, merged, split or converted. No Custom Roles functionality, Defense/Adviser policy correction, email uniqueness exception beyond the approved pair, or academic workflow redesign was introduced. Accepted FACULTY-0–17 reports/evidence and all historical migration files are unchanged.

## Exact changed files and final source checkpoint

Final bounded file inventory and clean committed replay evidence follow before delivery.

28 files, including this report and the final sanitized evidence:

- `backend/prisma/journey-fixtures.ts`
- `backend/prisma/migrations/20261110010000_role_scoped_email_identity/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/prisma/verify-journey-fixtures.ts`
- `backend/prisma/verify-journey-reset.ts`
- `backend/scripts/faculty-cutover-rehearsal.cjs`
- `backend/src/access/administrator-management.ts`
- `backend/src/access/cutover-rehearsal.ts`
- `backend/src/access/faculty-configuration.ts`
- `backend/src/repositories/auth.repository.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/utils/account-email.ts`
- `backend/tests/integration/direct-account-access.test.ts`
- `backend/tests/integration/faculty-16-cutover-rehearsal.test.ts`
- `backend/tests/integration/faculty-17-retirement.test.ts`
- `backend/tests/integration/faculty-17a-identity.test.ts`
- `backend/tests/unit/access/faculty-16-source-provenance.test.ts`
- `backend/tests/unit/access/faculty-17a-email.test.ts`
- `backend/tests/unit/routes/faculty-17-retirement.routes.test.ts`
- `backend/tests/unit/services/auth.login.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-10-faculty-17a-role-scoped-identity.md`
- `docs/superpowers/reports/evidence/2026-11-10-faculty-17a-identity.json`
- `frontend/e2e/faculty-17a-login.spec.ts`
- `frontend/scripts/faculty-17a-fixture-server.mjs`
- `frontend/scripts/verify-faculty-2-session.mjs`

## Final clean committed source and replay

Executed code/test checkpoint: `f29c994e4fc21cebd5801ec8cb57e56c628dab45`. The identity harness reported a CLEAN worktree; the operator's unchanged provenance mechanism loaded the pinned committed application graph, now explicitly including the pure email helper. The final publication changes only this report and the sanitized evidence, with no application/schema/test changes after that checkpoint.

Final consolidated replay: **4 files / 81 tests passed, zero failures/skips**: 51 identity/migration/auth/provisioning cases, 10 retirement-preservation cases, 12 historical foundation cases (including 3 server-isolation contracts), and 8 operator migration/SQL-restore/CLI cases. The focused unit regression separately passed **12 files / 396 tests**, frontend verifiers **119 checks**, and synthetic Chrome **6 scenarios**. No unrelated full-suite run was performed.

- Migration SHA-256: `61238fdbb63925ac6da653d1bd10189cfe682ca20df646ee92afe7d209c03e68`.
- Preserved preexisting business-column SHA-256: `04d01af9a382bcb7a342fecd14659a88fbfb69ab314ef1ed728e83bbfac81ff2`. The migration comparison retained raw email, User IDs, hashes, timestamps, profiles, Student relationships and original audit attribution; only new key projections and migration ledger additions were excluded.
- Target: 58 committed migrations, 71 tables, and the two expected identity triggers. Prisma comparison found no target-schema drift after both clean deployment and populated upgrade.
- Operator committed source-tree SHA-256: `efd9daa1029ccc02c04e29b64804ec775aa60bdb0cbcb9c74a5752b8d3496dad`; its module-file hashes, independent historical GS-020 hash and restored-state digest are in the evidence.
- Every generated FACULTY-1/16/17/17A schema was confirmed absent on the isolated server (count zero), and the process was shut down only after its exact workspace data directory/port were verified. The frontend fixture and temporary browser were stopped.

See [sanitized source/replay evidence](evidence/2026-11-10-faculty-17a-identity.json). The runtime requires the new columns/triggers; deployment must use the reviewed migration and compatible role-scoped code before any approved pair is provisioned. No such actual environment action occurred. The delivery response records the ending HEAD and verified local/actual-remote parity, avoiding a self-referential commit hash here. At initial report publication, independent source review and project-owner QA remained pending. See the chronological owner deployment/review addendum below for subsequent status; project-owner QA and formal acceptance remain separate.

## Owner-performed local development migration deployment addendum (2026-11-10, Asia/Manila)

This chronological addendum records a later project-owner operation. It does not rewrite the implementation agent's earlier synthetic-only execution record.

The project owner supplied a terminal screenshot showing `npx prisma migrate deploy` executed from the `backend` directory. Prisma loaded `prisma.config.ts`, identified the MySQL database `graduate_system` at `localhost:3306`, reported **58 migrations found**, and reported successful application of these four pending migrations:

- `20261108010000_faculty_identity_compatibility`
- `20261108020000_administrator_access_lock`
- `20261110000000_retire_custom_roles`
- `20261110010000_role_scoped_email_identity`

The terminal output ended with: **“All migrations have been successfully applied.”**

Relevant package migrations:
- FACULTY-17: `20261110000000_retire_custom_roles`.
- FACULTY-17A: `20261110010000_role_scoped_email_identity`.

### Evidence limits and operational boundaries

- This is **project-owner-provided terminal screenshot evidence**. The reviewer did not independently connect to or query the local database.
- The screenshot identifies the target as `graduate_system` at `localhost:3306`; the owner identifies this as the local development/XAMPP MySQL environment.
- This confirms that Prisma reported successful deployment of the four listed migrations. It does not independently prove post-deployment schema inventory, application startup, Faculty/Admin account provisioning, same-email login smoke tests, or every affected workflow.
- A subsequent `npx prisma migrate status` result was not supplied; do not claim an independently verified zero-pending status.
- The shown command is `migrate deploy`; the screenshot does not show a database reset, `db push`, or seed operation.
- The local development database was accessed and modified by this **separate owner-performed deployment**. The earlier statements that the implementation agent used only isolated synthetic databases remain historically accurate for the agent's implementation and verification runs.
- No staging or production database operation is reported or authorized by this addendum.
- This local migration deployment does not close the separate FACULTY-4/FACULTY-12 real-MariaDB contention-readiness gates and does not enable any activation gate. All three code-owned activation gates remain `false`.
- No real Faculty/Admin account was provisioned, merged, split, or converted by this migration command.

Project-owner application smoke QA and formal package acceptance remain separate checkpoints.
