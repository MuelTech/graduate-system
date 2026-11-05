import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  executionApplication,
  executionIds as ids,
} from "../../fixtures/exam-execution";
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  user: { findUnique: vi.fn() },
  examSlot: { findUnique: vi.fn(), updateMany: vi.fn() },
  entranceExamApplication: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  examScheduleAmendment: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: {} }));
import router from "../../../src/routes/exam.routes";
let server: Server, base: string, app: any;
const secret = "b9-synthetic-http-secret";
beforeAll(async () => {
  const http = express();
  http.use(express.json());
  http.use(router);
  server = createServer(http);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("JWT_SECRET", secret);
  app = executionApplication();
  db.$transaction.mockImplementation((fn) => fn(db));
  db.$queryRaw.mockResolvedValue([]);
  db.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true });
  db.entranceExamApplication.findUnique.mockImplementation(() => app);
  db.examSlot.findUnique.mockImplementation(() => app.slot);
  db.entranceExamApplication.count.mockResolvedValue(1);
  db.entranceExamApplication.updateMany.mockImplementation(({ data }) => {
    Object.assign(app, data);
    return { count: 1 };
  });
  db.examSlot.updateMany.mockResolvedValue({ count: 1 });
  db.examScheduleAmendment.create.mockResolvedValue({ id: "amendment" });
});
function request(
  suffix: string,
  body: unknown = { reason: "HTTP explanation" },
  role: string | null = "ADMIN",
  id = ids.app,
  method = "POST",
  userId = ids.admin,
) {
  const token =
    role === "invalid"
      ? "invalid"
      : role
        ? jwt.sign({ userId, role }, secret)
        : null;
  return fetch(`${base}/applications/${id}/${suffix}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}
describe("B9 actual route/authentication/repository boundary", () => {
  it.each([
    "missed-appeal/approve", "missed-appeal/reject", "reschedule",
    "cancel-appointment", "reconsider-result", "amendment-options",
  ])("B10 %s revalidates inactive/demoted Admin before domain writes", async suffix => {
    for (const actor of [{ role: "ADMIN", isActive: false }, { role: "APPLICANT", isActive: true }]) {
      db.user.findUnique.mockResolvedValue(actor);
      const body = { reason: "B10 current actor", ...(["reschedule", "missed-appeal/approve"].includes(suffix) ? { targetSlotId: ids.slot } : {}) };
      expect((await request(suffix, body, "ADMIN", ids.app, suffix === "amendment-options" ? "GET" : "POST")).status).toBe(403);
    }
    expect(db.entranceExamApplication.updateMany).not.toHaveBeenCalled();
    expect(db.examSlot.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it.each(["inactive", "demoted"])("B10 missed appeal revalidates %s Applicant persistence", async state => {
    if (state === "inactive") app.student.user.isActive = false;
    else app.student.user.role = "STUDENT";
    expect((await request("missed-appeal", { reason: "B10 Applicant actor" }, "APPLICANT", ids.app, "POST", ids.user)).status).toBe(403);
    expect(db.entranceExamApplication.updateMany).not.toHaveBeenCalled();
    expect(db.examSlot.updateMany).not.toHaveBeenCalled();
  });
  const adminRoutes = [
    "missed-appeal/approve",
    "missed-appeal/reject",
    "reschedule",
    "cancel-appointment",
    "reconsider-result",
    "amendment-options",
  ];
  it.each([...adminRoutes, "missed-appeal"])("B10 %s rejects a missing exact application", async suffix => {
    db.entranceExamApplication.findUnique.mockResolvedValue(null);
    const body = { reason: "B10 missing record", ...(["reschedule", "missed-appeal/approve"].includes(suffix) ? { targetSlotId: ids.slot } : {}) };
    expect((await request(suffix, body, suffix === "missed-appeal" ? "APPLICANT" : "ADMIN", ids.app, suffix === "amendment-options" ? "GET" : "POST", suffix === "missed-appeal" ? ids.user : ids.admin)).status).toBe(404);
    expect(db.entranceExamApplication.updateMany).not.toHaveBeenCalled();
    expect(db.examSlot.updateMany).not.toHaveBeenCalled();
  });
  it.each([...adminRoutes, "missed-appeal"])("B10 %s rejects stale TAKEN authority without schedule writes", async suffix => {
    app.status = "TAKEN";
    const body = { reason: "B10 stale record", ...(["reschedule", "missed-appeal/approve"].includes(suffix) ? { targetSlotId: ids.slot } : {}) };
    expect((await request(suffix, body, suffix === "missed-appeal" ? "APPLICANT" : "ADMIN", ids.app, suffix === "amendment-options" ? "GET" : "POST", suffix === "missed-appeal" ? ids.user : ids.admin)).status).toBe(409);
    expect(db.entranceExamApplication.updateMany).not.toHaveBeenCalled();
    expect(db.examSlot.updateMany).not.toHaveBeenCalled();
  });
  it.each(adminRoutes)(
    "%s rejects missing/invalid or non-Admin JWT before database access",
    async (suffix) => {
      for (const [role, status] of [
        [null, 401],
        ["invalid", 403],
        ["APPLICANT", 403],
        ["STUDENT", 403],
        ["PANELIST", 403],
      ] as const)
        expect(
          (
            await request(
              suffix,
              {},
              role,
              ids.app,
              suffix === "amendment-options" ? "GET" : "POST",
            )
          ).status,
        ).toBe(status);
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it("Applicant filing rejects other roles and uses the JWT owner only", async () => {
    for (const [role, status] of [
      [null, 401],
      ["ADMIN", 403],
      ["STUDENT", 403],
    ] as const)
      expect((await request("missed-appeal", {}, role)).status).toBe(status);
    expect(
      (await request("missed-appeal", { reason: "Other owner" }, "APPLICANT"))
        .status,
    ).toBe(404);
    expect(db.entranceExamApplication.updateMany).not.toHaveBeenCalled();
    const result = await request(
      "missed-appeal",
      { reason: "  Prior date explanation  " },
      "APPLICANT",
      ids.app,
      "POST",
      ids.user,
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.json()).toMatchObject({
      applicationId: ids.app,
      status: "APPEALED",
    });
    expect(db.examScheduleAmendment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: ids.app,
        reason: "Prior date explanation",
        requestedById: ids.user,
        status: "PENDING",
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    const locks = db.$queryRaw.mock.calls.map((call) => String(call[0]));
    expect(locks[0]).toContain("FROM students");
    expect(locks[1]).toContain("FROM exam_slots");
    expect(locks[2]).toContain("FROM entrance_exam_applications");
  });
  it.each([
    "missed-appeal",
    "missed-appeal/approve",
    "missed-appeal/reject",
    "reschedule",
    "cancel-appointment",
    "reconsider-result",
  ])(
    "%s rejects client authority and malformed exact ids before mutations",
    async (suffix) => {
      const target = ["reschedule", "missed-appeal/approve"].includes(suffix)
        ? { targetSlotId: ids.slot }
        : {};
      const role = suffix === "missed-appeal" ? "APPLICANT" : "ADMIN";
      for (const body of [
        null,
        [],
        {},
        { reason: " " },
        { reason: "x".repeat(2001) },
        ...[
          "status",
          "score",
          "totalScore",
          "passingThreshold",
          "scoringBasis",
          "decidedAt",
          "decidedById",
          "userId",
          "seatReleasedAt",
        ].map((key) => ({ reason: "explanation", ...target, [key]: "forged" })),
      ])
        expect((await request(suffix, body, role)).status).toBe(400);
      expect(
        (
          await request(
            suffix,
            { reason: "exact", ...target },
            role,
            "arbitrary-latest" as typeof ids.app,
          )
        ).status,
      ).toBe(400);
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it("rechecks active Admin and never-started authority inside the exact transaction", async () => {
    db.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: false });
    expect((await request("cancel-appointment")).status).toBe(403);
    db.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true });
    app.actualStartedAt = new Date();
    expect((await request("cancel-appointment")).status).toBe(409);
    expect(db.entranceExamApplication.updateMany).not.toHaveBeenCalled();
  });
  it("unexpected database errors return a bounded private response", async () => {
    db.$transaction.mockRejectedValue(new Error("private SQL credentials"));
    const response = await request("cancel-appointment");
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private SQL credentials");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each([
    ["/appeal", "POST", "APPLICANT"],
    [`/appeals/${ids.app}/approve`, "PATCH", "ADMIN"],
    [`/appeals/${ids.app}/reject`, "PATCH", "ADMIN"],
  ])(
    "retired %s fails without selecting or mutating any application",
    async (route, method, role) => {
      const token = jwt.sign({ userId: ids.user, role }, secret);
      const response = await fetch(base + route, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Legacy route" }),
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
});
