import crypto from "crypto";
import type {
  LegacyBackfillProbeResult,
  LegacyStorageProbe,
} from "../storage/storage-diagnostics.types";
import type {
  BackfillSource,
  BackfillUpdateData,
  LegacyCorBackfillRow,
  LegacyStorageDebtCounts,
  LegacyThesisBackfillRow,
  StorageBackfillRepository,
} from "../repositories/storage-backfill.repository";

/**
 * DL-12: safe, explicit, non-destructive legacy storage metadata backfill.
 *
 * - DRY RUN by default; mutation requires an explicit apply() (CLI `--apply`).
 * - Derives metadata from the ACTUAL contained physical object via the provider
 *   probe (never trusts the DB path string as a key).
 * - Only fills missing fields; never overwrites conflicting non-null metadata.
 * - Never copies/moves/renames/deletes files; `filePath` stays intact.
 * - Conditional updateMany makes apply concurrency-safe and idempotent.
 * - Report is bounded and never exposes paths/keys/filenames.
 */

export const BACKFILL_STATUSES = [
  "ALREADY_MANAGED",
  "ELIGIBLE",
  "APPLIED",
  "MISSING",
  "UNSAFE",
  "INVALID_DERIVED_STORAGE_KEY",
  "METADATA_CONFLICT",
  "RACE_OR_ALREADY_MIGRATED",
] as const;

export type BackfillStatus = (typeof BACKFILL_STATUSES)[number];

export interface BackfillDetail {
  source: BackfillSource;
  recordId: string;
  status: BackfillStatus;
  reason?: string;
  objectFingerprint?: string;
}

export interface BackfillReport {
  mode: "DRY_RUN" | "APPLY";
  inspected: number;
  alreadyManaged: number;
  summary: Record<BackfillStatus, number>;
  detailsReturned: number;
  detailsTruncated: boolean;
  details: BackfillDetail[];
}

interface Evaluation {
  source: BackfillSource;
  recordId: string;
  filePath: string;
  status: Exclude<BackfillStatus, "ALREADY_MANAGED" | "APPLIED" | "RACE_OR_ALREADY_MIGRATED">;
  data?: BackfillUpdateData;
  reason?: string;
  objectFingerprint?: string;
}

const SOURCE_RANK: Record<BackfillSource, number> = {
  COR_UPLOAD: 0,
  THESIS_DOCUMENT: 1,
};

const SHA256 = "sha256";

function emptySummary(): Record<BackfillStatus, number> {
  return BACKFILL_STATUSES.reduce(
    (summary, status) => {
      summary[status] = 0;
      return summary;
    },
    {} as Record<BackfillStatus, number>,
  );
}

function fingerprint(storageKey: string): string {
  return crypto.createHash("sha256").update(storageKey).digest("hex").slice(0, 16);
}

function probeStatusToBackfillStatus(
  status: LegacyBackfillProbeResult["status"],
): Evaluation["status"] {
  switch (status) {
    case "MISSING":
      return "MISSING";
    case "UNSAFE":
      return "UNSAFE";
    case "INVALID_KEY":
      return "INVALID_DERIVED_STORAGE_KEY";
    default:
      return "ELIGIBLE";
  }
}

export class StorageBackfillService {
  constructor(
    private readonly repo: StorageBackfillRepository,
    private readonly probe: LegacyStorageProbe,
    private readonly maxDetails = 200,
  ) {}

  /** Dry-run: same candidate selection/eligibility as apply, no writes. */
  async plan(): Promise<BackfillReport> {
    return this.buildReport("DRY_RUN");
  }

  /** Explicit apply: conditional, concurrency-safe, idempotent. */
  async apply(): Promise<BackfillReport> {
    return this.buildReport("APPLY");
  }

  async inventoryLegacyDebt(): Promise<LegacyStorageDebtCounts> {
    return this.repo.countLegacyPathDebt();
  }

  private async buildReport(mode: "DRY_RUN" | "APPLY"): Promise<BackfillReport> {
    const evaluations = await this.buildEvaluations();
    const managed = await this.repo.countManaged();
    const summary = emptySummary();
    summary.ALREADY_MANAGED =
      managed.managedCorUploads + managed.managedThesisDocuments;

    const details: BackfillDetail[] = [];

    for (const evaluation of evaluations) {
      if (evaluation.status !== "ELIGIBLE") {
        summary[evaluation.status] += 1;
        details.push(this.toDetail(evaluation));
        continue;
      }

      summary.ELIGIBLE += 1;

      if (mode === "DRY_RUN") {
        details.push(this.toDetail(evaluation));
        continue;
      }

      const changed =
        evaluation.source === "COR_UPLOAD"
          ? await this.repo.applyCorBackfill(
              evaluation.recordId,
              evaluation.filePath,
              evaluation.data as BackfillUpdateData,
            )
          : await this.repo.applyThesisBackfill(
              evaluation.recordId,
              evaluation.filePath,
              evaluation.data as BackfillUpdateData,
            );

      const finalStatus: BackfillStatus =
        changed === 0 ? "RACE_OR_ALREADY_MIGRATED" : "APPLIED";
      summary[finalStatus] += 1;
      details.push(this.toDetail({ ...evaluation, status: "ELIGIBLE" }, finalStatus));
    }

    const bounded = details.slice(0, this.maxDetails);
    return {
      mode,
      inspected: evaluations.length,
      alreadyManaged: summary.ALREADY_MANAGED,
      summary,
      detailsReturned: bounded.length,
      detailsTruncated: details.length > bounded.length,
      details: bounded,
    };
  }

