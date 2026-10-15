import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  panelAssignment: { findMany: vi.fn() },
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
