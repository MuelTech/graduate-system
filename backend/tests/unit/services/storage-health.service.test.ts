import { describe, expect, it, vi } from "vitest";
import {
  INTEGRITY_ISSUE_TYPES,
  StorageHealthService,
} from "../../../src/services/storage-health.service";
import { UploadTelemetry } from "../../../src/storage/upload-telemetry";
import type { StorageDiagnosticsProvider } from "../../../src/storage/storage-diagnostics.types";

const ZERO_TEMP = {
  requestDirectories: 0,
  fileCount: 0,
  totalBytes: 0,
  oldestModifiedAt: null,
  staleRequestDirectories: 0,
  staleFiles: 0,
};

function makeRepo() {
  return {
    getReferenceCounts: vi.fn().mockResolvedValue({
      managedCorUploads: 0,
      managedThesisDocuments: 0,
      legacyCorUploads: 0,
      legacyThesisDocuments: 0,
    }),
    listManagedCorUploads: vi.fn().mockResolvedValue([]),
    listManagedThesisDocuments: vi.fn().mockResolvedValue([]),
    listLegacyCorUploads: vi.fn().mockResolvedValue([]),
    listLegacyThesisDocuments: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };
}

function makeDiag(
  overrides: Partial<StorageDiagnosticsProvider> = {},
): StorageDiagnosticsProvider {
  return {
    providerName: "local",
    listManagedObjects: vi.fn().mockResolvedValue({ objects: [], symlinks: [] }),
    legacyOrUnclassifiedSummary: vi
      .fn()
      .mockResolvedValue({ count: 0, totalBytes: 0 }),
    tempSummary: vi.fn().mockResolvedValue({ ...ZERO_TEMP }),
    capacity: vi.fn().mockResolvedValue({
      available: true,
      totalBytes: 1000,
      freeBytes: 400,
      usedBytes: 600,
      freePercent: 40,
    }),
    probe: vi.fn().mockResolvedValue({ exists: true, sizeBytes: 10 }),
    checksum: vi.fn().mockResolvedValue("checksum-a"),
    fingerprint: vi.fn(
      (key: string) => `fp-${Buffer.from(key, "utf8").toString("hex")}`,
    ),
    legacyFileProbe: vi.fn().mockResolvedValue("OK"),
    ...overrides,
  } as StorageDiagnosticsProvider;
}

function makeService(options: {
  diag?: StorageDiagnosticsProvider;
  repo?: ReturnType<typeof makeRepo>;
  minFreePercent?: number | null;
  telemetry?: UploadTelemetry;
} = {}) {
  const repo = options.repo ?? makeRepo();
  const diag = options.diag ?? makeDiag();
  const service = new StorageHealthService(
    diag,
    repo as never,
    { staleTempHours: 24, minFreePercent: options.minFreePercent ?? null },
    options.telemetry ?? new UploadTelemetry(),
    200,
  );
  return { service, repo, diag };
}

function summaryOf(result: { summary: Record<string, number> }, type: string) {
  return result.summary[type] ?? 0;
}

