import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { examAdministrationEndpoints as endpoints, excludedExamAdministrationEndpoints as excluded } from "../../fixtures/exam-administration-endpoints";
const fixture = vi.hoisted(() => ({ actor: null as any, enabled: true, work: vi.fn(), promoted: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: { user: { findUnique: async ({ where }: any) => where.id === "actor" ? fixture.actor : null } } }));
vi.mock("../../../src/access/exam-administration-authorization", async importOriginal => {
  const original = await importOriginal<typeof import("../../../src/access/exam-administration-authorization")>();
  const enabled = new original.ExamAdministrationAuthorization(true);
  const dormant = new original.ExamAdministrationAuthorization();
  return { ...original, examAdministrationAuthorization: {
    assert: (...args: Parameters<typeof enabled.assert>) => (fixture.enabled ? enabled : dormant).assert(...args),
    assertExcluded: (...args: Parameters<typeof enabled.assertExcluded>) => (fixture.enabled ? enabled : dormant).assertExcluded(...args),
  } };
});
// These route tests isolate the real authentication/capability middleware from domain work.
// Separate business-boundary tests execute the real services and repositories.
const handlers = vi.hoisted(() => (names: string[]) => class {
  constructor() { for (const name of names) (this as any)[name] = (req: any, res: any) => { fixture.work(name, req.user?.userId); res.json({ ok: true }); }; }
});
vi.mock("../../../src/controllers/exam.controller", () => ({ ExamController: handlers(["createSlot","getAvailableSlots","scheduleExam","getAllSlots","getSlotBookings","getAssignmentOptions","assignApplicant","getAllApplications","getApplicationDetail","getApplicantStatus","updateSlot","toggleSlotStatus","appealMissedExam","getAppeals","approveAppeal","rejectAppeal","getExamResult","gradeEssay","finalizeResult","confirmResultAndEmail"]) }));
vi.mock("../../../src/controllers/exam-amendment.controller", () => ({ ExamAmendmentController: class extends handlers(["options","reconsider"]) {
  action = (name: string) => (req: any, res: any) => { fixture.work(name, req.user?.userId); res.json({ ok: true }); };
} }));
vi.mock("../../../src/controllers/exam-engine.controller", () => ({ ExamEngineController: handlers(["getQuestionsForApplicant","readDrafts","autoSaveAnswer","readFinalization","submitAnswers","getAllQuestionsForAdmin","createQuestion","updateQuestion","deleteQuestion"]) }));
vi.mock("../../../src/controllers/exam-execution.controller", () => ({ ExamExecutionController: handlers(["current","read","start","adminRead","authorize"]) }));
vi.mock("../../../src/controllers/exam-question-set.controller", () => ({ ExamQuestionSetController: handlers(["getCurrent","replaceSelection","publish"]) }));
vi.mock("../../../src/controllers/exam-configuration.controller", () => ({ ExamConfigurationController: handlers(["getCurrent","replaceCurrent"]) }));
vi.mock("../../../src/controllers/exam-media.controller", () => ({ ExamMediaController: handlers(["getContent","upload"]) }));
vi.mock("../../../src/storage/secure-upload", () => ({ secureUpload: () => ({ single: () => (_req: any, _res: any, next: any) => { fixture.promoted(); next(); } }) }));
import exam from "../../../src/routes/exam.routes";
import engine from "../../../src/routes/exam-engine.routes";
let server: ReturnType<typeof createServer>, base: string;
function actor(keys: readonly string[] = [], changes = {}) {
  fixture.actor = { id: "actor", email: "actor@example.test", role: "ADMIN", isActive: true, mustChangePassword: false,
    panelist: null, administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...changes };
}
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "faculty-6-synthetic-http");
  const app = express(); app.use(express.json()); app.use("/api/exam", exam); app.use("/api/exam-engine", engine);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