  private async buildEvaluations(): Promise<Evaluation[]> {
    const { cor, thesis } = await this.repo.listLegacyCandidates();
    const rows: Array<{
      source: BackfillSource;
      row: LegacyCorBackfillRow | LegacyThesisBackfillRow;
    }> = [
      ...cor.map((row) => ({ source: "COR_UPLOAD" as const, row })),
      ...thesis.map((row) => ({ source: "THESIS_DOCUMENT" as const, row })),
    ];
    rows.sort(
      (a, b) =>
        SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
        a.row.id.localeCompare(b.row.id),
    );

    const evaluations: Evaluation[] = [];
    for (const { source, row } of rows) {
      evaluations.push(await this.evaluate(source, row));
    }
    return evaluations;
  }

  private async evaluate(
    source: BackfillSource,
    row: LegacyCorBackfillRow | LegacyThesisBackfillRow,
  ): Promise<Evaluation> {
    const probe = await this.probe.legacyBackfillProbe(row.filePath);

    if (probe.status !== "OK") {
      const status = probeStatusToBackfillStatus(probe.status);
      return {
        source,
        recordId: row.id,
        filePath: row.filePath,
        status,
        reason: this.reasonFor(status),
      };
    }

    const conflict = this.detectConflict(row, probe);
    if (conflict) {
      return {
        source,
        recordId: row.id,
        filePath: row.filePath,
        status: "METADATA_CONFLICT",
        reason: conflict,
        objectFingerprint: fingerprint(probe.storageKey),
      };
    }

    return {
      source,
      recordId: row.id,
      filePath: row.filePath,
      status: "ELIGIBLE",
      data: this.buildUpdateData(row, probe),
      objectFingerprint: fingerprint(probe.storageKey),
    };
  }

  private detectConflict(
    row: LegacyCorBackfillRow,
    probe: Extract<LegacyBackfillProbeResult, { status: "OK" }>,
  ): string | null {
    if (row.storageProvider && row.storageProvider !== this.probe.providerName) {
      return "stored provider differs from active provider";
    }
    if (row.sizeBytes !== null && row.sizeBytes !== probe.sizeBytes) {
      return "stored size differs from the physical object";
    }
    if (row.checksum !== null && row.checksum !== probe.checksum) {
      return "stored checksum differs from the physical object";
    }
    if (row.checksumAlgorithm !== null && row.checksumAlgorithm !== SHA256) {
      return "unsupported stored checksum algorithm";
    }
    return null;
  }

  /** Fill only missing fields; never rewrite matching non-null metadata. */
  private buildUpdateData(
    row: LegacyCorBackfillRow,
    probe: Extract<LegacyBackfillProbeResult, { status: "OK" }>,
  ): BackfillUpdateData {
    const data: BackfillUpdateData = { storageKey: probe.storageKey };
    if (!row.storageProvider) data.storageProvider = this.probe.providerName;
    if (row.sizeBytes === null) data.sizeBytes = probe.sizeBytes;
    if (!row.checksum) data.checksum = probe.checksum;
    if (!row.checksumAlgorithm) data.checksumAlgorithm = SHA256;
    return data;
  }

  private toDetail(
    evaluation: Evaluation,
    statusOverride?: BackfillStatus,
  ): BackfillDetail {
    return {
      source: evaluation.source,
      recordId: evaluation.recordId,
      status: statusOverride ?? evaluation.status,
      ...(evaluation.reason ? { reason: evaluation.reason } : {}),
      ...(evaluation.objectFingerprint
        ? { objectFingerprint: evaluation.objectFingerprint }
        : {}),
    };
  }

  private reasonFor(status: Evaluation["status"]): string {
    switch (status) {
      case "MISSING":
        return "legacy object missing";
      case "UNSAFE":
        return "legacy object unsafe or not a regular file";
      case "INVALID_DERIVED_STORAGE_KEY":
        return "resolved object cannot be represented as a storage key";
      default:
        return "not eligible";
    }
  }
}
