import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAM_CONFIGURATION_KEY } from "../../../src/services/exam-configuration.rules";

const db = vi.hoisted(() => ({ systemSetting: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: db }));
import router from "../../../src/routes/exam-engine.routes";
import settingsRouter from "../../../src/routes/settings.routes";

const secret = "b1-synthetic-jwt-test-secret";
let server: Server;
let base: string;
let stored: { settingType: string; settingValue: string; settingKey: string } | null;
function request(role?: string, method = "GET", body?: unknown, path = "/exam-engine/admin/configuration") {
  const token = role === "invalid" ? role : role ? jwt.sign({ userId: "admin-actor", role }, secret) : null;
  return fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeAll(async () => {
  const app = express(); app.use(express.json());
  app.use("/api/exam-engine", router); app.use("/api/settings", settingsRouter);
  server = createServer(app); server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(async () => { const closed = once(server, "close"); server.close(); server.closeAllConnections(); await closed; });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("JWT_SECRET", secret); stored = null;
  db.systemSetting.findUnique.mockImplementation(async () => stored);
  db.systemSetting.upsert.mockImplementation(async ({ create, update }) => { stored = stored ? { ...stored, ...update } : create; return stored; });
});
afterEach(() => vi.unstubAllEnvs());

describe("B1 actual Admin configuration HTTP authority", () => {
  for (const method of ["GET", "PUT"]) {
    it.each([[undefined, 401], ["invalid", 403], ["APPLICANT", 403], ["STUDENT", 403], ["PANELIST", 403]] as const)(`${method} rejects actor %s before data access`, async (role, status) => {
      expect((await request(role, method, method === "PUT" ? {} : undefined)).status).toBe(status);
      expect(db.systemSetting.findUnique).not.toHaveBeenCalled(); expect(db.systemSetting.upsert).not.toHaveBeenCalled();
    });
  }

  it("allows ADMIN to read an unconfigured contract without fake defaults", async () => {
    const response = await request("ADMIN"); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ examDurationMinutes: null, mcqPointsPerCorrectItem: null, essayMaximumScore: null, passingThreshold: null, passingThresholdUnit: null, timezone: "Asia/Manila", isComplete: false });
    expect(db.systemSetting.upsert).not.toHaveBeenCalled();
  });

  it("saves and reads the exact current draft using the JWT actor", async () => {
    const response = await request("ADMIN", "PUT", { examDurationMinutes: 95, mcqPointsPerCorrectItem: 2.5, essayMaximumScore: 42 });
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved).toMatchObject({ examDurationMinutes: 95, mcqPointsPerCorrectItem: 2.5, essayMaximumScore: 42, timezone: "Asia/Manila", passingThreshold: null, isComplete: false });
    expect(await (await request("ADMIN")).json()).toEqual(saved);
    expect(db.systemSetting.upsert.mock.calls[0][0].update.lastModifiedById).toBe("admin-actor");
    expect(JSON.stringify(saved)).not.toMatch(/settingKey|lastModifiedBy|settingValue/);
  });

  it.each([null, [], { examDurationMinutes: "95" }, { essayMaximumScore: -2 }, { passingThreshold: 75 }, { passingThresholdUnit: "PERCENT" }, { timezone: "UTC" }, { isComplete: true }])("rejects invalid or unsupported mutation %# before persistence", async body => {
    const response = await request("ADMIN", "PUT", body); expect(response.status).toBe(400);
    expect(db.systemSetting.upsert).not.toHaveBeenCalled();
  });

  it("rejects a missing body", async () => {
    expect((await request("ADMIN", "PUT")).status).toBe(400);
    expect(db.systemSetting.upsert).not.toHaveBeenCalled();
  });

  it("does not expose database errors or claim success on failed persistence", async () => {
    db.systemSetting.upsert.mockRejectedValue(new Error("private database details"));
    const response = await request("ADMIN", "PUT", { passingThreshold: null });
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Could not access exam configuration." });
  });

  it("returns a bounded failure for corrupt stored configuration", async () => {
    stored = { settingKey: EXAM_CONFIGURATION_KEY, settingType: "JSON", settingValue: "not-json" };
    const response = await request("ADMIN"); expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Exam configuration could not be read. Contact the system administrator." });
  });

  it("blocks a direct generic-settings bypass even for ADMIN", async () => {
    await request("ADMIN", "PUT", { passingThreshold: null });
    const before = stored?.settingValue;
    const response = await request("ADMIN", "PUT", { settingValue: '{"passingThreshold":75}' }, `/settings/${EXAM_CONFIGURATION_KEY.toUpperCase()}`);
    expect(response.status).toBe(409); expect(stored?.settingValue).toBe(before);
    expect(db.systemSetting.update).not.toHaveBeenCalled();
  });
});
