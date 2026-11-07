import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_ACCESS_SELECT, readConfiguredAccountAccess } from "../../../src/access/account-access.store";

function database(findUnique = vi.fn()) {
  return { client: { user: { findUnique } } as unknown as Pick<PrismaClient, "user">, findUnique };
}

describe("configured access persistence boundary", () => {
  it("reads current configuration by exact User ID without credentials or legacy grants", async () => {
    const { client, findUnique } = database(vi.fn().mockResolvedValue({
      id: "user-1", role: "ADMIN", isActive: true, panelist: null,
      administratorAccess: { level: "RESTRICTED" }, capabilityGrants: [{ capabilityKey: "cor.verify" }],
    }));
    expect((await readConfiguredAccountAccess(client, "user-1")).capabilities).toEqual(["cor.verify", "cor.view"]);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "user-1" }, select: ACCOUNT_ACCESS_SELECT });
    expect(ACCOUNT_ACCESS_SELECT).not.toHaveProperty("passwordHash");
    expect(ACCOUNT_ACCESS_SELECT).not.toHaveProperty("customRole");
    expect(ACCOUNT_ACCESS_SELECT).not.toHaveProperty("email");
  });

  it("fails closed on a missing user and on persistence failure", async () => {
    expect((await readConfiguredAccountAccess(database(vi.fn().mockResolvedValue(null)).client, "absent")).status).toBe("NOT_FOUND");
    const failed = database(vi.fn().mockRejectedValue(new Error("unavailable schema/connection")));
    expect(await readConfiguredAccountAccess(failed.client, "user-1")).toMatchObject({ status: "UNAVAILABLE", capabilities: [] });
  });

  it("does not query blank identity or use a returned different account", async () => {
    const blank = database();
    expect((await readConfiguredAccountAccess(blank.client, " ")).capabilities).toEqual([]);
    expect(blank.findUnique).not.toHaveBeenCalled();
    const mismatch = database(vi.fn().mockResolvedValue({ id: "another-user" }));
    expect((await readConfiguredAccountAccess(mismatch.client, "user-1")).status).toBe("INVALID_CONFIGURATION");
  });

  it("rereads on each request, so previous Full metadata cannot mask a later revocation", async () => {
    const snapshot = { id: "admin-1", role: "ADMIN", isActive: true, panelist: null, administratorAccess: { level: "FULL" }, capabilityGrants: [] };
    const db = database(vi.fn().mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, administratorAccess: null }));
    expect((await readConfiguredAccountAccess(db.client, "admin-1")).capabilities).toContain("administrator_access.manage");
    expect((await readConfiguredAccountAccess(db.client, "admin-1")).capabilities).toEqual([]);
    expect(db.findUnique).toHaveBeenCalledTimes(2);
  });
});
