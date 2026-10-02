import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKFILL_STATUSES,
  StorageBackfillService,
} from "../../../src/services/storage-backfill.service";
import type { LegacyBackfillProbeResult } from "../../../src/storage/storage-diagnostics.types";

const ZERO_DEBT = {
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
};

function legacyCor(overrides: Record<string, unknown> = {}) {
  return {
    id: "cor-1",
    filePath: "/legacy/cor-a.pdf",
    storageKey: null,
    storageProvider: null,
    sizeBytes: null,
    checksum: null,
    checksumAlgorithm: null,
    ...overrides,
  };
}
function legacyThesis(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    filePath: "/legacy/doc-a.pdf",
    storageKey: null,
    storageProvider: null,
    sizeBytes: null,
    checksum: null,
    checksumAlgorithm: null,
    docType: "PAYMENT_RECEIPT",
    defenseStage: "TITLE",
    ...overrides,
  };
}

function makeRepo() {
  return {
    listLegacyCandidates: vi.fn().mockResolvedValue({ cor: [], thesis: [] }),
    countManaged: vi
      .fn()
      .mockResolvedValue({ managedCorUploads: 0, managedThesisDocuments: 0 }),
    applyCorBackfill: vi.fn().mockResolvedValue(1),
    applyThesisBackfill: vi.fn().mockResolvedValue(1),
    countLegacyPathDebt: vi.fn().mockResolvedValue({ ...ZERO_DEBT }),
    // guard spies for legacy-only models
    updateLegacy: vi.fn(),
    deleteLegacy: vi.fn(),
  };
}

function makeProbe(map: Record<string, LegacyBackfillProbeResult>) {
  return {
    providerName: "local",
    legacyBackfillProbe: vi.fn(
      async (filePath: string): Promise<LegacyBackfillProbeResult> =>
        map[filePath] ?? { status: "MISSING" },
    ),
  };
}

function makeService(map: Record<string, LegacyBackfillProbeResult>, repo = makeRepo()) {
  return {
    service: new StorageBackfillService(repo as never, makeProbe(map) as never, 200),
    repo,
  };
}

const OK = (
  storageKey: string,
  sizeBytes: number,
  checksum: string,
): LegacyBackfillProbeResult => ({ status: "OK", storageKey, sizeBytes, checksum });

beforeEach(() => vi.clearAllMocks());

