import jwt from "jsonwebtoken";
import express from "express";
import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ user: { findUnique: vi.fn(), update: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: database }));
import { authenticateJWT, optionalAuthenticateJWT, requireRole } from "../../../src/middlewares/auth.middleware";
import { currentAccountResponse, loadCurrentAccount } from "../../../src/services/current-account";
import authRoutes from "../../../src/routes/auth.routes";

const SECRET = "faculty2-test-secret";
const originalSecret = process.env.JWT_SECRET;
let account: Record<string, any>;
function token(role = "ADMIN", extra = {}) {
  return jwt.sign({ userId: "u-1", role, mustChangePassword: false, ...extra }, SECRET);
}
function req(url = "/api/admin/records", method = "GET", accessToken = token()) {
  return { headers: { authorization: `Bearer ${accessToken}` }, originalUrl: url, method } as any;
}
function res() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response as any;
}
beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
  account = { id: "u-1", role: "ADMIN", email: "a@example.com", isActive: true, mustChangePassword: false,
    panelist: null, administratorAccess: null, capabilityGrants: [], passwordHash: "private", firstName: "private" };
  database.user.findUnique.mockReset().mockImplementation(async () => ({ ...account }));
  database.user.update.mockReset().mockImplementation(async ({ data }) => { Object.assign(account, data); return account; });
});
afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

