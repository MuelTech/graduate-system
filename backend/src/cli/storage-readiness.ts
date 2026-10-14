import { storageProvider } from "../storage";
import { LocalStorageDiagnostics } from "../storage/local-storage.diagnostics";
import { StorageHealthRepository } from "../repositories/storage-health.repository";
import { StorageBackfillRepository } from "../repositories/storage-backfill.repository";
import { StorageHealthService } from "../services/storage-health.service";
import { StorageBackfillService } from "../services/storage-backfill.service";
import { StorageReadinessService } from "../services/storage-readiness.service";
import { uploadTelemetry } from "../storage/upload-telemetry";
import { STORAGE_CONFIG, STORAGE_OPERATIONS_CONFIG } from "../utils/file.utils";

/**
 * DL-12 operator CLI: read-only production-readiness verification.
 *
 *   node dist/cli/storage-readiness.js
 *
 * Reuses DL-11 health/integrity logic. Never mutates storage or workflow state.
 * Exit code: 0 = no blocking technical errors, 1 = blocking technical errors.
 */

export async function runStorageReadinessCli(): Promise<number> {
  const diagnostics = new LocalStorageDiagnostics(storageProvider);
  const health = new StorageHealthService(
    diagnostics,
    new StorageHealthRepository(),
    STORAGE_OPERATIONS_CONFIG,
    uploadTelemetry,
  );
  const backfill = new StorageBackfillService(
    new StorageBackfillRepository(),
    diagnostics,
  );
  const readiness = new StorageReadinessService(health, backfill, {
    provider: STORAGE_CONFIG.provider,
    isProduction: STORAGE_CONFIG.isProduction,
  });

  const report = await readiness.verify();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

if (require.main === module) {
  runStorageReadinessCli()
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "readiness failed"}\n`,
      );
      process.exit(1);
    });
}
