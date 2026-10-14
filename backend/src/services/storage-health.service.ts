import { AppError } from "../utils/AppError";
import { isValidStorageKey } from "../storage/storage-key";
import { MANAGED_STORAGE_PREFIXES } from "../storage/upload-policy";
import type { StorageDiagnosticsProvider } from "../storage/storage-diagnostics.types";
import type {
  ReferenceCounts,
  StorageHealthRepository,
} from "../repositories/storage-health.repository";
import type { StorageOperationsConfig } from "../config/storage.config";
import type {
  UploadTelemetry,
  UploadTelemetrySnapshot,
} from "../storage/upload-telemetry";

/**
 * DL-11: read-only storage health + integrity diagnostics.
 *
 * Non-negotiable boundary: this service only reads. It never deletes, repairs,
 * rewrites a key/checksum, backfills metadata, or mutates workflow authority.
 * The explicit integrity scan is diagnostic only; reconciliation is DL-12 or an
 * explicitly reviewed maintenance operation.
 */

export const INTEGRITY_ISSUE_TYPES = [
  "INVALID_STORAGE_KEY",
  "PROVIDER_MISMATCH",
  "MISSING_OBJECT",
  "SIZE_MISMATCH",
  "CHECKSUM_MISMATCH",
  "DUPLICATE_REFERENCE",
  "ORPHAN_MANAGED_OBJECT",
  "SYMLINK_DETECTED",
  "LEGACY_FILE_MISSING",
  "LEGACY_FILE_UNSAFE",
] as const;

export type IntegrityIssueType = (typeof INTEGRITY_ISSUE_TYPES)[number];

export type IntegrityIssueSource =
  | "COR_UPLOAD"
  | "THESIS_DOCUMENT"
  | "PHYSICAL_OBJECT";

export interface IntegrityIssueDto {
  issueType: IntegrityIssueType;
  source: IntegrityIssueSource;
  recordId?: string;
  docType?: string;
  defenseStage?: string | null;
  namespace?: string;
  expectedSize?: number | null;
  actualSize?: number | null;
  modifiedAt?: string;
  objectFingerprint?: string;
}

export interface IntegrityScanResultDto {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: Record<IntegrityIssueType, number>;
  totalIssues: number;
  issuesReturned: number;
  issuesTruncated: boolean;
  issues: IntegrityIssueDto[];
}

export interface IntegrityScanSummaryDto {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: Record<IntegrityIssueType, number>;
  totalIssues: number;
}

export interface StorageHealthDto {
  provider: string;
  managedObjects: { count: number; totalBytes: number };
  legacyOrUnclassified: { count: number; totalBytes: number };
  references: ReferenceCounts;
  capacity: {
    available: boolean;
    totalBytes?: number;
    usedBytes?: number;
    freeBytes?: number;
    freePercent?: number;
    minimumFreePercent: number | null;
    pressure: boolean | null;
  };
  temp: {
    thresholdHours: number;
    requestDirectories: number;
    fileCount: number;
    totalBytes: number;
    staleRequestDirectories: number;
    staleFiles: number;
    oldestModifiedAt: string | null;
    unsafeRootDetected: boolean;
  };
  uploadTelemetry: UploadTelemetrySnapshot;
  backup: {
    status: "UNAVAILABLE";
    lastSuccessfulBackupAt: null;
  };
  lastIntegrityScan: IntegrityScanSummaryDto | null;
}

interface ManagedReferenceInput {
  id: string;
  storageKey: string | null;
  storageProvider: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  checksumAlgorithm: string | null;
  docType?: string;
  defenseStage?: string | null;
}

interface LegacyReferenceInput {
  id: string;
  filePath: string | null;
  docType?: string;
  defenseStage?: string | null;
}

const SHA256 = "sha256";

function emptySummary(): Record<IntegrityIssueType, number> {
  return INTEGRITY_ISSUE_TYPES.reduce(
    (summary, type) => {
      summary[type] = 0;
      return summary;
    },
    {} as Record<IntegrityIssueType, number>,
  );
}

export class StorageHealthService {
  private scanInProgress = false;
  private lastScan: IntegrityScanSummaryDto | null = null;

  constructor(
    private readonly diagnostics: StorageDiagnosticsProvider,
    private readonly repo: StorageHealthRepository,
    private readonly config: StorageOperationsConfig,
    private readonly telemetry: UploadTelemetry,
    private readonly maxIssues = 200,
  ) {}

