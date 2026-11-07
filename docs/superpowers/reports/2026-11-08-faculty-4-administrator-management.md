# FACULTY-4 — Full Administrator management service and safeguards

Date: 2026-11-08 (Asia/Manila). Status: **IMPLEMENTED — independent review/acceptance pending**.

This package implements backend foundation only. Administrator management remains disabled in production composition. No live Full bootstrap, Admin conversion, Restricted provisioning/rollout, UI, Faculty management/essay work, or FACULTY-5 occurred.

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

Only FACULTY-4 is committed/pushed to `feat/faculty-admin-access`. The ending commit and verified remote parity are reported in the delivery message rather than embedded as a self-referential SHA. Checklist/plan mark implementation pending independent review only. No real Full bootstrap, live Restricted accounts, global Restricted enforcement, frontend/UI work or FACULTY-5. **Stop after delivery.**
