import { describe, expect, it, vi } from "vitest";
import { StorageReadinessService } from "../../../src/services/storage-readiness.service";

function healthFixture(overrides: {
  scanSummary?: Record<string, number>;
  unsafeTemp?: boolean;
  minimumFreePercent?: number | null;
} = {}) {
  const summary: Record<string, number> = {
    INVALID_STORAGE_KEY: 0,
    PROVIDER_MISMATCH: 0,
    MISSING_OBJECT: 0,
    SIZE_MISMATCH: 0,
    CHECKSUM_MISMATCH: 0,
    DUPLICATE_REFERENCE: 0,
    ORPHAN_MANAGED_OBJECT: 0,
    SYMLINK_DETECTED: 0,
    LEGACY_FILE_MISSING: 0,
    LEGACY_FILE_UNSAFE: 0,
    ...(overrides.scanSummary ?? {}),
  };
  return {
    getHealth: vi.fn().mockResolvedValue({
      temp: { unsafeRootDetected: overrides.unsafeTemp ?? false },
      capacity: {
        minimumFreePercent:
          overrides.minimumFreePercent === undefined
            ? null
            : overrides.minimumFreePercent,
      },
      backup: { status: "UNAVAILABLE", lastSuccessfulBackupAt: null },
    }),
    runIntegrityScan: vi.fn().mockResolvedValue({
      summary,
      totalIssues: Object.values(summary).reduce((a, b) => a + b, 0),
    }),
  };
}

function backfillFixture(overrides: {
  eligible?: number;
  inspected?: number;
  debt?: Record<string, number>;
} = {}) {
  return {
    plan: vi.fn().mockResolvedValue({
      mode: "DRY_RUN",
      inspected: overrides.inspected ?? 0,
      alreadyManaged: 0,
      summary: { ELIGIBLE: overrides.eligible ?? 0 },
      detailsReturned: 0,
      detailsTruncated: false,
      details: [],
    }),
    inventoryLegacyDebt: vi.fn().mockResolvedValue({
      studentRequirement: 0,
      plagiarismResult: 0,
      rapReport: 0,
      adviserCertification: 0,
      statisticianCertification: 0,
      grammarianCertification: 0,
      researchVariableForm: 0,
      expertEvaluation: 0,
      studentFile: 0,
      manuscriptDistributionSignature: 0,
      eLibraryFullPaper: 0,
      eLibraryRespondentData: 0,
      ...(overrides.debt ?? {}),
    }),
  };
}

function makeService(health: unknown, backfill: unknown) {
  return new StorageReadinessService(
    health as never,
    backfill as never,
    { provider: "local", isProduction: false },
  );
}

const codes = (findings: Array<{ code: string }>) => findings.map((f) => f.code);

describe("DL-12 StorageReadinessService", () => {
  it("reports no errors for a healthy store and marks rehearsals not executed", async () => {
    const { service } = {
      service: makeService(healthFixture(), backfillFixture()),
    };

    const report = await service.verify();

    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.deploymentRehearsal.deploymentRestartRehearsal).toBe(
      "NOT EXECUTED",
    );
    expect(report.deploymentRehearsal.backupRestoreRehearsal).toBe(
      "NOT EXECUTED",
    );
    expect(codes(report.warnings)).toEqual(
      expect.arrayContaining([
        "CAPACITY_THRESHOLD_NOT_CONFIGURED",
        "BACKUP_STATUS_UNAVAILABLE",
        "DEPLOYMENT_RESTART_REHEARSAL_NOT_EXECUTED",
        "BACKUP_RESTORE_REHEARSAL_NOT_EXECUTED",
      ]),
    );
  });

  it("treats integrity blocking conditions as errors", async () => {
    const health = healthFixture({
      scanSummary: {
        MISSING_OBJECT: 2,
        CHECKSUM_MISMATCH: 1,
        SIZE_MISMATCH: 1,
        INVALID_STORAGE_KEY: 1,
        SYMLINK_DETECTED: 1,
        LEGACY_FILE_MISSING: 3,
        LEGACY_FILE_UNSAFE: 1,
      },
    });
    const report = await makeService(health, backfillFixture()).verify();

    expect(report.ok).toBe(false);
    expect(codes(report.errors)).toEqual([
      "INTEGRITY_CHECKSUM_MISMATCH",
      "INTEGRITY_INVALID_STORAGE_KEY",
      "INTEGRITY_LEGACY_FILE_MISSING",
      "INTEGRITY_LEGACY_FILE_UNSAFE",
      "INTEGRITY_MISSING_OBJECT",
      "INTEGRITY_SIZE_MISMATCH",
      "INTEGRITY_SYMLINK_DETECTED",
    ]);
  });

  it("treats orphan/provider/duplicate as warnings, not errors", async () => {
    const health = healthFixture({
      scanSummary: {
        ORPHAN_MANAGED_OBJECT: 4,
        PROVIDER_MISMATCH: 1,
        DUPLICATE_REFERENCE: 2,
      },
    });
    const report = await makeService(health, backfillFixture()).verify();

    expect(report.ok).toBe(true);
    expect(codes(report.warnings)).toEqual(
      expect.arrayContaining([
        "INTEGRITY_ORPHAN_MANAGED_OBJECT",
        "INTEGRITY_PROVIDER_MISMATCH",
        "INTEGRITY_DUPLICATE_REFERENCE",
      ]),
    );
  });

  it("flags an unsafe temp root as an error", async () => {
    const report = await makeService(
      healthFixture({ unsafeTemp: true }),
      backfillFixture(),
    ).verify();
    expect(report.ok).toBe(false);
    expect(codes(report.errors)).toContain("TEMP_ROOT_UNSAFE");
  });

  it("warns about pending backfill candidates and remaining legacy debt", async () => {
    const report = await makeService(
      healthFixture({ minimumFreePercent: 10 }),
      backfillFixture({ eligible: 5, inspected: 5, debt: { rapReport: 2, eLibraryRespondentData: 1 } }),
    ).verify();

    expect(codes(report.warnings)).toContain("LEGACY_BACKFILL_PENDING");
    expect(codes(report.warnings)).toContain("LEGACY_STORAGE_DEBT");
    expect(report.legacyStorageDebt.eLibraryRespondentData).toBe(1);
    expect(report.legacyBackfill.eligible).toBe(5);
    // Threshold configured -> no threshold warning.
    expect(codes(report.warnings)).not.toContain(
      "CAPACITY_THRESHOLD_NOT_CONFIGURED",
    );
  });

  it("produces deterministic ordering of findings", async () => {
    const report = await makeService(healthFixture(), backfillFixture()).verify();
    expect(codes(report.errors)).toEqual([...codes(report.errors)].sort());
    expect(codes(report.warnings)).toEqual([...codes(report.warnings)].sort());
  });
});
