# FACULTY-4 — Full Administrator management service and safeguards

Date: 2026-11-08 (Asia/Manila). Status: **ACCEPTED FOR CONTINUATION**.

This package implements backend foundation only and is accepted for continuation at `33b3910e90f9008f93a5b203c113088a7e2f4d46` after independent remote commit-diff/source/security review. Administrator management remains disabled in production composition. No live Full bootstrap, Admin conversion, Restricted provisioning/rollout, UI, Faculty management/essay work, or FACULTY-5 occurred.

## Starting repository state

- Repository: `MuelTech/graduate-system`; branch: `feat/faculty-admin-access`.
- Initial local HEAD: `6d03ab79d56439e805114a9d5bfc5f08664379ac`; tree/index clean.
- Fetched branch and main; branch remote matched expected `023adef40a92ee9140c28781c379bdd7cb44b2a7`.
- Normally fast-forwarded the local branch to that exact remote commit, then verified clean tree/index and local/remote parity before implementation.
- Local/fetched main: `045316540d97364214792c7d441ae20a1e426d4c`.
- `git rev-list --left-right --count origin/main...HEAD`: `0 10` at implementation start.
- No merge commit, rebase, reset, force-push, branch creation, or history rewrite.

Read the current canonical Faculty/Admin source of truth, design, audit, plan, relevant checklist sections, and Engineering Verification Policy. FACULTY-1/2/3 acceptance remains intact; their catalog, current-account rules and academic identity compatibility were retained.

## Full-only API and service contract

Mounted at `/api/admin/administrators`:

| Method/path | Contract |
| --- | --- |
| `GET /` | Paginated safe Admin summaries; optional `page` (1–100000) and `pageSize` (1–100, default 25). Unknown/malformed query fields rejected. |
| `GET /:userId` | Exact existing ADMIN summary; no password/hash/temporary credential. |
| `POST /` | Required explicit fields: `email`, `firstName`, `lastName`, `level`, `capabilityKeys`. Creates a new ADMIN User, metadata and validated direct grants atomically. Returns `{ account, temporaryPassword }` after commit only. |
| `PATCH /:userId` | Nonempty strict subset of `level`, `capabilityKeys`, `isActive`. Changes existing mapped Admin access/status only; no mass assignment, identity-role change or credential reset. |
| `DELETE /:userId/access` | Removes mapped access metadata/direct grants and disables the retained User atomically. Preserves User IDs, hashes, history and audit attribution. Does not physically delete the account. |

`User.role` stays ADMIN for both FULL and RESTRICTED levels. No new UserRole or combined academic/administrative identity. Unmapped/invalid target access cannot be bootstrapped through PATCH or removal; it requires future reviewed operator reconciliation. Reads can expose the safe unmapped state to an authorized Full actor.

Both the router and service require current active ADMIN + valid FULL configuration + `mustChangePassword=false`. Missing/invalid metadata, invalid/wrong-category persisted grants, Restricted accounts, non-Admin accounts and stale token privilege are denied. The service does not accept a preauthorized access object from the caller: only a server-derived actor User ID, followed by its own fenced current-account read.

`ADMINISTRATOR_MANAGEMENT_ENABLED=false` is a code-owned default. No environment variable, request body or stored setting enables it. Production router composition uses the dormant default service; its valid Full requests receive 503 without management transactions. Internal constructor/router dependency injection enables synthetic tests only. The separate `DIRECT_ACCESS_ENFORCEMENT_ENABLED=false` remains unchanged. This package does not activate Restricted enforcement on legacy modules or provide a live account-provisioning path.

Capability validation reuses FACULTY-1 `validateDirectCapabilityKeys("ADMIN", ...)`: rejects unknown keys, duplicates, nonstrings, malformed lists, Faculty `essay.evaluate`, Full-only `administrator_access.manage`, and raw route names. Full continues to resolve the enumerated administrative catalog; valid ordinary direct keys retain FACULTY-1 storage semantics. No academic Adviser/Defense/essay authority is added by Full status.

## Temporary credentials

Provisioning generates `randomBytes(32).toString("base64url")`: 256 random bits, 43 characters. It stores a bcrypt hash at cost 12, always sets `mustChangePassword=true`, and never derives credentials from a surname/default. Password hashing occurs before acquiring the mutation fence; the actor is still revalidated inside the eventual transaction. The temporary value is returned only after the transaction commits, with `Cache-Control: private, no-store` and `Pragma: no-cache`.

