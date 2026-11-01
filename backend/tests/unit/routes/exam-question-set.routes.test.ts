import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { qid, setQuestion } from "../../fixtures/exam-question-set";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), examQuestion: { findMany: vi.fn() }, examQuestionSelection: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() }, examContentRevision: { findFirst: vi.fn(), create: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: db }));
import router from "../../../src/routes/exam-engine.routes";
let server: Server; let base: string;
const secret = "b2-synthetic-auth-secret";
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/exam-engine", router);
  server = createServer(app); server.listen(0, "127.0.0.1"); await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); server.close(); vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("JWT_SECRET", secret);
  db.$transaction.mockImplementation(fn => fn(db)); db.examQuestion.findMany.mockResolvedValue([setQuestion()]);
  db.examQuestionSelection.findMany.mockResolvedValue([{ questionId: qid }]); db.examContentRevision.findFirst.mockResolvedValue(null);
  db.examContentRevision.create.mockResolvedValue({ id: "published-id", publishedAt: new Date(), _count: { questions: 1 } });
});
const routes = [["GET", "/admin/question-set"], ["PUT", "/admin/question-set"], ["POST", "/admin/question-set/publish"]] as const;
function request(method: string, path: string, role?: string, body: unknown = { questionIds: [qid] }) {
  const token = role === "invalid" ? role : role ? jwt.sign({ userId: "admin-actor", role }, secret) : null;
  return fetch(`${base}/exam-engine${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
}
describe("B2 actual route/controller/repository JWT authority", () => {
  for (const [method, path] of routes) {
    it.each([[undefined, 401], ["invalid", 403], ["APPLICANT", 403], ["STUDENT", 403], ["PANELIST", 403]] as const)(`${method} ${path} denies %s`, async (role, status) => {
      expect((await request(method, path, role)).status).toBe(status); expect(db.$transaction).not.toHaveBeenCalled();
    });
    it(`${method} ${path} permits ADMIN with private response`, async () => {
      const response = await request(method, path, "ADMIN"); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
      if (method === "POST") expect(db.examContentRevision.create.mock.calls[0][0].data.publishedById).toBe("admin-actor");
    });
  }
  it("rejects duplicates and unknown IDs without publishing", async () => {
    expect((await request("PUT", "/admin/question-set", "ADMIN", { questionIds: [qid, qid] })).status).toBe(400);
    db.examQuestion.findMany.mockResolvedValue([]);
    expect((await request("PUT", "/admin/question-set", "ADMIN")).status).toBe(400); expect(db.examContentRevision.create).not.toHaveBeenCalled();
  });
  it("bounds unexpected errors", async () => {
    db.$transaction.mockRejectedValue(new Error("secret storage key")); const response = await request("GET", "/admin/question-set", "ADMIN");
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Could not access the Question Set." });
  });
  it("offers no Applicant revision/binding endpoint", async () => {
    expect((await request("GET", "/revisions/published-id", "APPLICANT")).status).toBe(404);
  });
});
