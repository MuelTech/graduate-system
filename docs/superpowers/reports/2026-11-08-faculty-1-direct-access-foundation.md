# FACULTY-1 — Direct-access foundation implementation

- Date: 2026-11-08 (Asia/Manila)
- Repository/branch: `MuelTech/graduate-system`, `feat/faculty-admin-access`
- Verified starting feature HEAD: `d080d9006b8820c34fbcf833087926d40532dc6a`
- Verified live main/base: `045316540d97364214792c7d441ae20a1e426d4c`; no main drift at start.
- Status: implemented; pending independent source review. Foundation only; not activated.
- Authority: [Faculty/Admin Source of Truth](../FACULTY_ADMIN_ACCESS_SOURCE_OF_TRUTH.md), [approved design](../specs/2026-11-08-faculty-admin-access-design.md), [audit](2026-11-08-faculty-admin-access-audit.md), [FACULTY-1 plan](../plans/2026-11-08-faculty-admin-access-implementation.md), and [verification policy](../ENGINEERING_VERIFICATION_POLICY.md).

## Implemented boundary

The foundation has no imports from current application routes, authentication, sessions, controllers, or workflow services. No login, frontend, route guard, existing academic authority, email surface, seed, or real account was changed. There is no grant writer, bootstrap command, access-management endpoint or preflight database scanner.

`DIRECT_ACCESS_PHASE` is `FOUNDATION_ONLY`; `DIRECT_ACCESS_ENFORCEMENT_ENABLED` is code-owned and false. `canAuthorizeDirectCapability` therefore denies even explicitly configured synthetic accounts. `resolveConfiguredAccountAccess` and `hasConfiguredCapability` inspect configuration only; they are not an authenticated actor, assignment check, or permission to activate an API. No environment variable enables enforcement. Later packages must close their backend boundaries and satisfy the reviewed activation gate before changing this state.

## Persistence

New forward migration: `20261108000000_direct_account_access`.

| Structure | Integrity and behavior |
| --- | --- |
| `AdministratorAccess` / `administrator_access` | User ID is the primary key; explicit level; creator/updater User foreign keys and timestamps. No row or access level is supplied to existing accounts. |
| `AccountCapabilityGrant` / `account_capability_grants` | Unique `(userId, capabilityKey)`; creator/updater attribution and timestamps; target/actor foreign keys restrict deletion and preserve attribution. |

The migration creates only those tables and their foreign keys. It contains no account updates, bootstrap inserts, role conversion, historical rewrite or destructive operation. UserRole, Panelist, CUSTOM/CustomRole/RoleFeatureAccess, PanelRole and academic records remain unchanged.

Admin level is stored as `VARCHAR(16) NOT NULL` with a case-sensitive SQL CHECK restricting it to `FULL` or `RESTRICTED`, and no default. A real MariaDB rehearsal caught that a non-null ENUM can implicitly supply its first value when a level is omitted; using FULL first would be unsafe. The explicit CHECK representation rejects omitted, invalid and incorrectly cased levels without inventing another access level. Prisma represents the field as String; the resolver independently validates the exact two values because Prisma does not express this SQL CHECK in its data model.

SQL constraints enforce row identity, grant uniqueness, explicit level values and referential integrity. Account-category/key compatibility is enforced by the shared validator/resolver, not by a cross-table role trigger: a misplaced metadata row or unknown/cross-category grant persisted through direct SQL grants no configured access. Future mutation services must call the validator and provide their own current-actor/transaction/audit authorization; this package introduces no configuration mutation path.

## Capability and resolver contract

- Stable typed business-action keys follow the audited catalog, with explicit same-category read prerequisites. No URL strings, wildcard authority, Program Chair, Adviser-page or committee-role permission is introduced.
- Full Administrator configuration derives only the enumerated administrative set, including `administrator_access.manage`; it never includes `essay.evaluate` or academic assignment authority.
- Restricted configuration derives only known direct administrative keys and their precise prerequisites. Full-only access management is not a direct grant to Restricted.
- Configured Faculty access contains only `essay.evaluate`, with school-wide meaning. No Faculty-to-Program relation, scope field or Program predicate is added. Essay eligibility, queue and grading integration are FACULTY-12 work.
- The foundation classifies the existing PANELIST identity as the academic account category internally. It does not add/convert FACULTY UserRole or update existing identity checks; that compatibility reader work remains FACULTY-3.
- Missing/inactive users, unsupported roles, missing/inactive academic profiles, missing/invalid Admin levels, misplaced metadata, malformed/duplicate/unknown/wrong-category grants fail closed. Unknown prototype names such as `__proto__` do not pass key validation.
- `readConfiguredAccountAccess` takes an injected Prisma client/transaction, reads the exact User ID with a narrow select, and never imports the auto-connecting application database singleton. It reads no password, email, custom-role grant or workflow record. Missing schema/connection returns a denied `UNAVAILABLE` result, with no legacy ADMIN fallback or cached authority. Repeated calls reread persisted configuration.

