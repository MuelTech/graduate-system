import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { executionApplication, executionRevision, executionIds as ids, configuration } from "../../fixtures/exam-execution";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(), user: { findUnique: vi.fn() },
  entranceExamApplication: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() }, systemSetting: { findUnique: vi.fn() }, examContentRevision: { findUnique: vi.fn(), findFirst: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import router from "../../../src/routes/exam-engine.routes";
let server: Server, base: string, app: any;
const secret = "b4-synthetic-auth-secret";
beforeAll(async () => {
  const http = express(); http.use(express.json()); http.use("/exam-engine", router);
  server = createServer(http); server.listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.closeAllConnections(); server.close(); vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("JWT_SECRET", secret); app = executionApplication();
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) + "T00:00:00Z");
  app.slot.examDate = app.examDate = today; app.slot.examTime = app.examTime = new Date("1970-01-01T00:00:00Z");
  db.$transaction.mockImplementation(fn => fn(db)); db.$queryRaw.mockResolvedValue([{}]);
  db.entranceExamApplication.findUnique.mockImplementation(async () => app); db.entranceExamApplication.count.mockResolvedValue(1);
  db.entranceExamApplication.update.mockImplementation(async ({ data }) => { Object.assign(app, data); return app; });
  db.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true }); db.systemSetting.findUnique.mockResolvedValue({ settingType: "JSON", settingValue: JSON.stringify(configuration) });
  db.examContentRevision.findFirst.mockResolvedValue({ id: ids.revision }); db.examContentRevision.findUnique.mockResolvedValue(executionRevision(ids.revision, true));
});
function request(method: string, route: string, role?: string, body: unknown = {}, userId = role === "ADMIN" ? ids.admin : ids.user) {
  const token = role === "invalid" ? "invalid" : role ? jwt.sign({ userId, role }, secret) : null;
  return fetch(`${base}/exam-engine${route}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
}
describe("B4 actual HTTP role and identity boundaries", () => {
  it.each([
    { role: "ADMIN", isActive: false },
    { role: "PANELIST", isActive: true },
  ])("B10 Start authorization revalidates current actor $role/$isActive", async actor => {
    db.user.findUnique.mockResolvedValue(actor);
    expect((await request("POST", `/admin/applications/${ids.app}/start-authorization`, "ADMIN")).status).toBe(403);
    expect(db.entranceExamApplication.update).not.toHaveBeenCalled();
  });
  it.each(["inactive", "demoted"])("B10 new Start rejects %s Applicant persistence", async state => {
    if (state === "inactive") app.student.user.isActive = false;
    else app.student.user.role = "STUDENT";
    expect((await request("POST", `/applications/${ids.app}/start`, "APPLICANT")).status).toBe(409);
    expect(db.entranceExamApplication.update).not.toHaveBeenCalled();
  });
  for (const [method, route, allowed] of [
    ["POST", `/admin/applications/${ids.app}/start-authorization`, "ADMIN"], ["GET", `/admin/applications/${ids.app}/execution`, "ADMIN"],
    ["POST", `/applications/${ids.app}/start`, "APPLICANT"], ["GET", `/applications/${ids.app}/execution`, "APPLICANT"],
    ["GET", `/applications/${ids.app}/questions`, "APPLICANT"],
  ]) {
    it.each([undefined, "invalid", "STUDENT", "PANELIST", "CUSTOM", allowed === "ADMIN" ? "APPLICANT" : "ADMIN"])(`${method} ${route} rejects %s`, async role => {
      const response = await request(method, route, role); expect(response.status).toBe(role ? 403 : 401); expect(db.$transaction).not.toHaveBeenCalled();
    });
  }
  it("Admin authorization has actor/time and no actual start; Applicant starts and reads only bound content", async () => {
    const auth = await request("POST", `/admin/applications/${ids.app}/start-authorization`, "ADMIN"); expect(auth.status).toBe(200);
    expect(await auth.json()).toMatchObject({ actualStartedAt: null, authorization: { authorizedAt: expect.any(String) } }); expect(app.startAuthorizedById).toBe(ids.admin);
    const start = await request("POST", `/applications/${ids.app}/start`, "APPLICANT"); expect(start.status).toBe(200); const started = await start.json();
    const read = await request("GET", `/applications/${ids.app}/execution`, "APPLICANT"); expect(await read.json()).toMatchObject({ deadlineAt: started.deadlineAt });
    const questions = await request("GET", `/applications/${ids.app}/questions`, "APPLICANT"); expect(questions.status).toBe(200); expect(JSON.stringify(await questions.json())).not.toContain("isCorrect"); expect(read.headers.get("cache-control")).toBe("private, no-store");
  });
  it("arbitrary or unstarted content, missing/external IDs and timing fields fail closed", async () => {
    expect((await request("GET", `/applications/${ids.app}/questions`, "APPLICANT")).status).toBe(409);
    expect((await request("POST", `/applications/${ids.app}/start`, "APPLICANT", {}, ids.admin)).status).toBe(404);
    expect((await request("POST", "/applications/malformed/start", "APPLICANT")).status).toBe(400);
    expect((await request("POST", `/applications/${ids.app}/start`, "APPLICANT", { duration: 200 })).status).toBe(400);
    db.entranceExamApplication.findUnique.mockResolvedValue(null);
    expect((await request("POST", `/admin/applications/${ids.app}/start-authorization`, "ADMIN")).status).toBe(404);
  });
  it("retired implicit legacy URLs reject without resolving latest application or reading bank", async () => {
    for (const [method, route] of [["GET", "/questions"], ["PATCH", "/autosave"], ["POST", "/submit"]]) expect((await request(method, route, "APPLICANT")).status).toBe(409);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("unexpected errors are bounded and private", async () => {
    db.$transaction.mockRejectedValue(new Error("private key database")); const response = await request("GET", `/applications/${ids.app}/execution`, "APPLICANT");
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Could not access the examination record." });
  });
});
