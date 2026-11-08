import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ account: null as any, enabled: true, work: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: { user: { findUnique: async ({ where }: any) => where.id === "actor" ? fixture.account : null } } }));
vi.mock("../../../src/access/operational-authorization", async importOriginal => {
  const original = await importOriginal<typeof import("../../../src/access/operational-authorization")>();
  const target = new original.OperationalAuthorization(true); const dormant = new original.OperationalAuthorization();
  return { ...original, operationalAuthorization: {
    current: (...args: Parameters<typeof target.current>) => (fixture.enabled ? target : dormant).current(...args),
    assert: (...args: Parameters<typeof target.assert>) => (fixture.enabled ? target : dormant).assert(...args),
    capabilities: (...args: Parameters<typeof target.capabilities>) => (fixture.enabled ? target : dormant).capabilities(...args),
    assertExcluded: () => (fixture.enabled ? target : dormant).assertExcluded(),
  } };
});
const Controller = vi.hoisted(() => class {
  constructor() { return new Proxy(this, { get: (_target, name) => (req: any, res: any) => {
    fixture.work(name, req.user); res.status(200).json({ ok: true });
  } }); }
});
vi.mock("../../../src/controllers/settings.controller", () => ({ SettingsController: Controller }));
vi.mock("../../../src/controllers/storage-health.controller", () => ({ StorageHealthController: Controller }));
vi.mock("../../../src/controllers/repository.controller", () => ({ RepositoryController: Controller }));
vi.mock("../../../src/controllers/databank.controller", () => ({ DatabankController: Controller }));
vi.mock("../../../src/controllers/memo.controller", () => ({ MemoController: Controller }));
vi.mock("../../../src/controllers/admin-dashboard.controller", () => ({ AdminDashboardController: Controller }));
vi.mock("../../../src/controllers/admin-panelist.controller", () => ({ AdminPanelistController: Controller }));
vi.mock("../../../src/controllers/evaluation.controller", () => ({ EvaluationController: Controller }));
vi.mock("../../../src/controllers/email.controller", () => ({ emailController: { getEmailLogs: (_req: any, res: any) => { fixture.work(); res.status(200).json({ ok: true }); } } }));
vi.mock("../../../src/middlewares/upload.middleware", () => ({ upload: { single: () => (_req: any, _res: any, next: any) => next() },
  secureUpload: () => ({ single: () => (_req: any, _res: any, next: any) => next() }) }));
vi.mock("../../../src/storage/secure-upload", () => ({ secureUpload: () => ({ fields: () => (_req: any, _res: any, next: any) => next() }) }));
import settings from "../../../src/routes/settings.routes";
import storage from "../../../src/routes/admin-storage.routes";
import repository from "../../../src/routes/repository.routes";
import databank from "../../../src/routes/databank.routes";
import memos from "../../../src/routes/memo.routes";
import email from "../../../src/routes/email.routes";
import dashboard from "../../../src/routes/admin-dashboard.routes";
import faculty from "../../../src/routes/admin-panelist.routes";
import evaluation from "../../../src/routes/evaluation.routes";
const endpoints = [
  ["GET", "/settings", "settings.view"], ["PUT", "/settings/ACADEMIC_YEAR", "settings.manage"],
  ["GET", "/settings/email-templates", "email.configuration.manage"], ["PUT", "/settings/email-templates/memo_broadcast", "email.configuration.manage"],
  ["GET", "/settings/audit-logs", "audit.view"], ["GET", "/admin/email-logs/logs", "email.logs.view"],
  ["GET", "/admin/storage/health", "storage.health.view"], ["POST", "/admin/storage/integrity-scan", "storage.integrity.scan"],
  ["GET", "/repository/admin/entries", "repository.view"], ["PUT", "/repository/admin/entries/entry/publish", "repository.manage"],
  ["PUT", "/repository/admin/entries/entry/unpublish", "repository.manage"], ["PUT", "/repository/admin/entries/entry/metadata", "repository.manage"],
  ["GET", "/databank", "repository.view"], ["POST", "/memos", "memos.manage"],
  ["PATCH", "/memos/memo/archive", "memos.manage"], ["GET", "/memos", "memos.manage"],
] as const;
const excluded = [
  ["DELETE", "/settings/audit-logs/log"], ["POST", "/settings/audit-logs/delete"], ["POST", "/evaluation/request/assign"],
  ["GET", "/admin/panelists"], ["GET", "/admin/panelists/faculty"], ["POST", "/admin/panelists"], ["PUT", "/admin/panelists/faculty"],
] as const;
let server: ReturnType<typeof createServer>, base: string;
function account(keys: string[] = [], extra = {}) {
  fixture.account = { id: "actor", email: "actor@example.test", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra };
}
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "faculty-9-http-synthetic"); const app = express();
  for (const [path, routes] of [["/settings", settings], ["/admin/storage", storage], ["/repository", repository], ["/databank", databank],
    ["/memos", memos], ["/admin/email-logs", email], ["/admin/dashboard", dashboard], ["/admin/panelists", faculty], ["/evaluation", evaluation]] as const) app.use("/api" + path, routes);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
