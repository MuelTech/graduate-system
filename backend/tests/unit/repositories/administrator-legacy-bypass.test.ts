import { beforeEach, describe, expect, it, vi } from "vitest";
const tx = vi.hoisted(() => ({ panelist: { findUnique: vi.fn(), update: vi.fn() }, user: { update: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: { $transaction: (operation: (client: unknown) => unknown) => operation(tx) } }));
import { AdminPanelistRepository } from "../../../src/repositories/admin-panelist.repository";
beforeEach(() => vi.clearAllMocks());
describe("FACULTY-4 alternate legacy identity mutation boundary", () => {
  it("blocks legacy profile-based status, identity and password updates to an ADMIN User", async () => {
    tx.panelist.findUnique.mockResolvedValue({ id: "legacy-profile", userId: "full-a", user: { role: "ADMIN" } });
    await expect(new AdminPanelistRepository().updateWithUserTransaction("legacy-profile", {
      isActive: false, firstName: "Injected", lastName: "Injected",
    }, "restricted", "injected-hash")).rejects.toMatchObject({ statusCode: 403 });
    expect(tx.user.update).not.toHaveBeenCalled(); expect(tx.panelist.update).not.toHaveBeenCalled();
  });
  it.each(["PANELIST", "FACULTY"])("retires the alternate %s writer; authorized changes now use Faculty configuration", async role => {
    tx.panelist.findUnique.mockResolvedValue({ id: "profile", userId: "academic", user: { role },
      isExternal: false, isAvailableAsAdviser: true });
    tx.user.update.mockResolvedValue({}); tx.panelist.update.mockResolvedValue({ id: "profile" });
    await expect(new AdminPanelistRepository().updateWithUserTransaction("profile", { isActive: false }, "admin")).rejects.toMatchObject({ statusCode: 403 });
    expect(tx.user.update).not.toHaveBeenCalled(); expect(tx.panelist.update).not.toHaveBeenCalled();
  });
});
