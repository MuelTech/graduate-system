import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ actor: null as any, enabled: true,
  queue: vi.fn(), detail: vi.fn(), grade: vi.fn(), image: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: { user: { findUnique: async ({ where }: any) => where.id === "evaluator" ? fixture.actor : null } } }));
vi.mock("../../../src/access/faculty-essay-authorization", async original => {
  const real = await original<typeof import("../../../src/access/faculty-essay-authorization")>();
  const access = new real.FacultyEssayAuthorization(true);
  return { ...real, facultyEssayAuthorization: { assert: async (id: string) => {
    if (!fixture.enabled) throw new (await import("../../../src/utils/AppError")).AppError("Unavailable", 503);
    return access.assert(id);
  } } };
});
vi.mock("../../../src/access/exam-administration-authorization", async original => {
  const real = await original<typeof import("../../../src/access/exam-administration-authorization")>();
  return { ...real, examAdministrationAuthorization: new real.ExamAdministrationAuthorization(true) };
});
vi.mock("../../../src/services/faculty-essay-evaluation.service", () => ({ FacultyEssayEvaluationService: class {
  queue = fixture.queue; detail = fixture.detail; grade = fixture.grade;
} }));
vi.mock("../../../src/services/exam-media.service", () => ({ ExamMediaService: class { getEssayContent = fixture.image; } }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: { sendTemplateEmail: vi.fn() } }));
import router from "../../../src/routes/exam.routes";
import { AppError } from "../../../src/utils/AppError";
let server: ReturnType<typeof createServer>, base: string;
const secret = "faculty12-synthetic-http";
function account(role = "FACULTY", grants = ["essay.evaluate"]) {
  fixture.actor = { id: "evaluator", email: "synthetic@example.invalid", role, isActive: true, mustChangePassword: false,
    panelist: { id: "profile", userId: "evaluator", isActive: true }, administratorAccess: null,
    capabilityGrants: grants.map(capabilityKey => ({ capabilityKey })) };
}
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", secret); const app = express(); app.use(express.json()); app.use("/api/exam", router);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/exam`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.clearAllMocks(); fixture.enabled = true; account();
  fixture.queue.mockResolvedValue({ items: [], nextCursor: null }); fixture.detail.mockResolvedValue({ status: "PENDING" });
  fixture.grade.mockResolvedValue({ status: "COMPLETED" }); fixture.image.mockResolvedValue({ bytes: Buffer.from("synthetic-image"), mimeType: "image/png" });
});
const operations = [["GET", "/essay-evaluations"], ["GET", "/essay-evaluations/application"],
  ["POST", "/essay-evaluations/application/grade"], ["GET", "/essay-evaluations/application/media/image/content"]] as const;
function request(method: string, path: string, claim: string | null = "FACULTY", body: unknown = { essayScore: 0 }) {
  return fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(claim ? {
    Authorization: `Bearer ${jwt.sign({ userId: "evaluator", role: claim, capabilityKeys: ["essay.evaluate"] }, secret)}`,
  } : {}) }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
}

describe.each(operations)("FACULTY-12 %s %s", (method, path) => {
  it.each(["FACULTY", "PANELIST"])("accepts current %s despite stale JWT role", async role => {
    account(role); const response = await request(method, path, "ADMIN");
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects forged JWT grants after current revocation and keeps dormant composition unavailable", async () => {
    account("FACULTY", []); expect((await request(method, path)).status).toBe(403);
    account(); fixture.enabled = false; vi.stubEnv("FACULTY_ESSAY_EVALUATION_ENABLED", "true");
    expect((await request(method, path + "?enabled=true")).status).toBe(503);
    expect(fixture.queue).not.toHaveBeenCalled(); expect(fixture.detail).not.toHaveBeenCalled(); expect(fixture.grade).not.toHaveBeenCalled(); expect(fixture.image).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => { expect((await request(method, path, null)).status).toBe(401); });
  it.each(["ADMIN", "STUDENT", "APPLICANT", "CUSTOM"])("denies current %s even with Faculty JWT claim", async role => {
    account(role); expect((await request(method, path)).status).toBe(403);
  });
});
describe("FACULTY-12 API ownership/privacy and Admin separation", () => {
  it("returns only validated private image bytes and safe headers", async () => {
    const response = await request("GET", "/essay-evaluations/application/media/image/content");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="exam-image.png"');
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("synthetic-image");
  });
  it("passes only authenticated evaluator identity and no caller role/actor override", async () => {
    await request("GET", "/essay-evaluations?cursor=next&actorId=attacker");
    expect(fixture.queue).toHaveBeenCalledWith("evaluator", "next");
    await request("GET", "/essay-evaluations/application"); expect(fixture.detail).toHaveBeenCalledWith("application", "evaluator");
    await request("POST", "/essay-evaluations/application/grade"); expect(fixture.grade).toHaveBeenCalledWith("application", { essayScore: 0 }, "evaluator");
    await request("GET", "/essay-evaluations/application/media/image/content");
    expect(fixture.image).toHaveBeenCalledWith("image", "application", "evaluator");
  });
  it.each([400, 403, 404, 409, 503])("preserves controlled %s and hides unexpected internals", async status => {
    fixture.grade.mockRejectedValueOnce(new AppError("Controlled evidence rejection", status));
    const result = await request("POST", "/essay-evaluations/application/grade"); expect(result.status).toBe(status);
    fixture.grade.mockRejectedValueOnce(new Error("SQL passwordHash private internals"));
    const unexpected = await request("POST", "/essay-evaluations/application/grade");
    expect(unexpected.status).toBe(500); expect(await unexpected.text()).not.toMatch(/SQL|passwordHash|private internals/);
  });
  it.each(["FULL", "RESTRICTED"])("%s Admin cannot grade through Faculty or legacy target route", async level => {
    account("ADMIN", level === "FULL" ? [] : ["exam.records.view", "exam.results.finalize"]);
    fixture.actor.administratorAccess = { level }; fixture.actor.panelist = null;
    expect((await request("POST", "/essay-evaluations/application/grade", "FACULTY")).status).toBe(403);
    expect((await request("POST", "/scores/application/grade", "ADMIN")).status).toBe(403);
    expect(fixture.grade).not.toHaveBeenCalled();
  });
  it.each([["GET", "/applications"], ["GET", "/applications/application"], ["POST", "/scores/application/finalize"],
    ["POST", "/applications/application/reconsider-result"], ["POST", "/scores/application/send-email"]])("Faculty essay grant cannot call %s %s", async (method, path) => {
    expect((await request(method, path)).status).toBe(403);
  });
});
