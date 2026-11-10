import express from "express";
import jwt from "jsonwebtoken";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  panelist: { findUnique: vi.fn() },
  adviserRequest: { findMany: vi.fn() },
  adviserAssignment: { findMany: vi.fn() },
  thesisRecord: { findFirst: vi.fn() },
  panelAssignment: { findMany: vi.fn() },
  rapReportSignature: { findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: database }));
import thesisRoutes from "../../../src/routes/thesis.routes";

const SECRET = "uiux-3e-external-adviser-isolation-test";
const originalSecret = process.env.JWT_SECRET;
const INTERNAL_ID = "internal-faculty";
const EXTERNAL_ID = "external-faculty";
const OTHER_ID = "other-faculty";

let accounts: Record<string, any>;
let server: Server;
let base: string;

function makeAccount(
  id: string,
  role: "FACULTY" | "PANELIST",
  isExternal: boolean,
) {
  return {
    id,
    role,
    email: `${id}@example.test`,
    isActive: true,
    mustChangePassword: false,
    panelist: {
      isActive: true,
      isExternal,
      isAvailableAsAdviser: !isExternal,
    },
    administratorAccess: null,
    capabilityGrants: [],
  };
}

function makeAdviserRequestRow(id: string, requestedAdviserId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    requestedAdviserId,
    sourceDefenseScheduleId: "sched-title-1",
    reason: "Research alignment",
    requestDate: new Date("2026-10-01T00:00:00.000Z"),
    status: "PENDING",
    adviserStatus: "PENDING",
    adviserRespondedAt: null,
    adviserRemarks: null,
    deanStatus: "PENDING",
    deanReviewedAt: null,
    deanRemarks: null,
    student: {
      id: `student-${id}`,
      studentNumber: `2026-${id}`,
      user: { id: `stu-user-${id}`, firstName: "Ana", lastName: `Student-${id}`, email: `stu-${id}@example.test` },
      program: { programName: "MIT" },
    },
    requestedAdviser: {
      id: requestedAdviserId,
      firstName: "Prof",
      lastName: requestedAdviserId,
      email: `${requestedAdviserId}@example.test`,
    },
    sourceDefenseSchedule: {
      id: "sched-title-1",
      conclusion: { id: "conc-1", selectedTitle: { id: "t-1", titleText: "Title One" } },
      panelAssignments: [{ role: "CHAIRMAN" }],
    },
    ...overrides,
  };
}

function makeDefenseAssignmentRow(scheduleId: string, studentName: string, sessionStatus: string, dateOffsetDays: number) {
  const defenseDate = new Date(Date.now() + dateOffsetDays * 24 * 60 * 60 * 1000);
  const yyyyMmDd = defenseDate.toISOString().slice(0, 10);
  return {
    id: `pa-${scheduleId}`,
    role: "PANELIST",
    oralExamScores: [],
    schedule: {
      id: scheduleId,
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus,
      defenseDate: new Date(`${yyyyMmDd}T00:00:00.000Z`),
      defenseTime: new Date("1970-01-01T09:00:00.000Z"),
      venueOrLink: "Room 302",
      conclusion: null,
      oralExamSummary: null,
      rapporteurNotesFinalizedAt: null,
      rapReports: [],
      thesis: {
        student: {
          studentNumber: "2026-500",
          user: { firstName: studentName, lastName: "Defense" },
          program: { programName: "MSIT" },
        },
      },
    },
  };
}

