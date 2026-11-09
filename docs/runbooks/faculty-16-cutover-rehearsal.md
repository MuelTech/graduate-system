# FACULTY-16 operator preflight and isolated cutover rehearsal

Status: **FACULTY-16 implemented / pending independent review**. This runbook executes the existing [implementation plan](../superpowers/plans/2026-11-08-faculty-admin-access-implementation.md#faculty-16--operator-preflight-reconciliation-and-data-cutover-rehearsal); it does not replace it or authorize environment access.

## Scope and environment boundary

The CLI supports **synthetic, disposable, offline MariaDB rehearsal only**. It requires an explicit `FACULTY_16_DB_SERVER_URL`, a local server on a different port from `DATABASE_URL`, and a `faculty16_test_<32 lowercase hex UUID>` schema. `DATABASE_URL` is parsed only to reject the application's port; the operator code never connects to it or imports the application database singleton. There is no default database, normal-schema mode, live bootstrap switch, or HTTP route.

Do not use this command to inspect development/XAMPP, staging or production. Actual-environment inventory, an authorized production-like copy containing actual data, real identity decisions and live cutover each require separate project-owner authorization. A schema name alone does not prove that data is synthetic: create the separate server with a new data directory and use only the supplied synthetic fixture harness. Never copy the normal XAMPP data directory or point the server at it.

The tool snapshots every column/row, the committed migration ledger, table definitions, column/enum values, keys and triggers. It checks every declared foreign key, including compound keys. All tables must use InnoDB. The schema must be quiescent, with application/background writers stopped. Serializable transactions lock all table rows/ranges, and each batch revalidates the entire state before and after its allowlisted delta. This is bounded rehearsal tooling (at most 1,000 explicitly listed accounts), with full in-memory snapshots, not a large online migration service. It makes no cross-transaction filesystem-storage lock claim.

## Protected operator artifacts

Use an operator-only directory outside version control (the harness uses `backend/.tmp`). The **baseline contains full database rows, credential hashes and signed evidence** and is needed for exact restoration. Restrict the directory with OS ACLs, encrypt/back it up with the private storage copy, and do not upload it, log it, commit it, or attach it to public reports. POSIX mode `0600` is requested, but Windows permissions depend on the directory's ACL. Inventory/evidence/manifest files contain account IDs and internal metadata and also remain operator-only. Console output never prints the URL, password, baseline or signatures.

The CLI exclusively creates new baseline/evidence files. Each invocation needs a new evidence filename. An evidence file left as `IN_PROGRESS_OR_INTERRUPTED` records an incomplete attempt; recover using the unchanged baseline, manifest and DB journal. An evidence-write failure after a DB commit cannot undo that commit. Re-run with a new evidence filename and the same immutable inputs; the DB journal is authoritative. Do not recapture a partially converted database as a new baseline to bypass rejection.

## Synthetic harness

From `backend`, after creating a new local MariaDB instance with its own data directory and loopback-only port:

```powershell
$env:FACULTY_16_DB_TEST = '1'
$env:FACULTY_16_DB_SERVER_URL = 'mysql://<operator>:<disposable-password>@127.0.0.1:<separate-port>/'
$env:FACULTY_16_MYSQL_BIN = '<absolute-path-to-MariaDB-bin>'
npx vitest run tests/integration/faculty-16-cutover-rehearsal.test.ts
```

The ordinary `DATABASE_URL` need only be present for the port comparison; it is never contacted. The harness creates UUID schemas, deploys the entire committed chain into an empty schema, separately upgrades a populated pre-Faculty synthetic snapshot, checks migration redeploy, takes a real SQL dump, restores it into another disposable schema, tests reconciliation/rollback and invokes the CLI across separate processes. It drops only its exact generated schemas and validates cleanup paths. It does not run seeds, `migrate reset`, or the normal application. Its temporary fixture directory is removed after completion. Retain the sanitized hash evidence from the test log before shutting down the separate instance. Stop only the instance created for this rehearsal, by its verified data directory/port/process identity.

The independent FACULTY-4 last-Full contention and FACULTY-12 five-case essay contention harnesses are **not executed by this command**. Their readiness gates remain open until those exact separately required checks pass.

## Baseline and manifest

From a reviewed compatible checkout, run `npm run build`, then `npm run faculty:cutover:rehearse -- --help`. For a synthetic schema retained by a separately controlled rehearsal harness:

```powershell
npm run faculty:cutover:rehearse -- --schema faculty16_test_<uuid32> --capture <protected-baseline.json> --evidence <new-inventory.json>
```

The read-only inventory lists current account/profile/activity/password flags, explicit direct configuration, legacy role/feature evidence (including duplicate/unknown keys), authoritative record/actor/relationship IDs, migrations, schema evidence and per-table counts/SHA-256. Missing profiles, role/profile/activity mismatches, duplicate active Advisers, External-Adviser anomalies, pending ineligible GS-020, ADMIN/CUSTOM academic history and unapproved External committee roles are reported. Baseline snapshots carry the original role/grant mapping; history is never inferred from a current display name.

Prepare an immutable version-1 JSON manifest using the following shape. These placeholders deliberately do not form an executable approval:

```json
{
  "version": 1,
  "mode": "ISOLATED_REHEARSAL",
  "baselineDigest": "<exact inventory baselineDigest>",
  "sourceCommit": "<exact reviewed 40-character checkout HEAD>",
  "actorUserId": "<existing synthetic active ADMIN ID>",
  "approvalReference": "<explicit synthetic approval record>",
  "approvedAt": "2026-11-09T00:00:00.000Z",
  "mappings": [
    {
      "userId": "<explicit synthetic bootstrap ADMIN ID>",
      "disposition": "APPROVED",
      "decision": "<explicit synthetic DR-1 approval>",
      "target": { "role": "ADMIN", "level": "FULL", "capabilities": [], "normalizeExternalAvailability": false }
    },
    { "userId": "<unresolved synthetic account ID>", "disposition": "BLOCKED", "decision": "DR-2 unresolved / unmapped / denied" }
  ]
}
```

Every ADMIN/CUSTOM/PANELIST/FACULTY account requires exactly one disposition, including already-Faculty and inactive accounts. The first approved batch must establish an active, password-ready Full Administrator. Full derives the existing enumerated administrative catalog; no wildcard or direct `administrator_access.manage` grant is accepted. Restricted and Faculty grants pass the existing category/catalog validation; read prerequisites stay with that catalog. Faculty can receive only `essay.evaluate`, school-wide under resolved DR-3. Raw legacy feature keys are evidence and never copied or translated automatically.

An approved mapping changes only an existing account's stored role in place, inserts its exact new direct configuration and optionally changes an explicitly approved External `isAvailableAsAdviser=true` to false. It creates no accounts or profiles, resets no credentials, changes no classification/activity, merges no identities, and edits no academic relationship. Existing target metadata/grants require separate reconciliation and must be held out; this tool does not overwrite them. CUSTOM-to-Faculty requires an existing exact academic profile; missing profiles cannot be invented to pass preflight. Existing User/profile IDs, email uniqueness, credentials/flags, timestamps, `customRoleId`, CustomRole/RoleFeatureAccess rows, PanelRole values, historical actors and all signed bytes/hashes stay unchanged.

Hold out unresolved DR-1/2/4–7 cases explicitly with no target. A BLOCKED account must resolve to no configured target capabilities. Ambiguous classifications, DR-4 mixed academic/operational history, DR-5 External non-Panelist seats, DR-6 pending ineligible signed requests, DR-7 External-Adviser anomalies and duplicate active Adviser relationships block the affected mapping; the fixture/inventory retains their exact evidence. DR-2 unknown/duplicate/inactive legacy keys require explicit per-account approval of an unrelated allowlisted direct set; their values do not supply authority. No guessed aliases, account splitting, automatic Faculty designation, signature edits or relationship repairs are supported.

Blocked mappings do not certify a future live rollout: existing assignment-derived work and dormant legacy paths are preserved, and unresolved live accounts must be assessed before activation. Missing DR-1 prevents an executable manifest; preflight capture can still report the blocker. Real decisions remain unresolved in FACULTY-16's synthetic evidence.

## Dry-run, bounded apply and resume

```powershell
# Default is read-only; --dry-run is optional. Reports proposed changes separately.
npm run faculty:cutover:rehearse -- --schema faculty16_test_<uuid32> --baseline <baseline.json> --manifest <approved.json> --evidence <new-dry-run.json>

# Rehearse one account transaction, then stop deliberately.
npm run faculty:cutover:rehearse -- --schema faculty16_test_<uuid32> --baseline <baseline.json> --manifest <approved.json> --apply --max-batches 1 --evidence <new-partial.json>

# Resume with identical inputs; a complete repeat commits zero changes/audit rows.
npm run faculty:cutover:rehearse -- --schema faculty16_test_<uuid32> --baseline <baseline.json> --manifest <approved.json> --apply --evidence <new-resume.json>
```

One account is one transaction, including a deterministic protected `ACCOUNT_CAPABILITY_CUTOVER_REHEARSED` audit/checkpoint. The audit contains actor, target, approval-bound manifest hash, sequence and exact before/after state digests. Unknown/changed manifest fields, changed source HEAD, missing/forged/duplicate journal rows, schema/ledger drift, unrelated audits, new accounts, credential/access/profile/history changes or dangling FKs reject the next operation. An audit error rolls back both data and checkpoint. Lost connection before commit leaves no batch; loss after commit is recovered from the journal. Do not edit a decision string, approval timestamp, list order or manifest after a batch commits. Investigate drift; never loosen the hash check or silently accept the observed state.

The tool leaves all application gates off. It provisions only synthetic metadata in the disposable schema; it does not certify production Full/Restricted service behavior or activate Faculty grants.

## Restoration and compatible release behavior

```powershell
npm run faculty:cutover:rehearse -- --schema faculty16_test_<uuid32> --baseline <baseline.json> --manifest <approved.json> --restore --max-batches 1 --evidence <new-restore-partial.json>
npm run faculty:cutover:rehearse -- --schema faculty16_test_<uuid32> --baseline <baseline.json> --manifest <approved.json> --restore --evidence <new-restore-resume.json>
```

Restoration reverses committed batches in reverse order, restores original stored roles/External availability, removes only this manifest's added direct configuration, and appends protected restoration audits. Original audits and both rehearsal journals remain. A repeat restoration is a no-op. Forward application after restoration has begun is rejected; a new baseline/manifest requires fresh review. Offline restoration may return to the original unmapped/zero-Full baseline, so keep every application/worker entry point closed. Never use a legacy broad-ADMIN binary to serve rehearsed Restricted accounts.

Keep the accepted FACULTY/PANELIST-compatible binary for both forward and reverse states. Backend authentication already reloads current identity by token User ID: an existing PANELIST claim remains compatible with the same now-FACULTY account; stale ADMIN/CUSTOM claims never supply current privilege. The targeted session tests exercise this behavior and current Restricted metadata. For any future live cutover, stop writers and require fresh browser authentication/session refresh before reopening service so NextAuth presentation synchronizes; FACULTY-16 does not add a token-revocation/session protocol or claim owner browser acceptance.

DDL migrations are separate from data-batch restoration and may implicitly commit. Retain additive enum/tables and legacy rows; never drop FACULTY while rows use it or deploy a PANELIST-only binary. Full disaster recovery requires a consistent DB plus private-storage backup, isolated SQL restore, file/hash verification and a compatible release. This rehearsal proves synthetic SQL backup/restore and exact GS-020 renderer hashes; an actual environment/private-storage restore remains separately authorized readiness work.

## Before any future deployment

Obtain independent review of the actual pushed commit, explicit authorization for the named environment, DR-1/2 and applicable DR-4–7 approvals, all backend/frontend parity and owner QA, verified consistent DB/private-storage restore, and the exact FACULTY-4/FACULTY-12 contention evidence. Inventory the authorized application's deployed versions and all writers then; FACULTY-16 did not inspect them. Resolve or safely deny every live held-out mapping. FACULTY-17 and FACULTY-18 require separate authorization. All three named activation gates remain false in this package, and this CLI deliberately cannot execute a live cutover.
