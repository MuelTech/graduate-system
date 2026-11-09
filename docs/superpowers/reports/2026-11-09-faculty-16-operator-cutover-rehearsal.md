# FACULTY-16 — Operator preflight, reconciliation and data-cutover rehearsal

Date: 2026-11-09 (Asia/Manila). Repository: `MuelTech/graduate-system`. Branch: `feat/faculty-admin-access`.

**Status: FACULTY-16 implemented / pending independent review.** No independent acceptance or activation is asserted. FACULTY-17 and FACULTY-18 were not implemented.

## Verified baseline and scope

Actual remote HEAD was verified with `git ls-remote origin refs/heads/feat/faculty-admin-access` as **`d4141dcdc46843f815811b1995c9542a8c978c31`**, matching the required starting HEAD. The clean local branch was behind at `60e559568b4a368666e5cd42fde64eeb3ec29daf`; it was fetched and fast-forwarded to the verified starting commit before editing. No applicable AGENTS.md was found in the repository/inspected ancestors. No replacement implementation plan was created.

Reconciled the current canonical source of truth, design, existing implementation plan (especially sections 4–7), checklist and Engineering Verification Policy with the current catalog, access/audit/preflight contracts, Prisma schema/migrations and auth compatibility. Consulted the FACULTY-0 audit required by the plan and the directly relevant FACULTY-1/3/4/10/12/15 dependency reports for migration/isolation, original preflight contract, Full safeguards, academic conflict behavior and readiness limitations. Unrelated historical reports were not used to broaden the task.

This package adds operator-only synthetic/disposable tooling, focused tests, a sanitized evidence artifact and the [operator/deployment runbook](../../runbooks/faculty-16-cutover-rehearsal.md). It changes no application runtime route, frontend/browser surface, capability catalog, resolver, schema, migration, auth protocol or gate. No normal application DB connection, inventory, migration, reset, reseed, reconciliation or cutover was performed. Environment URL parsing for isolation is not a DB connection.

## Manifest, preflight and reconciliation

- The CLI defaults to dry-run and requires a separate explicit local server/port plus a UUID-named `faculty16_test_*` schema. No actual-environment mode exists. New inventory capture is read-only. Baseline/evidence files use exclusive creation and protected-directory guidance; errors/console output do not print credentials or signed evidence.
- The protected baseline captures every column/row, original identity/grant configuration, migration ledger, actual schema/enum/key/trigger definitions. The read-only report exports account/profile/credential-state flags, direct configuration, raw legacy-role/feature observations, authoritative actor/relationship/record IDs, table counts/digests and anomalies. Every actual FK is checked, including compound keys. The foundation's existing version-1 uncollected template remains unchanged; this runner reports its separate `COLLECTED_SYNTHETIC_REHEARSAL` capture status honestly.
- A version-1 manifest binds exact source HEAD, baseline SHA-256, operator, approval reference/time and every affected account's ordered explicit APPROVED/BLOCKED disposition. There is no legacy feature-key translator, automatic bootstrap candidate, default evaluator or account generator. Catalog/category/duplicate/unknown/high-privilege checks reuse the accepted catalog. The first approved batch must establish active, credential-ready Full; the final projected state also requires one. Unknown manifest fields and ambiguous classifications are rejected.
- Each account change is one serializable transaction. Full snapshots/ranges are locked, validated against the baseline plus the exact journal prefix, changed through a small SQL allowlist, checked again, and committed with a deterministic protected audit checkpoint. A failure during the audit write rolls back access and checkpoint together. This is offline bounded rehearsal; it does not claim online-migration scalability or prove FACULTY-4/12 application contention races.
- Approved PANELIST→FACULTY conversion preserves the same User/profile/credential/relationship identities. Approved CUSTOM→ADMIN uses an explicitly supplied direct capability set while retaining `customRoleId`, CustomRole and legacy feature evidence. CUSTOM→FACULTY requires an existing exact profile; missing identity/profile/classification is never invented. Existing target grants/metadata require separate reconciliation and are rejected for overwrite. Explicit External availability normalization can only change true→false; it never reclassifies a Faculty member or repairs an assignment.
- The journal is authoritative across process/connection interruption. A repeated complete apply or restoration adds no changes or audit rows. Source/manifest/approval, schema/ledger, credential/identity, relationship/history, new-account, original-audit or journal drift rejects progress. An interrupted output file cannot get ahead of a committed DB checkpoint. The checkpoint's `old_value` hashes the full pre-batch state; `new_value` hashes post-data-change state before appending that same audit event, avoiding a recursive self-hash. The full post-commit digest is separately reported in integrity evidence.
- Restoration reverses only committed mappings, in reverse order, restores original roles/availability and removes only this manifest's newly inserted access/grants. Both apply/restoration audits and all original history remain. Applying again after restoration begins is denied. Offline restoration may return to the original zero-Full/unmapped baseline; all entry points remain closed. No enum/table contraction or old PANELIST-only release rollback is allowed.

