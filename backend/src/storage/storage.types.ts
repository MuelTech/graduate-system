import type { Readable } from "stream";

/**
 * DL-1: provider-agnostic storage abstractions.
 * Business/domain services depend on these types rather than absolute
 * machine-specific filesystem paths. An S3-compatible provider can implement
 * the same interface later without changing domain authority.
 */

export interface StorageObjectStat {
  storageKey: string;
  provider: string;
  sizeBytes: number;
}

export interface StorageProvider {
  readonly name: string;
  resolveStorageKeyReadPath(storageKey: string): Promise<string>;
  resolveLegacyFilePathReadPath(
    filePath: string | null | undefined,
  ): Promise<string>;
  openRead(storageKey: string): Promise<Readable>;
  exists(storageKey: string): Promise<boolean>;
  stat(storageKey: string): Promise<StorageObjectStat | null>;
  delete(storageKey: string): Promise<void>;
  /** DL-2: absolute private temporary/quarantine directory under the root. */
  temporaryRoot(): string;
  /** DL-2: move a validated temporary object to a permanent managed key. */
  promoteTemporaryFile(
    tempAbsolutePath: string,
    storageKey: string,
  ): Promise<string>;
  /** DL-2: best-effort removal of a temporary object (idempotent). */
  discardTemporaryFile(tempAbsolutePath: string): Promise<void>;
  /** DL-2: remove a per-request temporary directory recursively. */
  removeTemporaryDir(dirAbsolutePath: string): Promise<void>;
}
