import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const source = vi.hoisted(() => ({ database: null as any }));
vi.mock("../../../src/config/database", () => ({ default: { user: { findUnique: (query: unknown) => source.database.user.findUnique(query) } } }));
import { createAdministratorAccessRouter } from "../../../src/routes/administrator-access.routes";
import { AdministratorAccessRepository } from "../../../src/repositories/administrator-access.repository";
import { AdministratorAccessService } from "../../../src/services/administrator-access.service";
import { administratorDatabase } from "../../fixtures/administrator-management";

const secret = "faculty-4-synthetic-http-secret";
let fixture: ReturnType<typeof administratorDatabase>;
let management: AdministratorAccessService;
let server: ReturnType<typeof createServer>;
let url: string;
beforeEach(async () => {
  vi.stubEnv("JWT_SECRET", secret); fixture = administratorDatabase(); source.database = fixture.database;
  const repository = new AdministratorAccessRepository(fixture.database as never);
  management = new AdministratorAccessService(repository, () => true);
  const app = express(); app.use(express.json());
  app.use("/api/admin/administrators", createAdministratorAccessRouter(management));
  app.use("/api/dormant", createAdministratorAccessRouter(new AdministratorAccessService(repository)));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); vi.unstubAllEnvs();
});
function request(method: string, path = "", body?: unknown, actor = "full-a", claim = "ADMIN") {
  return fetch(`${url}/api/admin/administrators${path}`, { method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt.sign({ userId: actor, role: claim }, secret)}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
const create = { email: "new@example.test", firstName: "New", lastName: "Administrator", level: "RESTRICTED", capabilityKeys: ["students.view"] };
const routes = [
  ["GET", "", undefined], ["GET", "/restricted", undefined], ["POST", "", create],
  ["PATCH", "/full-a", { level: "FULL", capabilityKeys: [] }], ["DELETE", "/full-a/access", undefined],
] as const;
describe("FACULTY-4 real router/current-account boundary", () => {
  it("requires a valid token and preserves 401 versus authenticated 403", async () => {
    const endpoint = `${url}/api/admin/administrators`;
    expect((await fetch(endpoint)).status).toBe(401);
    expect((await fetch(endpoint, { headers: { Authorization: "Bearer invalid" } })).status).toBe(401);
    expect((await request("GET", "", undefined, "restricted")).status).toBe(403);
  });
  it.each([
    { administratorAccess: null }, { administratorAccess: { level: "RESTRICTED" } }, { administratorAccess: { level: "invalid" } },
    { isActive: false }, { mustChangePassword: true }, { role: "CUSTOM" }, { role: "FACULTY", panelist: { isActive: true } },
    { role: "PANELIST", panelist: { isActive: true } }, { role: "STUDENT" }, { role: "APPLICANT" },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
  ])("denies every management route for current actor %j despite stale ADMIN claims", async change => {
    Object.assign(fixture.control.state.users[0], change);
    for (const [method, path, body] of routes) expect((await request(method, path, body)).status).toBe(change.role === "CUSTOM" ? 503 : 403);
    expect(fixture.database.$transaction).not.toHaveBeenCalled();
  });
  it("denies Restricted self-elevation and editing another Administrator", async () => {
    expect((await request("PATCH", "/restricted", { level: "FULL" }, "restricted")).status).toBe(403);
    expect((await request("PATCH", "/full-b", { isActive: false }, "restricted")).status).toBe(403);
    expect(fixture.control.state.audits).toEqual([]);
  });
  it("uses fresh Full state rather than an old non-ADMIN token claim", async () => {
    expect((await request("GET", "", undefined, "full-a", "CUSTOM")).status).toBe(200);
    const result = await request("GET", "/restricted"); expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.json()).toMatchObject({ id: "restricted", role: "ADMIN", level: "RESTRICTED" });
  });
  it.each([
    { ...create, role: "ADMIN" }, { ...create, actorId: "full-a" }, { ...create, mustChangePassword: false },
    { ...create, capabilityKeys: ["essay.evaluate"] }, { ...create, capabilityKeys: ["administrator_access.manage"] },
    { ...create, capabilityKeys: ["unknown"] }, { ...create, capabilityKeys: ["students.view", "students.view"] },
  ])("rejects HTTP privilege/body injection %j", async body => {
    expect((await request("POST", "", body)).status).toBe(400); expect(fixture.control.state.users).toHaveLength(3);
  });
  it("creates temporary credentials once, never returns them on reads, and leaves ADMIN role fixed", async () => {
    const created = await request("POST", "", create); expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("private, no-store");
    const body = await created.json(); expect(body.temporaryPassword).toHaveLength(43);
    expect(body.account).toMatchObject({ role: "ADMIN", mustChangePassword: true });
    const detail = await request("GET", `/${body.account.id}`);
    expect(await detail.text()).not.toMatch(/passwordHash|temporaryPassword/);
    expect((await request("GET", "", undefined, body.account.id)).status).toBe(403);
  });
  it("keeps production's dormant default closed even for a synthetic Full account", async () => {
    const result = await fetch(`${url}/api/dormant`, { headers: { Authorization: `Bearer ${jwt.sign({ userId: "full-a", role: "ADMIN" }, secret)}` } });
    expect(result.status).toBe(503); expect(fixture.database.$transaction).not.toHaveBeenCalled();
  });
  it("does not expose partial credentials or target writes after audit failure", async () => {
    fixture.control.failAudit = true;
    const result = await request("POST", "", create);
    expect(result.status).toBe(500); expect(await result.text()).not.toMatch(/password|hash|Synthetic audit failure/);
    expect(fixture.control.state.users).toHaveLength(3); expect(fixture.control.state.audits).toEqual([]);
  });
  it("rejects an HTTP mutation that passed the route guard before its actor lost Full while waiting", async () => {
    const held = fixture.control.holdNextFence();
    const demotion = management.update("full-b", "full-a", { level: "RESTRICTED", capabilityKeys: [] });
    await held.entered.promise;
    const waiting = request("PATCH", "/restricted", { level: "FULL" });
    try {
      await vi.waitFor(() => expect(fixture.database.$transaction).toHaveBeenCalledTimes(2));
    } finally { held.release.resolve(); }
    await demotion; expect((await waiting).status).toBe(403);
    expect(fixture.control.state.users.find(user => user.id === "restricted")?.administratorAccess?.level).toBe("RESTRICTED");
  });
});