Temporary passwords/hashes are absent from audit, safe list/detail projections, error responses and email/notification integrations. No recovery/reset endpoint or public Admin registration was added. Existing FACULTY-2 credential-state enforcement applies to provisioned accounts. Tests verify independent credentials, bcrypt comparison, forced-change flags and denial of gated accounts.

## Concurrency, revalidation and invariant

New migration: `backend/prisma/migrations/20261108020000_administrator_access_lock/migration.sql`.

It creates only `administrator_access_lock` with an unsigned tinyint primary key, `CHECK (id = 1)`, and explicit **ENGINE=InnoDB**, then inserts its one sentinel row (`id=1`). The row contains no account identity, access level, grant or bootstrap mapping. No historical migration or existing account/history data is changed. No migration was deployed in this task.

Every management read/mutation uses a Prisma READ COMMITTED interactive transaction:

1. Lock the persistent singleton with `SELECT ... WHERE id=1 FOR UPDATE`. Missing fence fails closed; runtime code never creates/upserts it.
2. Lock current ADMIN User rows in `user_id` order. All authorized management writers use the same singleton first.
3. Reload actor identity, activity, credential state, metadata and grants **after acquiring the fence**. A route-level Full check from before lock waiting cannot authorize the write.
4. Reload exact target and current active-Full population. Count only snapshots that resolve to valid active Full access; malformed grants/metadata do not qualify. Evaluate the target's proposed after-state and reject demotion, disablement or removal if it would leave zero active Full accounts.
5. Apply only explicit validated changes and required audit inserts in the same transaction. Return only after commit. Transaction errors roll back both writes and audit.

This serializes competing changes across server processes through the database, rather than an in-process mutex or an unlocked count. The synthetic transaction double tests ordered reads, one-winner races, missing-fence denial, rollback and actor revocation; these tests **do not prove real InnoDB behavior**. Real-DB evidence remains outstanding below.

Audited existing User mutation paths: public registration remains Applicant-only; COR promotion conditionally updates only APPLICANT to STUDENT; authenticated password change modifies credentials only. The legacy Admin Panelist updater could otherwise mutate an ADMIN User attached to a profile: it now rejects ADMIN targets and includes an atomic `role != ADMIN` User-update condition. This closes an alternate status/password/identity mutation path without redesigning Faculty workflows.

## Atomic protected access evidence

Reuses FACULTY-1 action taxonomy and `AccessAuditEvent`/state contracts. Adds only `ADMINISTRATOR_ACCESS_REMOVED` within the existing protected namespace. Create, level/status changes, individual grants/revocations and authority removal record actor, target, version, action, occurrence timestamp, and before/after direct configuration. Individual capability events identify the changed key. Audit stores no credentials. No-op PATCH does not fabricate an access-change event.

Audit creation is awaited within the privileged transaction. Tests force failure for create/update/removal and after an earlier successful audit insert; the target state and every audit insert roll back together.

The single/bulk generic Settings deletion repository paths apply protected-namespace exclusions **in the DELETE predicate**, avoiding check-then-delete races. Parameterized SQL uses literal LEFT/CHAR_LENGTH comparisons (no LIKE wildcards) and binds every requested identifier. Shared prefixes protect all `ADMINISTRATOR_ACCESS_*` and `ACCOUNT_CAPABILITY_*` actions, including unknown future actions. Single protected deletion returns 403; missing ordinary records remain 404. Bulk deletion skips protected records and returns the actual ordinary deletion count. Both real generic Settings HTTP aliases are covered, even for a Full actor. No Audit Log UI or broader retention redesign.

## Verification and limits

| Evidence | Result |
| --- | --- |
| `npm run prisma:generate` (backend) | PASS |
| `npx prisma validate` (backend) | PASS |
| `npm run build` (backend, after final production-source changes) | PASS |
| Prisma schema-to-schema migration diff against starting HEAD | PASS: only the singleton table is added. SQL migration deliberately also specifies InnoDB, singleton CHECK and sentinel INSERT that Prisma schema cannot fully represent. |
| Focused command below | **16 files / 343 tests PASS; 1 real-DB file / 5 tests safely SKIPPED** |
| `git diff --check`, schema enum/model preservation and exact migration/file inspection | PASS |
| Frontend/build/UI suites | NOT RUN; no frontend files changed |
| Unrelated full backend suite | NOT RUN; bounded package verification requested; prior unrelated baseline failures are not reworked here |
| Manual/browser QA | NOT EXECUTED; no UI implemented |
| Hosted CI / independent review | NOT EXECUTED / pending; no independent acceptance claimed |

