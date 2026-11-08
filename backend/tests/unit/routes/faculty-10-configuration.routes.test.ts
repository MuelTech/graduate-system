import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ enabled: true, account: null as any, work: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: { user: { findUnique: async ({ where }: any) => where.id === "actor" ? fixture.account : null } } }));
vi.mock("../../../src/access/faculty-configuration", async original => {
  const real = await original<typeof import("../../../src/access/faculty-configuration")>();
  const { OperationalAuthorization } = await import("../../../src/access/operational-authorization");
  const target = new OperationalAuthorization(true);
  return { ...real, facultyAuthorization: { get enabled() { return fixture.enabled; },
    assert: (...args: Parameters<typeof target.assert>) => target.assert(...args) } };
});
const Controller = vi.hoisted(() => class {
  constructor() { return new Proxy(this, { get: (_target, name) => (req: any, res: any) => {
    fixture.work(name, req.user); res.status(200).json({ ok: true });
  } }); }
});
vi.mock("../../../src/controllers/admin-panelist.controller", () => ({ AdminPanelistController: Controller }));
vi.mock("../../../src/controllers/panelist.controller", () => ({ PanelistController: Controller }));
import adminRoutes from "../../../src/routes/admin-panelist.routes";
import selfRoutes from "../../../src/routes/panelist.routes";
let server: ReturnType<typeof createServer>, base: string;
function account(keys: string[] = [], extra = {}) {
  fixture.account = { id: "actor", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra };
}
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "faculty-10-http-synthetic"); const app = express();
  app.use("/api/admin/panelists", adminRoutes); app.use("/api/panelists", selfRoutes);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
beforeEach(() => { vi.clearAllMocks(); fixture.enabled = true; account(); });
const request = (method: string, path: string, claim = "ADMIN") => fetch(base + path, { method, headers: {
  Authorization: `Bearer ${jwt.sign({ userId: "actor", role: claim, capabilityKeys: ["faculty.manage"] }, process.env.JWT_SECRET!)}`,
} });
const endpoints = [
  ["GET", "/admin/panelists", "faculty.view"], ["GET", "/admin/panelists/profile", "faculty.view"],
  ["POST", "/admin/panelists", "faculty.manage"], ["PUT", "/admin/panelists/profile", "faculty.manage"],
] as const;
describe("FACULTY-10 management HTTP boundaries", () => {
  it.each(endpoints)("%s %s requires %s", async (method, path, key) => {
    account([key]); expect((await request(method, path)).status).toBe(200);
    account([], { administratorAccess: { level: "FULL" } }); expect((await request(method, path)).status).toBe(200);
    for (const keys of [[], ["settings.manage"], ["adviser.requests.review"]]) {
      account(keys); fixture.work.mockClear(); expect((await request(method, path)).status).toBe(403); expect(fixture.work).not.toHaveBeenCalled();
    }
  });
  it("view does not permit create/update; manage includes the read prerequisite", async () => {
    account(["faculty.view"]); expect((await request("POST", "/admin/panelists")).status).toBe(403);
    expect((await request("PUT", "/admin/panelists/profile")).status).toBe(403);
    account(["faculty.manage"]); expect((await request("GET", "/admin/panelists")).status).toBe(200);
  });
  it.each([{ isActive: false }, { mustChangePassword: true }, { administratorAccess: null },
    { administratorAccess: { level: "INVALID" } }, { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
    { capabilityGrants: [{ capabilityKey: "faculty.manage" }, { capabilityKey: "faculty.manage" }] },
  ])("current-invalid Admin %j never reaches management", async extra => {
    account(["faculty.manage"], extra);
    for (const [method, path] of endpoints) expect((await request(method, path)).status).toBe(403);
    expect(fixture.work).not.toHaveBeenCalled();
  });
  it("current identity and grants override stale JWT role and cached grants", async () => {
    account(["faculty.manage"]); expect((await request("GET", "/admin/panelists", "STUDENT")).status).toBe(200);
    account([]); expect((await request("GET", "/admin/panelists")).status).toBe(403);
    account([], { role: "STUDENT", administratorAccess: null }); expect((await request("PUT", "/admin/panelists/profile")).status).toBe(403);
  });
  it.each(["FACULTY", "PANELIST"])("%s cannot self-write availability; own profile read remains", async role => {
    account([], { role, administratorAccess: null, panelist: { isActive: true } });
    expect((await request("PATCH", "/panelists/me/availability")).status).toBe(403);
    expect((await request("GET", "/panelists/me")).status).toBe(200);
    expect((await request("POST", "/admin/panelists")).status).toBe(403);
  });
  it("dormant management stays closed and runtime activation flags do not enable it", async () => {
    fixture.enabled = false; account([], { administratorAccess: { level: "FULL" } }); vi.stubEnv("FACULTY_CONFIGURATION_ENABLED", "true");
    for (const [method, path] of endpoints) expect((await request(method, path)).status).toBe(503);
    expect(fixture.work).not.toHaveBeenCalled();
  });
  it("unauthenticated management is denied", async () => {
    for (const [method, path] of endpoints) expect((await fetch(base + path, { method })).status).toBe(401);
    expect(fixture.work).not.toHaveBeenCalled();
  });
});
