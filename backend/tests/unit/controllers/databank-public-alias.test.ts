import { beforeEach, describe, expect, it, vi } from "vitest";

const listPublished = vi.fn();
const getPublished = vi.fn();
const registerArchive = vi.fn();
const getArchiveContext = vi.fn();
const getAllEntries = vi.fn();

vi.mock("../../../src/services/repository-publication.service", () => ({
  RepositoryPublicationService: class {
    listPublished = listPublished;
    getPublished = getPublished;
  },
}));

vi.mock("../../../src/services/databank-archive.service", () => ({
  DatabankArchiveService: class {
    registerArchive = registerArchive;
    getArchiveContext = getArchiveContext;
  },
}));

vi.mock("../../../src/services/databank.service", () => ({
  DatabankService: class {
    getAllEntries = getAllEntries;
  },
}));

import { AppError } from "../../../src/utils/AppError";
import { DatabankController } from "../../../src/controllers/databank.controller";

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

/**
 * DL-10: the deprecated `/databank/public*` aliases must delegate to the exact
 * safe Repository publication service, never a generic findById, never vary by
 * role, and never expose a private archive.
 */
describe("DL-10 deprecated databank public aliases", () => {
  const controller = new DatabankController();

  beforeEach(() => vi.clearAllMocks());

  it("list delegates to the safe publication service and ignores caller role", async () => {
    listPublished.mockResolvedValue([{ id: "pub-1" }]);
    const res = makeRes();

    await controller.searchPublic(
      {
        query: { q: "ai" },
        user: { userId: "u1", role: "STUDENT" },
      } as any,
      res,
    );

    expect(listPublished).toHaveBeenCalledWith("ai");
    expect(res.json).toHaveBeenCalledWith([{ id: "pub-1" }]);
  });

  it("detail delegates and maps a private/unknown id to 404", async () => {
    getPublished.mockRejectedValue(new AppError("Publication not found.", 404));
    const res = makeRes();

    await controller.getEntryById(
      { params: { id: "private-archive" }, user: { role: "ADMIN" } } as any,
      res,
    );

    expect(getPublished).toHaveBeenCalledWith("private-archive");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("detail returns the same payload the canonical service produces", async () => {
    getPublished.mockResolvedValue({ id: "pub-1", title: "T" });
    const res = makeRes();

    await controller.getEntryById(
      { params: { id: "pub-1" }, user: { role: "APPLICANT" } } as any,
      res,
    );

    expect(res.json).toHaveBeenCalledWith({ id: "pub-1", title: "T" });
  });
});