describe("DL-11 StorageHealthService.getHealth", () => {
  it("reports managed objects, references, temp and backup status", async () => {
    const diag = makeDiag({
      listManagedObjects: vi.fn().mockResolvedValue({
        objects: [
          { storageKey: "cor/a", namespace: "cor", sizeBytes: 10, modifiedAt: "2026-01-01T00:00:00.000Z" },
          { storageKey: "manuscripts/b", namespace: "manuscripts", sizeBytes: 5, modifiedAt: "2026-01-01T00:00:00.000Z" },
        ],
        symlinks: [],
      }),
      legacyOrUnclassifiedSummary: vi
        .fn()
        .mockResolvedValue({ count: 3, totalBytes: 30 }),
      tempSummary: vi.fn().mockResolvedValue({
        ...ZERO_TEMP,
        requestDirectories: 2,
        fileCount: 4,
        totalBytes: 40,
      }),
    });
    const repo = makeRepo();
    repo.getReferenceCounts.mockResolvedValue({
      managedCorUploads: 1,
      managedThesisDocuments: 1,
      legacyCorUploads: 2,
      legacyThesisDocuments: 3,
    });
    const { service } = makeService({ diag, repo });

    const health = await service.getHealth();

    expect(health.provider).toBe("local");
    expect(health.managedObjects).toEqual({ count: 2, totalBytes: 15 });
    expect(health.legacyOrUnclassified).toEqual({ count: 3, totalBytes: 30 });
    expect(health.references).toEqual({
      managedCorUploads: 1,
      managedThesisDocuments: 1,
      legacyCorUploads: 2,
      legacyThesisDocuments: 3,
    });
    expect(health.capacity.available).toBe(true);
    expect(health.capacity.minimumFreePercent).toBeNull();
    expect(health.capacity.pressure).toBeNull();
    expect(health.temp.thresholdHours).toBe(24);
    expect(health.temp.fileCount).toBe(4);
    expect(health.uploadTelemetry.scope).toBe("PROCESS_LOCAL_PIPELINE");
    expect(health.backup).toEqual({
      status: "UNAVAILABLE",
      lastSuccessfulBackupAt: null,
    });
    expect(health.lastIntegrityScan).toBeNull();
  });

  it("classifies capacity pressure only when a threshold is configured", async () => {
    const { service } = makeService({ minFreePercent: 50 });
    const health = await service.getHealth();
    expect(health.capacity.minimumFreePercent).toBe(50);
    expect(health.capacity.pressure).toBe(true);

    const below = makeDiag({
      capacity: vi.fn().mockResolvedValue({
        available: true,
        totalBytes: 1000,
        freeBytes: 400,
        usedBytes: 600,
        freePercent: 40,
      }),
    });
    const ok = makeService({ diag: below, minFreePercent: 10 });
    expect((await ok.service.getHealth()).capacity.pressure).toBe(false);
  });

  it("never serializes storage root, paths, storage keys, filenames or user ids", async () => {
    const diag = makeDiag({
      listManagedObjects: vi.fn().mockResolvedValue({
        objects: [
          { storageKey: "cor/secret-key-abc", namespace: "cor", sizeBytes: 1, modifiedAt: "2026-01-01T00:00:00.000Z" },
        ],
        symlinks: [],
      }),
      tempSummary: vi.fn().mockResolvedValue({
        ...ZERO_TEMP,
        oldestModifiedAt: "2026-01-01T00:00:00.000Z",
      }),
    });
    const { service } = makeService({ diag });

    const serialized = JSON.stringify(await service.getHealth());

    for (const forbidden of [
      "storageKey",
      "cor/secret-key-abc",
      "filePath",
      "originalFilename",
      "userId",
      "email",
      "signatureData",
      "tempAbsolutePath",
      "UPLOAD_DIR",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("DL-11 integrity scan — healthy + reference checks", () => {
  it("reports no issues when metadata and physical objects agree", async () => {
    const diag = makeDiag({
      listManagedObjects: vi.fn().mockResolvedValue({
        objects: [
          { storageKey: "cor/a", namespace: "cor", sizeBytes: 10, modifiedAt: "2026-01-01T00:00:00.000Z" },
          { storageKey: "evidence/b", namespace: "evidence", sizeBytes: 20, modifiedAt: "2026-01-01T00:00:00.000Z" },
        ],
        symlinks: [],
      }),
      probe: vi.fn().mockImplementation(async (key: string) => ({
        exists: true,
        sizeBytes: key === "cor/a" ? 10 : 20,
      })),
      checksum: vi.fn().mockImplementation(async (key: string) =>
        key === "cor/a" ? "checksum-a" : "checksum-b",
      ),
    });
    const repo = makeRepo();
    repo.listManagedCorUploads.mockResolvedValue([
      { id: "cor-1", storageKey: "cor/a", storageProvider: "local", sizeBytes: 10, checksum: "checksum-a", checksumAlgorithm: "sha256" },
    ]);
    repo.listManagedThesisDocuments.mockResolvedValue([
      { id: "doc-1", storageKey: "evidence/b", storageProvider: "local", sizeBytes: 20, checksum: "checksum-b", checksumAlgorithm: "sha256", docType: "PAYMENT_RECEIPT", defenseStage: "TITLE" },
    ]);
    const { service, repo: repoMock } = makeService({ diag, repo });

    const result = await service.runIntegrityScan();

    expect(result.summary.MISSING_OBJECT).toBe(0);
    expect(result.summary.ORPHAN_MANAGED_OBJECT).toBe(0);
    expect(result.summary.SIZE_MISMATCH).toBe(0);
    expect(result.summary.CHECKSUM_MISMATCH).toBe(0);
    expect(result.totalIssues).toBe(0);
    for (const spy of [repoMock.create, repoMock.update, repoMock.updateMany, repoMock.delete, repoMock.deleteMany]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("reports MISSING_OBJECT for a managed row with no physical file", async () => {
    const diag = makeDiag({
      probe: vi.fn().mockResolvedValue({ exists: false }),
      checksum: vi.fn().mockResolvedValue(null),
    });
    const repo = makeRepo();
    repo.listManagedCorUploads.mockResolvedValue([
      { id: "cor-1", storageKey: "cor/missing", storageProvider: "local", sizeBytes: 10, checksum: null, checksumAlgorithm: null },
    ]);
    const { service } = makeService({ diag, repo });

    const result = await service.runIntegrityScan();

    expect(result.summary.MISSING_OBJECT).toBe(1);
    expect(result.issues[0]).toMatchObject({
      issueType: "MISSING_OBJECT",
      source: "COR_UPLOAD",
      recordId: "cor-1",
    });
    expect(JSON.stringify(result)).not.toContain("cor/missing");
  });

  it("reports SIZE_MISMATCH and CHECKSUM_MISMATCH without repairing", async () => {
    const diag = makeDiag({
      probe: vi.fn().mockResolvedValue({ exists: true, sizeBytes: 999 }),
      checksum: vi.fn().mockResolvedValue("actual-different"),
    });
    const repo = makeRepo();
    repo.listManagedThesisDocuments.mockResolvedValue([
      { id: "doc-1", storageKey: "evidence/x", storageProvider: "local", sizeBytes: 10, checksum: "stored", checksumAlgorithm: "sha256", docType: "PAYMENT_RECEIPT", defenseStage: "TITLE" },
    ]);
    const { service, repo: repoMock } = makeService({ diag, repo });

    const result = await service.runIntegrityScan();

    expect(result.summary.SIZE_MISMATCH).toBe(1);
    expect(result.summary.CHECKSUM_MISMATCH).toBe(1);
    expect(repoMock.update).not.toHaveBeenCalled();
    expect(repoMock.updateMany).not.toHaveBeenCalled();
  });

  it("reports PROVIDER_MISMATCH separately and does not probe a foreign provider", async () => {
    const probe = vi.fn();
    const diag = makeDiag({ probe });
    const repo = makeRepo();
    repo.listManagedCorUploads.mockResolvedValue([
      { id: "cor-1", storageKey: "cor/a", storageProvider: "future-s3", sizeBytes: 10, checksum: "x", checksumAlgorithm: "sha256" },
    ]);
    const { service } = makeService({ diag, repo });

    const result = await service.runIntegrityScan();

    expect(result.summary.PROVIDER_MISMATCH).toBe(1);
    expect(result.summary.MISSING_OBJECT).toBe(0);
    expect(probe).not.toHaveBeenCalled();
  });

  it("reports INVALID_STORAGE_KEY and never resolves an escaping key", async () => {
    const probe = vi.fn();
    const diag = makeDiag({ probe });
    const repo = makeRepo();
    repo.listManagedCorUploads.mockResolvedValue([
      { id: "cor-1", storageKey: "../escape/key", storageProvider: "local", sizeBytes: 10, checksum: null, checksumAlgorithm: null },
    ]);
    const { service } = makeService({ diag, repo });

    const result = await service.runIntegrityScan();

    expect(result.summary.INVALID_STORAGE_KEY).toBe(1);
    expect(probe).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("../escape");
  });

  it("reports DUPLICATE_REFERENCE once per shared managed key", async () => {
    const diag = makeDiag({
      listManagedObjects: vi.fn().mockResolvedValue({
        objects: [
          { storageKey: "cor/dup", namespace: "cor", sizeBytes: 10, modifiedAt: "2026-01-01T00:00:00.000Z" },
        ],
        symlinks: [],
      }),
      probe: vi.fn().mockResolvedValue({ exists: true, sizeBytes: 10 }),
    });
    const repo = makeRepo();
    repo.listManagedCorUploads.mockResolvedValue([
      { id: "cor-1", storageKey: "cor/dup", storageProvider: "local", sizeBytes: 10, checksum: null, checksumAlgorithm: null },
      { id: "cor-2", storageKey: "cor/dup", storageProvider: "local", sizeBytes: 10, checksum: null, checksumAlgorithm: null },
    ]);
    const { service } = makeService({ diag, repo });

    const result = await service.runIntegrityScan();

    expect(result.summary.DUPLICATE_REFERENCE).toBe(1);
    expect(result.summary.ORPHAN_MANAGED_OBJECT).toBe(0);
  });

  it("reports ORPHAN_MANAGED_OBJECT for an unreferenced managed object only", async () => {
    const diag = makeDiag({
      listManagedObjects: vi.fn().mockResolvedValue({
        objects: [
          { storageKey: "cor/referenced", namespace: "cor", sizeBytes: 1, modifiedAt: "2026-01-01T00:00:00.000Z" },
          { storageKey: "cor/orphan", namespace: "cor", sizeBytes: 2, modifiedAt: "2026-01-01T00:00:00.000Z" },
        ],
        symlinks: [],
      }),
      legacyOrUnclassifiedSummary: vi
        .fn()
        .mockResolvedValue({ count: 1, totalBytes: 3 }),
      probe: vi.fn().mockResolvedValue({ exists: true, sizeBytes: 1 }),
    });
    const repo = makeRepo();
    repo.listManagedCorUploads.mockResolvedValue([
      { id: "cor-1", storageKey: "cor/referenced", storageProvider: "local", sizeBytes: 1, checksum: null, checksumAlgorithm: null },
    ]);
    const { service } = makeService({ diag, repo });

    const result = await service.runIntegrityScan();

    expect(result.summary.ORPHAN_MANAGED_OBJECT).toBe(1);
    const orphanIssue = result.issues.find(
      (i) => i.issueType === "ORPHAN_MANAGED_OBJECT",
    );
    expect(orphanIssue).toMatchObject({
      source: "PHYSICAL_OBJECT",
      namespace: "cor",
    });
    expect(orphanIssue?.objectFingerprint).toBeTruthy();
    // A root-level legacy/unclassified file never becomes an orphan here.
    expect(result.summary.ORPHAN_MANAGED_OBJECT).not.toBe(2);
  });

  it("reports SYMLINK_DETECTED for a managed namespace symlink", async () => {
    const diag = makeDiag({
      listManagedObjects: vi.fn().mockResolvedValue({
        objects: [],
        symlinks: [{ storageKey: "evidence/link", namespace: "evidence" }],
      }),
    });
    const { service } = makeService({ diag });

    const result = await service.runIntegrityScan();

    expect(result.summary.SYMLINK_DETECTED).toBe(1);
    const issue = result.issues.find((i) => i.issueType === "SYMLINK_DETECTED");
    expect(issue).toMatchObject({ source: "PHYSICAL_OBJECT", namespace: "evidence" });
    expect(JSON.stringify(result)).not.toContain("evidence/link");
  });

  it("reports legacy missing/unsafe files without backfilling", async () => {
    const diag = makeDiag({
      legacyFileProbe: vi.fn().mockImplementation(async (filePath: string) =>
        filePath.includes("unsafe") ? "UNSAFE" : "MISSING",
      ),
    });
    const repo = makeRepo();
    repo.listLegacyCorUploads.mockResolvedValue([
      { id: "legacy-1", filePath: "/legacy/missing.pdf" },
    ]);
    repo.listLegacyThesisDocuments.mockResolvedValue([
      { id: "legacy-2", filePath: "/legacy/unsafe.pdf", docType: "PAYMENT_RECEIPT", defenseStage: "TITLE" },
    ]);
    const { service, repo: repoMock } = makeService({ diag, repo });

    const result = await service.runIntegrityScan();

    expect(result.summary.LEGACY_FILE_MISSING).toBe(1);
    expect(result.summary.LEGACY_FILE_UNSAFE).toBe(1);
    expect(repoMock.update).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("/legacy/");
  });
});

describe("DL-11 integrity scan — bounds, lock, cache", () => {
  it("bounds returned issues but never hides total counts", async () => {
    const objects = Array.from({ length: 250 }, (_, i) => ({
      storageKey: `cor/orphan-${i}`,
      namespace: "cor",
      sizeBytes: 1,
      modifiedAt: "2026-01-01T00:00:00.000Z",
    }));
    const diag = makeDiag({
      listManagedObjects: vi.fn().mockResolvedValue({ objects, symlinks: [] }),
    });
    const { service } = makeService({ diag });

    const result = await service.runIntegrityScan();

    expect(result.totalIssues).toBe(250);
    expect(result.issuesReturned).toBe(200);
    expect(result.issuesTruncated).toBe(true);
    expect(result.summary.ORPHAN_MANAGED_OBJECT).toBe(250);
    expect(result.issues).toHaveLength(200);
  });

  it("rejects a second overlapping scan with 409", async () => {
    let release: (value: unknown) => void = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const diag = makeDiag({
      listManagedObjects: vi.fn().mockImplementation(async () => {
        await gate;
        return { objects: [], symlinks: [] };
      }),
    });
    const { service } = makeService({ diag });

    const first = service.runIntegrityScan();
    await expect(service.runIntegrityScan()).rejects.toMatchObject({
      statusCode: 409,
    });
    release(undefined);
    await first;
  });

  it("caches the latest scan summary for /health and resets nothing persisted", async () => {
    const { service } = makeService();
    const before = await service.getHealth();
    expect(before.lastIntegrityScan).toBeNull();

    const scan = await service.runIntegrityScan();
    const after = await service.getHealth();

    expect(after.lastIntegrityScan?.startedAt).toBe(scan.startedAt);
    expect(after.lastIntegrityScan?.completedAt).toBe(scan.completedAt);
    expect(after.lastIntegrityScan?.durationMs).toBeTypeOf("number");
  });

  it("exposes every integrity issue type in the summary", async () => {
    const { service } = makeService();
    const result = await service.runIntegrityScan();
    for (const type of INTEGRITY_ISSUE_TYPES) {
      expect(result.summary).toHaveProperty(type);
    }
    expect(summaryOf(result, "ORPHAN_MANAGED_OBJECT")).toBe(0);
  });
});