Command run in `backend`:

```text
npm test -- tests/unit/services/administrator-access.service.test.ts tests/unit/routes/administrator-access.routes.test.ts tests/unit/repositories/settings-access-audit.test.ts tests/unit/repositories/administrator-legacy-bypass.test.ts tests/unit/migrations/administrator-access-lock.test.ts tests/integration/administrator-access-contention.test.ts tests/unit/access tests/unit/middlewares/auth.middleware.test.ts tests/unit/services/auth.login.test.ts tests/unit/repositories/auth.repository.login.test.ts tests/unit/services/faculty-3-compatibility.test.ts tests/unit/realtime/faculty-3-realtime.test.ts tests/unit/migrations/faculty-3-enum-expansion.test.ts tests/unit/repositories/admin-panelist.repository.test.ts
```

The matrix covers Full-only direct HTTP/service reads and mutations; Restricted self-elevation/other edits; plain/invalid ADMIN metadata; current non-ADMIN with stale ADMIN claims; body/capability injection; random credentials; generic password gating; exact academic identity regression; last-Full demotion/disable/removal; competing self-demotions/disables/removals; actor demotion during lock waiting; audit rollback; and single/bulk protected audit preservation. One HTTP case explicitly waits until a request has passed the route guard and entered its transaction before releasing a competing actor demotion, then verifies 403 and no target change.

### Isolated MariaDB contention — safe skip

Application `DATABASE_URL` resolves to `localhost:3306`. No `FACULTY_4_DB_SERVER_URL` is configured; no genuinely isolated authenticated server was established. **Real migration/full-chain/contention/audit-trigger rehearsal was not run.** No normal-XAMPP scratch schema, reset, drop, reseed, live Admin write/bootstrap/conversion or InnoDB file manipulation occurred. All FACULTY-4 account writes used synthetic test doubles; the real integration suite remained skipped.

An opt-in suite is supplied for later authorized execution. It requires both `FACULTY_4_DB_TEST=1` and an explicit server-only `FACULTY_4_DB_SERVER_URL`, plus the application URL to prove separation. The guard restricts testing to a local server on a **different port** from the application, rejecting same-port loopback aliases and any URL already naming a schema. It never falls back to the application server. Only after this proof does it create a random isolated `faculty4_test_<hex>` schema, deploy the committed migration chain, create synthetic actors and exercise actual competing transactions, actor revocation and forced DB-trigger audit failure. Cleanup is bounded to that exact generated isolated schema/folder. Guard cases run without database connections.

Real DB locking/rollback verification is a known limitation and must remain a readiness/review gate. DR-1 remains unresolved for future real-environment bootstrap; no mapping was inferred from email, seed order or existing Admin rows. Runtime management cannot bootstrap an unmapped existing account. The new API remains dormant until a later reviewed rollout; no claim is made that legacy modules already enforce Restricted grants.

## Exact changed files

- `backend/prisma/migrations/20261108020000_administrator_access_lock/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/src/access/access-audit.ts`
- `backend/src/access/administrator-management.ts`
- `backend/src/controllers/administrator-access.controller.ts`
- `backend/src/repositories/admin-panelist.repository.ts`
- `backend/src/repositories/administrator-access.repository.ts`
- `backend/src/repositories/settings.repository.ts`
- `backend/src/routes/administrator-access.routes.ts`
- `backend/src/routes/index.ts`
- `backend/src/services/administrator-access.service.ts`
- `backend/src/services/settings.service.ts`
- `backend/tests/fixtures/administrator-management.ts`
- `backend/tests/helpers/isolated-administrator-database.ts`
- `backend/tests/integration/administrator-access-contention.test.ts`
- `backend/tests/unit/migrations/administrator-access-lock.test.ts`
- `backend/tests/unit/repositories/administrator-legacy-bypass.test.ts`
- `backend/tests/unit/repositories/settings-access-audit.test.ts`
- `backend/tests/unit/routes/administrator-access.routes.test.ts`
- `backend/tests/unit/services/administrator-access.service.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-08-faculty-4-administrator-management.md`