beforeEach(() => { vi.clearAllMocks(); fixture.enabled = true; actor(); });
function request(method: string, path: string, body: unknown = {}, claim = "ADMIN") {
  return fetch(base + path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt.sign({ userId: "actor", role: claim, capabilities: ["exam.questions.manage"] }, process.env.JWT_SECRET!)}` }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
}
describe("FACULTY-6 endpoint/alias authorization", () => {
  it.each(endpoints)("%s %s requires %s and allows enumerated Full", async (method, path, key) => {
    actor([], { administratorAccess: { level: "FULL" } }); expect((await request(method, path)).status).toBe(200);
    actor([key]); expect((await request(method, path)).status).toBe(200);
    vi.clearAllMocks(); actor(["students.view"]);
    expect((await request(method, path, { role: "ADMIN", actorId: "full", capabilityKeys: [key] })).status).toBe(403);
    expect(fixture.work).not.toHaveBeenCalled(); expect(fixture.promoted).not.toHaveBeenCalled();
  });
  it.each(["exam.schedules.manage", "exam.starts.authorize", "exam.results.finalize", "exam.results.reconsider", "exam.questions.manage"])("honors %s read prerequisites without widening sibling mutations", async key => {
    actor([key]);
    const read = key === "exam.schedules.manage" ? "/exam/slots" : key === "exam.questions.manage" ? "/exam-engine/admin/questions" : "/exam/applications";
    expect((await request("GET", read)).status).toBe(200);
    if (key === "exam.results.finalize") expect((await request("POST", "/exam/applications/target/reconsider-result")).status).toBe(403);
    if (key === "exam.results.reconsider") expect((await request("POST", "/exam/scores/target/finalize")).status).toBe(403);
  });
  it.each(["exam.schedules.view", "exam.records.view", "exam.questions.view"])("view-only %s cannot mutate", async key => {
    actor([key]);
    for (const [method, path] of endpoints.filter(([method]) => method !== "GET")) expect((await request(method, path)).status).toBe(403);
    expect(fixture.work).not.toHaveBeenCalled(); expect(fixture.promoted).not.toHaveBeenCalled();
  });
  it.each([
    { administratorAccess: null }, { administratorAccess: { level: "INVALID" } },
    { capabilityGrants: [{ capabilityKey: "unknown" }] }, { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
    { capabilityGrants: [{ capabilityKey: "exam.records.view" }, { capabilityKey: "exam.records.view" }] },
    { role: "STUDENT" }, { role: "FACULTY", panelist: { isActive: true } }, { isActive: false }, { mustChangePassword: true },
  ])("denies current invalid/revoked authority %j on every Admin endpoint", async extra => {
    actor([], { administratorAccess: { level: "FULL" }, ...extra });
    for (const [method, path] of endpoints) expect((await request(method, path)).status).toBe(403);
    expect(fixture.work).not.toHaveBeenCalled(); expect(fixture.promoted).not.toHaveBeenCalled();
  });
  it.each([...new Set(endpoints.map(([, , key]) => key)), "FULL"])("%s cannot grade essays or send result email", async key => {
    actor(key === "FULL" ? [] : [key], key === "FULL" ? { administratorAccess: { level: "FULL" } } : {});
    for (const path of excluded) expect((await request("POST", path)).status).toBe(403);
    expect(fixture.work).not.toHaveBeenCalled();
  });
  it("revokes immediately despite stale JWT claims and accepts current role over a stale token role", async () => {
    actor(["exam.records.view"]); expect((await request("GET", "/exam/applications", {}, "CUSTOM")).status).toBe(200);
    fixture.actor.capabilityGrants = []; expect((await request("GET", "/exam/applications")).status).toBe(403);
  });
  it("preserves Applicant media and keeps Admin capability out of execution/self-booking", async () => {
    actor([], { administratorAccess: { level: "FULL" } });
    for (const [method, path] of [["POST", "/exam/schedule"], ["POST", "/exam-engine/applications/target/start"], ["PATCH", "/exam-engine/applications/target/drafts"], ["POST", "/exam-engine/applications/target/submit"]]) expect((await request(method, path)).status).toBe(403);
    actor([], { role: "APPLICANT", administratorAccess: null });
    expect((await request("GET", "/exam-engine/media/target?applicationId=exact", {}, "APPLICANT")).status).toBe(200);
  });
  it("keeps default composition dormant, legacy unmapped ADMIN behavior and exclusions unchanged", async () => {
    fixture.enabled = false; actor([], { administratorAccess: null });
    vi.stubEnv("EXAM_ADMINISTRATION_CAPABILITY_ENFORCEMENT_ENABLED", "true");
    for (const [method, path] of endpoints) expect((await request(method, path)).status).toBe(200);
    for (const path of excluded) expect((await request("POST", path)).status).toBe(200);
    expect(fixture.actor.administratorAccess).toBeNull();
  });
});
