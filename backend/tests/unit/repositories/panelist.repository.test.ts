import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  panelist: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { PanelistRepository } from "../../../src/repositories/panelist.repository";

describe("PanelistRepository", () => {
  const repository = new PanelistRepository();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertActiveInternalFaculty", () => {
    it("allows an active Internal Faculty Panelist profile", async () => {
      prismaMock.panelist.findUnique.mockResolvedValue({
        isActive: true,
        isExternal: false,
      });

      await expect(repository.assertActiveInternalFaculty("user-internal")).resolves.toBeUndefined();
      expect(prismaMock.panelist.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-internal" },
        select: { isActive: true, isExternal: true },
      });
    });

    it.each([
      ["missing Panelist profile", null],
      ["inactive Internal Panelist profile", { isActive: false, isExternal: false }],
      ["active External Panelist profile", { isActive: true, isExternal: true }],
      ["inactive External Panelist profile", { isActive: false, isExternal: true }],
    ])("fails closed with 403 for %s", async (_label, profile) => {
      prismaMock.panelist.findUnique.mockResolvedValue(profile);

      await expect(repository.assertActiveInternalFaculty("user-denied")).rejects.toMatchObject({
        statusCode: 403,
        message: "External Faculty cannot serve as Thesis Adviser.",
      });
    });

    it("propagates database errors rather than masking failures", async () => {
      prismaMock.panelist.findUnique.mockRejectedValue(new Error("DB connection failed"));

      await expect(repository.assertActiveInternalFaculty("user-err")).rejects.toThrow(
        "DB connection failed",
      );
    });
  });

  describe("isExternalFaculty (preserved semantics for Defense/effective-access callers)", () => {
    it("returns true only when Panelist.isExternal === true", async () => {
      prismaMock.panelist.findUnique.mockResolvedValueOnce({ isExternal: true });
      await expect(repository.isExternalFaculty("ext")).resolves.toBe(true);

      prismaMock.panelist.findUnique.mockResolvedValueOnce({ isExternal: false });
      await expect(repository.isExternalFaculty("int")).resolves.toBe(false);

      prismaMock.panelist.findUnique.mockResolvedValueOnce(null);
      await expect(repository.isExternalFaculty("missing")).resolves.toBe(false);
    });

    it("propagates database errors", async () => {
      prismaMock.panelist.findUnique.mockRejectedValue(new Error("Query failed"));
      await expect(repository.isExternalFaculty("err")).rejects.toThrow("Query failed");
    });
  });
});
