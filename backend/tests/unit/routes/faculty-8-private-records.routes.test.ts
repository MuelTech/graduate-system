import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ account: null as any, enabled: true, work: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: { user: { findUnique: async ({ where }: any) => where.id === "actor" ? fixture.account : null } } }));
vi.mock("../../../src/access/private-record-authorization", async importOriginal => {
  const original = await importOriginal<typeof import("../../../src/access/private-record-authorization")>();
  const target = new original.PrivateRecordAuthorization(true);
  const dormant = new original.PrivateRecordAuthorization();
  return { ...original, privateRecordAuthorization: {
    current: (...args: Parameters<typeof target.current>) => (fixture.enabled ? target : dormant).current(...args),
    can: (...args: Parameters<typeof target.can>) => (fixture.enabled ? target : dormant).can(...args),
  } };
});
const Controller = vi.hoisted(() => class {
  constructor() { return new Proxy(this, { get: (_target, name) => (req: any, res: any) => {
    fixture.work(name, req.user); res.status(200).json({ ok: true });
  } }); }
});
vi.mock("../../../src/controllers/thesis.controller", () => ({ ThesisController: Controller }));
vi.mock("../../../src/controllers/defense-collaboration.controller", () => ({ DefenseCollaborationController: Controller }));
vi.mock("../../../src/controllers/defense-history.controller", () => ({ DefenseHistoryController: Controller }));
vi.mock("../../../src/middlewares/upload.middleware", () => ({ secureUpload: () => ({ fields: () => (_req: any, _res: any, next: any) => next(), single: () => (_req: any, _res: any, next: any) => next() }) }));
import routes from "../../../src/routes/thesis.routes";
const endpoints = [
  ["/adviser-certifications?thesisId=thesis", "defense.applications.view"],
  ["/adviser-certifications/cert/pdf", "defense.applications.view"],
  ["/adviser/requests/records", "adviser.requests.view"], ["/adviser/requests/request/pdf", "adviser.requests.view"],
  ["/defense/schedule/records/criteria/assignment", "defense.records.view"],
  ["/defense/schedule/records/criteria/assignment/pdf", "defense.records.view"],
  ["/defense/schedule/records/summary", "defense.records.view"], ["/defense/schedule/records/summary/pdf", "defense.records.view"],
  ["/defense/schedule/records/application/pdf", "defense.records.view"], ["/defense/schedule/records/evaluations/pdf", "defense.records.view"],
] as const;
let server: ReturnType<typeof createServer>, base: string;
function account(keys: string[] = [], extra = {}) {
  fixture.account = { id: "actor", email: "actor@example.test", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra };
}
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "faculty-8-synthetic-http"); const app = express(); app.use("/api/thesis", routes);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/thesis`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
beforeEach(() => { vi.clearAllMocks(); fixture.enabled = true; account(); });
const get = (path: string, claim = "ADMIN") => fetch(base + path, { headers: { Authorization: `Bearer ${jwt.sign({ userId: "actor", role: claim,
  capabilityGrants: endpoints.map(row => row[1]) }, process.env.JWT_SECRET!)}` } });

describe("FACULTY-8 private official-record route capability matrix", () => {
  it.each(endpoints)("%s requires %s", async (path, key) => {
    account([key]); expect((await get(path)).status).toBe(200);
    account([], { administratorAccess: { level: "FULL" } }); expect((await get(path)).status).toBe(200);
    for (const keys of [[], ["students.view"], ["exam.records.view"]]) {
      account(keys); fixture.work.mockClear(); expect((await get(path)).status).toBe(403); expect(fixture.work).not.toHaveBeenCalled();
    }
  });
  it("GS-017 also accepts schedule capability at the route; service proves the exact context", async () => {
    account(["defense.schedules.view"]);
    for (const [path] of endpoints.slice(0, 2)) expect((await get(path)).status).toBe(200);
    for (const [path] of endpoints.slice(2)) expect((await get(path)).status).toBe(403);
  });
  it.each([{ isActive: false }, { mustChangePassword: true }, { administratorAccess: null },
    { administratorAccess: { level: "INVALID" } }, { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
    { capabilityGrants: [{ capabilityKey: "cor.view" }, { capabilityKey: "cor.view" }] },
  ])("current invalid authority %j cannot reach a controller", async extra => {
    account([], { administratorAccess: { level: "FULL" }, ...extra });
    for (const [path] of endpoints) expect((await get(path)).status).toBe(403);
    expect(fixture.work).not.toHaveBeenCalled();
  });
  it("current grants override stale token role and cached grants; revocation takes effect", async () => {
    account(["defense.records.view"]); expect((await get(endpoints[4][0], "CUSTOM")).status).toBe(200);
    account([]); expect((await get(endpoints[4][0])).status).toBe(403);
  });
  it("essay-only Faculty never enters Admin official-output routes", async () => {
    account(["essay.evaluate"], { role: "FACULTY", administratorAccess: null, panelist: { isActive: true } });
    for (const [path] of endpoints.filter(([path]) => path.includes("/records/") && path !== "/adviser/requests/records")) {
      if (path === endpoints[4][0]) continue; // Safe own-evaluator JSON is checked by the owning service.
      expect((await get(path, "ADMIN")).status).toBe(403);
    }
  });
  it("ordinary composition remains dormant with no live Admin mappings", async () => {
    fixture.enabled = false; account([], { administratorAccess: null });
    for (const [path] of endpoints) expect((await get(path)).status).toBe(200);
  });
});