describe("DL-12 backfill dry-run", () => {
  it("assesses eligibility without any DB write", async () => {
    const repo = makeRepo();
    repo.listLegacyCandidates.mockResolvedValue({ cor: [legacyCor()], thesis: [] });
    const { service } = makeService({ "/legacy/cor-a.pdf": OK("cor/a", 10, "sha") }, repo);

    const report = await service.plan();

    expect(report.mode).toBe("DRY_RUN");
    expect(report.inspected).toBe(1);
    expect(report.summary.ELIGIBLE).toBe(1);
    expect(report.summary.APPLIED).toBe(0);
    expect(repo.applyCorBackfill).not.toHaveBeenCalled();
    expect(repo.applyThesisBackfill).not.toHaveBeenCalled();
  });

  it("never prints raw paths, keys, or filenames", async () => {
    const repo = makeRepo();
    repo.listLegacyCandidates.mockResolvedValue({ cor: [legacyCor()], thesis: [] });
    const { service } = makeService(
      { "/legacy/cor-a.pdf": OK("cor/secret-key", 10, "sha") },
      repo,
    );

    const serialized = JSON.stringify(await service.plan());
    for (const forbidden of [
      "/legacy/cor-a.pdf",
      "cor/secret-key",
      "filePath",
      "storageKey",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("DL-12 backfill apply", () => {
  it("applies derived metadata through the conditional update with a server-derived value set", async () => {
    const repo = makeRepo();
    repo.listLegacyCandidates.mockResolvedValue({ cor: [legacyCor()], thesis: [] });
    const { service } = makeService({ "/legacy/cor-a.pdf": OK("cor/a", 10, "sha") }, repo);

    const report = await service.apply();

    expect(report.mode).toBe("APPLY");
    expect(report.summary.ELIGIBLE).toBe(1);
    expect(report.summary.APPLIED).toBe(1);
    expect(repo.applyCorBackfill).toHaveBeenCalledWith("cor-1", "/legacy/cor-a.pdf", {
      storageKey: "cor/a",
      storageProvider: "local",
      sizeBytes: 10,
      checksum: "sha",
      checksumAlgorithm: "sha256",
    });
    expect(repo.applyThesisBackfill).not.toHaveBeenCalled();
  });

  it("fills only missing fields and leaves matching non-null metadata alone", async () => {
    const repo = makeRepo();
    repo.listLegacyCandidates.mockResolvedValue({
      cor: [
        legacyCor({
          storageProvider: "local",
          sizeBytes: 10,
          checksum: "sha",
          checksumAlgorithm: "sha256",
        }),
      ],
      thesis: [],
    });
    const { service } = makeService({ "/legacy/cor-a.pdf": OK("cor/a", 10, "sha") }, repo);

    await service.apply();

    expect(repo.applyCorBackfill).toHaveBeenCalledWith("cor-1", "/legacy/cor-a.pdf", {
      storageKey: "cor/a",
    });
  });

  it("reports a lost race as RACE_OR_ALREADY_MIGRATED without overwriting", async () => {
    const repo = makeRepo();
    repo.listLegacyCandidates.mockResolvedValue({ cor: [legacyCor()], thesis: [] });
    repo.applyCorBackfill.mockResolvedValue(0);
    const { service } = makeService({ "/legacy/cor-a.pdf": OK("cor/a", 10, "sha") }, repo);

    const report = await service.apply();

    expect(report.summary.APPLIED).toBe(0);
    expect(report.summary.RACE_OR_ALREADY_MIGRATED).toBe(1);
  });

  it("is idempotent: a second apply finds no legacy candidates", async () => {
    const repo = makeRepo();
    repo.listLegacyCandidates.mockResolvedValueOnce({
      cor: [legacyCor()],
      thesis: [],
    });
    const { service } = makeService({ "/legacy/cor-a.pdf": OK("cor/a", 10, "sha") }, repo);

    await service.apply();
    repo.listLegacyCandidates.mockResolvedValue({ cor: [], thesis: [] });
    repo.countManaged.mockResolvedValue({
      managedCorUploads: 1,
      managedThesisDocuments: 0,
    });
    const second = await service.apply();

    expect(second.inspected).toBe(0);
    expect(second.summary.APPLIED).toBe(0);
    expect(second.alreadyManaged).toBe(1);
    expect(repo.applyCorBackfill).toHaveBeenCalledTimes(1);
  });
});

describe("DL-12 backfill skip categories", () => {
  const cases: Array<[LegacyBackfillProbeResult, string]> = [
    [{ status: "MISSING" }, "MISSING"],
    [{ status: "UNSAFE" }, "UNSAFE"],
    [{ status: "INVALID_KEY" }, "INVALID_DERIVED_STORAGE_KEY"],
  ];

  it.each(cases)("skips %o as %s with no write", async (probe, expected) => {
    const repo = makeRepo();
    repo.listLegacyCandidates.mockResolvedValue({ cor: [legacyCor()], thesis: [] });
    const { service } = makeService({ "/legacy/cor-a.pdf": probe }, repo);

    const report = await service.apply();

    expect(report.summary[expected as keyof typeof report.summary]).toBe(1);
    expect(report.summary.APPLIED).toBe(0);
    expect(repo.applyCorBackfill).not.toHaveBeenCalled();
  });

  it("reports METADATA_CONFLICT for conflicting size/checksum/provider/algorithm and never repairs", async () => {
    for (const overrides of [
      { sizeBytes: 999 },
      { checksum: "different" },
      { storageProvider: "future-s3" },
      { checksumAlgorithm: "md5" },
    ]) {
      const repo = makeRepo();
      repo.listLegacyCandidates.mockResolvedValue({
        cor: [legacyCor(overrides)],
        thesis: [],
      });
      const { service } = makeService(
        { "/legacy/cor-a.pdf": OK("cor/a", 10, "sha") },
        repo,
      );
      const report = await service.apply();
      expect(report.summary.METADATA_CONFLICT).toBe(1);
      expect(report.summary.APPLIED).toBe(0);
      expect(repo.applyCorBackfill).not.toHaveBeenCalled();
    }
  });

  it("treats duplicate physical keys as separate eligible rows without uniqueness assumptions", async () => {
    const repo = makeRepo();
    repo.listLegacyCandidates.mockResolvedValue({
      cor: [
        legacyCor({ id: "cor-1", filePath: "/legacy/one.pdf" }),
        legacyCor({ id: "cor-2", filePath: "/legacy/two.pdf" }),
      ],
      thesis: [],
    });
    const { service } = makeService(
      {
        "/legacy/one.pdf": OK("cor/shared", 10, "sha"),
        "/legacy/two.pdf": OK("cor/shared", 10, "sha"),
      },
      repo,
    );

    const report = await service.plan();

    expect(report.summary.ELIGIBLE).toBe(2);
    expect(report.details.filter((d) => d.status === "ELIGIBLE")).toHaveLength(2);
  });
});

describe("DL-12 backfill reporting", () => {
  it("bounds details but keeps totals and truncation flag", async () => {
    const repo = makeRepo();
    const rows = Array.from({ length: 5 }, (_, i) =>
      legacyCor({ id: `cor-${i}`, filePath: `/legacy/${i}.pdf` }),
    );
    repo.listLegacyCandidates.mockResolvedValue({ cor: rows, thesis: [] });
    const map: Record<string, LegacyBackfillProbeResult> = {};
    for (let i = 0; i < 5; i++) map[`/legacy/${i}.pdf`] = OK(`cor/${i}`, 1, "sha");
    const service = new StorageBackfillService(
      repo as never,
      makeProbe(map) as never,
      2,
    );

    const report = await service.plan();

    expect(report.inspected).toBe(5);
    expect(report.summary.ELIGIBLE).toBe(5);
    expect(report.detailsReturned).toBe(2);
    expect(report.detailsTruncated).toBe(true);
  });

  it("orders deterministically by source then record id", async () => {
    const repo = makeRepo();
    repo.listLegacyCandidates.mockResolvedValue({
      cor: [legacyCor({ id: "cor-b" }), legacyCor({ id: "cor-a" })],
      thesis: [legacyThesis({ id: "doc-a" })],
    });
    const map: Record<string, LegacyBackfillProbeResult> = {
      "/legacy/cor-a.pdf": { status: "MISSING" },
      "/legacy/cor-b.pdf": { status: "MISSING" },
      "/legacy/doc-a.pdf": { status: "MISSING" },
    };
    const { service } = makeService(map, repo);

    const report = await service.plan();
    expect(report.details.map((d) => d.recordId)).toEqual([
      "cor-a",
      "cor-b",
      "doc-a",
    ]);
    expect(report.details.map((d) => d.source)).toEqual([
      "COR_UPLOAD",
      "COR_UPLOAD",
      "THESIS_DOCUMENT",
    ]);
  });

  it("exposes every backfill status in the summary and inventories legacy debt read-only", async () => {
    const repo = makeRepo();
    const { service } = makeService({}, repo);
    const report = await service.plan();
    for (const status of BACKFILL_STATUSES) {
      expect(report.summary).toHaveProperty(status);
    }

    repo.countLegacyPathDebt.mockResolvedValue({
      ...ZERO_DEBT,
      rapReport: 2,
      eLibraryRespondentData: 1,
    });
    const debt = await service.inventoryLegacyDebt();
    expect(debt.rapReport).toBe(2);
    expect(debt.eLibraryRespondentData).toBe(1);
  });
});