## Delivery and stop

Only FACULTY-4 is committed/pushed to `feat/faculty-admin-access`. No real Full bootstrap, live Restricted accounts, global Restricted enforcement, frontend/UI work or FACULTY-5 occurred during implementation.

## Independent acceptance checkpoint

- Accepted implementation commit: `33b3910e90f9008f93a5b203c113088a7e2f4d46`.
- Independent remote review inspected the actual one-commit diff from `023adef40a92ee9140c28781c379bdd7cb44b2a7`: 23 changed files, 1 commit ahead / 0 behind.
- Review confirmed the code-owned dormant management gate, current Full-Administrator revalidation after the database fence, strict DTO/capability validation, random temporary privileged credentials with forced password change, singleton InnoDB last-active-Full fence, transactional audit rollback, protected generic audit deletion, and legacy Admin-through-Panelist mutation denial.
- No blocking source/security issue was found in the reviewed FACULTY-4 diff.
- Focused verification evidence remains 16 files / 343 tests PASS with 5 opt-in real-MariaDB tests safely skipped.
- Real InnoDB contention/rollback proof remains an explicit deployment-readiness gate because no isolated MariaDB endpoint was configured; the normal XAMPP application database was not used for scratch/destructive testing.
- Manual/browser QA is not required for this acceptance checkpoint because no UI/live management rollout exists in FACULTY-4.
- Direct-access enforcement and Administrator Management remain dormant; no live Full/Restricted mapping or bootstrap is authorized.
- **FACULTY-4 is accepted for continuation. FACULTY-5 is next / not started.**

## Isolated real-MariaDB gate-closure addendum (2026-11-10)

This chronological addendum records isolated real-MariaDB verification executed on **2026-11-10 (Asia/Manila)** against branch `feat/faculty-admin-access` at verified source/test commit `9170adfc9d6fa1215c51c4278cc1dde3fa12c1ab`. It does **not** alter the historical 2026-11-08 acceptance checkpoint above, when the real-MariaDB suite was safely skipped because no isolated endpoint was configured.

### Gate and isolated environment identity

- **Package / gate:** `FACULTY-4` (Full Administrator management InnoDB serialization, actor revocation during lock wait, and transactional audit-failure rollback).
- **Database engine:** `10.4.32-MariaDB` (`D:\xampp\mysql\bin\mysqld.exe`, initialized with `mysql_install_db.exe` into a fresh workspace-only data directory `backend/.tmp/faculty4-12-gate-server/data`).
- **Network / port isolation:** `@@bind_address = 127.0.0.1`, `@@port = 33319`. Verified separate from configured application `DATABASE_URL` (`localhost:3306`, schema `/graduate_system`). The ordinary XAMPP/development database on port `3306` was never contacted or modified.
- **Harness environment configuration:** `FACULTY_4_DB_TEST=1` and explicit server-only `FACULTY_4_DB_SERVER_URL` (`mysql://<ephemeral-user>:<redacted>@127.0.0.1:33319/`, without schema name; secrets omitted).
- **Disposable schema & migration deployment:** `faculty4_test_9059844811114b0791544a9386393b85`, deployed with all 58 committed migrations via `prisma migrate deploy` using generated config under `backend/.tmp/faculty4-*`. Verified dropped in `afterAll` (`information_schema.SCHEMATA` count = `0`, `REMAINING_FACULTY4_SCHEMAS=0`), followed by clean `mysqladmin shutdown` and temporary server directory removal.

### Commands executed

From `backend/`:

- Typecheck before execution (exit `0`):
  `npx tsc --ignoreConfig --noEmit --strict --esModuleInterop --skipLibCheck --target ES2022 --module commonjs --moduleResolution node --ignoreDeprecations 6.0 --types node tests/integration/administrator-access-contention.test.ts tests/integration/faculty-12-essay-contention.test.ts`
- Real-MariaDB contention suite (exit `0`):
  `npx vitest run tests/integration/administrator-access-contention.test.ts --reporter=verbose` — **1 file / 5 tests PASS, 0 skipped, 0 failed** (duration `40.43s`, started `21:59:11`).