## Audit and operator foundation

Protected audit namespaces are `ADMINISTRATOR_ACCESS_` and `ACCOUNT_CAPABILITY_`. Typed events cover Administrator creation, level/status change, approved future bootstrap, and capability grant/revoke. Event shape requires actor, target, time and before/after state. The protection classifier also recognizes future actions in those namespaces.

This is a taxonomy/classification foundation only. It does not write events or modify current audit deletion endpoints. Atomic mutation audit and actual deletion protection remain FACULTY-4; no claim of live audit-retention enforcement is made here.

`AccessPreflightInventory` defines a read-only versioned format for account/profile flags, observed direct keys, legacy role/feature evidence, migration names, table counts/identity digests and anomaly references. It contains no credentials, raw signatures, Program evaluator assignments or proposed automatic grants. Unknown legacy keys stay observations. `createAccessPreflightTemplate()` explicitly returns `NOT_COLLECTED`, not a misleading empty inventory. No live preflight was run and no real account mapping was chosen.

## Verification evidence

| Check | Result |
| --- | --- |
| Focused unit/catalog/resolver/store/audit/preflight and migration-boundary tests | 97 passed |
| Opt-in real MariaDB migration/integrity tests | 9 passed |
| Combined focused run | 6 files / 106 tests passed / 0 failed / 0 skipped |
| Prisma Client generate and schema validate | Passed |
| Offline Prisma schema diff against starting HEAD | Only the two new tables/FKs; migration adds the deliberate level CHECK |
| Backend production TypeScript build | Passed |
| Focused source/test TypeScript validation | Passed |
| Diff/reference/scope/whitespace checks | Passed before commit |
| Browser/manual QA | Not executed; owner responsibility |
| Hosted CI | Not executed/observed for this task |

The real-DB tests deploy the entire committed pre-foundation migration chain into a random disposable schema, insert synthetic identities/legacy role/profile/Adviser/Defense/audit evidence, snapshot every pre-existing business table, deploy the new migration and assert identical old-table digests. They prove zero automatic access rows, redeploy idempotency, unique keys, six foreign-key paths, rejected missing/invalid levels, protected User references, persisted configuration resolution and revocation reads. Invalid SQL category/key data is explicitly tested as denied by the resolver.

The passing final rehearsal used a separately initialized, loopback-only temporary MariaDB instance; its test schemas were removed and absence checked. The test requires both `FACULTY_1_DB_TEST=1` and an explicit server-only `FACULTY_1_DB_SERVER_URL`; it never falls back to application DATABASE_URL or `.env`, and rejects a URL naming an application schema. Default runs skip the database suite.

During the initial local-server rehearsal, schema cleanup stalled inside MariaDB; only generated disposable schemas were involved, not application tables. The test connections were cancelled and final verification moved to the isolated server. At original completion, cleanup of the initial server's remaining disposable schemas required recovery of that local server; a restart was requested separately because it interrupts other database connections. This operational limitation did not invalidate the passing isolated migration/integrity evidence and was not reported as successful cleanup of the initial server. The later owner-rebuilt environment and authorized development-database setup are recorded below; this continuation does not claim to have repaired the previous InnoDB files.

## Changed files

- [Prisma schema](../../../backend/prisma/schema.prisma)
- [Forward migration](../../../backend/prisma/migrations/20261108000000_direct_account_access/migration.sql)
- [Capability catalog](../../../backend/src/access/capability-catalog.ts)
- [Configured-access resolver and inactive enforcement boundary](../../../backend/src/access/account-access.ts)
- [Injected read store](../../../backend/src/access/account-access.store.ts)
- [Audit taxonomy](../../../backend/src/access/access-audit.ts)
- [Preflight format](../../../backend/src/access/access-preflight.ts)
- [Catalog tests](../../../backend/tests/unit/access/capability-catalog.test.ts)
- [Resolver tests](../../../backend/tests/unit/access/account-access.test.ts)
- [Read-store tests](../../../backend/tests/unit/access/account-access.store.test.ts)
- [Audit/preflight tests](../../../backend/tests/unit/access/access-contracts.test.ts)
- [Migration boundary test](../../../backend/tests/unit/migrations/direct-account-access.test.ts)
- [Real database tests](../../../backend/tests/integration/direct-account-access.test.ts)
- This implementation report.

## Remaining decisions and stop

No product-policy blocker was discovered for FACULTY-1. DR-3 is resolved: Essay Evaluation is school-wide. Actual Full bootstrap, CUSTOM mappings, dual-account identifiers and Adviser/External edge policies remain with their planned later packages; no real data was queried or mapped to resolve them here.

Last-active-Full locking, grant mutation/audit writers, credential/current-actor authentication, route/service enforcement, access UI and live activation are not implemented. At original completion, the configured application database had not received this migration; the authorized recovery continuation below supersedes that environment status. FACULTY-2 and all later implementation work remain untouched. Stop after the reviewed commit and push.

## Recovery continuation — 2026-11-08

### Reconciliation before database work

