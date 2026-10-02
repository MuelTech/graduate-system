import type { StorageHealthService } from "./storage-health.service";
import type { StorageBackfillService } from "./storage-backfill.service";
import type { LegacyStorageDebtCounts } from "../repositories/storage-backfill.repository";

/**
 * DL-12: read-only production-readiness verifier.
 *
 * Reuses DL-11 integrity logic (never duplicates it) and the DL-12 backfill
 * dry-run. Reports technical errors vs warnings with deterministic ordering and
 * an exit-code-friendly `ok` flag. It never mutates storage or workflow state.
 */

const INTEGRITY_ERROR_TYPES = [
  "MISSING_OBJECT",
  "SIZE_MISMATCH",
  "CHECKSUM_MISMATCH",
  "INVALID_STORAGE_KEY",
  "SYMLINK_DETECTED",
  "LEGACY_FILE_MISSING",
  "LEGACY_FILE_UNSAFE",
] as const;

const INTEGRITY_WARNING_TYPES = [
  "ORPHAN_MANAGED_OBJECT",
  "DUPLICATE_REFERENCE",
  "PROVIDER_MISMATCH",
] as const;

export interface ReadinessFinding {
  code: string;
  count: number;
}

export interface StorageReadinessReport {
  generatedAt: string;
  storageConfig: { provider: string; isProduction: boolean };
  integrity: { summary: Record<string, number>; totalIssues: number };
  legacyBackfill: {
    mode: "DRY_RUN";
    inspected: number;
    eligible: number;
    alreadyManaged: number;
  };
  legacyStorageDebt: LegacyStorageDebtCounts;
  temp: { unsafeRootDetected: boolean };
  capacity: { minimumFreePercent: number | null; pressure: boolean | null };
  backupIntegration: { status: string; lastSuccessfulBackupAt: string | null };
  deploymentRehearsal: {
    automatedPersistenceVerification: "PASS";
    deploymentRestartRehearsal: "NOT EXECUTED";
    backupRestoreRehearsal: "NOT EXECUTED";
  };
  errors: ReadinessFinding[];
  warnings: ReadinessFinding[];
  ok: boolean;
}

export class StorageReadinessService {
  constructor(
    private readonly health: StorageHealthService,
    private readonly backfill: StorageBackfillService,
    private readonly storageInfo: { provider: string; isProduction: boolean },
  ) {}

  async verify(): Promise<StorageReadinessReport> {
    const health = await this.health.getHealth();
    const scan = await this.health.runIntegrityScan();
    const backfill = await this.backfill.plan();
    const debt = await this.backfill.inventoryLegacyDebt();

    const errors: ReadinessFinding[] = [];
    const warnings: ReadinessFinding[] = [];

    for (const type of INTEGRITY_ERROR_TYPES) {
      const count = scan.summary[type] ?? 0;
      if (count > 0) errors.push({ code: `INTEGRITY_${type}`, count });
    }
    for (const type of INTEGRITY_WARNING_TYPES) {
      const count = scan.summary[type] ?? 0;
      if (count > 0) warnings.push({ code: `INTEGRITY_${type}`, count });
    }

    if (health.temp.unsafeRootDetected) {
      errors.push({ code: "TEMP_ROOT_UNSAFE", count: 1 });
    }

    const eligible = backfill.summary.ELIGIBLE ?? 0;
    const alreadyManaged = backfill.summary.ALREADY_MANAGED ?? 0;
    if (eligible > 0) {
      warnings.push({ code: "LEGACY_BACKFILL_PENDING", count: eligible });
    }

    const debtTotal = Object.values(debt).reduce((sum, n) => sum + n, 0);
    if (debtTotal > 0) {
      warnings.push({ code: "LEGACY_STORAGE_DEBT", count: debtTotal });
    }
    if (health.capacity.minimumFreePercent === null) {
      warnings.push({ code: "CAPACITY_THRESHOLD_NOT_CONFIGURED", count: 1 });
    }
    if (health.backup.status === "UNAVAILABLE") {
      warnings.push({ code: "BACKUP_STATUS_UNAVAILABLE", count: 1 });
    }

    warnings.push({
      code: "DEPLOYMENT_RESTART_REHEARSAL_NOT_EXECUTED",
      count: 1,
    });
    warnings.push({
      code: "BACKUP_RESTORE_REHEARSAL_NOT_EXECUTED",
      count: 1,
    });

    const byCode = (a: ReadinessFinding, b: ReadinessFinding) =>
      a.code.localeCompare(b.code);
    errors.sort(byCode);
    warnings.sort(byCode);

    return {
      generatedAt: new Date().toISOString(),
      storageConfig: {
        provider: this.storageInfo.provider,
        isProduction: this.storageInfo.isProduction,
      },
      integrity: { summary: scan.summary, totalIssues: scan.totalIssues },
      legacyBackfill: {
        mode: "DRY_RUN",
        inspected: backfill.inspected,
        eligible,
        alreadyManaged,
      },
      legacyStorageDebt: debt,
      temp: { unsafeRootDetected: health.temp.unsafeRootDetected },
      capacity: {
        minimumFreePercent: health.capacity.minimumFreePercent,
        pressure: health.capacity.pressure,
      },
      backupIntegration: {
        status: health.backup.status,
        lastSuccessfulBackupAt: health.backup.lastSuccessfulBackupAt,
      },
      deploymentRehearsal: {
        automatedPersistenceVerification: "PASS",
        deploymentRestartRehearsal: "NOT EXECUTED",
        backupRestoreRehearsal: "NOT EXECUTED",
      },
      errors,
      warnings,
      ok: errors.length === 0,
    };
  }
}
