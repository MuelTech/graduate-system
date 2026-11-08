import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { defenseAdviserEndpoints as endpoints } from "../../fixtures/defense-adviser-endpoints";

const fixture = vi.hoisted(() => ({ actor: null as any, enabled: true, work: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: { user: { findUnique: async ({ where }: any) => where.id === "actor" ? fixture.actor : null } } }));
vi.mock("../../../src/access/defense-adviser-authorization", async importOriginal => {
  const original = await importOriginal<typeof import("../../../src/access/defense-adviser-authorization")>();
  const enabled = new original.DefenseAdviserAuthorization(true);
  const dormant = new original.DefenseAdviserAuthorization();
  return { ...original, defenseAdviserAuthorization: {
    assert: (...args: Parameters<typeof enabled.assert>) => (fixture.enabled ? enabled : dormant).assert(...args),
    assertExcluded: () => (fixture.enabled ? enabled : dormant).assertExcluded(),
  } };
});
// Real JWT/current-account and route middleware; domain behavior is tested separately.
const controller = vi.hoisted(() => class {
  constructor() {
    return new Proxy(this, { get: (_target, name) => (req: any, res: any) => {
      fixture.work(name, req.user?.userId);
      res.status(name === "distributeRapReport" ? 409 : 200).json({ ok: true });
    } });
  }
});
vi.mock("../../../src/controllers/thesis.controller", () => ({ ThesisController: controller }));
vi.mock("../../../src/controllers/defense-collaboration.controller", () => ({ DefenseCollaborationController: controller }));
vi.mock("../../../src/controllers/defense-history.controller", () => ({ DefenseHistoryController: controller }));
vi.mock("../../../src/middlewares/upload.middleware", () => ({ secureUpload: () => ({ fields: () => (_req: any, _res: any, next: any) => next(), single: () => (_req: any, _res: any, next: any) => next() }) }));
import routes from "../../../src/routes/thesis.routes";
let server: ReturnType<typeof createServer>, base: string;
function actor(keys: readonly string[] = [], changes = {}) {
  fixture.actor = { id: "actor", email: "actor@example.test", role: "ADMIN", isActive: true, mustChangePassword: false,
    panelist: null, administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...changes };
}
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "faculty-7-synthetic-http");
  const app = express(); app.use(express.json()); app.use("/api/thesis", routes);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/thesis`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
beforeEach(() => { vi.clearAllMocks(); fixture.enabled = true; actor(); });
function request(method: string, path: string, claim = "ADMIN") {
  return fetch(base + path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt.sign({ userId: "actor", role: claim, capabilities: endpoints.map(row => row[2]) }, process.env.JWT_SECRET!)}` },
    ...(method === "GET" ? {} : { body: JSON.stringify({ actorId: "other-full-admin", role: "ADMIN", capabilityKeys: endpoints.map(row => row[2]) }) }) });
}
// FACULTY-8 now owns private official-record reads; remaining exclusions stay FACULTY-7-owned.
const deferred = ["/adviser/available", "/defense/target/lobby", "/eligibility/TITLE_DEFENSE"];
const academic = [
  ["POST", "/defense/target/score"], ["GET", "/defense/target/evaluation/me"], ["PUT", "/defense/target/evaluation/draft"], ["POST", "/defense/target/evaluation/finalize"],
  ["POST", "/defense/target/start"], ["POST", "/defense/target/conclusion"], ["POST", "/defense/target/conclude"],
  ["GET", "/defense/target/workspace"], ["PUT", "/defense/target/workspace/rapporteur-notes"], ["PUT", "/defense/target/notes"], ["POST", "/defense/target/rapporteur/finalize"],
  ["PUT", "/defense/target/collaboration/report"], ["POST", "/defense/target/collaboration/report/freeze"], ["POST", "/defense/target/collaboration/report/sign"], ["POST", "/defense/rap-reports/target/sign"],
  ["GET", "/adviser/workspace"], ["GET", "/adviser/advisees/target"], ["POST", "/adviser/requests/target/adviser-response"],
];
describe("FACULTY-7 complete administrative route matrix", () => {
  it.each(endpoints)("%s %s requires %s", async (method, path, key) => {
    actor([], { administratorAccess: { level: "FULL" } }); expect((await request(method, path)).status).toBe(200);
    actor([key]); expect((await request(method, path)).status).toBe(200);
    actor(["students.view"]); fixture.work.mockClear(); expect((await request(method, path)).status).toBe(403); expect(fixture.work).not.toHaveBeenCalled();
  });
  it.each(["adviser.requests.view", "defense.applications.view", "defense.schedules.view", "defense.records.view"])("%s never authorizes mutations", async key => {
    actor([key]);
    for (const [method, path] of endpoints.filter(([method]) => method !== "GET")) expect((await request(method, path)).status).toBe(403);
    expect(fixture.work).not.toHaveBeenCalled();
  });
  it.each(["adviser.requests.review", "defense.applications.review", "defense.schedules.manage"])("%s expands only to its read prerequisites", async key => {
    actor([key]); const readKey = key.replace(/review|manage/, "view");
    for (const [method, path, required] of endpoints) {
      expect((await request(method, path)).status).toBe(required === key || required === readKey ? 200 : 403);
    }
  });
  it.each([{ administratorAccess: null }, { administratorAccess: { level: "INVALID" } },
    { capabilityGrants: [{ capabilityKey: "unknown" }] }, { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
    { capabilityGrants: [{ capabilityKey: "defense.records.view" }, { capabilityKey: "defense.records.view" }] },
    { role: "STUDENT" }, { role: "FACULTY", panelist: { isActive: true } }, { isActive: false }, { mustChangePassword: true },
  ])("fails closed for current invalid actor %j", async extra => {
    actor([], { administratorAccess: { level: "FULL" }, ...extra });
    for (const [method, path] of endpoints) expect((await request(method, path)).status).toBe(403);
    expect(fixture.work).not.toHaveBeenCalled();
  });
  it.each(["FULL", "ALL_FACULTY_7"])("%s cannot perform academic actions or deferred Admin actions", async mode => {
    actor(mode === "FULL" ? [] : [...new Set(endpoints.map(row => row[2]))], mode === "FULL" ? { administratorAccess: { level: "FULL" } } : {});
    for (const [method, path] of academic) expect((await request(method, path)).status, path).toBe(403);
    for (const path of deferred) expect((await request("GET", path)).status, path).toBe(403);
    expect((await request("POST", "/defense/rap-reports/target/remind")).status).toBe(403);
    expect(fixture.work).not.toHaveBeenCalled();
    expect((await request("POST", "/defense/rap-reports/target/distribute")).status).toBe(409);
  });
  it("uses current role and grants over stale JWT claims", async () => {
    actor(["defense.records.view"]); expect((await request("GET", "/defense/records", "CUSTOM")).status).toBe(200);
    fixture.actor.capabilityGrants = []; expect((await request("GET", "/defense/records")).status).toBe(403);
  });
  it("preserves Student candidate flow and legacy availability without an Admin directory grant", async () => {
    actor([], { role: "STUDENT", administratorAccess: null });
    expect((await request("GET", "/adviser/candidates", "STUDENT")).status).toBe(200);
    expect((await request("GET", "/adviser/available", "STUDENT")).status).toBe(200);
  });
  it("default composition stays dormant even with environment/request claims", async () => {
    fixture.enabled = false; actor([], { administratorAccess: null });
    vi.stubEnv("DEFENSE_ADVISER_CAPABILITY_ENFORCEMENT_ENABLED", "true");
    for (const [method, path] of endpoints) expect((await request(method, path)).status).toBe(200);
    expect((await request("GET", "/adviser/available")).status).toBe(200);
    expect((await request("POST", "/defense/rap-reports/target/remind")).status).toBe(200);
    expect((await request("POST", "/defense/rap-reports/target/distribute")).status).toBe(409);
  });
});