- Supporting migration & URL/port isolation guard suite (exit `0`):
  `npx vitest run tests/unit/migrations/administrator-access-lock.test.ts --reporter=verbose` — **1 file / 8 tests PASS, 0 skipped, 0 failed**.

### Per-case real-MariaDB evidence

| Package / Gate | Exact test / scenario (`backend/tests/integration/administrator-access-contention.test.ts`) | Expected behavior | Actual behavior & transaction / locking / rollback outcome | Result |
| --- | --- | --- | --- | --- |
| `FACULTY-4` | `serializes competing Full demote operations on real InnoDB locks` (`139ms`) | Two concurrent `service.update` demotions (`ids.a` and `ids.b` to `RESTRICTED`) serialize on `SELECT id FROM administrator_access_lock WHERE id = 1 FOR UPDATE` and ordered `ADMIN` row locks under `READ COMMITTED`; 1 succeeds, 1 rejects, and 1 active Full remains. | `Promise.allSettled` produced exactly 1 fulfilled and 1 rejected outcome; post-transaction count of active `ADMIN` users with `administratorAccess.level = 'FULL'` was `1`. Second transaction waited on real InnoDB locks, observed the committed demotion, and rolled back without violating the last-active-Full invariant. | **PASS** |
| `FACULTY-4` | `serializes competing Full disable operations on real InnoDB locks` (`77ms`) | Two concurrent `service.update(..., { isActive: false })` calls for `ids.a` and `ids.b` serialize on the InnoDB singleton fence and ordered `ADMIN` locks; 1 succeeds, 1 rejects, and 1 active Full remains. | `Promise.allSettled` produced exactly 1 fulfilled and 1 rejected outcome; post-transaction active Full count was `1`. Competing disablement serialized cleanly under real InnoDB locking. | **PASS** |
| `FACULTY-4` | `serializes competing Full remove operations on real InnoDB locks` (`91ms`) | Two concurrent `service.removeAccess` calls for `ids.a` and `ids.b` serialize on the InnoDB singleton fence and ordered `ADMIN` locks; 1 removes access + disables user, 1 rejects, and 1 active Full remains. | `Promise.allSettled` produced exactly 1 fulfilled and 1 rejected outcome; post-transaction active Full count was `1`. Concurrent authority removal preserved one active Full Administrator. | **PASS** |
| `FACULTY-4` | `rechecks a waiting actor after a committed Full revocation` (`140ms`) | Connection 1 begins a transaction, acquires `administrator_access_lock` (`id = 1 FOR UPDATE`), demotes `ids.a` to `RESTRICTED`, and holds the lock while `service.update(ids.a, ids.target, { level: "FULL" })` blocks on a pooled connection; after Connection 1 commits (~100ms), the service re-reads `ids.a` under `READ COMMITTED`, rejects with `403`, and leaves `ids.target` unchanged. | Pooled service call rejected with `{ statusCode: 403 }` after lock release; `administrator_access.level` for `ids.target` remained `'RESTRICTED'`. Proved post-fence actor revalidation against real committed InnoDB state. | **PASS** |
| `FACULTY-4` | `rolls back privileged changes when the database rejects required audit insertion` (`88ms`) | Real MariaDB trigger `faculty4_fail_audit` (`BEFORE INSERT ON audit_logs`, `SIGNAL SQLSTATE '45000'`) aborts audit insertion during `service.update(ids.a, ids.target, { isActive: false, capabilityKeys: ["students.view"] })`; transaction rolls back `users.is_active`, `account_capability_grants`, and `audit_logs` together. | `service.update` rejected as expected; `users.isActive` for `ids.target` stayed `true`, `accountCapabilityGrant.count` stayed `0`, and `auditLog.count` stayed `0`. Trigger removed in `finally`. | **PASS** |

### Readiness gate closure summary

- The **FACULTY-4 real-MariaDB contention readiness gate is now satisfied / closed** (5/5 passed on real isolated MariaDB 10.4.32, 0 skipped, 0 failed).
- All code-owned rollout/activation gates remain **`false`** (`ADMINISTRATOR_MANAGEMENT_ENABLED`, `DIRECT_ACCESS_ENFORCEMENT_ENABLED`, `OPERATIONAL_ENFORCEMENT_ENABLED`, `FACULTY_ESSAY_EVALUATION_ENABLED`). No live Full bootstrap, Restricted provisioning, or FACULTY-18 execution occurred.