beforeEach(() => { vi.clearAllMocks(); fixture.enabled = true; account(); });
const request = (method: string, path: string, claim = "ADMIN", userId = "actor") => fetch(base + path, { method, headers: {
  Authorization: `Bearer ${jwt.sign({ userId, role: claim, capabilities: endpoints.map(row => row[2]) }, process.env.JWT_SECRET!)}`,
} });
describe("FACULTY-9 HTTP action/capability matrix", () => {
  it.each(endpoints)("%s %s requires %s", async (method, path, key) => {
    account([key]); expect((await request(method, path)).status).toBe(200);
    account([], { administratorAccess: { level: "FULL" } }); expect((await request(method, path)).status).toBe(200);
    for (const keys of [[], ["students.view"], ["exam.records.view"]]) {
      account(keys); fixture.work.mockClear(); expect((await request(method, path)).status).toBe(403); expect(fixture.work).not.toHaveBeenCalled();
    }
  });
  it.each([{ isActive: false }, { mustChangePassword: true }, { administratorAccess: null },
    { administratorAccess: { level: "INVALID" } }, { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
    { capabilityGrants: [{ capabilityKey: "repository.view" }, { capabilityKey: "repository.view" }] },
  ])("invalid current access %j reaches no controller", async extra => {
    account([], { administratorAccess: { level: "FULL" }, ...extra });
    for (const [method, path] of endpoints) expect((await request(method, path)).status).toBe(403);
    expect((await request("GET", "/admin/dashboard")).status).toBe(403); expect(fixture.work).not.toHaveBeenCalled();
  });
  it("stale ADMIN JWT and cached grants cannot restore revoked/current Student authority", async () => {
    account(["repository.view"]); expect((await request("GET", "/repository/admin/entries", "CUSTOM")).status).toBe(200);
    account([]); expect((await request("GET", "/repository/admin/entries")).status).toBe(403);
    account([], { role: "STUDENT", administratorAccess: null });
    for (const [method, path] of endpoints.filter(([, path]) => path !== "/memos")) expect((await request(method, path)).status).toBe(403);
  });
  it.each(excluded)("%s %s is denied even to Full", async (method, path) => {
    account([], { administratorAccess: { level: "FULL" } }); expect((await request(method, path)).status).toBe(403); expect(fixture.work).not.toHaveBeenCalled();
  });
  it("valid Restricted dashboard may have no modules; projection is checked independently", async () => {
    expect((await request("GET", "/admin/dashboard")).status).toBe(200);
  });
  it.each(["STUDENT", "PANELIST", "FACULTY", "APPLICANT"])("shared Memo feed retains %s audience path", async role => {
    account([], { role, administratorAccess: null, panelist: ["PANELIST", "FACULTY"].includes(role) ? { isActive: true } : null });
    expect((await request("GET", "/memos")).status).toBe(200);
  });
  it("public Repository and Databank aliases remain public", async () => {
    for (const path of ["/repository", "/repository/entry", "/databank/public", "/databank/public/entry"]) expect((await fetch(base + path)).status).toBe(200);
    expect((await fetch(base + "/settings")).status).toBe(401);
  });
  it("Student archive ownership routes remain separate from repository grants", async () => {
    account([], { role: "STUDENT", administratorAccess: null });
    for (const [method, path] of [["GET", "/databank/archive/me"], ["POST", "/databank/archive"], ["POST", "/databank"]]) expect((await request(method, path)).status).toBe(200);
    account(["repository.manage"]); expect((await request("POST", "/databank/archive")).status).toBe(403);
  });
  it("all existing role-only behaviors remain dormant until code-owned activation", async () => {
    fixture.enabled = false; account([], { administratorAccess: null });
    for (const [method, path] of [...endpoints, ...excluded]) expect((await request(method, path)).status).toBe(200);
  });
});
