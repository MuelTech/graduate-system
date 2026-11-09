# FACULTY-17 — Complete Custom Roles subsystem retirement

**Status: FACULTY-17 implemented / pending independent review.**

Date: 2026-11-10 (Asia/Manila). Repository: `MuelTech/graduate-system`. Branch: `feat/faculty-admin-access`.

Starting HEAD: `56142eaa5ed6fd87146df5315421191ddaf46e61`. Local and actual remote HEAD were independently checked and matched before edits; the starting worktree was clean. The delivery response records the ending HEAD and final actual-remote parity; no self-referential commit hash is asserted here.

## Authority and scope

Executed the existing FACULTY-17 package in the canonical implementation plan, using the newly recorded owner DR-1–7 decisions. DR-2 authorizes development implementation of complete subsystem retirement, not an actual database inventory or cleanup. No new implementation plan or replacement role system was created. Current Faculty/Admin source-of-truth, design, plan, checklist, verification/copy policies and relevant FACULTY-15/16 acceptance boundaries were inspected.

FACULTY-17A same-email account resolution/recovery and FACULTY-17B DR-5/6/7 workflow alignment remain separate. Existing conservative rehearsal eligibility checks are unchanged; they are not a reopening of the approved policies. No initial Full bootstrap, Restricted provisioning, actual account reconciliation, live cutover or FACULTY-18 work occurred.

## Consumer and dependency audit

- Prisma dependencies were limited to `User.customRoleId` / `UserCustomRole`, reverse `customRolesCreated` / `CustomRoleCreatedBy`, `CustomRole`, `RoleFeatureAccess`, their indexes and three historical foreign keys. The direct `AdministratorAccess` / `AccountCapabilityGrant` architecture does not depend on them.
- The initial migration creates the legacy tables/column/enum and foreign keys. FACULTY-3 expands the enum with FACULTY. Both files and every other historical migration remain unchanged.
- No backend Custom Roles API or normal seed consumer was found. Runtime compatibility consisted of `other -> CUSTOM` login, current-account/session allowlists, operational actor validation, preflight metadata and isolated rehearsal CUSTOM mapping/legacy-grant readers.
- Frontend consumers were the mock CRUD page, two navigation catalogs and obsolete public About/FAQ copy. The login selector already had four choices; its implementation was preserved.
- Current rehearsal fixtures now use existing Admin identities with explicit direct configuration and a held-out unconfigured Admin. Retired CUSTOM conversion, legacy-grant inspection/translation and obsolete preflight fields are removed. The operator rejects pre-retirement schemas and unsupported identities before executing any manifest.
- Remaining CUSTOM strings in tests are deliberate rejection/forged-claim cases or raw SQL fixtures scoped to historical migration schemas. Those migration fixtures cannot seed target CUSTOM accounts. Remaining application-source legacy structure names are explicit refusal checks, not a reader/writer or authorization source.
- Historical docs/reports and FACULTY-16 evidence retain their original accepted statements and payloads. The active operator runbook is updated for target-schema compatibility; the historical replay remains available at its accepted commit.

## Schema and forward migration

`20261110000000_retire_custom_roles/migration.sql` removes `UserRole.CUSTOM`, `users.custom_role_id`, its foreign key/index, `role_feature_access` and `custom_roles`. The target Prisma schema also removes both models, the forward/reverse relations and the reverse creator relation. Generated Prisma Client was rebuilt locally; generated output remains untracked.

Before the first permanent DDL statement, duplicate-primary-key guards reject:

1. Any CUSTOM account, active or inactive, or other unsupported/invalid enum identity.
2. Unexpected incoming foreign keys to either obsolete table or to the obsolete User column, including cross-schema references visible to the migration account.

The guards fail even with non-strict SQL mode. They perform no account deletion, conversion, grant copying or credential change. Failure requires separately authorized disposition/dependency review; it is not permission to clean up real users. The known User FK is removed before its column/index; the feature table is dropped before its parent role table. Existing remaining enum labels/default and User records survive unchanged.

Deploy only with writers stopped and a verified backup. MySQL/MariaDB DDL implicitly commits: this migration is forward-only, not one rollback transaction. It was exercised only on a fresh separate loopback MariaDB server/data directory with UUID disposable schemas. No actual deployment is authorized here. Recovery from an unforeseen partial DDL failure requires the verified backup or a separately reviewed forward repair; the batch-restoration tool does not recreate retired tables.

## Authentication and user-facing retirement

Manually posted `other`, `custom`, `CUSTOM`, `OTHER` and `Other Roles` selectors return HTTP 400 before repository/password lookup. Applicant ID, Student Number, Faculty and Admin behavior is preserved, including the existing stored PANELIST compatibility reader. Persisted retired CUSTOM identities fail current-account loading (503/unavailable) and operational authorization (403); they cannot obtain target authority through old tokens. A stale token role remains identity-only: the current supported User record determines authority. Frontend session synchronization refuses a CUSTOM response.

