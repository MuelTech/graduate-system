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

During the initial local-server rehearsal, schema cleanup stalled inside MariaDB; only generated disposable schemas were involved, not application tables. The test connections were cancelled and final verification moved to the isolated server. Cleanup of the initial server's remaining disposable schemas requires recovery of that local server; a restart is requested separately because it interrupts other database connections. This operational limitation does not invalidate the passing isolated migration/integrity evidence and is not reported as successful cleanup of the initial server.

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

Last-active-Full locking, grant mutation/audit writers, credential/current-actor authentication, route/service enforcement, access UI and live activation are not implemented. The configured application database has not received this migration. FACULTY-2 and all later implementation work remain untouched. Stop after the reviewed commit and push.
