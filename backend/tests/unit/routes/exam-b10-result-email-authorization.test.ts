import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluationApplication } from "../../fixtures/exam-essay-evaluation";
import { executionIds as ids } from "../../fixtures/exam-execution";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  user: { findUnique: vi.fn() },
  entranceExamApplication: { findUnique: vi.fn() },
  entranceExamScore: { update: vi.fn() },
}));
const enqueue = vi.hoisted(() => vi.fn());
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/email.service", () => ({
  EmailService: { sendTemplateEmail: enqueue },
}));
import router from "../../../src/routes/exam.routes";
import { validatedResultBasis } from "../../../src/services/exam-result.rules";

const secret = "b10-disposable-route-test-secret";
let server: Server, base: string;

// Synthetic, internally consistent B8 result. No configured database or real queue.
function completedApplication() {
  const app = evaluationApplication();
  Object.assign(app, { status: "PASSED", resultDecision: null });
  Object.assign(app.student.user, {
    firstName: "Synthetic",
    email: "b10-owner@example.invalid",
  });
  Object.assign(app.score, {
    id: ids.app,
    status: "PASSED",
    multipleChoiceScore: 0,
    essayScore: 25.5,
    totalScore: 25.5,
    gradedById: ids.admin,
    essayEvaluatedAt: new Date("2026-11-01T02:01:00Z"),
    scoredAt: new Date("2026-11-01T02:01:00Z"),
    scoringBasis: {
      version: 1,
      applicationId: ids.app,
      contentRevisionId: ids.revision,
      finalizationReceiptId: ids.app,
      mcqQuestionCount: 1,
      mcqCorrectCount: 0,
      mcqPointsPerCorrectItem: "2",
      mcqEarnedPoints: "0",
      mcqMaximumPoints: "2",
      essayScore: "25.5",
      essayMaximum: "25.5",
      finalEarnedPoints: "25.5",
      maximumPossiblePoints: "27.5",
      passingThreshold: "75",
      passingThresholdUnit: "PERCENT",
      result: "PASSED",
    },
  });
  validatedResultBasis(app); // Reject an invalid fixture before testing authorization.
  return app;
}

beforeAll(async () => {
  const http = express();
  http.use(express.json());
  http.use(router);
  server = createServer(http);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  const closed = once(server, "close");
  server.closeAllConnections();
  server.close();
  await closed;
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("JWT_SECRET", secret);
  db.$transaction.mockImplementation((operation) => operation(db));
  db.$queryRaw.mockResolvedValue([{ status: "PASSED" }]);
  db.entranceExamApplication.findUnique.mockResolvedValue(completedApplication());
  db.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true });
});

function sendResultEmail() {
  // Represents a still-valid token issued while the account was active ADMIN.
  const token = jwt.sign({ userId: ids.admin, role: "ADMIN" }, secret, {
    expiresIn: "1h",
  });
  return fetch(`${base}/scores/${ids.app}/send-email`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
}

describe("B10 result-email current actor authorization acceptance gate", () => {
  it("allows the current active ADMIN positive control", async () => {
    expect((await sendResultEmail()).status).toBe(200);
    expect(enqueue).toHaveBeenCalledOnce();
    expect(db.entranceExamScore.update).toHaveBeenCalledOnce();
  });

  it.each([
    { role: "ADMIN", isActive: false },
    { role: "APPLICANT", isActive: true },
  ])("rejects current actor $role / active=$isActive despite an earlier ADMIN JWT", async (actor) => {
    db.user.findUnique.mockResolvedValue(actor);
    const response = await sendResultEmail();
    const body = await response.json();
    console.log("B10 authorization reproduction", {
      actor,
      httpStatus: response.status,
      response: body,
      actorLookups: db.user.findUnique.mock.calls.length,
      queueCalls: enqueue.mock.calls.length,
      queuedEvidenceWrites: db.entranceExamScore.update.mock.calls.length,
    });
    expect.soft(response.status).toBe(403);
    expect.soft(enqueue).not.toHaveBeenCalled();
    expect.soft(db.entranceExamScore.update).not.toHaveBeenCalled();
  });
});