The mock Custom Roles page and Create/Edit/Delete Role controls are deleted. Both Admin navigation catalogs omit it. Next routing redirects `/admin/users/roles` and descendants to `/admin/users/administrators` before the layout presentation gate. The destination retains existing Full-only UI/backend authorization; Restricted users receive the existing denied state without management reads/writes, and unauthenticated users must sign in. No backend permission gate was loosened. The About and expanded FAQ role copy now describes Applicant, Student, Faculty and Administrator.

## Verification evidence

Agent-local execution only; none of the following is hosted CI, independent review or project-owner QA.

| Evidence class | Result |
| --- | --- |
| Related backend auth/access/rehearsal/promotion/Defense/document regression | 24 files / 908 tests passed, zero failures/skips |
| Existing Full-only Administrator route/service boundary | 2 files / 78 tests passed, zero failures/skips |
| Frontend session, identity, Faculty portal and Admin access verifiers | 18 + 8 + 42 + 50 = 118 checks passed |
| Synthetic Chrome affected-surface scenarios | 8 passed: Full root/nested bookmarks, Restricted zero/two-grant denials, unauthenticated bookmark, four-role login, About and expanded FAQ |
| Agent-browser smoke / visual inspection | Login loaded with meaningful content, four choices and no framework error overlay; implementation agent inspected login and Full-management screenshots |
| Historical foundation fixture compatibility on isolated MariaDB | 12 tests passed; legacy structures are populated through raw SQL only in the historical prefix |
| Prisma validation / generated client / backend build | Passed |
| Focused TypeScript for changed migration/route integration harnesses | Passed |
| Frontend TypeScript / scoped ESLint / production build | Passed; existing middleware and module-register deprecation warnings remain |
| Final clean committed migration/rehearsal replay | 10 retirement cases + 8 adjusted operator cases passed at the code checkpoint below; zero final failures/skips |

The related backend set was chosen because current-account and operational role allowlists are shared authentication/authorization boundaries. It includes configured access, stale JWTs, Applicant-to-Student promotion, academic impersonation denial, Memo/private-file containment, official-record preservation and isolated operator source-provenance guards. No repository-wide test run was used.

The dedicated `faculty-17-retirement.test.ts` harness tests clean-chain Prisma deployment and no-op redeploy, populated legacy upgrade, active/inactive CUSTOM refusal, invalid enum refusal, unexpected FK refusal, target schema metadata, seed rebuild, and schema/client consistency. It captures all tables and checks every actual declared FK, including compound keys. The populated fixture includes all five contextual Defense roles, PanelAssignment relationships, finalized oral criteria/summary, RAP content/signature, DefenseConclusion, GS-017 certificate/manuscript, signed GS-020 request/official record, direct Admin metadata/grants and original audit history. All unrelated rows/columns and credentials are compared before/after, excluding only the explicitly retired structures/column and migration ledger additions. The GS-020 renderer SHA-256 must also match.

Reproduction (from `backend`, using only a new isolated local server): set `FACULTY_17_DB_TEST=1` and explicit server-only `FACULTY_17_DB_SERVER_URL`, then run `npx vitest run tests/integration/faculty-17-retirement.test.ts --reporter=verbose`. The configured `DATABASE_URL` is parsed only to reject the application's server port. It is never contacted by this harness. All generated schemas are checked for removal.

**Hosted CI:** not observed/claimed. **Independent source review:** pending. **Project-owner manual/browser/visual QA:** pending / not executed by the owner; not recorded as PASS. Full MySQL-server testing was not performed; actual isolated SQL execution uses MariaDB 10.4.32 with the existing deployment architecture and MySQL-compatible syntax.

## Remaining gates and preservation boundaries

No actual XAMPP/development, staging or production database was accessed, inventoried, migrated, reset, seeded or modified. The installed MariaDB executables were used with a new workspace-only data directory on port 33317, not the normal XAMPP data directory/server. No real accounts were inspected, provisioned, converted or deleted.

`ADMINISTRATOR_MANAGEMENT_ENABLED`, `DIRECT_ACCESS_ENFORCEMENT_ENABLED` and `OPERATIONAL_ENFORCEMENT_ENABLED` are unchanged and false. FACULTY-4 last-Full and FACULTY-12 exact real-MariaDB contention readiness remain OPEN; synthetic retirement tests do not close them. DR-1 actual initial Full designation/bootstrap and actual/live DR-2 account disposition remain separately authorized operations. FACULTY-17A, FACULTY-17B and FACULTY-18 are not implemented.

Defense `PanelRole`/`PanelAssignment` definitions and all Faculty/Adviser/Defense/exam workflow implementations remain unchanged. No email uniqueness/recovery architecture, External committee policy implementation or Adviser reclassification/recovery implementation was added.

