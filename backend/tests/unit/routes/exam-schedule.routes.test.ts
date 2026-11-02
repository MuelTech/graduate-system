import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../src/utils/AppError";

const service = vi.hoisted(() => ({ createSlot: vi.fn(), getAllSlots: vi.fn(), updateSlot: vi.fn(), toggleSlotStatus: vi.fn(), getAvailableSlots: vi.fn(), scheduleExam: vi.fn(), getApplicantStatus: vi.fn(), assignApplicant: vi.fn(), getAssignmentOptions: vi.fn() }));
vi.mock("../../../src/services/exam.service", () => ({ ExamService: class {
  createSlot = service.createSlot; getAllSlots = service.getAllSlots; updateSlot = service.updateSlot;
  toggleSlotStatus = service.toggleSlotStatus; getAvailableSlots = service.getAvailableSlots;
  scheduleExam = service.scheduleExam; getApplicantStatus = service.getApplicantStatus;
  assignApplicant = service.assignApplicant; getAssignmentOptions = service.getAssignmentOptions;
} }));
import router from "../../../src/routes/exam.routes";
const secret = "b3-synthetic-route-test-secret";
const id = "11111111-1111-4111-8111-111111111111";
let server: Server; let url: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/exam", router);
  server = createServer(app); server.listen(0, "127.0.0.1"); await once(server, "listening");
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/exam`;
  vi.stubEnv("JWT_SECRET", secret);
});
afterAll(async () => { const closed = once(server, "close"); server.close(); server.closeAllConnections(); await closed; vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.resetAllMocks();
  for (const method of Object.values(service)) method.mockResolvedValue({ id });
});
async function request(method: string, path: string, role?: string, body?: unknown) {
  return fetch(`${url}${path}`, { method, headers: { "Content-Type": "application/json", ...(role ? { Authorization: `Bearer ${role === "invalid" ? "invalid" : jwt.sign({ userId: "jwt-applicant", role }, secret)}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const adminRoutes = [["POST", "/slots", "createSlot"], ["GET", "/slots", "getAllSlots"], ["PUT", `/slots/${id}`, "updateSlot"], ["PATCH", `/slots/${id}/status`, "toggleSlotStatus"], ["GET", `/assignment-options/${id}`, "getAssignmentOptions"], ["POST", "/assignments", "assignApplicant"]] as const;
const applicantRoutes = [["GET", "/slots/available", "getAvailableSlots"], ["POST", "/schedule", "scheduleExam"], ["GET", "/status", "getApplicantStatus"]] as const;

describe("B3 actual scheduling routes and JWT/role boundaries", () => {
  it.each([...adminRoutes, ...applicantRoutes])("requires a valid JWT for %s %s", async (method, path) => {
    expect((await request(method, path)).status).toBe(401);
    expect((await request(method, path, "invalid")).status).toBe(403);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });
  it.each(adminRoutes)("restricts %s %s to ADMIN", async (method, path, name) => {
    for (const role of ["APPLICANT", "STUDENT", "PANELIST", "CUSTOM"]) expect((await request(method, path, role, method === "GET" ? undefined : { isActive: false })).status).toBe(403);
    expect(service[name]).not.toHaveBeenCalled();
    expect((await request(method, path, "ADMIN", method === "GET" ? undefined : name === "assignApplicant" ? { studentId: id, slotId: id } : { isActive: false })).status).toBe(method === "POST" ? 201 : 200);
    expect(service[name]).toHaveBeenCalledOnce();
  });
  it.each(applicantRoutes)("restricts %s %s to APPLICANT", async (method, path, name) => {
    for (const role of ["ADMIN", "STUDENT", "PANELIST"]) expect((await request(method, path, role, method === "POST" ? { slotId: id } : undefined)).status).toBe(403);
    expect(service[name]).not.toHaveBeenCalled();
    expect((await request(method, path, "APPLICANT", method === "POST" ? { slotId: id } : undefined)).status).toBe(method === "POST" ? 201 : 200);
  });
  it("available lookup delegates JWT identity and optional query; client identity never substitutes", async () => {
    await request("GET", `/slots/available?programId=${id}&userId=forged`, "APPLICANT");
    expect(service.getAvailableSlots).toHaveBeenCalledWith("jwt-applicant", id);
    await request("GET", "/slots/available", "APPLICANT");
    expect(service.getAvailableSlots).toHaveBeenLastCalledWith("jwt-applicant", undefined);
  });
  it("booking passes only JWT user and validated slot; rejects supplied Student/Program", async () => {
    expect((await request("POST", "/schedule", "APPLICANT", { slotId: id })).status).toBe(201);
    expect(service.scheduleExam).toHaveBeenCalledWith("jwt-applicant", id);
    service.scheduleExam.mockClear();
    for (const body of [{ slotId: id, studentId: id }, { slotId: id, programId: id }, { slotId: id, userId: id }, {}, null, []]) expect((await request("POST", "/schedule", "APPLICANT", body)).status).toBe(400);
    expect(service.scheduleExam).not.toHaveBeenCalled();
  });
  it("status PATCH validates actual boolean and rejects extra fields", async () => {
    for (const body of [{ isActive: "false" }, { isActive: 1 }, { isActive: null }, { isActive: true, slotsTaken: 0 }, {}]) expect((await request("PATCH", `/slots/${id}/status`, "ADMIN", body)).status).toBe(400);
    expect(service.toggleSlotStatus).not.toHaveBeenCalled();
  });
  it("Admin assignment accepts only selected Student/slot UUIDs and a bounded creation response", async () => {
    service.assignApplicant.mockResolvedValue({ id, user: { passwordHash: "private" } });
    const response = await request("POST", "/assignments", "ADMIN", { studentId: id, slotId: id });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ application: { id }, message: "Applicant assigned successfully." });
    expect(service.assignApplicant).toHaveBeenCalledWith(id, id);
    service.assignApplicant.mockClear();
    for (const body of [null, [], {}, { studentId: "bad", slotId: id }, { studentId: id, slotId: "bad" },
      { studentId: id, slotId: id, programId: id }, { studentId: id, slotId: id, bypassTime: true },
      { studentId: id, slotId: id, isActive: true }, { studentId: id, slotId: id, maxSlots: 10 }]) {
      expect((await request("POST", "/assignments", "ADMIN", body)).status).toBe(400);
    }
    expect(service.assignApplicant).not.toHaveBeenCalled();
  });
  it.each([
    ["POST", "/slots", "ADMIN", "createSlot", {}],
    ["GET", "/slots/available", "APPLICANT", "getAvailableSlots", undefined],
    ["POST", "/schedule", "APPLICANT", "scheduleExam", { slotId: id }],
    ["PUT", `/slots/${id}`, "ADMIN", "updateSlot", {}],
    ["PATCH", `/slots/${id}/status`, "ADMIN", "toggleSlotStatus", { isActive: false }],
    ["POST", "/assignments", "ADMIN", "assignApplicant", { studentId: id, slotId: id }],
    ["GET", `/assignment-options/${id}`, "ADMIN", "getAssignmentOptions", undefined],
  ] as const)("preserves operational errors and bounds unexpected internals for %s %s", async (method, path, role, name, body) => {
    service[name].mockRejectedValueOnce(new AppError("Bounded admission conflict", 409));
    let response = await request(method, path, role, body); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: "Bounded admission conflict" });
    service[name].mockRejectedValueOnce(new Error("private SQL/credentials/stack"));
    response = await request(method, path, role, body); expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Could not complete the scheduling request." });
  });
});
