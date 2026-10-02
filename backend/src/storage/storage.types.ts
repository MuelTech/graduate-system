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
}