## Exact changed files and source checkpoint

The complete bounded file inventory and clean committed replay evidence follow. Accepted FACULTY-0–16 reports/evidence and historical migration files are excluded from the diff.

37 files (including this report and the sanitized replay evidence):

- `backend/prisma/migrations/20261110000000_retire_custom_roles/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/src/access/access-preflight.ts`
- `backend/src/access/cutover-rehearsal.ts`
- `backend/src/access/operational-authorization.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/services/current-account.ts`
- `backend/tests/fixtures/faculty-16.ts`
- `backend/tests/integration/direct-account-access.test.ts`
- `backend/tests/integration/faculty-16-cutover-rehearsal.test.ts`
- `backend/tests/integration/faculty-17-retirement.test.ts`
- `backend/tests/unit/access/access-contracts.test.ts`
- `backend/tests/unit/access/faculty-16-cutover-session.test.ts`
- `backend/tests/unit/access/faculty-16-cutover.test.ts`
- `backend/tests/unit/middlewares/auth.middleware.test.ts`
- `backend/tests/unit/migrations/faculty-3-enum-expansion.test.ts`
- `backend/tests/unit/routes/administrator-access.routes.test.ts`
- `backend/tests/unit/routes/faculty-13-effective-access.routes.test.ts`
- `backend/tests/unit/routes/faculty-17-retirement.routes.test.ts`
- `backend/tests/unit/services/auth.login.test.ts`
- `backend/tests/unit/services/faculty-3-compatibility.test.ts`
- `backend/tests/unit/services/faculty-9-private-documents.test.ts`
- `docs/runbooks/faculty-16-cutover-rehearsal.md`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-10-faculty-17-custom-roles-retirement.md`
- `docs/superpowers/reports/evidence/2026-11-10-faculty-17-retirement.json`
- `frontend/e2e/administrators-management.spec.ts`
- `frontend/next.config.ts`
- `frontend/scripts/verify-faculty-15-admin.mjs`
- `frontend/scripts/verify-faculty-2-session.mjs`
- `frontend/src/app/(portal)/admin/layout.tsx`
- `frontend/src/app/(portal)/admin/users/roles/page.tsx`
- `frontend/src/app/(public)/about/page.tsx`
- `frontend/src/app/(public)/faq/page.tsx`
- `frontend/src/lib/admin-access.ts`
- `frontend/src/lib/current-session.ts`

## Final clean committed replay

Executed code/test checkpoint: `833d2e6d0a58a8c6008bec0e0ea3a74c99743118`. The retirement harness reported a CLEAN worktree at that commit; the adjusted operator replay loaded its pinned Git-object module graph and recorded its per-file/source-tree hashes. No code changes followed this checkpoint; the final publication adds only this completed report and sanitized evidence.

- Retirement: **10 tests passed**, including clean-chain/populated upgrade, all refusal guards, seed rebuild and zero Prisma schema drift against both isolated schemas.
- Adjusted operator regression: **8 tests passed**, including clean chain/populated upgrade, no-op, audit-failure rollback, interruption/resume, credential-drift refusal, reverse restoration, actual SQL dump/restore and separate-process CLI execution. This exercises existing Admin direct configuration and academic compatibility only, with no CUSTOM conversion.
- The first operator attempt was refused by the existing Git ownership guard under the sandbox account before any operator schema was created. Replaying as the repository owner passed; no safe-directory configuration or source-provenance guard was changed. The retirement checks passed in that initial clean-commit attempt as well.
- Retirement preserved-data SHA-256: `e024b3d3ecc0bfc07c6e3399f7019d364fecfbb8239d6e89bba132bd17fbe9c6` (all 71 target tables represented; 8 Users and all 5 Defense seats preserved).
- Retained rendered GS-020 SHA-256: `5bf1e11bb746b962a8118e4c3a665e64454813f06d5b273cff4e4a4aa1376779` before and after the retirement.
- Migration file SHA-256: `3c471ee891c5db17d3fbc1094e8408886b7301875ad017e5c35fe4ca5a42179b`.
- Operator executed source-tree SHA-256: `ddb1f2aed0d81c3ba0183e011df06e03dc19d2a5bbcc5389379230a92ec2685f`; 57 migrations, 71 tables, 6 synthetic accounts, 4 apply batches and 4 restoration batches. Its own independent GS-020 output and restored-state hashes are in the evidence.
- All generated FACULTY-1/16/17 schemas were confirmed absent (count zero) on the new loopback server. Only the process whose exact workspace data directory and port 33317 were verified was shut down. The synthetic frontend fixture and temporary smoke-test browser were also stopped.

See [sanitized committed-replay evidence](evidence/2026-11-10-faculty-17-retirement.json). No historical FACULTY-16 evidence payload was modified. Independent review and project-owner acceptance remain pending; no subsequent package is authorized by these results.