describe("FACULTY-2 REST current account authority", () => {
  it("attaches current stored role rather than stale ADMIN claims", async () => {
    account.role = "STUDENT";
    const request = req(); const response = res(); const next = vi.fn();
    await authenticateJWT(request, response, next);
    expect(request.user).toEqual({ userId: "u-1", role: "STUDENT" });
    const adminNext = vi.fn(); requireRole(["ADMIN"])(request, response, adminNext);
    expect(adminNext).not.toHaveBeenCalled(); expect(response.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledOnce();
  });
  it("reloads on each request and denies an already-issued token after disable", async () => {
    const accessToken = token(); const next = vi.fn();
    await authenticateJWT(req(undefined, undefined, accessToken), res(), next);
    account.isActive = false;
    const response = res(); const disabledNext = vi.fn();
    await authenticateJWT(req(undefined, undefined, accessToken), response, disabledNext);
    expect(disabledNext).not.toHaveBeenCalled(); expect(response.status).toHaveBeenCalledWith(403);
    expect(database.user.findUnique).toHaveBeenCalledTimes(2);
  });
  it("preserves Applicant-to-Student token identity while removing Applicant role", async () => {
    account.role = "STUDENT";
    const request = req(undefined, undefined, token("APPLICANT"));
    await authenticateJWT(request, res(), vi.fn());
    expect(request.user.role).toBe("STUDENT");
  });
  it.each(["APPLICANT", "STUDENT", "ADMIN", "PANELIST", "CUSTOM"])("gates %s by current credential state", async (role) => {
    account.role = role; account.mustChangePassword = true;
    const response = res(); const next = vi.fn();
    await authenticateJWT(req(), response, next);
    expect(next).not.toHaveBeenCalled(); expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PASSWORD_CHANGE_REQUIRED" }));
  });
  it.each([
    ["/api/auth/me", "GET"], ["/api/auth/me?refresh=1", "GET"], ["/api/auth/change-password", "POST"],
  ])("allows exact recovery %s %s", async (url, method) => {
    account.mustChangePassword = true; const next = vi.fn();
    await authenticateJWT(req(url, method), res(), next);
    expect(next).toHaveBeenCalledOnce();
  });
  it.each([
    ["/api/auth/me", "POST"], ["/api/auth/change-password", "GET"], ["/api/auth/change-password/extra", "POST"],
    ["/api/auth/change-password/", "POST"], ["/api/auth/change-password-bypass", "POST"],
    ["/api/documents/cor-upload/other", "GET"], ["/api/admin/records?path=/api/auth/me", "GET"],
  ])("denies credential bypass %s %s", async (url, method) => {
    account.mustChangePassword = true; const response = res(); const next = vi.fn();
    await authenticateJWT(req(url, method), response, next);
    expect(next).not.toHaveBeenCalled(); expect(response.status).toHaveBeenCalledWith(403);
  });
  it.each(["not-a-jwt", jwt.sign({ userId: "u-1", role: "ADMIN" }, SECRET, { expiresIn: -1 })])("returns 401 for invalid/expired token", async (accessToken) => {
    const response = res(); const next = vi.fn();
    await authenticateJWT(req(undefined, undefined, accessToken), response, next);
    expect(response.status).toHaveBeenCalledWith(401); expect(next).not.toHaveBeenCalled();
    expect(database.user.findUnique).not.toHaveBeenCalled();
  });
  it("returns 401 without a token or account", async () => {
    const response = res(); await authenticateJWT({ headers: {} } as any, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(401);
    database.user.findUnique.mockResolvedValue(null);
    await expect(loadCurrentAccount("u-1")).rejects.toMatchObject({ statusCode: 401 });
  });
  it("fails closed without stale identity on database failure", async () => {
    database.user.findUnique.mockRejectedValue(new Error("offline"));
    const request = req(); request.user = { userId: "u-1", role: "ADMIN" };
    const response = res(); const next = vi.fn();
    await authenticateJWT(request, response, next);
    expect(request.user).toBeUndefined(); expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(503);
  });
  it("returns 500 for missing JWT configuration", async () => {
    const request = req(); delete process.env.JWT_SECRET;
    const response = res(); await authenticateJWT(request, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(500);
  });
  it.each([{ isActive: false }, { mustChangePassword: true }, { role: "UNKNOWN" }])("optional auth grants no identity on %j", async (change) => {
    Object.assign(account, change); const request = req(); const next = vi.fn();
    await optionalAuthenticateJWT(request, res(), next);
    expect(request.user).toBeUndefined(); expect(next).toHaveBeenCalledOnce();
  });
  it("optional auth uses the current role", async () => {
    account.role = "STUDENT"; const request = req();
    await optionalAuthenticateJWT(request, res(), vi.fn());
    expect(request.user.role).toBe("STUDENT");
  });
});

describe("FACULTY-2 minimal self access and credential recovery HTTP", () => {
  it("returns only own safe fields and configured preview without activating grants", async () => {
    account.administratorAccess = { level: "RESTRICTED" };
    account.capabilityGrants = [{ capabilityKey: "applicants.view" }];
    const projection = currentAccountResponse(await loadCurrentAccount("u-1"));
    expect(projection).toEqual({
      user: { id: "u-1", email: "a@example.com", role: "ADMIN", mustChangePassword: false },
      configuredAccess: { status: "RESOLVED", administratorLevel: "RESTRICTED", capabilities: ["applicants.view"] },
      directAccessEnforcementEnabled: false,
    });
    account.mustChangePassword = true;
    expect(currentAccountResponse(await loadCurrentAccount("u-1")).configuredAccess.capabilities).toEqual([]);
  });
  it("fails closed for unknown grants and invalid account snapshots", async () => {
    account.administratorAccess = { level: "FULL" }; account.capabilityGrants = [{ capabilityKey: "forged" }];
    expect(currentAccountResponse(await loadCurrentAccount("u-1")).configuredAccess.capabilities).toEqual([]);
    account.id = "another";
    await expect(loadCurrentAccount("u-1")).rejects.toMatchObject({ statusCode: 503 });
  });
  it("password change clears the current gate and old credential claims cannot keep it locked", async () => {
    const app = express(); app.use(express.json()); app.use("/api/auth", authRoutes);
    app.get("/api/protected", authenticateJWT, (_req, response) => { response.json({ ok: true }); });
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    const accessToken = token("ADMIN", { mustChangePassword: true });
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    account.mustChangePassword = true;
    try {
      expect((await fetch(`${url}/api/protected`, { headers })).status).toBe(403);
      const me = await fetch(`${url}/api/auth/me`, { headers });
      expect(me.status).toBe(200); expect(me.headers.get("cache-control")).toBe("no-store");
      expect((await me.json()).user.mustChangePassword).toBe(true);
      const invalid = await fetch(`${url}/api/auth/change-password`, { method: "POST", headers, body: JSON.stringify({ newPassword: [] }) });
      expect(invalid.status).toBe(400); expect(account.mustChangePassword).toBe(true);
      const changed = await fetch(`${url}/api/auth/change-password`, { method: "POST", headers, body: JSON.stringify({ newPassword: "new-secure-password" }) });
      expect(changed.status).toBe(200); expect(account.mustChangePassword).toBe(false);
      expect(account.passwordHash).not.toBe("private");
      expect((await fetch(`${url}/api/protected`, { headers })).status).toBe(200);
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
});
