import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ entranceExamApplication: { findFirst: vi.fn(), findUnique: vi.fn() }, examQuestion: { count: vi.fn() } }));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: { sendTemplateEmail: sendEmail } }));
import router from "../../../src/routes/exam.routes";

const secret = "b0b-synthetic-authentication-test-secret";
let server: Server;
let baseUrl: string;
function application(status = "PASSED", scoreStatus = status) {
  return { id: "exact-app", status, score: { status: scoreStatus, multipleChoiceScore: 63, essayScore: scoreStatus === "PENDING" ? null : 20, totalScore: scoreStatus === "PENDING" ? null : 83 },
    student: { user: { firstName: "Synthetic", email: "record-owner@example.invalid" } },
    slot: { examDate: new Date("2026-11-02T00:00:00Z") }, program: {},
  };
}
function request(path: string, role?: string, options: RequestInit = {}) {
  const token = role === "invalid" ? role : role ? jwt.sign({ userId: "authenticated-user", role }, secret) : undefined;
  return fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/exam", router);
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/exam`;
});
afterAll(async () => {
  const closed = once(server, "close");
  server.close();
  server.closeAllConnections();
  await closed;
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("JWT_SECRET", secret);
  db.entranceExamApplication.findFirst.mockResolvedValue(application());
  db.entranceExamApplication.findUnique.mockResolvedValue(application());
  db.examQuestion.count.mockResolvedValue(72);
});
afterEach(() => vi.unstubAllEnvs());

describe("B0B actual routes, authentication, controllers and services", () => {
  it.each([[undefined, 401], ["invalid", 403], ["APPLICANT", 403], ["STUDENT", 403], ["PANELIST", 403]] as const)("rejects email actor %s before lookup/queue", async (role, expected) => {
    const response = await request("/scores/exact-app/send-email", role, { method: "POST" });
    expect(response.status).toBe(expected);
    expect(db.entranceExamApplication.findUnique).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([["PASSED", "ecat_result_pass"], ["FAILED", "ecat_result_fail"]])("allows ADMIN with a consistent %s result and ignores forged recipient/template", async (status, template) => {
    db.entranceExamApplication.findUnique.mockResolvedValue(application(status));
    const response = await request("/scores/exact-app/send-email", "ADMIN", { method: "POST", body: JSON.stringify({ applicationId: "other-app", email: "attacker@example.invalid", template: "wrong-template" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, message: expect.stringContaining("queue") });
    expect(db.entranceExamApplication.findUnique.mock.calls[0][0].where).toEqual({ id: "exact-app" });
    expect(sendEmail).toHaveBeenCalledExactlyOnceWith("record-owner@example.invalid", template, expect.objectContaining({ student_name: "Synthetic" }));
  });

  it("returns a typed not-final conflict without queueing for TAKEN/PENDING", async () => {
    db.entranceExamApplication.findUnique.mockResolvedValue(application("TAKEN", "PENDING"));
    const response = await request("/scores/exact-app/send-email", "ADMIN", { method: "POST" });
    expect(response.status).toBe(409);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing exact email record", async () => {
    db.entranceExamApplication.findUnique.mockResolvedValue(null);
    expect((await request("/scores/missing/send-email", "ADMIN", { method: "POST" })).status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns 500 without queue success or internals when dispatch rejects", async () => {
    sendEmail.mockRejectedValue(new Error("private redis/template/stack details"));
    const response = await request("/scores/exact-app/send-email", "ADMIN", { method: "POST" });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not queue the result email." });
  });

  it.each(["PASSED", "FAILED"])("returns authoritative %s data scoped only to the JWT Applicant", async status => {
    db.entranceExamApplication.findFirst.mockResolvedValue(application(status));
    const response = await request("/result?userId=other-user&applicationId=other-app", "APPLICANT");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: status.toLowerCase(), mcqScore: 63, essayScore: 20, totalScore: 83 });
    expect(db.entranceExamApplication.findFirst.mock.calls[0][0].where.student).toEqual({ userId: "authenticated-user" });
  });

  it("does not publish pending null scores as a completed result", async () => {
    db.entranceExamApplication.findFirst.mockResolvedValue(application("TAKEN", "PENDING"));
    const response = await request("/result", "APPLICANT");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Your examination result is not yet available. It may still be awaiting evaluation." });
  });

  it("returns not available with no result", async () => {
    db.entranceExamApplication.findFirst.mockResolvedValue(null);
    const response = await request("/result", "APPLICANT");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "No examination result is available yet." });
  });

  it("distinguishes unexpected result failures from domain unavailability", async () => {
    db.entranceExamApplication.findFirst.mockRejectedValue(new Error("private database connection details"));
    const response = await request("/result", "APPLICANT");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not load examination results." });
  });

  it.each([[undefined, 401], ["invalid", 403], ["ADMIN", 403]] as const)("retains Applicant-only result access for %s", async (role, status) => {
    expect((await request("/result", role)).status).toBe(status);
    expect(db.entranceExamApplication.findFirst).not.toHaveBeenCalled();
  });
});
