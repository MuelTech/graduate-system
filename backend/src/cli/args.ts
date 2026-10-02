/**
 * DL-12: pure CLI argument parsing, kept free of storage/DB imports so it can be
 * tested without side effects.
 */
export interface StorageBackfillCliArgs {
  apply: boolean;
}

export function parseStorageBackfillArgs(
  argv: readonly string[],
): StorageBackfillCliArgs {
  return { apply: argv.includes("--apply") };
}