- Starting branch: `feat/faculty-admin-access`.
- Starting HEAD: `1208e45d73447450db9b6e3f7b785c191f0fe5bd`, also independently verified as the remote feature-branch HEAD before continuation.
- Working tree and index: clean; no staged or unstaged changes to recover, discard or recreate.
- Recent history already contained the FACULTY-1 implementation commit above, following the approved scope clarification at `d080d9006b8820c34fbcf833087926d40532dc6a`.

| FACULTY-1 requirement | State on resumption | Continuation |
| --- | --- | --- |
| Typed capability catalog/categories and precise prerequisites | Completed | Preserved unchanged |
| Additive direct-grant/Admin-level storage, constraints and forward migration | Completed | Preserved unchanged; deployed committed migration as part of authorized local setup |
| Fail-closed resolver/read store and dormant activation boundary | Completed | Preserved unchanged; focused checks rerun |
| Protected access audit/event taxonomy | Completed | Preserved unchanged |
| Read-only operator/preflight format | Completed | Preserved unchanged; no live preflight collection |
| Focused foundation tests and previous isolated rehearsal evidence | Completed | 97 non-destructive checks rerun; historical isolated results retained as historical evidence |
| Rebuilt local development database deployment, seed and application connectivity | Not yet verified | Completed after resolving the missing database with explicit owner authorization |

No partially implemented or missing FACULTY-1 production-code requirement was found. This continuation completed environment setup, verification and reporting only; it did not restart implementation.

### Database target, authorization and results

Verified active configuration: **host `localhost`, port `3306`, database `graduate_system`**. Passwords, credential values and full connection URLs are omitted.

The first requested `npx prisma migrate deploy` failed with an empty schema-engine error. A bounded connection diagnostic established `ER_BAD_DB_ERROR` / SQLSTATE `42000`: MariaDB was running, but `graduate_system` was absent. No seed or database creation was attempted before clarification because the owner's instructions prohibited recreating that database.

The owner then explicitly authorized: **Create empty graduate_system, then migrate and seed**. The continuation verified normal recovery mode (`0`) and used `CREATE DATABASE IF NOT EXISTS` for only that exact intended database, then executed the requested commands. No existing database was dropped or reset.

| Recovery check | Result |
| --- | --- |
| `npx prisma migrate deploy` after authorized database creation | Passed; all 54 committed migrations applied, including `20261108000000_direct_account_access` |
| `npx prisma db seed` | Passed, exit code 0; invoked the unchanged configured `ts-node prisma/seed.ts` command; fixture credentials suppressed from output |
| Seed safety inspection | Existing fixture creation/upserts; no reset, database drop or destructive schema recreation required |
| `npx prisma migrate status` | Passed; schema up to date |
| Prisma/application database-module connection | Passed using the built application's existing `dist/config/database` module and a read-only query against `graduate_system` |
| Migration ledger | 54 finished, 0 unfinished |
| Seeded User count | 53 |
| Direct-access rows after seed | `administrator_access = 0`, `account_capability_grants = 0` |
| Server recovery mode | 0 |
| `npx prisma generate` / `npx prisma validate` | Passed |
| Focused access/migration-boundary tests | 5 files / 97 passed / 0 failed |
| `npm run build` in backend | Passed |
| Disposable/full-chain destructive rehearsal | **Not executed during continuation due to environment isolation requirements**; no separate isolated destructive-test environment was configured |
| Manual/browser QA and hosted CI | Not executed/claimed for this continuation |

The normal development database received only the explicitly authorized committed migration deployment and existing project seed. No `faculty1_test_*` or other disposable schemas were created/dropped, no reset/force-reset was run, and no XAMPP data-directory files, shared tablespaces or redo-log files were manually modified. The isolated rehearsal tests were not run against the development database.

### Delivery and remaining work

The only repository file changed by this continuation is this implementation report. All existing implementation, schema, migration, seed and test files remain unchanged. The final diff is limited to recovery reconciliation and current verification evidence; the ending commit is reported after commit/push rather than embedded self-referentially here.

No FACULTY-1 implementation or local database-readiness blocker remains. Independent source review and owner QA remain their separate acceptance activities. Direct-access enforcement stays off, and no live Full/Restricted Administrator or Essay Evaluation access was granted. FACULTY-2 was not started.


## Independent review safety correction — 2026-11-08

After FACULTY-1 source review, the opt-in real-MariaDB migration test was hardened so a future run cannot use the same MariaDB server as the configured application database merely by supplying a server-only URL. The test now loads the application's `DATABASE_URL`, canonicalizes local loopback aliases, and rejects `FACULTY_1_DB_SERVER_URL` when its host+port matches the application database server. A separate local port/server is required for the destructive disposable rehearsal.

Three non-database guard cases cover same-server rejection across loopback aliases, acceptance of a different local port, and rejection of a test URL that names a schema. This correction changes test safety only; it does not alter production schema, access behavior, migration contents, application database data, or FACULTY-1 activation state. No destructive database rehearsal is required for this correction.
