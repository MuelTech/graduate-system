import { storageProvider } from "../storage";
import { LocalStorageDiagnostics } from "../storage/local-storage.diagnostics";
import { StorageBackfillRepository } from "../repositories/storage-backfill.repository";
import { StorageBackfillService } from "../services/storage-backfill.service";
import { parseStorageBackfillArgs } from "./args";

/**
 * DL-12 operator CLI: legacy storage metadata backfill.
 *
 *   node dist/cli/storage-backfill.js           # DRY RUN (no DB writes)
 *   node dist/cli/storage-backfill.js --apply   # explicit apply
 *
 * Backfill is never automatic. This tool only adds metadata pointing at the
 * existing contained physical object; it never copies/moves/deletes files and
 * leaves `filePath` intact. Output is bounded and never prints paths/keys.
 */

export async function runStorageBackfillCli(argv: readonly string[]): Promise<number> {
  const { apply } = parseStorageBackfillArgs(argv);
  const probe = new LocalStorageDiagnostics(storageProvider);
  const service = new StorageBackfillService(
    new StorageBackfillRepository(),
    probe,
  );
  const report = apply ? await service.apply() : await service.plan();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  runStorageBackfillCli(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "backfill failed"}\n`,
      );
      process.exit(1);
    });
}
