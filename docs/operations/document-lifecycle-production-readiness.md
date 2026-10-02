# Document Lifecycle — Production Readiness and Legacy Backfill

Status: Operations guide for the DL-0…DL-12 Document Lifecycle packages.
Scope: EARIST Graduate School Information System (GS-IS), single-node private local storage.

> Backfill and verification tools are **read-only by default**. The backfill only
> adds storage metadata that points at the existing contained physical object; it
> never copies, moves, renames, deletes, or re-promotes files, and it never
> removes `filePath`. Retention/deletion policy remains unresolved.

## 1. Pre-deploy requirements

1. `UPLOAD_DIR` points to persistent, service-owned private storage outside the
   release/webroot (production startup fails closed otherwise).
2. The database schema is up to date for this application version.
3. Application version / branch recorded (for the deployment record).
4. A consistent backup of **database + private storage** has been taken
   (`docs/operations/storage-backup-restore.md`).

## 2. Migration status

- DL-1 already added the nullable storage-metadata columns; **DL-12 adds no
  schema change and no migration**.
- Historical migrations are forward-only and untouched.
- Verify with `npx prisma validate` and `npx prisma generate`.
- Fresh-database `prisma migrate deploy` replay is desirable where a disposable
  database exists; otherwise record it as `NOT EXECUTABLE`.

## 3. Backfill scope

Only two models are backfill targets (they already carry the DL-1 metadata):

```text
CorUpload
ThesisDocument
```

All other `filePath` / `signaturePath` / `fullPaperPath` / `respondentDataPath`
fields are legacy-only "storage debt": the readiness verifier **counts** them
but nothing mutates them. In particular `ELibrary.respondentDataPath` is never
read, exposed, migrated, or made downloadable.

## 4. Dry-run procedure (safe, default)

```bash
cd backend
npm run build
npm run storage:backfill            # DRY RUN — no DB writes
```

Review the report: inspected vs eligible vs skipped-by-reason
(`MISSING`, `UNSAFE`, `INVALID_DERIVED_STORAGE_KEY`, `METADATA_CONFLICT`).
Investigate skipped rows before applying. Raw paths, keys, and filenames are
never printed.

## 5. Backup prerequisite

Take a consistent DB + document-storage backup **before** any apply. The
application cannot verify the backup for you; this is an operator precondition.

## 6. Apply procedure

```bash
cd backend
npm run storage:backfill:apply       # node dist/cli/storage-backfill.js --apply
```

Apply is:

- conditional (`id` + `storageKey IS NULL` + same `filePath`) so a concurrently
  modified row is reported as `RACE_OR_ALREADY_MIGRATED`, never overwritten;
- idempotent (a second run finds no candidates);
- metadata-only (derives `storageKey`, `storageProvider`, `sizeBytes`,
  `checksum`, `checksumAlgorithm` from the actual object);
- never overwriting conflicting non-null metadata (`METADATA_CONFLICT`);
- preserving `CorUpload.originalFilename` / `detectedMimeType` and never
  inventing `uploadedById`, `verifiedMimeType`, or version/authority fields.

## 7. Operator sequence

```text
1. verify application version / branch
2. verify persistent UPLOAD_DIR
3. take consistent DB + storage backup
4. run backfill DRY RUN
5. review skipped/conflict rows
6. run APPLY only after review
7. rerun DRY RUN (expect no eligible rows)
8. run the readiness verifier / integrity scan
9. perform representative authorized retrieval tests
10. retain legacy filePath compatibility
```

Do **not** delete old files after backfill.

## 8. Post-backfill verification

```bash
cd backend
npm run storage:readiness            # node dist/cli/storage-readiness.js
```

Exit code `0` = no blocking technical errors; non-zero = blocking errors.
Warnings (orphans, duplicate references, provider mismatch, pending backfill,
capacity threshold unset, backup integration unavailable, rehearsals not
executed) do not by themselves fail.

## 9. Regression commands

```bash
cd backend
npm test
npx tsc --noEmit
npm run build
npx prisma validate
npx prisma generate
```

## 10. Persistence verification

An automated test proves a promoted managed object survives provider
recreation against the same root (`tests/unit/storage/persistence.rehearsal.test.ts`).

An **actual deployment restart rehearsal** (record object → restart/redeploy →
verify authorized retrieval) requires a safe disposable environment. If none is
available, it is `NOT EXECUTABLE` — do not fabricate it.

## 11. Backup / restore rehearsal

Follow `docs/operations/storage-backup-restore.md`. A real rehearsal requires an
isolated DB + storage environment. If none exists it is `NOT EXECUTABLE`. The
documented procedure is **not** itself a successful rehearsal.

## 12. Rollback / safe-stop conditions

- Backfill does not move or delete files and leaves `filePath` intact, so the
  primary rollback is: **restore the database backup** if needed.
- Stop before apply if the dry run shows unexpected `METADATA_CONFLICT` or
  `UNSAFE` rows, or if the backup prerequisite is not met.
- There is no automated "undo" that nulls storage metadata; do not write one.
- The backfill is not exposed in the Admin UI and is never run automatically.

## 13. Remaining legacy storage debt

The readiness verifier reports counts for legacy-only path models
(`StudentRequirement`, `PlagiarismResult`, `RapReport`, `AdviserCertification`,
`StatisticianCertification`, `GrammarianCertification`, `ResearchVariableForm`,
`ExpertEvaluation`, `StudentFile`, `ManuscriptDistribution.signaturePath`,
`ELibrary.fullPaperPath`, `ELibrary.respondentDataPath`). These are tracked as
debt; no migration into the managed model is performed here.

## 14. Unresolved policy dependencies

These are not software regressions and not invented by DL-12:

- DL-5 authoritative EARIST COR parser sample (native extraction + manual review
  remain functional);
- post-Final archival manuscript/correction policy;
- Repository full-text/download policy;
- respondent/instrument access policy;
- retention/deletion periods;
- malware/CDR requirement/provider;
- exact Master's evaluator count; rating formula; re-defense policy.
