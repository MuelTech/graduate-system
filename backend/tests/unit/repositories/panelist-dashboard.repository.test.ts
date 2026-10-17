import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  panelAssignment: { findMany: vi.fn() },
  rapReportSignature: { findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { PanelistDashboardRepository } from "../../../src/repositories/panelist-dashboard.repository";

function assignmentRow(overrides: {
  role: string;
  defenseType: string;
  oralExamScores?: Array<{ panelId: string; status: string }>;
}) {
  return {
    id: "pa-1",
    userId: "u1",
    role: overrides.role,
    oralExamScores: overrides.oralExamScores ?? [],
    schedule: {
      id: "sched-1",
      defenseType: overrides.defenseType,
      sessionStatus: "IN_PROGRESS",
      defenseDate: new Date("2026-10-01T00:00:00Z"),
      defenseTime: new Date("1970-01-01T10:00:00Z"),
      venueOrLink: "Room 1",
      conclusion: null,
      oralExamSummary: null,
      rapporteurNotesFinalizedAt: null,
      thesis: {
        student: {
          studentNumber: "2026-1",
          user: { firstName: "Ana", lastName: "Student" },
          program: { programName: "MIT" },
        },
      },
    },
  };
}

describe("WF-C1b PanelistDashboardRepository evaluator status", () => {
  const repo = new PanelistDashboardRepository();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Title Chairman/Panelist surface own status; Rapporteur/Facilitator → NONE", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignmentRow({
        role: "CHAIRMAN",
        defenseType: "TITLE_DEFENSE",
        oralExamScores: [{ panelId: "pa-1", status: "DRAFT" }],
      }),
      assignmentRow({ role: "PANELIST", defenseType: "TITLE_DEFENSE" }),
      assignmentRow({
        role: "RAPPORTEUR",
        defenseType: "TITLE_DEFENSE",
        oralExamScores: [{ panelId: "pa-1", status: "DRAFT" }],
      }),
      assignmentRow({
        role: "FACILITATOR",
        defenseType: "TITLE_DEFENSE",
        oralExamScores: [{ panelId: "pa-1", status: "DRAFT" }],
      }),
    ]);

    const rows = await repo.getAssignments("u1");
    expect(rows[0].evaluationStatus).toBe("DRAFT");
    expect(rows[1].evaluationStatus).toBe("NOT_STARTED");
    expect(rows[2].evaluationStatus).toBe("NONE");
    expect(rows[3].evaluationStatus).toBe("NONE");
  });
});

describe("CDW-7 read-model cleanup — historical RAP slots are not actionable work", () => {
  const repo = new PanelistDashboardRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.rapReportSignature.findMany.mockResolvedValue([]);
  });

  function pendingWhere() {
    return prismaMock.rapReportSignature.findMany.mock.calls[0][0].where;
  }

  it("A/B: pending slots exclude CONCLUDED and CANCELLED attempts at the query level", async () => {
    await repo.getPendingRapSlots("u1");
    const where = pendingWhere();
    expect(where.userId).toBe("u1");
    expect(where.isSigned).toBe(false);
    expect(where.required).toEqual({ not: false });
    expect(where.rapReport.status.in).toEqual(["FOR_SIGNATURE", "PARTIALLY_SIGNED"]);
    expect(where.rapReport.schedule.sessionStatus.notIn).toEqual([
      "CONCLUDED",
      "CANCELLED",
    ]);
  });

  it("C: an ACTIVE pending slot is still returned and mapped", async () => {
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      {
        id: "sig-1",
        rapId: "rap-1",
        roleAtDefense: "PANELIST",
        rapReport: {
          scheduleId: "sched-1",
          defenseType: "PROPOSAL_DEFENSE",
          generatedAt: new Date("2026-10-05T00:00:00Z"),
          thesis: {
            student: {
              studentNumber: "2026-1",
              user: { firstName: "Ana", lastName: "Student" },
            },
          },
        },
      },
    ]);

    const rows = await repo.getPendingRapSlots("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "sig-1",
      scheduleId: "sched-1",
      defenseType: "PROPOSAL_DEFENSE",
      studentName: "Ana Student",
    });
  });

  it("D: signed 'waiting for others' slots exclude CONCLUDED/CANCELLED attempts", async () => {
    await repo.getSignedRapSlots("u1");
    const where = prismaMock.rapReportSignature.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u1");
    expect(where.isSigned).toBe(true);
    expect(where.rapReport.status.in).toEqual(["FOR_SIGNATURE", "PARTIALLY_SIGNED"]);
    expect(where.rapReport.schedule.sessionStatus.notIn).toEqual([
      "CONCLUDED",
      "CANCELLED",
    ]);
  });

  it("E: an ACTIVE signed waiting slot is still returned", async () => {
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      {
        id: "sig-2",
        rapReport: {
          defenseType: "FINAL_DEFENSE",
          thesis: {
            student: {
              studentNumber: "2026-1",
              user: { firstName: "Ana", lastName: "Student" },
            },
          },
        },
        signedAt: new Date("2026-10-06T00:00:00Z"),
      },
    ]);

    const rows = await repo.getSignedRapSlots("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0].defenseType).toBe("FINAL_DEFENSE");
  });
});