## Decisions and held-out mappings

**Real DR-1, DR-2 and applicable DR-4–7 remain unresolved/uninspected.** DR-3 remains resolved and was not reopened. The synthetic fixture's named `operator` is test evidence only, not a proposed actual initial Full Administrator. Its explicit Restricted/evaluator decisions do not approve any real person or legacy key equivalence.

The real-DB fixture has six synthetic User identities: one explicitly approved Full bootstrap, one explicitly approved CUSTOM→Restricted mapping, two in-place PANELIST→FACULTY mappings (one explicit External availability normalization), one blocked/unmapped CUSTOM and one unchanged Student. The blocked CUSTOM remains CUSTOM with no target capabilities; its unknown/duplicate legacy feature rows remain intact. Unit cases additionally prove hold-out/rejection for DR-5 External non-Panelist assignments, DR-6 pending ineligible signed requests, DR-7 External-Adviser anomalies and duplicate active Advisers. The inventory reports ADMIN/CUSTOM academic history as DR-4 conflict. No dual-account identifiers, classification changes, External committee expansion, signed-request recovery or academic repairs are inferred.

Blocked accounts receive no new configured authority. This does not certify live activation: assignment-driven historical/current work and dormant legacy paths remain preserved, and each actual held-out account requires a separately authorized environment decision before rollout.

## Exact isolated database evidence

The [machine-readable evidence](evidence/2026-11-09-faculty-16-rehearsal.json) records every table's exact before/after row count and SHA-256, plus the summary below. Values are from synthetic data only; no real names/emails/credentials/signatures appear in the committed artifact.

Executed against **MariaDB 10.4.32**, a fresh workspace data directory and dedicated loopback-only process at port **33316**, separate from the application's configured port. No normal XAMPP data directory was opened by that process. The harness used three UUID-named schemas, verified their removal, and the separate process was shut down after verification. Ignored local logs/data-directory artifacts are not tracked deliverables.

| Evidence | Observed result |
| --- | --- |
| Empty-schema full committed chain | 56 migrations deployed; zero automatic User/Admin/grant bootstrap |
| Populated pre-Faculty snapshot upgrade | Pre-existing business rows unchanged through additive migrations; redeploy reports no pending migrations |
| Full snapshot boundary | 73 InnoDB tables, actual schema/ledger/FKs; zero dangling declared FKs |
| Accounts/profiles | User count 6→6; profile count 2→2; User/profile IDs and all unapproved fields unchanged |
| Approved mapping delta | Two PANELIST→FACULTY, one CUSTOM→Restricted ADMIN, one explicit External availability true→false |
| Admin metadata / grants | 0→2 / 0→2; Restricted gets only `students.view`, Faculty gets only `essay.evaluate`; Full enumerates the existing Admin catalog |
| Journals | Original 1 audit row retained; 4 apply events added; 4 restoration events added; repeat calls add zero |
| Interrupt/resume | Commit/disconnect/reconnect and separate CLI processes resume from one committed account; no duplicate grants/audits |
| Failure/drift | Real audit trigger error rolls back both access/checkpoint; real credential drift prevents restoration until the exact synthetic original is restored |
| Reversal | Four reverse batches across disconnect; exact baseline business digest after excluding appended journals; repeat restoration no-op |
| SQL backup/restore | Real `mysqldump --single-transaction` restored into another isolated schema; complete snapshot/ledger match (schema identity adjusted only for comparison) |
| Signed/history preservation | Existing active Adviser, inactive contextual Panelist assignment, signed/final GS-020, GS-017 issuer/reviewed manuscript, historical Admin grader, legacy features and audit actor rows retain exact digests |
| Historical output | Existing GS-020 renderer consumes the unchanged frozen synthetic display snapshot; before/apply/restoration/SQL-restore PDF SHA-256 remains `19792406d9b7bcffe72415797d388f855d164ba28d68939f2a4737b14a68b8da` |

This is an actual isolated synthetic migration/data/SQL-restore rehearsal. It is not a production-like snapshot of actual data, a complete actual private-storage restore, hosted CI, project-owner acceptance, or real application lock-race proof. Those remain separately authorized evidence.

## Session and rollback compatibility