async function getAs(userId: string, path: string) {
  const token = jwt.sign({ userId, role: "ADMIN" }, SECRET);
  const response = await fetch(`${base}/api/thesis${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  return { response, body };
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  const app = express();
  app.use(express.json());
  app.use("/api/thesis", thesisRoutes);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

beforeEach(() => {
  vi.resetAllMocks();
  accounts = {
    [INTERNAL_ID]: makeAccount(INTERNAL_ID, "FACULTY", false),
    [EXTERNAL_ID]: makeAccount(EXTERNAL_ID, "PANELIST", true),
    [OTHER_ID]: makeAccount(OTHER_ID, "FACULTY", false),
  };

  database.user.findUnique.mockImplementation(async ({ where }) =>
    accounts[where.id] ? structuredClone(accounts[where.id]) : null,
  );
  database.panelist.findUnique.mockImplementation(async ({ where }) => {
    const account = accounts[where.userId];
    return account?.panelist ? { isExternal: account.panelist.isExternal } : null;
  });
  database.adviserAssignment.findMany.mockResolvedValue([]);
  database.adviserRequest.findMany.mockResolvedValue([]);
  database.thesisRecord.findFirst.mockResolvedValue(null);
  database.panelAssignment.findMany.mockResolvedValue([]);
  database.rapReportSignature.findMany.mockResolvedValue([]);
});

describe("UIUX-3E Part B HTTP/controller boundaries — External Faculty Adviser isolation", () => {
  it("allows Internal Faculty own Adviser inbox and isolates User-ID scope against spoofed query params", async () => {
    const ownRows = [makeAdviserRequestRow("req-own", INTERNAL_ID)];
    const otherRows = [makeAdviserRequestRow("req-other", OTHER_ID)];
    database.adviserRequest.findMany.mockImplementation(async ({ where }) =>
      where.requestedAdviserId === INTERNAL_ID ? ownRows : otherRows,
    );

    const { response, body } = await getAs(
      INTERNAL_ID,
      `/adviser/requests/mine?userId=${OTHER_ID}&requestedAdviserId=${OTHER_ID}`,
    );

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("req-own");
    expect(database.adviserRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requestedAdviserId: INTERNAL_ID } }),
    );
  });

  it("denies External Faculty direct Adviser inbox GET /adviser/requests/mine with 403", async () => {
    database.adviserRequest.findMany.mockResolvedValue([
      makeAdviserRequestRow("req-should-not-leak", EXTERNAL_ID),
    ]);

    const { response, body } = await getAs(EXTERNAL_ID, "/adviser/requests/mine");

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "External Faculty cannot serve as Thesis Adviser." });
    expect(database.adviserRequest.findMany).not.toHaveBeenCalled();
  });

  it("denies External Faculty GET /adviser/workspace with 403 while preserving Internal Faculty access", async () => {
    const externalRes = await getAs(EXTERNAL_ID, "/adviser/workspace");
    expect(externalRes.response.status).toBe(403);
    expect(externalRes.body).toEqual({
      error: "External Faculty cannot serve as Thesis Adviser.",
    });
    expect(database.adviserRequest.findMany).not.toHaveBeenCalled();

    database.adviserRequest.findMany.mockResolvedValue([
      makeAdviserRequestRow("req-int", INTERNAL_ID),
    ]);
    const internalRes = await getAs(INTERNAL_ID, "/adviser/workspace");
    expect(internalRes.response.status).toBe(200);
    expect(internalRes.body.incomingRequests).toHaveLength(1);
    expect(internalRes.body.incomingRequests[0].id).toBe("req-int");
  });

  it("keeps External Faculty Defense dashboard 200 with Defense data and strips all Adviser requests/reviews/waiting items", async () => {
    database.panelAssignment.findMany.mockResolvedValue([
      makeDefenseAssignmentRow("sched-active", "Active", "IN_PROGRESS", 0),
      makeDefenseAssignmentRow("sched-future", "Future", "SCHEDULED", 5),
    ]);
    database.rapReportSignature.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: "sig-waiting",
        rapReport: {
          defenseType: "PROPOSAL_DEFENSE",
          thesis: {
            student: {
              studentNumber: "2026-500",
              user: { firstName: "Signed", lastName: "Defense" },
            },
          },
        },
        signedAt: new Date("2026-10-05T00:00:00.000Z"),
      },
    ]);
    // Even if anomalous rows exist in DB, dashboard aggregator must not fetch or return Adviser data for External Faculty.
    database.adviserRequest.findMany.mockResolvedValue([
      makeAdviserRequestRow("req-ext-hidden", EXTERNAL_ID, {
        status: "PENDING",
        adviserStatus: "CONFORMED",
        deanStatus: "PENDING",
      }),
    ]);

    const { response, body } = await getAs(EXTERNAL_ID, "/defense/panelist/dashboard");

    expect(response.status).toBe(200);
    expect(body.kpis).toEqual({ upcomingDefenses: 1, pendingTasks: 1 });
    expect(body.activeDefenses.map((d: any) => d.scheduleId)).toEqual(["sched-active"]);
    expect(body.upcomingDefenses.map((d: any) => d.scheduleId)).toEqual(["sched-future"]);
    expect(body.needsAttention.map((t: any) => t.id)).toEqual(["evaluation:sched-active"]);
    expect(body.waitingOnOthers.map((w: any) => w.id)).toEqual([
      "rap-awaiting-signatures:sig-waiting",
    ]);
    expect(database.adviserRequest.findMany).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("adviser-dean:");
    expect(JSON.stringify(body)).not.toContain("manuscript-revision:");
    expect(JSON.stringify(body)).not.toContain("ADVISER_REQUEST");
  });

  it("retains legitimate Adviser tasks and Adviser waiting items for Internal Faculty and never swallows DB errors", async () => {
    database.adviserRequest.findMany.mockResolvedValue([
      makeAdviserRequestRow("req-pending", INTERNAL_ID, {
        status: "PENDING",
        adviserStatus: "PENDING",
        deanStatus: "PENDING",
      }),
      makeAdviserRequestRow("req-dean", INTERNAL_ID, {
        status: "PENDING",
        adviserStatus: "CONFORMED",
        deanStatus: "PENDING",
      }),
    ]);

    const okRes = await getAs(INTERNAL_ID, "/defense/panelist/dashboard");
    expect(okRes.response.status).toBe(200);
    expect(okRes.body.kpis.pendingTasks).toBe(1);
    expect(okRes.body.needsAttention.map((t: any) => t.id)).toEqual([
      "adviser-request:req-pending",
    ]);
    expect(okRes.body.waitingOnOthers.map((w: any) => w.id)).toEqual([
      "adviser-dean:req-dean",
    ]);

    // DB error inside Panelist classification check must propagate as error, not mask failure as empty data.
    database.panelist.findUnique.mockRejectedValueOnce(new Error("DB connection failed"));
    const errRes = await getAs(INTERNAL_ID, "/defense/panelist/dashboard");
    expect(errRes.response.status).toBeGreaterThanOrEqual(400);
    expect(errRes.body.needsAttention).toBeUndefined();
  });
});
