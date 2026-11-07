import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluationApplication } from "../../fixtures/exam-essay-evaluation";
import { calculatePoints } from "../../../src/services/exam-result.rules";

const db = vi.hoisted(() => ({ examSlot: { findUnique: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: {} }));
import router from "../../../src/routes/exam.routes";

const slotId = "11111111-1111-4111-8111-111111111111";
const otherSlot = "22222222-2222-4222-8222-222222222222";
const recorded = new Date("2026-11-05T17:30:00.000Z");
const secret = "synthetic-bookings-route-secret";
let server: Server, url: string, rows: any[];
function booking(id: string, slot = slotId, released: Date | null = null) {
  return { ...evaluationApplication(), id, slotId: slot, seatReleasedAt: released,
    createdAt: recorded, status: "PENDING", resultDecision: null,
    student: { pinnacleApplicantId: `PIN-${id}`, user: { firstName: "Ana", lastName: `Applicant ${id}` } },
  };
}
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/exam", router);
  server = createServer(app); server.listen(0, "127.0.0.1"); await once(server, "listening");
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/exam/slots`;
  vi.stubEnv("JWT_SECRET", secret);
});
afterAll(async () => {
  const closed = once(server, "close"); server.close(); server.closeAllConnections(); await closed; vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.clearAllMocks();
  rows = [booking("b"), booking("released", slotId, recorded), booking("foreign", otherSlot),
    { ...booking("older"), createdAt: new Date("2026-11-01T00:00:00Z") }, booking("a")];
  // Model only the Prisma read contract, with mixed-slot/released fixtures.
  db.examSlot.findUnique.mockImplementation(async query => {
    if (query.where.id !== slotId) return null;
    const relation = query.select.examApplications;
    expect(relation.where).toEqual({ seatReleasedAt: null });
    expect(relation.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    return { examApplications: rows.filter(row => row.slotId === query.where.id && row.seatReleasedAt === relation.where.seatReleasedAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)) };
  });
});
function request(role?: string, id = slotId) {
  return fetch(`${url}/${id}/bookings`, { headers: role ? {
    Authorization: `Bearer ${role === "invalid" ? "invalid" : jwt.sign({ userId: "synthetic-user", role }, secret)}`,
  } : {} });
}

describe("ADMIN schedule bookings: actual router/controller/service/repository read path", () => {
  it("returns only current occupants of the exact schedule, ordered by createdAt then application id", async () => {
    const response = await request("ADMIN");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).map((row: any) => row.id)).toEqual(["older", "a", "b"]);
    expect(db.examSlot.findUnique).toHaveBeenCalledOnce();
    expect(db.examSlot.findUnique.mock.calls[0][0].where).toEqual({ id: slotId });
  });
  it("returns authoritative identity, application id/status and createdAt, stripping internal state evidence", async () => {
    rows = [booking("a")];
    expect(await (await request("ADMIN")).json()).toEqual([{
      id: "a", status: "PENDING", createdAt: recorded.toISOString(),
      student: { pinnacleApplicantId: "PIN-a", user: { firstName: "Ana", lastName: "Applicant a" } },
      essayEvaluationCompleted: false, reconsidered: false,
    }]);
    const select = db.examSlot.findUnique.mock.calls[0][0].select.examApplications.select;
    expect(select.id).toBe(true); expect(select.status).toBe(true); expect(select.createdAt).toBe(true);
    expect(select.student).toEqual({ select: { pinnacleApplicantId: true, user: { select: { firstName: true, lastName: true } } } });
    for (const key of ["answers", "questions", "program", "startAuthorizedById", "startAuthorizedAt", "scheduleAmendment"]) expect(select).not.toHaveProperty(key);
    expect(select.score.select).not.toHaveProperty("resultEmailQueuedAt");
  });
  it.each([undefined, "invalid", "APPLICANT", "STUDENT", "PANELIST", "CUSTOM"])("denies %s before reading any booking data", async role => {
    expect((await request(role)).status).toBe(role === undefined ? 401 : 403);
    expect(db.examSlot.findUnique).not.toHaveBeenCalled();
  });
  it("returns a truthful empty list when only released/foreign bookings remain", async () => {
    rows = [booking("released", slotId, recorded), booking("foreign", otherSlot)];
    expect(await (await request("ADMIN")).json()).toEqual([]);
  });
  it("distinguishes missing schedules from empty schedules", async () => {
    const response = await request("ADMIN", otherSlot);
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Exam schedule not found." });
  });
  it("validates the slot identifier before a database read", async () => {
    expect((await request("ADMIN", "not-a-uuid")).status).toBe(400);
    expect(db.examSlot.findUnique).not.toHaveBeenCalled();
  });
  it("bounds unexpected errors without leaking database details", async () => {
    db.examSlot.findUnique.mockRejectedValueOnce(new Error("private SQL"));
    const response = await request("ADMIN"); expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not load schedule bookings." });
  });
  it("uses the existing Exam Records completion predicate; partial/legacy evidence does not imply evaluation", async () => {
    const evaluated = { ...booking("evaluated"), status: "TAKEN" };
    Object.assign(evaluated.score, { essayScore: 0, gradedById: "admin", essayEvaluatedAt: recorded });
    const partial = { ...evaluated, id: "partial", finalizationReceiptId: null };
    rows = [evaluated, partial, { ...booking("pending"), status: "TAKEN" }];
    const result = await (await request("ADMIN")).json();
    expect(result.map((row: any) => [row.id, row.essayEvaluationCompleted])).toEqual([
      ["evaluated", true], ["partial", false], ["pending", false],
    ]);
    expect(JSON.stringify(result)).not.toMatch(/gradedById|essayScore|executionConfiguration|finalizationReceiptId/);
  });
  it("does not invent a reconsidered pass from a decision without valid recorded result evidence", async () => {
    rows = [{ ...booking("failed"), status: "FAILED", resultDecision: { decision: "PASSED_RECONSIDERED" } }];
    const result = await (await request("ADMIN")).json();
    expect(result[0].reconsidered).toBe(false); expect(result[0].status).toBe("FAILED");
    expect(result[0]).not.toHaveProperty("resultDecision");
  });
  it("projects a validated reconsidered pass as a flag while preserving FAILED and hiding its evidence", async () => {
    const app = { ...booking("reconsidered"), status: "FAILED" };
    const basis = { version: 1, applicationId: app.id, contentRevisionId: app.contentRevisionId,
      finalizationReceiptId: app.finalizationReceiptId, mcqQuestionCount: 1, mcqCorrectCount: 0,
      mcqPointsPerCorrectItem: "2", essayScore: "0", essayMaximum: "25.5", passingThreshold: "75", passingThresholdUnit: "PERCENT",
      ...calculatePoints(0, 1, "2", "0", "25.5", "75"),
    };
    Object.assign(app.score, { id: "score-1", status: "FAILED", multipleChoiceScore: 0, essayScore: 0, totalScore: 0,
      gradedById: "admin", essayEvaluatedAt: recorded, scoredAt: recorded, scoringBasis: basis });
    app.resultDecision = { id: "decision-1", applicationId: app.id, scoreId: app.score.id, decision: "PASSED_RECONSIDERED",
      reason: "Recorded institutional decision", decidedById: "admin", decidedAt: recorded } as any;
    rows = [app];
    const result = await (await request("ADMIN")).json();
    expect(result[0]).toMatchObject({ status: "FAILED", reconsidered: true });
    expect(JSON.stringify(result)).not.toMatch(/scoringBasis|Recorded institutional decision|decidedById|score-1/);
  });
});
