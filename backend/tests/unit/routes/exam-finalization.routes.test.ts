import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { executionApplication, executionRevision, executionIds as ids, configuration } from "../../fixtures/exam-execution";
const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(),
  entranceExamApplication: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  examContentRevision: { findUnique: vi.fn() }, applicantAnswer: { findMany: vi.fn(), upsert: vi.fn() },
  entranceExamScore: { create: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import router from "../../../src/routes/exam-engine.routes";
let server: Server, base: string, app: any, revision: any, rows: any[];
const secret = "b6-synthetic-secret";
beforeAll(async () => {
  const http = express(); http.use(express.json()); http.use(router); server = createServer(http);
  server.listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.closeAllConnections(); server.close(); vi.unstubAllEnvs(); vi.useRealTimers(); });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("JWT_SECRET", secret); app = executionApplication(); rows = []; revision = executionRevision();
  Object.assign(app, { actualStartedAt: new Date(), finalizedAt: null, finalizationReason: null, finalizationReceiptId: null, finalizationAnsweredCount: null, finalizationQuestionCount: null });
  app.deadlineAt = new Date(app.actualStartedAt.getTime() + 120 * 60_000);
  app.executionConfiguration = { ...configuration, timezone: "Asia/Manila", passingThresholdUnit: null }; app.contentRevisionId = ids.revision;
  db.$transaction.mockImplementation(fn => fn(db)); db.$queryRaw.mockResolvedValue([{ status: "PENDING" }]);
  db.entranceExamApplication.findUnique.mockImplementation(async () => app);
  db.entranceExamApplication.findUniqueOrThrow.mockImplementation(async () => app);
  db.entranceExamApplication.update.mockImplementation(async ({ data }) => Object.assign(app, data));
  db.examContentRevision.findUnique.mockImplementation(async () => revision);
  db.applicantAnswer.findMany.mockImplementation(async () => rows);
});
const q = () => revision.questions[0].content;
function request(body: unknown = {}, method = "POST", userId = ids.user, role = "APPLICANT", id = ids.app) {
  const token = jwt.sign({ userId, role }, secret);
  return fetch(`${base}/applications/${id}/${method === "GET" ? "finalization" : "submit"}`, {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}
const answer = () => ({ questionId: q().id, selectedOptionId: q().options[0].id, essayAnswer: null, draftRevision: 3 });
function noWrites() { expect(db.entranceExamApplication.update).not.toHaveBeenCalled(); expect(db.applicantAnswer.upsert).not.toHaveBeenCalled(); expect(db.entranceExamScore.create).not.toHaveBeenCalled(); }
describe("B6 exact submission HTTP / B4 binding / persisted B5 answers", () => {
  it.each(["ADMIN", "STUDENT", "PANELIST"])("rejects %s", async role => { expect((await request({}, "POST", ids.user, role)).status).toBe(403); noWrites(); });
  it("rejects anonymous access", async () => { expect((await fetch(`${base}/applications/${ids.app}/finalization`)).status).toBe(401); noWrites(); });
  for (const method of ["POST", "GET"]) {
    it(`${method} enforces ownership`, async () => { expect((await request({}, method, ids.admin)).status).toBe(404); noWrites(); });
    it(`${method} rejects malformed identity`, async () => { expect((await request({}, method, ids.user, "APPLICANT", "bad")).status).toBe(400); noWrites(); });
  }
  it.each([null, [], { answers: [] }, { acknowledgeIncomplete: "yes" }, { deadlineAt: "x" }, { actualStartedAt: "x" }, { finalizedAt: "x" }, { finalizationReason: "APPLICANT_SUBMITTED" }, { receiptId: ids.app }, { contentRevisionId: ids.revision }, { score: 1 }])("rejects client authority %#", async body => {
    expect((await request(body)).status).toBe(400); noWrites();
  });
  it("requires explicit incomplete acknowledgment and has no partial writes", async () => {
    const response = await request(); expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "INCOMPLETE_CONFIRMATION_REQUIRED", unansweredCount: 1 }); noWrites();
  });
  it("complete saved choice needs no acknowledgment and scores from the frozen key", async () => {
    rows = [answer()]; const response = await request(); expect(response.status).toBe(200);
    const receipt = await response.json(); expect(receipt).toMatchObject({ answeredCount: 1, unansweredCount: 0, finalizationReason: "APPLICANT_SUBMITTED", contentRevisionId: ids.revision });
    expect(db.entranceExamScore.create).toHaveBeenCalledWith({ data: { applicationId: ids.app, multipleChoiceScore: 1, status: "PENDING" } });
    expect(db.applicantAnswer.upsert).not.toHaveBeenCalled();
    expect(JSON.stringify(receipt)).not.toMatch(/isCorrect|answerKey|Score|storageKey|executionConfiguration/);
  });
  it("incomplete confirmation finalizes missing answers without creating any", async () => {
    const receipt = await (await request({ acknowledgeIncomplete: true })).json();
    expect(receipt).toMatchObject({ answeredCount: 0, unansweredCount: 1 }); expect(rows).toEqual([]); expect(db.applicantAnswer.upsert).not.toHaveBeenCalled();
  });
  it.each([null, "", "   "])("preserves explicit clear %s as unanswered", async value => {
    if (value === null) rows = [{ ...answer(), selectedOptionId: null }];
    else { rows = [{ ...answer(), selectedOptionId: null, essayAnswer: value }]; q().type = "ESSAY"; q().options = []; }
    expect((await request()).status).toBe(409);
    const receipt = await (await request({ acknowledgeIncomplete: true })).json(); expect(receipt.unansweredCount).toBe(1); expect(rows[0].essayAnswer).toBe(value); expect(db.applicantAnswer.upsert).not.toHaveBeenCalled();
  });
  it.each(["missingStart", "partialBinding", "invalidDeadline"])("rejects %s", async state => {
    if (state === "missingStart") app.actualStartedAt = null;
    if (state === "partialBinding") app.contentRevisionId = null;
    if (state === "invalidDeadline") app.deadlineAt = new Date(0);
    expect((await request({ acknowledgeIncomplete: true })).status).toBe(409); noWrites();
  });
  it.each(["TAKEN", "PASSED", "FAILED", "APPEALED", "DISQUALIFIED"])("keeps legacy %s truthful", async status => {
    app.status = status; expect((await request()).status).toBe(409); noWrites();
    expect(await (await request({}, "GET")).json()).toEqual({ state: "LEGACY_TERMINAL", receipt: null });
  });
  it("expiry wins without confirmation and recovers one stable receipt on retry/read", async () => {
    app.actualStartedAt = new Date(Date.now() - 121 * 60_000); app.deadlineAt = new Date(app.actualStartedAt.getTime() + 120 * 60_000);
    const first = await (await request()).json(); expect(first.finalizationReason).toBe("TIME_EXPIRED");
    expect(await (await request()).json()).toEqual(first);
    expect(await (await request({}, "GET")).json()).toEqual({ state: "FINALIZED", receipt: first });
    expect(db.entranceExamApplication.update).toHaveBeenCalledTimes(1); expect(db.entranceExamScore.create).toHaveBeenCalledTimes(1);
    const denied = await fetch(`${base}/applications/${ids.app}/drafts`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt.sign({ userId: ids.user, role: "APPLICANT" }, secret)}` }, body: JSON.stringify({ questionId: q().id, selectedOptionId: null, expectedRevision: 0 }) });
    expect(denied.status).toBe(409); expect(db.applicantAnswer.upsert).not.toHaveBeenCalled();
  });
  it.each(["foreignQuestion", "foreignOption", "wrongType"])("validates saved %s before finalization writes", async kind => {
    rows = [answer()]; if (kind === "foreignQuestion") rows[0].questionId = ids.admin;
    if (kind === "foreignOption") rows[0].selectedOptionId = ids.admin;
    if (kind === "wrongType") rows[0].essayAnswer = "invalid";
    expect((await request({ acknowledgeIncomplete: true })).status).toBe(409); noWrites();
  });
  it("preserves B4 eligibility for active explicit submit but closes an expired recorded execution", async () => {
    app.student.user.isActive = false; expect((await request({ acknowledgeIncomplete: true })).status).toBe(409); noWrites();
    app.actualStartedAt = new Date(Date.now() - 121 * 60_000); app.deadlineAt = new Date(app.actualStartedAt.getTime() + 120 * 60_000);
    expect((await (await request()).json()).finalizationReason).toBe("TIME_EXPIRED");
  });
  it("fails closed on partial receipt evidence without fabricating fields", async () => {
    app.finalizationReceiptId = ids.app; expect((await request({}, "GET")).status).toBe(409); expect((await request()).status).toBe(409); noWrites();
  });
  it("locks then rereads current state under READ COMMITTED", async () => {
    await request({ acknowledgeIncomplete: true });
    expect(db.$transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: "ReadCommitted" });
    const [sql, id] = db.$queryRaw.mock.calls[0]; expect(sql.join("?")).toMatch(/SELECT status.*WHERE application_id = \? FOR UPDATE/); expect(id).toBe(ids.app);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.entranceExamApplication.findUniqueOrThrow.mock.invocationCallOrder[0]);
  });
});
