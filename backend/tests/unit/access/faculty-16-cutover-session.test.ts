import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: database }));
import { authenticateJWT, requireRole } from "../../../src/middlewares/auth.middleware";
import { currentAccountResponse } from "../../../src/services/current-account";
import { isAcademicAccountRole } from "../../../src/utils/academic-account";
import { nextBatch } from "../../../src/access/cutover-rehearsal";
import { syntheticCutoverManifest, syntheticCutoverSnapshot } from "../../fixtures/faculty-16";
const secret = process.env.JWT_SECRET;
afterEach(() => { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });
async function request(userId: string, claim: string) {
  const b = syntheticCutoverSnapshot(), manifest = syntheticCutoverManifest(b); let current = b;
  for (let i = 0; i < 4; i++) current = nextBatch(b, manifest, current).next!;
  const user = current.tables.users.find(r => r.user_id === userId)!, p = current.tables.panelists.find(r => r.user_id === userId);
  database.user.findUnique.mockResolvedValue({ id: userId, email: user.email, role: user.role, isActive: true,
    mustChangePassword: false, panelist: p ? { isActive: p.is_active === 1 } : null,
    administratorAccess: current.tables.administrator_access.find(r => r.user_id === userId) ?? null,
    capabilityGrants: current.tables.account_capability_grants.filter(r => r.user_id === userId).map(r => ({ capabilityKey: r.capability_key })) });
  process.env.JWT_SECRET = "faculty16-synthetic-session-secret";
  const token = jwt.sign({ userId, role: claim }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` }, method: "GET", originalUrl: "/api/auth/me" } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any, next = vi.fn();
  await authenticateJWT(req, res, next); expect(next).toHaveBeenCalledOnce(); return { req, res };
}
describe("FACULTY-16 chosen session compatibility (current account wins)", () => {
  it("retains a legacy PANELIST token for the same converted Faculty user, without Admin authority", async () => {
    const { req, res } = await request("faculty", "PANELIST");
    expect(req.user).toEqual({ userId: "faculty", role: "FACULTY" }); expect(isAcademicAccountRole(req.user.role)).toBe(true);
    const next = vi.fn(); requireRole(["ADMIN"])(req, res, next); expect(next).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(403);
  });
  it("cannot retain a stale ADMIN claim on the converted Faculty account", async () => {
    const { req, res } = await request("faculty", "ADMIN"), next = vi.fn();
    requireRole(["ADMIN"])(req, res, next); expect(next).not.toHaveBeenCalled();
    expect(currentAccountResponse(req.currentAccount).configuredAccess.capabilities).toEqual(["essay.evaluate"]);
  });
  it("resolves converted CUSTOM from explicit Restricted metadata, never from its old claim/legacy features", async () => {
    const { req } = await request("restricted", "CUSTOM");
    expect(req.user.role).toBe("ADMIN");
    expect(currentAccountResponse(req.currentAccount).configuredAccess).toMatchObject({ administratorLevel: "RESTRICTED", capabilities: ["students.view"] });
  });
  it("leaves held-out CUSTOM authenticated with no target authority", async () => {
    const { req } = await request("unresolved", "ADMIN");
    expect(req.user.role).toBe("CUSTOM");
    expect(currentAccountResponse(req.currentAccount).configuredAccess).toMatchObject({ status: "UNSUPPORTED_ACCOUNT", capabilities: [] });
  });
});
