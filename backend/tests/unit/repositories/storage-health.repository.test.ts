import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  corUpload: {
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  thesisDocument: {
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { StorageHealthRepository } from "../../../src/repositories/storage-health.repository";

/**
 * DL-11: the health/scan repository is strictly read-only. These tests assert
 * the exact safe selects and that no mutation method is ever invoked.
 */
describe("StorageHealthRepository", () => {
  let repo: StorageHealthRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new StorageHealthRepository();
  });

  function expectNoMutations() {
    for (const model of [prismaMock.corUpload, prismaMock.thesisDocument]) {
      expect(model.create).not.toHaveBeenCalled();
      expect(model.update).not.toHaveBeenCalled();
      expect(model.updateMany).not.toHaveBeenCalled();
      expect(model.delete).not.toHaveBeenCalled();
      expect(model.deleteMany).not.toHaveBeenCalled();
    }
  }

  it("counts managed vs legacy COR and ThesisDocument references", async () => {
    prismaMock.corUpload.count.mockResolvedValue(3);
    prismaMock.thesisDocument.count.mockResolvedValue(4);

    const counts = await repo.getReferenceCounts();

    expect(prismaMock.corUpload.count).toHaveBeenCalledWith({
      where: { storageKey: { not: null } },
    });
    expect(prismaMock.corUpload.count).toHaveBeenCalledWith({
      where: { storageKey: { equals: null } },
    });
    expect(prismaMock.thesisDocument.count).toHaveBeenCalledWith({
      where: { storageKey: { not: null } },
    });
    expect(prismaMock.thesisDocument.count).toHaveBeenCalledWith({
      where: { storageKey: { equals: null } },
    });
    expect(counts).toEqual({
      managedCorUploads: 3,
      managedThesisDocuments: 4,
      legacyCorUploads: 3,
      legacyThesisDocuments: 4,
    });
    expectNoMutations();
  });

  it("lists managed COR rows with integrity metadata only", async () => {
    prismaMock.corUpload.findMany.mockResolvedValue([]);
    await repo.listManagedCorUploads();

    const args = prismaMock.corUpload.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ storageKey: { not: null } });
    expect(args.select).toMatchObject({
      id: true,
      storageKey: true,
      storageProvider: true,
      sizeBytes: true,
      checksum: true,
      checksumAlgorithm: true,
    });
    expect(args.select).not.toHaveProperty("filePath");
    expectNoMutations();
  });

  it("lists managed ThesisDocument rows with doc type + stage context", async () => {
    prismaMock.thesisDocument.findMany.mockResolvedValue([]);
    await repo.listManagedThesisDocuments();

    const args = prismaMock.thesisDocument.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ storageKey: { not: null } });
    expect(args.select).toMatchObject({
      id: true,
      storageKey: true,
      storageProvider: true,
      sizeBytes: true,
      checksum: true,
      checksumAlgorithm: true,
      docType: true,
      defenseStage: true,
    });
    expectNoMutations();
  });

  it("lists legacy rows that have a filePath but no storage key", async () => {
    prismaMock.corUpload.findMany.mockResolvedValue([]);
    prismaMock.thesisDocument.findMany.mockResolvedValue([]);
    await repo.listLegacyCorUploads();
    await repo.listLegacyThesisDocuments();

    const corArgs = prismaMock.corUpload.findMany.mock.calls[0][0];
    expect(corArgs.where).toEqual({
      storageKey: { equals: null },
      filePath: { not: "" },
    });
    expect(corArgs.select).toMatchObject({ id: true, filePath: true });

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
    expectNoMutations();
  });
});
