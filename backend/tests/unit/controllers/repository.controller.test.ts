import { beforeEach, describe, expect, it, vi } from "vitest";

const listPublished = vi.fn();
const getPublished = vi.fn();
const listAdminEntries = vi.fn();
const publishMetadata = vi.fn();
const unpublishMetadata = vi.fn();

vi.mock("../../../src/services/repository-publication.service", () => ({
  RepositoryPublicationService: class {
    listPublished = listPublished;
    getPublished = getPublished;
    listAdminEntries = listAdminEntries;
    publishMetadata = publishMetadata;
    unpublishMetadata = unpublishMetadata;
  },
}));

import { AppError } from "../../../src/utils/AppError";
import { RepositoryController } from "../../../src/controllers/repository.controller";

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

describe("DL-10 RepositoryController", () => {
  const controller = new RepositoryController();

  beforeEach(() => vi.clearAllMocks());

  it("public list forwards the q query and never inspects a role", async () => {
    listPublished.mockResolvedValue([{ id: "pub-1" }]);
    const res = makeRes();

    await controller.listPublic(
      { query: { q: "machine" } } as any,
      res,
    );

    expect(listPublished).toHaveBeenCalledWith("machine");
    expect(res.json).toHaveBeenCalledWith([{ id: "pub-1" }]);
  });

  it("public detail preserves the 404 from the service for private/unknown ids", async () => {
    getPublished.mockRejectedValue(new AppError("Publication not found.", 404));
    const res = makeRes();

    await controller.getPublic({ params: { id: "private-1" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Publication not found." });
  });

  it("publish uses the JWT userId as the admin actor and ignores body authority", async () => {
    publishMetadata.mockResolvedValue({ id: "elib-1" });
    const res = makeRes();

    await controller.publish(
      {
        params: { id: "elib-1" },
        user: { userId: "admin-9", role: "ADMIN" },
        body: {
          approvedById: "attacker",
          adminId: "attacker",
          isPublic: false,
          publishedAt: "1999-01-01",
        },
      } as any,
      res,
    );

    expect(publishMetadata).toHaveBeenCalledWith("elib-1", "admin-9");
    expect(res.json).toHaveBeenCalledWith({ id: "elib-1" });
  });

  it("publish without an authenticated user is 401 and never mutates", async () => {
    const res = makeRes();
    await controller.publish({ params: { id: "elib-1" }, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(publishMetadata).not.toHaveBeenCalled();
  });

  it("publish preserves 404/409 from the service (never a blanket 500)", async () => {
    for (const status of [404, 409]) {
      publishMetadata.mockRejectedValueOnce(new AppError("nope", status));
      const res = makeRes();
      await controller.publish(
        {
          params: { id: "elib-1" },
          user: { userId: "admin-9", role: "ADMIN" },
          body: {},
        } as any,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(status);
    }
  });

  it("unpublish transitions by id and preserves conflicts", async () => {
    unpublishMetadata.mockRejectedValueOnce(new AppError("already private", 409));
    const res = makeRes();
    await controller.unpublish({ params: { id: "elib-1" } } as any, res);
    expect(unpublishMetadata).toHaveBeenCalledWith("elib-1");
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("admin list returns the service read model", async () => {
    listAdminEntries.mockResolvedValue([{ id: "elib-1" }]);
    const res = makeRes();
    await controller.listAdmin({} as any, res);
    expect(res.json).toHaveBeenCalledWith([{ id: "elib-1" }]);
  });
});