  async getHealth(): Promise<StorageHealthDto> {
    const prefixes = MANAGED_STORAGE_PREFIXES;
    const [listing, legacy, temp, capacity, references] = await Promise.all([
      this.diagnostics.listManagedObjects(prefixes),
      this.diagnostics.legacyOrUnclassifiedSummary(prefixes),
      this.diagnostics.tempSummary(this.config.staleTempHours),
      this.diagnostics.capacity(),
      this.repo.getReferenceCounts(),
    ]);

    const managedBytes = listing.objects.reduce(
      (sum, object) => sum + object.sizeBytes,
      0,
    );

    return {
      provider: this.diagnostics.providerName,
      managedObjects: {
        count: listing.objects.length,
        totalBytes: managedBytes,
      },
      legacyOrUnclassified: {
        count: legacy.count,
        totalBytes: legacy.totalBytes,
      },
      references,
      capacity: this.toCapacity(capacity),
      temp: {
        thresholdHours: this.config.staleTempHours,
        requestDirectories: temp.requestDirectories,
        fileCount: temp.fileCount,
        totalBytes: temp.totalBytes,
        staleRequestDirectories: temp.staleRequestDirectories,
        staleFiles: temp.staleFiles,
        oldestModifiedAt: temp.oldestModifiedAt,
        unsafeRootDetected: temp.unsafeRootDetected,
      },
      uploadTelemetry: this.telemetry.snapshot(),
      backup: {
        status: "UNAVAILABLE",
        lastSuccessfulBackupAt: null,
      },
      lastIntegrityScan: this.lastScan ? { ...this.lastScan } : null,
    };
  }

