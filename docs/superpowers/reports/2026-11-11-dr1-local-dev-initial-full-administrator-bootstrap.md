# DR-1 — Bounded Local-Development Initial Full Administrator Bootstrap

- **Date:** 2026-11-11 (Asia/Manila)
- **Branch:** `feat/faculty-admin-access`
- **Authorization scope:** **Local development ONLY** — explicit project-owner designation of existing account `admin@earist.edu.ph` (`role = ADMIN`) in local XAMPP `graduate_system` on `localhost:3306`.
- **Non-claims:** **NOT staging or production authorization.** Does **not** mark **FACULTY-18** accepted, does **not** perform DR-2 account conversion or Restricted Administrator provisioning, and leaves **all 9 code-owned rollout activation gates strictly `false`**.

---

## 1. Problem Resolved & Scope Boundaries

Prior to bootstrap, `admin@earist.edu.ph` in local XAMPP `graduate_system` existed as an active `ADMIN` account (`mustChangePassword = false`) with no `administrator_access` row. Because `resolveConfiguredAccountAccess` in [`account-access.ts`](../../../backend/src/access/account-access.ts#L40-L70) intentionally fails closed rather than inferring `FULL` authority from `role = ADMIN`, `GET /api/auth/me` returned:

- `configuredAccess.status = "MISSING_ADMIN_LEVEL"`
- `configuredAccess.administratorLevel = null`
- `configuredAccess.capabilities = []`

The frontend correctly displayed `"Administrator access is unavailable."` while preserving safe Dashboard and Notifications presentation.

**Explicit boundaries enforced:**

- Zero fallback or implicit `ADMIN -> FULL` inference added to runtime auth or frontend providers.
- Zero changes to [`seed.ts`](../../../backend/prisma/seed.ts).
- Synthetic/disposable [`faculty-cutover-rehearsal.ts`](../../../backend/src/cli/faculty-cutover-rehearsal.ts) tooling was **not** used against local XAMPP `graduate_system`.
- No public or runtime self-bootstrap endpoint added.
- All 9 code-owned activation flags remain literally `false` (`DIRECT_ACCESS_ENFORCEMENT_ENABLED`, `ADMINISTRATOR_MANAGEMENT_ENABLED`, `ADMISSION_STUDENT_CAPABILITY_ENFORCEMENT_ENABLED`, `EXAM_ADMINISTRATION_CAPABILITY_ENFORCEMENT_ENABLED`, `DEFENSE_ADVISER_CAPABILITY_ENFORCEMENT_ENABLED`, `PRIVATE_RECORD_ENFORCEMENT_ENABLED`, `OPERATIONAL_ENFORCEMENT_ENABLED`, `FACULTY_CONFIGURATION_ENABLED`, `FACULTY_ESSAY_EVALUATION_ENABLED`).

---

## 2. Implementation & Fail-Closed Design

Added bounded operator-invoked DR-1 tooling:

- [`backend/src/access/local-dev-full-administrator-bootstrap.ts`](../../../backend/src/access/local-dev-full-administrator-bootstrap.ts)
  - `parseLocalDevFullAdministratorBootstrapArgs`: requires explicit `--email <address>` and `--confirm-local-dev`, optional bounded `--authorization-ref`, and rejects unknown/duplicate flags.
  - `assertAuthorizedLocalDevDatabaseTarget`: parses `DATABASE_URL` without logging credentials and permits **only** `mysql:`/`mariadb:` targeting `localhost` or `127.0.0.1` on port `3306` for database `graduate_system`. Refuses non-local/staging/production URLs before any DB client initialization or query.
  - `bootstrapInitialFullAdministrator`:
    1. Acquires singleton fence `SELECT id FROM administrator_access_lock WHERE id = 1 FOR UPDATE` and locks `ADMIN` rows (`ORDER BY user_id FOR UPDATE`).
    2. Resolves exact normalized `ADMIN` identity via `accountEmailWhere(normalizedEmail, "ADMIN")`, rejecting missing (`404`) or ambiguous (`409`) matches.
    3. Verifies `role === "ADMIN"`, `isActive === true`, `mustChangePassword === false`, `panelist === null`, and `capabilityGrants.length === 0`.
    4. Returns idempotent `"ALREADY_FULL_NOOP"` with **zero writes and zero duplicate audits** if already `FULL` with zero direct grants; fails closed (`409`) on `RESTRICTED` metadata, direct grants, or another existing `administrator_access` row.
    5. Atomically inserts `administratorAccess` (`level: "FULL"`, `createdById: target.id`, `updatedById: target.id`) and a protected [`AuditLog`](../../../backend/prisma/schema.prisma#L1388-L1403) entry (`actionType: "ADMINISTRATOR_ACCESS_BOOTSTRAPPED"`, `targetTable: "administrator_access"`) without modifying `User` columns or creating any `AccountCapabilityGrant` row.
    6. Re-reads the target inside the transaction and asserts `resolveConfiguredAccountAccess` returns `status = "RESOLVED"`, `administratorLevel = "FULL"`, and complete `FULL_ADMINISTRATOR_CAPABILITIES` (`36` capabilities).
- [`backend/src/cli/bootstrap-full-administrator.ts`](../../../backend/src/cli/bootstrap-full-administrator.ts) & [`backend/package.json`](../../../backend/package.json#L22) (`admin:bootstrap-full:local-dev`).
- [`backend/tests/unit/access/local-dev-full-administrator-bootstrap.test.ts`](../../../backend/tests/unit/access/local-dev-full-administrator-bootstrap.test.ts): synthetic unit suite covering CLI parsing, local-dev target guard, credential non-leakage, pre-bootstrap `MISSING_ADMIN_LEVEL`, atomic `FULL` bootstrap + protected audit, idempotent NO-OP, audit rollback, missing fence, inactive/password-reset/non-ADMIN/pre-restricted/direct-grant/multi-admin fail-closed paths, and preserved unrelated accounts.

---

## 3. Sanitized Local `graduate_system` Pre/Post Verification (`localhost:3306`)

No credentials, connection strings, or password hashes are recorded below.

| Verification Aspect | Pre-Bootstrap (`2026-11-11`) | Post-Bootstrap (`2026-11-11`) |
| --- | --- | --- |
| Target DB identity | `mysql://localhost:3306/graduate_system` | `mysql://localhost:3306/graduate_system` |
| `administrator_access_lock` | `[{ "id": 1 }]` | `[{ "id": 1 }]` |
| Total `users` | `53` (`1` ADMIN, `29` STUDENT, `10` PANELIST, `13` APPLICANT) | `53` (`1` ADMIN, `29` STUDENT, `10` PANELIST, `13` APPLICANT) |
| Designated `User.id` | `1d592729-1e20-4e5f-becd-81ab821c8659` | `1d592729-1e20-4e5f-becd-81ab821c8659` (unchanged) |
| Email / Role / Active / MustChangePassword | `admin@earist.edu.ph` / `ADMIN` / `true` / `false` | `admin@earist.edu.ph` / `ADMIN` / `true` / `false` (unchanged) |
| Password hash SHA-256 invariance | Captured in-run in gitignored `.tmp` then removed | **Unchanged** (`passwordHashUnchanged: true`, `User.updatedAt` untouched at `2026-11-07T18:39:49.060Z`) |
| `administrator_access` rows | `0` (`null` on target) | `1` (`userId = 1d592729-1e20-4e5f-becd-81ab821c8659`, `level = "FULL"`, `createdById = updatedById = userId`) |
| `account_capability_grants` rows | `0` | `0` |
| Access `audit_logs` (`ADMINISTRATOR_ACCESS_%` / `ACCOUNT_CAPABILITY_%`) | `0` | `1` (`id = 1db11843-e05e-4b63-a6c2-223a48d2b3d7`, `actionType = "ADMINISTRATOR_ACCESS_BOOTSTRAPPED"`, `targetTable = "administrator_access"`, `bootstrapScope = "DR-1_LOCAL_DEV_ONLY"`) |
| Repeat CLI invocation | N/A | `"outcome": "ALREADY_FULL_NOOP"`, `"auditLogged": false`, `accessAuditCount` remained `1` |
| `loadCurrentAccount` + `EffectiveAccessService` | `status: "MISSING_ADMIN_LEVEL"`, `administratorLevel: null`, `capabilities: []` | `status: "RESOLVED"`, `administratorLevel: "FULL"`, all `36` `FULL_ADMINISTRATOR_CAPABILITIES` (`capabilitiesMatchFullCatalog: true`), `directAccessEnforcementEnabled: false`, `facultyWork: null` |
| Dormant management guard (`ADMINISTRATOR_MANAGEMENT_ENABLED = false`) | Returns `503` | Still returns `503` (`new AdministratorAccessService().create(...)` threw `statusCode: 503`) |

---

## 4. Verification Commands & Outcomes

1. **Synthetic tests, typecheck & build:**
   - Pre-execution 5-file focus (`npx vitest run tests/unit/access/dr1-administrator-bootstrap.test.ts tests/unit/access/account-access.test.ts tests/unit/access/account-access.store.test.ts tests/unit/access/access-contracts.test.ts tests/unit/services/administrator-access.service.test.ts`) -> **5/5 files, 104/104 tests PASS**.
   - Final broader access + admin suite (`npx vitest run tests/unit/access tests/unit/services/administrator-access.service.test.ts tests/unit/routes/administrator-access.routes.test.ts`) -> **13/13 files, 322/322 tests PASS** (0 skipped, 0 failed).
   - `npx tsc --noEmit` -> **PASS (0 errors)**; `npm run build` -> **PASS**; `git diff --check` -> **PASS**.
2. **Compiled CLI safety checks:**
   - `npm run admin:bootstrap-full:local-dev -- --help` -> **PASS (exit 0)**.
   - Missing `--confirm-local-dev` -> **PASS (refused cleanly, exit 1)**.
   - Explicit non-local target (`staging.internal:3306/staging_db`) -> **PASS (refused cleanly before DB connect, exit 1, zero credential output)**.
3. **Authorized local-development bootstrap & repeat idempotency check:**
   - `npm run admin:bootstrap-full:local-dev -- --email admin@earist.edu.ph --confirm-local-dev` (first execution) -> `outcome: "BOOTSTRAPPED"`, `auditAction: "ADMINISTRATOR_ACCESS_BOOTSTRAPPED"`, `auditLogged: true`, `resolvedStatus: "RESOLVED"`, `capabilityCount: 36`.
   - `npm run admin:bootstrap-full:local-dev -- --email admin@earist.edu.ph --confirm-local-dev` (second execution) -> `outcome: "ALREADY_FULL_NOOP"`, `auditAction: null`, `auditLogged: false`.

---

## 5. Operational Impact Note

`admin@earist.edu.ph` in local development (`localhost:3306/graduate_system`) now resolves as `FULL` Administrator on login / `GET /api/auth/me`, unblocking local Full-Administrator UI navigation and manual QA inspection (including **FACULTY-15**, **FACULTY-11**, **FACULTY-17**, and **FACULTY-17A**). All dormant mutation endpoints guarded by disabled rollout flags (including Administrator Management and Faculty Management creates/edits and Essay Evaluation) remain intentionally `503` until separate post-acceptance rollout authorization is granted.
