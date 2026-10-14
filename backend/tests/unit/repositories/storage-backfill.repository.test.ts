import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  corUpload: {
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  thesisDocument: {
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  studentRequirement: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  plagiarismResult: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  rapReport: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  adviserCertification: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  statisticianCertification: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  grammarianCertification: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  researchVariableForm: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  expertEvaluation: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  studentFile: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  manuscriptDistribution: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  eLibrary: { count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { StorageBackfillRepository } from "../../../src/repositories/storage-backfill.repository";

/**
 * DL-12: only CorUpload + ThesisDocument are backfill targets, and only through
 * a conditional updateMany. Legacy-only path models are counted, never mutated.
 */
describe("DL-12 StorageBackfillRepository", () => {
  let repo: StorageBackfillRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new StorageBackfillRepository();
  });

  it("selects only true legacy COR candidates (storageKey null, non-empty filePath)", async () => {
    prismaMock.corUpload.findMany.mockResolvedValue([]);
    prismaMock.thesisDocument.findMany.mockResolvedValue([]);

    await repo.listLegacyCandidates();

    const corArgs = prismaMock.corUpload.findMany.mock.calls[0][0];
    expect(corArgs.where).toEqual({
      storageKey: { equals: null },
      filePath: { not: "" },
    });
    expect(corArgs.select).toMatchObject({
      id: true,
      filePath: true,
      storageKey: true,
      storageProvider: true,
      sizeBytes: true,
      checksum: true,
      checksumAlgorithm: true,
    });

    const thesisArgs = prismaMock.thesisDocument.findMany.mock.calls[0][0];
    expect(thesisArgs.where).toEqual({
      storageKey: { equals: null },
      filePath: { not: "" },
    });
    expect(thesisArgs.select).toMatchObject({
      id: true,
      filePath: true,
      docType: true,
      defenseStage: true,
    });
  });

  it("applies COR metadata through a concurrency-safe conditional updateMany", async () => {
    prismaMock.corUpload.updateMany.mockResolvedValue({ count: 1 });
    const data = {
      storageKey: "cor/abc",
      storageProvider: "local",
      sizeBytes: 3,
      checksum: "sha",
      checksumAlgorithm: "sha256",
    };

    const count = await repo.applyCorBackfill("cor-1", "/old/path.pdf", data);

    expect(count).toBe(1);
    expect(prismaMock.corUpload.updateMany).toHaveBeenCalledWith({
      where: {
        id: "cor-1",
        storageKey: { equals: null },
        filePath: "/old/path.pdf",
      },
      data,
    });
    expect(prismaMock.corUpload.create).not.toHaveBeenCalled();
    expect(prismaMock.corUpload.delete).not.toHaveBeenCalled();
  });

  it("applies ThesisDocument metadata through a conditional updateMany", async () => {
    prismaMock.thesisDocument.updateMany.mockResolvedValue({ count: 0 });
    const count = await repo.applyThesisBackfill("doc-1", "/old/path.pdf", {
      storageKey: "evidence/x",
    });
    expect(count).toBe(0);
    expect(prismaMock.thesisDocument.updateMany).toHaveBeenCalledWith({
      where: {
        id: "doc-1",
        storageKey: { equals: null },
        filePath: "/old/path.pdf",
      },
      data: { storageKey: "evidence/x" },
    });
  });

  it("counts managed rows for informational reporting", async () => {
    prismaMock.corUpload.count.mockResolvedValue(2);
    prismaMock.thesisDocument.count.mockResolvedValue(5);
    const counts = await repo.countManaged();
    expect(counts).toEqual({ managedCorUploads: 2, managedThesisDocuments: 5 });
  });

  it("inventories legacy-only path debt with read-only counts and no mutation", async () => {
    for (const model of [
      prismaMock.studentRequirement,
      prismaMock.plagiarismResult,
      prismaMock.rapReport,
      prismaMock.adviserCertification,
      prismaMock.statisticianCertification,
      prismaMock.grammarianCertification,
      prismaMock.researchVariableForm,
      prismaMock.expertEvaluation,
      prismaMock.studentFile,
      prismaMock.manuscriptDistribution,
      prismaMock.eLibrary,
    ]) {
      model.count.mockResolvedValue(1);
    }

    const debt = await repo.countLegacyPathDebt();

    expect(prismaMock.studentRequirement.count).toHaveBeenCalledWith({
      where: { filePath: { not: null } },
    });
    expect(prismaMock.plagiarismResult.count).toHaveBeenCalledWith({
      where: { filePath: { not: "" } },
    });
    expect(prismaMock.studentFile.count).toHaveBeenCalledWith({
      where: { filePath: { not: "" } },
    });
    expect(prismaMock.manuscriptDistribution.count).toHaveBeenCalledWith({
      where: { signaturePath: { not: null } },
    });
    expect(prismaMock.eLibrary.count).toHaveBeenCalledWith({
      where: { fullPaperPath: { not: null } },
    });
    expect(prismaMock.eLibrary.count).toHaveBeenCalledWith({
      where: { respondentDataPath: { not: null } },
    });
    expect(Object.keys(debt)).toEqual(
      expect.arrayContaining([
        "studentRequirement",
        "plagiarismResult",
        "rapReport",
        "adviserCertification",
        "statisticianCertification",
        "grammarianCertification",
        "researchVariableForm",
        "expertEvaluation",
        "studentFile",
        "manuscriptDistributionSignature",
        "eLibraryFullPaper",
        "eLibraryRespondentData",
      ]),
    );

    // Never mutate legacy-only models.
    for (const model of [
      prismaMock.studentRequirement,
      prismaMock.plagiarismResult,
      prismaMock.rapReport,
      prismaMock.adviserCertification,
      prismaMock.statisticianCertification,
      prismaMock.grammarianCertification,
      prismaMock.researchVariableForm,
      prismaMock.expertEvaluation,
      prismaMock.studentFile,
      prismaMock.manuscriptDistribution,
      prismaMock.eLibrary,
    ]) {
      expect(model.update).not.toHaveBeenCalled();
      expect(model.updateMany).not.toHaveBeenCalled();
    }
  });
});