New targeted tests compose the rehearsed state with the existing actual authentication middleware. The same User's legacy PANELIST token resolves to current FACULTY, and stale ADMIN claims cannot preserve Admin authority. Converted CUSTOM resolves only its explicit Restricted metadata; blocked CUSTOM remains without target access even with a stale Admin claim. Existing login/current-account tests cover current credential flags and role selection. No auth/session production code was changed. The runbook requires a compatible dual-identity binary and fresh browser authentication/session refresh before any future authorized reopening; owner browser QA is not claimed.

## Verification classes and exact commands

Focused affected automated regression (from `backend`):

```powershell
npx vitest run tests/unit/access tests/unit/middlewares/auth.middleware.test.ts tests/unit/services/auth.login.test.ts tests/unit/repositories/settings-access-audit.test.ts tests/unit/services/adviser-request-record.service.test.ts tests/unit/documents/official-defense/adviser-request.renderer.test.ts tests/unit/migrations/direct-account-access.test.ts tests/unit/migrations/faculty-3-enum-expansion.test.ts
```

**15 files / 363 tests passed, zero failures/skips.** This bounded set covers manifest/catalog/configured denial, protected audit evidence, current-account compatibility, retained records/rendering and additive migration boundaries. No unrelated full suite was run. Final source review tightened first-bootstrap credential readiness and timestamp validation; the affected two new suites were then rerun: **2 files / 53 tests passed**, zero failures/skips. These overlapping totals are not added together.

Isolated real MariaDB (environment setup in runbook):

```powershell
npx vitest run tests/integration/faculty-16-cutover-rehearsal.test.ts --reporter=verbose
```

**1 file / 8 tests passed**, zero failures/skips. Includes actual CLI processes. Early fixture setup attempts exposed a wrong CONFORMED enum, a missing document date/type and a pooled Buffer issue in fixture logo loading; these were corrected and the final 8-case run passed. Focused TypeScript checking now includes the integration fixtures to catch these schema mismatches before execution. The final two validation-only guards were checked by the final unit/build pass; no redundant full DB cycle was run after that tightening.

Static/build:

```powershell
npm run build
npx tsc --ignoreConfig --noEmit --strict --esModuleInterop --skipLibCheck --target ES2022 --module commonjs --moduleResolution node --ignoreDeprecations 6.0 --types node tests/integration/faculty-16-cutover-rehearsal.test.ts tests/unit/access/faculty-16-cutover.test.ts tests/unit/access/faculty-16-cutover-session.test.ts
git diff --check
```

Backend build, focused source/fixture typecheck and diff checks **PASS**. No production schema or migration changed; no ordinary Prisma deployment/generation/reset was required or executed. No frontend build/lint/browser QA was needed because no browser surface changed. The existing Vite CommonJS/native-loader warning remains unchanged.

- **Hosted CI:** not observed/claimed.
- **Project-owner manual/browser/visual QA:** NOT EXECUTED / not recorded as PASS.
- **Independent remote source review:** PENDING.
- **FACULTY-4 real last-Full contention readiness:** OPEN; exact harness not executed.
- **FACULTY-12 five-case real essay/access contention readiness:** OPEN; exact harness not executed.
- **Activation:** `ADMINISTRATOR_MANAGEMENT_ENABLED`, `DIRECT_ACCESS_ENFORCEMENT_ENABLED`, `OPERATIONAL_ENFORCEMENT_ENABLED` remain unchanged and false. No real provisioning or development/staging/production cutover.

## Exact changed files and delivery

13 files, including this report and the two status-only canonical updates:

1. `backend/package.json`
2. `backend/src/access/cutover-rehearsal.ts`
3. `backend/src/access/cutover-rehearsal.database.ts`
4. `backend/src/cli/faculty-cutover-rehearsal.ts`
5. `backend/tests/fixtures/faculty-16.ts`
6. `backend/tests/unit/access/faculty-16-cutover.test.ts`
7. `backend/tests/unit/access/faculty-16-cutover-session.test.ts`
8. `backend/tests/integration/faculty-16-cutover-rehearsal.test.ts`
9. `docs/runbooks/faculty-16-cutover-rehearsal.md`
10. `docs/superpowers/reports/evidence/2026-11-09-faculty-16-rehearsal.json`
11. `docs/superpowers/reports/2026-11-09-faculty-16-operator-cutover-rehearsal.md`
12. `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
13. `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`

The containing commit is the ending implementation HEAD; its exact SHA, clean worktree and local/actual-remote parity are reported after commit/push to avoid a self-referential commit ID. Push only to `feat/faculty-admin-access`; do not merge to main. Stop after FACULTY-16.
