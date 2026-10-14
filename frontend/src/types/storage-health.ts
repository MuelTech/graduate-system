/**
 * DL-11: Admin storage health / integrity diagnostics DTOs.
 *
 * These mirror the read-only backend `/api/admin/storage/*` responses. They
 * never contain storage roots, absolute paths, raw storage keys, filenames, user
 * secrets, or document contents.
 */

export interface StorageCapacity {
  available: boolean;
  totalBytes?: number;
  usedBytes?: number;
  freeBytes?: number;
  freePercent?: number;
  minimumFreePercent: number | null;
  pressure: boolean | null;
}

export interface StorageTempSummary {
  thresholdHours: number;
  requestDirectories: number;
  fileCount: number;
  totalBytes: number;
  staleRequestDirectories: number;
  staleFiles: number;
  oldestModifiedAt: string | null;
  /** True when the `.tmp` root is a symlink / failed containment (not traversed). */
  unsafeRootDetected: boolean;
}

export interface UploadFailureEvent {
  timestamp: string;
  stage: string;
  statusClass: "4xx" | "5xx" | null;
}

export interface UploadTelemetrySnapshot {
  scope: "PROCESS_LOCAL_PIPELINE";
  startedAt: string;
  attempts: number;
  successes: number;
  failures: number;
  recentFailures: UploadFailureEvent[];
}

export interface IntegrityScanSummary {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: Record<string, number>;
  totalIssues: number;
}

export interface IntegrityIssue {
  issueType: string;
  source: string;
  recordId?: string;
  docType?: string;
  defenseStage?: string | null;
  namespace?: string;
  expectedSize?: number | null;
  actualSize?: number | null;
  modifiedAt?: string;
  objectFingerprint?: string;
}

export interface IntegrityScanResult extends IntegrityScanSummary {
  issuesReturned: number;
  issuesTruncated: boolean;
  issues: IntegrityIssue[];
}

export interface StorageHealth {
  provider: string;
  managedObjects: { count: number; totalBytes: number };
  legacyOrUnclassified: { count: number; totalBytes: number };
  references: {
    managedCorUploads: number;
    managedThesisDocuments: number;
    legacyCorUploads: number;
    legacyThesisDocuments: number;
  };
  capacity: StorageCapacity;
  temp: StorageTempSummary;
  uploadTelemetry: UploadTelemetrySnapshot;
  backup: {
    status: "UNAVAILABLE";
    lastSuccessfulBackupAt: null;
  };
  lastIntegrityScan: IntegrityScanSummary | null;
}