  async runIntegrityScan(): Promise<IntegrityScanResultDto> {
    if (this.scanInProgress) {
      throw new AppError("Integrity scan already in progress.", 409);
    }
    this.scanInProgress = true;

    const startedAt = new Date();
    const startMs = Date.now();

    try {
      const prefixes = MANAGED_STORAGE_PREFIXES;
      const [listing, corRows, thesisRows, legacyCor, legacyThesis] =
        await Promise.all([
          this.diagnostics.listManagedObjects(prefixes),
          this.repo.listManagedCorUploads(),
          this.repo.listManagedThesisDocuments(),
          this.repo.listLegacyCorUploads(),
          this.repo.listLegacyThesisDocuments(),
        ]);

      const issues: IntegrityIssueDto[] = [];
      const summary = emptySummary();
      const push = (issue: IntegrityIssueDto): void => {
        summary[issue.issueType] += 1;
        issues.push(issue);
      };

      const referenced = new Set<string>();
      const keyUsage = new Map<string, number>();
      const checksumCache = new Map<string, string | null>();

      const checksumFor = async (key: string): Promise<string | null> => {
        if (!checksumCache.has(key)) {
          checksumCache.set(key, await this.diagnostics.checksum(key));
        }
        return checksumCache.get(key) ?? null;
      };

      const inspect = async (
        row: ManagedReferenceInput,
        source: Extract<IntegrityIssueSource, "COR_UPLOAD" | "THESIS_DOCUMENT">,
      ): Promise<void> => {
        const key = row.storageKey;
        if (!key) return;

        const base = {
          source,
          recordId: row.id,
          docType: row.docType,
          defenseStage: row.defenseStage ?? null,
        };

        if (!isValidStorageKey(key)) {
          push({
            issueType: "INVALID_STORAGE_KEY",
            ...base,
            objectFingerprint: this.diagnostics.fingerprint(key),
          });
          return;
        }

        // A foreign-provider row does not claim the local object's namespace:
        // it must not be added to local reference/duplicate accounting, and the
        // local object (if present) remains an orphan candidate.
        if (
          row.storageProvider &&
          row.storageProvider !== this.diagnostics.providerName
        ) {
          push({
            issueType: "PROVIDER_MISMATCH",
            ...base,
            objectFingerprint: this.diagnostics.fingerprint(key),
          });
          return;
        }

        // Active provider (or legacy null provider) owns this key locally.
        referenced.add(key);
        keyUsage.set(key, (keyUsage.get(key) ?? 0) + 1);

        const probe = await this.diagnostics.probe(key);
        if (!probe.exists) {
          push({
            issueType: "MISSING_OBJECT",
            ...base,
            objectFingerprint: this.diagnostics.fingerprint(key),
          });
          return;
        }

        if (
          row.sizeBytes !== null &&
          row.sizeBytes !== undefined &&
          probe.sizeBytes !== undefined &&
          row.sizeBytes !== probe.sizeBytes
        ) {
          push({
            issueType: "SIZE_MISMATCH",
            ...base,
            expectedSize: row.sizeBytes,
            actualSize: probe.sizeBytes,
            modifiedAt: probe.modifiedAt,
            objectFingerprint: this.diagnostics.fingerprint(key),
          });
        }

        if (row.checksum && row.checksumAlgorithm === SHA256) {
          const actual = await checksumFor(key);
          if (actual && actual !== row.checksum) {
            push({
              issueType: "CHECKSUM_MISMATCH",
              ...base,
              modifiedAt: probe.modifiedAt,
              objectFingerprint: this.diagnostics.fingerprint(key),
            });
          }
        }
      };

      for (const row of corRows) await inspect(row, "COR_UPLOAD");
      for (const row of thesisRows) await inspect(row, "THESIS_DOCUMENT");

      for (const [key, count] of keyUsage) {
        if (count > 1) {
          push({
            issueType: "DUPLICATE_REFERENCE",
            source: "PHYSICAL_OBJECT",
            namespace: key.split("/")[0],
            objectFingerprint: this.diagnostics.fingerprint(key),
          });
        }
      }

      for (const object of listing.objects) {
        if (!referenced.has(object.storageKey)) {
          push({
            issueType: "ORPHAN_MANAGED_OBJECT",
            source: "PHYSICAL_OBJECT",
            namespace: object.namespace,
            actualSize: object.sizeBytes,
            modifiedAt: object.modifiedAt,
            objectFingerprint: this.diagnostics.fingerprint(object.storageKey),
          });
        }
      }

      for (const link of listing.symlinks) {
        push({
          issueType: "SYMLINK_DETECTED",
          source: "PHYSICAL_OBJECT",
          namespace: link.namespace,
          objectFingerprint: this.diagnostics.fingerprint(link.storageKey),
        });
      }

      const inspectLegacy = async (
        row: LegacyReferenceInput,
        source: Extract<IntegrityIssueSource, "COR_UPLOAD" | "THESIS_DOCUMENT">,
      ): Promise<void> => {
        if (!row.filePath) return;
        const probe = await this.diagnostics.legacyFileProbe(row.filePath);
        if (probe === "OK") return;
        push({
          issueType:
            probe === "UNSAFE" ? "LEGACY_FILE_UNSAFE" : "LEGACY_FILE_MISSING",
          source,
          recordId: row.id,
          docType: row.docType,
          defenseStage: row.defenseStage ?? null,
        });
      };

      for (const row of legacyCor) await inspectLegacy(row, "COR_UPLOAD");
      for (const row of legacyThesis) {
        await inspectLegacy(row, "THESIS_DOCUMENT");
      }

      const totalIssues = issues.length;
      const bounded = issues.slice(0, this.maxIssues);
      const completedAt = new Date();
      const result: IntegrityScanResultDto = {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startMs,
        summary,
        totalIssues,
        issuesReturned: bounded.length,
        issuesTruncated: totalIssues > bounded.length,
        issues: bounded,
      };

      this.lastScan = {
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        durationMs: result.durationMs,
        summary: { ...summary },
        totalIssues,
      };

      return result;
    } finally {
      this.scanInProgress = false;
    }
  }

  private toCapacity(
    capacity: Awaited<ReturnType<StorageDiagnosticsProvider["capacity"]>>,
  ): StorageHealthDto["capacity"] {
    const minimumFreePercent = this.config.minFreePercent;
    const pressure =
      minimumFreePercent !== null &&
      capacity.available &&
      typeof capacity.freePercent === "number"
        ? capacity.freePercent < minimumFreePercent
        : null;

    return {
      available: capacity.available,
      totalBytes: capacity.totalBytes,
      usedBytes: capacity.usedBytes,
      freeBytes: capacity.freeBytes,
      freePercent: capacity.freePercent,
      minimumFreePercent,
      pressure,
    };
  }
}
