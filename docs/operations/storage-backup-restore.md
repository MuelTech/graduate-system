# Storage Backup and Restore (Single-Node Private Local Storage)

Status: Operations guide for the current Document Lifecycle storage model.
Scope: EARIST Graduate School Information System (GS-IS), single-node deployment.

> This document describes an operational procedure. It does not define retention
> or deletion policy, which remains unresolved. The DL-11 storage health tooling
> is **read-only** and never deletes, repairs, moves, or backfills anything.

## 1. What must be backed up

A complete, recoverable backup must include **BOTH**:

```text
1. the database (MySQL/MariaDB)
+
2. the private document storage tree
```

Either one alone is insufficient:

- restoring only the database leaves managed document rows pointing at missing
  objects;
- restoring only the files leaves orphaned physical objects with no metadata,
  ownership, or workflow authority.

## 2. Where private storage lives

`UPLOAD_DIR` is the configured private storage root. The provider and keys are
implementation details and are never exposed as public URLs.

1. Verify `UPLOAD_DIR` points to a **persistent, service-owned** directory:
   - outside the application release directory;
   - outside any public/static webroot;
   - not a disposable build directory.
2. In production `UPLOAD_DIR` is **required**; startup fails closed if it is
   unset or resolves to a forbidden location.
3. Direct `/uploads/...` access remains blocked; documents are served only
   through authorized application endpoints.

## 3. Consistency strategy

Do **not** assume that independently copying the database and the storage tree at
arbitrary, different times produces a consistent backup. For the current
single-node deployment, use one of:

```text
Option A (simple, brief write pause):
  put the application into maintenance / pause writes
  -> back up the database
  -> snapshot/copy the private storage tree
  -> resume writes

Option B:
  use deployment-native consistent snapshot tooling that captures the database
  and the storage volume together
```

Choose whichever your deployment actually supports. Do not treat an arbitrary
`cp` of both paths at different times as consistent.

## 4. Example commands (adapt to your deployment)

These are **examples only**. They contain no real hostnames, credentials, or
user-specific paths and must be adapted to your environment.

```bash
# Example: database dump (adapt host/user/database names)
mysqldump --single-transaction --routines --triggers <DB_NAME> > graduate_db.sql

# Example: private storage archive (adapt UPLOAD_DIR)
tar -czf graduate_storage_backup.tgz -C "$UPLOAD_DIR" .
```

Notes:

- Prefer a transactionally consistent database dump.
- Record a checksum of each backup artifact where tooling supports it.
- Store backups in a location with the same (or stronger) confidentiality as the
  live data. Backups contain private documents and personal data.

## 5. Protect backup confidentiality

- Encrypt backups at rest where supported.
- Restrict access to the backup location to the service/operations account.
- Do not commit backups, dumps, or archives to the repository.
- Do not paste backup contents or credentials into tickets or chats.

## 6. Verify a backup

Before relying on a backup:

1. Confirm the archive/dump is readable and not truncated.
2. Confirm the database dump contains the expected schema/tables.
3. Confirm the storage archive contains the managed namespaces (`cor`,
   `manuscripts`, `evidence`, `instruments`) and is not empty.
4. Verify checksums where recorded.

## 7. Restore procedure

Perform restores in an **isolated** environment first.

```text
1. Restore the database from the dump.
2. Restore the private storage tree to the configured private root (UPLOAD_DIR).
3. Verify filesystem ownership and permissions (service account, minimum needed).
4. Start the backend in isolated/test mode.
5. Run the DL-11 integrity scan (Admin -> Storage Health -> Run Integrity Scan).
6. Verify representative authorized document retrieval through the documents API.
7. Verify direct /uploads access is still blocked.
8. Only then perform production cutover.
```

### Migration note

Run Prisma migrations only as appropriate for the deployment. A backup produced
at a given schema version should be restored to a build that understands that
schema; apply forward migrations deliberately, not blindly.

### Integrity scan after restore

The DL-11 scan reports (read-only):

```text
INVALID_STORAGE_KEY / PROVIDER_MISMATCH / MISSING_OBJECT /
SIZE_MISMATCH / CHECKSUM_MISMATCH / DUPLICATE_REFERENCE /
ORPHAN_MANAGED_OBJECT / SYMLINK_DETECTED /
LEGACY_FILE_MISSING / LEGACY_FILE_UNSAFE
```

A restore is not complete until the scan shows no unexpected missing objects.
The scan never repairs or deletes; reconciliation belongs to an explicitly
reviewed maintenance operation (DL-12 or later).

## 8. Multi-instance warning

```text
Node-local private filesystem is appropriate only for the current single-node
model.
```

If the application becomes multi-instance or stateless, shared/object storage
(for example S3-compatible storage) is required, because node-local files are
not shared across instances. DL-11 does not implement object storage; the
storage provider abstraction exists so it can be added later without changing
domain authority.

## 9. Monitoring hooks

`GET /api/admin/storage/health` (ADMIN-only) is the initial machine-readable
monitoring hook. Useful signals:

- free disk percentage (`capacity.freePercent`);
- capacity pressure when `STORAGE_MIN_FREE_PERCENT` is configured
  (`capacity.pressure`);
- stale temporary upload count (`temp.staleFiles`,
  `temp.staleRequestDirectories`);
- recent pipeline failures (`uploadTelemetry.failures`,
  `uploadTelemetry.recentFailures`);
- missing/orphan counts and checksum mismatches from the latest explicit scan
  (`lastIntegrityScan.summary`).

The endpoint must never be exposed publicly. Upload telemetry and the last-scan
summary are **process-local** and reset when the backend restarts.

## 10. Operational settings

```text
STORAGE_STALE_TEMP_HOURS   # labels temp uploads as stale; never deletes them
STORAGE_MIN_FREE_PERCENT   # optional; when unset, pressure stays unclassified
```

These are classification/reporting settings only. There is no automatic cleanup
on startup, and no scheduled cleanup job.
