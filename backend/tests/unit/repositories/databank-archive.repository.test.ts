import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  eLibrary: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DatabankArchiveRepository } from "../../../src/repositories/databank-archive.repository";
import { DatabankRepository } from "../../../src/repositories/databank.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DL-9 DatabankArchiveRepository", () => {
  it("creates a private archive with null legacy paths and no publication state", async () => {
    prismaMock.eLibrary.create.mockResolvedValue({ id: "elib-1" });
    const repo = new DatabankArchiveRepository();

    await repo.createArchive({
      thesisId: "thesis-1",
      title: "Official Title",
      abstract: "a",
      keywords: "k",
    });

    expect(prismaMock.eLibrary.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          thesisId: "thesis-1",
          title: "Official Title",
          abstract: "a",
          keywords: "k",
          fullPaperPath: null,
          respondentDataPath: null,
          isPublic: false,
          publishedAt: null,
          approvedById: null,
        },
      }),
    );
  });

  it("reads the archive through a safe select (no raw paths)", async () => {
    prismaMock.eLibrary.findUnique.mockResolvedValue(null);
    const repo = new DatabankArchiveRepository();
    await repo.getArchiveByThesisId("thesis-1");

    const select = prismaMock.eLibrary.findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("fullPaperPath");
    expect(select).not.toHaveProperty("respondentDataPath");
    expect(select).toMatchObject({ id: true, thesisId: true, isPublic: true });
  });
});

describe("DL-9 DatabankRepository admin list", () => {
  it("does not serialize raw storage paths in the admin list", async () => {
    prismaMock.eLibrary.findMany.mockResolvedValue([]);
    const repo = new DatabankRepository();
    await repo.findAll();

    const select = prismaMock.eLibrary.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("fullPaperPath");
    expect(select).not.toHaveProperty("respondentDataPath");
    expect(select).toMatchObject({
      id: true,
      title: true,
      abstract: true,
      keywords: true,
      isPublic: true,
      publishedAt: true,
      approvedById: true,
    });
  });
});
