import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { executionApplication, executionRevision, executionIds as ids, configuration } from "../../fixtures/exam-execution";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(),
  entranceExamApplication: { findUnique: vi.fn() }, examContentRevision: { findUnique: vi.fn() },
  applicantAnswer: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import router from "../../../src/routes/exam-engine.routes";
let server: Server, base: string, app: any, revision: any, saved: any;
const secret = "b5-synthetic-secret";
beforeAll(async () => {
  const http = express(); http.use(express.json()); http.use(router); server = createServer(http); server.listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.closeAllConnections(); server.close(); vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("JWT_SECRET", secret); app = executionApplication(); saved = null; revision = executionRevision();
  app.actualStartedAt = new Date(); app.deadlineAt = new Date(app.actualStartedAt.getTime() + 120 * 60_000); app.executionConfiguration = { ...configuration, timezone: "Asia/Manila", passingThresholdUnit: "PERCENT" }; app.contentRevisionId = ids.revision;
  db.$transaction.mockImplementation(fn => fn(db)); db.$queryRaw.mockResolvedValue([{ status: "PENDING" }]);
  db.entranceExamApplication.findUnique.mockImplementation(async () => app); db.examContentRevision.findUnique.mockImplementation(async () => revision);
  db.applicantAnswer.findUnique.mockImplementation(async () => saved);
  db.applicantAnswer.findMany.mockImplementation(async () => saved ? [saved] : []);
  db.applicantAnswer.upsert.mockImplementation(async ({ create }) => { saved = create; return saved; });
});
const q = () => revision.questions[0].content;
function request(method = "GET", body?: unknown, role: string | undefined = "APPLICANT", userId = ids.user, route = "drafts") {
  const token = role === "invalid" ? "invalid" : role ? jwt.sign({ userId, role }, secret) : null;
  return fetch(`${base}/applications/${ids.app}/${route}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
}
const payload = () => ({ questionId: q().id, selectedOptionId: q().options[0].id, expectedRevision: 0 });
describe("B5 real router/controller/repository authority and contract", () => {
  for (const method of ["GET", "PATCH"]) it.each([undefined, "invalid", "ADMIN", "STUDENT", "PANELIST", "CUSTOM"])(`${method} rejects role %s`, async role => {
    // Explicit undefined must avoid the request helper's default.
    const response = role === undefined ? await fetch(`${base}/applications/${ids.app}/drafts`, { method }) : await request(method, payload(), role);
    expect(response.status).toBe(role ? 403 : 401); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("reads exact bound drafts with a safe no-store DTO, retaining null clear/version", async () => {
    saved = { questionId: q().id, selectedOptionId: null, essayAnswer: null, draftRevision: 4, storageKey: "secret", isCorrect: true };
    const response = await request(); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual([{ questionId: q().id, selectedOptionId: null, revision: 4 }]);
    expect(db.applicantAnswer.findMany.mock.calls[0][0].where).toEqual({ applicationId: ids.app, questionId: { in: [q().id] } });
  });
  it.each(["GET", "PATCH"])("%s rejects another Applicant and repeats owner check after lock", async method => {
    expect((await request(method, payload(), "APPLICANT", ids.admin)).status).toBe(404);
    db.entranceExamApplication.findUnique.mockResolvedValueOnce(app).mockResolvedValueOnce({ ...app, student: { ...app.student, userId: ids.admin } });
    expect((await request(method, payload())).status).toBe(404); expect(db.applicantAnswer.upsert).not.toHaveBeenCalled();
  });
  for (const method of ["GET", "PATCH"]) it.each(["unstarted", "expired", "terminal", "blocked", "unbound"])(`${method} rejects %s`, async state => {
    if (state === "unstarted") app.actualStartedAt = null;
    if (state === "expired") { app.actualStartedAt = new Date(Date.now() - 121 * 60_000); app.deadlineAt = new Date(app.actualStartedAt.getTime() + 120 * 60_000); }
    if (state === "terminal") db.$queryRaw.mockResolvedValue([{ status: "TAKEN" }]);
    if (state === "blocked") app.student.user.isActive = false;
    if (state === "unbound") app.contentRevisionId = null;
    expect((await request(method, payload())).status).toBe(409); expect(db.applicantAnswer.upsert).not.toHaveBeenCalled();
  });
  it("selects, changes and clears MCQ with monotonic acknowledgments; stale/duplicate requests reject", async () => {
    const first = payload(); expect(await (await request("PATCH", first)).json()).toMatchObject({ revision: 1, selectedOptionId: first.selectedOptionId });
    expect((await request("PATCH", first)).status).toBe(409);
    expect(await (await request("PATCH", { ...first, selectedOptionId: q().options[1].id, expectedRevision: 1 })).json()).toMatchObject({ revision: 2 });
    expect(await (await request("PATCH", { ...first, selectedOptionId: null, expectedRevision: 2 })).json()).toMatchObject({ selectedOptionId: null, revision: 3 });
    expect((await request("PATCH", { ...first, expectedRevision: 1 })).status).toBe(409); expect(saved.selectedOptionId).toBeNull();
  });
  it.each([
    { questionId: "malformed", expectedRevision: 0, essayAnswer: "x" },
    { selectedOptionId: ids.admin }, { questionId: ids.admin }, { essayAnswer: "contradictory" },
    { expectedRevision: -1 }, { expectedRevision: 1.5 }, { expectedRevision: "0" }, { expectedRevision: 2147483647 },
    { expectedRevision: undefined }, { isCorrect: true }, { selectedOptionId: "bad" },
  ])("rejects malformed/type/foreign payload %# before persistence", async patch => {
    const response = await request("PATCH", { ...payload(), ...patch });
    expect(response.status).toBe(400); expect(db.applicantAnswer.upsert).not.toHaveBeenCalled();
  });
  it("supports essay first save, edits, blank and byte bounds; rejects MCQ representation", async () => {
    q().type = "ESSAY"; q().options = [];
    for (const [expectedRevision, essayAnswer] of [[0, "draft"], [1, "continued"], [2, ""]] as const) {
      expect(await (await request("PATCH", { questionId: q().id, expectedRevision, essayAnswer })).json()).toMatchObject({ essayAnswer, revision: expectedRevision + 1 });
    }
    expect(await (await request()).json()).toEqual([{ questionId: q().id, essayAnswer: "", revision: 3 }]);
    expect((await request("PATCH", { questionId: q().id, expectedRevision: 3, essayAnswer: "😀".repeat(16384) })).status).toBe(400);
    expect((await request("PATCH", { questionId: q().id, expectedRevision: 3, selectedOptionId: null })).status).toBe(400);
  });
  it("the transitional autosave URL requires the same versioned contract", async () => {
    expect((await request("PATCH", { questionId: q().id, essayAnswer: "unversioned" }, "APPLICANT", ids.user, "autosave")).status).toBe(400);
    expect((await request("PATCH", payload(), "APPLICANT", ids.user, "autosave")).status).toBe(200);
  });
  it("unexpected persistence errors are bounded and never acknowledge save", async () => {
    db.applicantAnswer.upsert.mockRejectedValue(new Error("private correctness data")); const response = await request("PATCH", payload());
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Could not save answer." });
  });
});
