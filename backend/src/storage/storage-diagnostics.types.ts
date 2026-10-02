/**
 * DL-11: provider-agnostic storage diagnostics capability.
 *
 * Business/domain services stay on the `StorageProvider` interface; only the
 * health/diagnostics layer depends on these types. A future S3-compatible
 * provider can supply its own diagnostics implementation.
 *
 * Internal enumeration results MAY carry the raw storage key so the service can
 * correlate DB references with physical objects. The health/scan API layer is
 * responsible for replacing those with non-reversible fingerprints; raw keys
 * must never be serialized to a client.
 */

export interface ManagedObjectInfo {
  /** Internal only — never serialize to a client. */
  storageKey: string;
  namespace: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface SymlinkFinding {
  /** Internal only — never serialize to a client. */
  storageKey: string;
  namespace: string;
}

export interface ManagedObjectListing {
  objects: ManagedObjectInfo[];
  symlinks: SymlinkFinding[];
}

export interface LegacyOrUnclassifiedSummary {
  count: number;
  totalBytes: number;
}

export interface ObjectProbe {
  exists: boolean;
  sizeBytes?: number;
  modifiedAt?: string;
}

export interface CapacityAvailability {
  available: boolean;
  totalBytes?: number;
  freeBytes?: number;
  usedBytes?: number;
  freePercent?: number;
}

export interface TempSummary {
  requestDirectories: number;
  fileCount: number;
  totalBytes: number;
  oldestModifiedAt: string | null;
  staleRequestDirectories: number;
  staleFiles: number;
}

export type LegacyProbeResult = "OK" | "MISSING" | "UNSAFE";

export interface StorageDiagnosticsProvider {
  readonly providerName: string;
  listManagedObjects(
    prefixes: readonly string[],
  ): Promise<ManagedObjectListing>;
  legacyOrUnclassifiedSummary(
    prefixes: readonly string[],
  ): Promise<LegacyOrUnclassifiedSummary>;
  tempSummary(staleTempHours: number): Promise<TempSummary>;
  capacity(): Promise<CapacityAvailability>;
  probe(storageKey: string): Promise<ObjectProbe>;
  checksum(storageKey: string): Promise<string | null>;
  /** Non-reversible diagnostic identifier for a physical object. */
  fingerprint(storageKey: string): string;
  legacyFileProbe(filePath: string): Promise<LegacyProbeResult>;
}
