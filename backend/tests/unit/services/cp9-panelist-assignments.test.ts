import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  panelAssignment: {
    findMany: vi.fn(),
  },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { ThesisRepository } from "../../../src/repositories/thesis.repository";

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
      sessionStatus: "SCHEDULED",
      defenseDate: new Date("2026-10-01T00:00:00Z"),
      defenseTime: new Date("1970-01-01T10:00:00Z"),
      venueOrLink: "Room 1",
      thesis: {
        student: {
          user: { firstName: "Ana", lastName: "Student" },
          program: { programName: "MIT" },
        },
        thesisDocuments: [],
      },
    },
  };
}

describe("CP9 getPanelistAssignments evaluationStatus", () => {
  const repo = new ThesisRepository();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PANELIST + no score row → NOT_STARTED (Proposal)", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignmentRow({ role: "PANELIST", defenseType: "PROPOSAL_DEFENSE" }),
    ]);
    const rows = await repo.getPanelistAssignments("u1");
    expect(rows[0].evaluationStatus).toBe("NOT_STARTED");
  });

  it("PANELIST + DRAFT → DRAFT", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignmentRow({
        role: "PANELIST",
        defenseType: "PROPOSAL_DEFENSE",
        oralExamScores: [{ panelId: "pa-1", status: "DRAFT" }],
      }),
    ]);
    const rows = await repo.getPanelistAssignments("u1");
    expect(rows[0].evaluationStatus).toBe("DRAFT");
  });

  it("PANELIST + FINALIZED → FINALIZED", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignmentRow({
        role: "PANELIST",
        defenseType: "FINAL_DEFENSE",
        oralExamScores: [{ panelId: "pa-1", status: "FINALIZED" }],
      }),
    ]);
    const rows = await repo.getPanelistAssignments("u1");
    expect(rows[0].evaluationStatus).toBe("FINALIZED");
  });

  it("CHAIRMAN + no score row → NOT_STARTED; CHAIRMAN + DRAFT/FINALIZED maps own status", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignmentRow({ role: "CHAIRMAN", defenseType: "PROPOSAL_DEFENSE" }),
      assignmentRow({
        role: "CHAIRMAN",
        defenseType: "PROPOSAL_DEFENSE",
        oralExamScores: [{ panelId: "pa-1", status: "DRAFT" }],
      }),
      assignmentRow({
        role: "CHAIRMAN",
        defenseType: "PROPOSAL_DEFENSE",
        oralExamScores: [{ panelId: "pa-1", status: "FINALIZED" }],
      }),
    ]);
    const rows = await repo.getPanelistAssignments("u1");
    expect(rows[0].evaluationStatus).toBe("NOT_STARTED");
    expect(rows[1].evaluationStatus).toBe("DRAFT");
    expect(rows[2].evaluationStatus).toBe("FINALIZED");
  });

  it("RAPPORTEUR / FACILITATOR / ADVISER → NONE", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignmentRow({
        role: "RAPPORTEUR",
        defenseType: "PROPOSAL_DEFENSE",
        oralExamScores: [{ panelId: "pa-1", status: "DRAFT" }],
      }),
      assignmentRow({ role: "FACILITATOR", defenseType: "PROPOSAL_DEFENSE" }),
      assignmentRow({ role: "ADVISER", defenseType: "FINAL_DEFENSE" }),
    ]);
    const rows = await repo.getPanelistAssignments("u1");
    expect(rows[0].evaluationStatus).toBe("NONE");
    expect(rows[1].evaluationStatus).toBe("NONE");
    expect(rows[2].evaluationStatus).toBe("NONE");
  });

  it("TITLE_DEFENSE + CHAIRMAN/PANELIST → NONE (no numerical evaluation)", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignmentRow({
        role: "CHAIRMAN",
        defenseType: "TITLE_DEFENSE",
        oralExamScores: [{ panelId: "pa-1", status: "DRAFT" }],
      }),
      assignmentRow({ role: "PANELIST", defenseType: "TITLE_DEFENSE" }),
    ]);
    const rows = await repo.getPanelistAssignments("u1");
    expect(rows[0].evaluationStatus).toBe("NONE");
    expect(rows[1].evaluationStatus).toBe("NONE");
  });

  it("privacy: response has no other-evaluator criteria/recommendations/signatureData", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignmentRow({
        role: "PANELIST",
        defenseType: "PROPOSAL_DEFENSE",
        oralExamScores: [{ panelId: "pa-1", status: "DRAFT" }],
      }),
    ]);
    const rows = await repo.getPanelistAssignments("u1");
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toMatch(/signatureData/);
    expect(serialized).not.toMatch(/recommendations/);
    expect(serialized).not.toMatch(/timelinessRelevance/);
    // own status only
    expect(rows[0].oralExamScores?.[0]).toEqual({
      panelId: "pa-1",
      status: "DRAFT",
    });
  });

  it("include selects only panelId+status for oralExamScores (privacy)", async () => {
    const spy = vi
      .spyOn(prismaMock.panelAssignment, "findMany")
      .mockResolvedValue([]);
    await repo.getPanelistAssignments("u1");
    const args = spy.mock.calls[0][0] as Record<string, any>;
    expect(args.include.oralExamScores.select).toEqual({
      panelId: true,
      status: true,
    });
    spy.mockRestore();
  });

  it("preserves stage-aware document filtering in assignment payload", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      {
        ...assignmentRow({ role: "PANELIST", defenseType: "TITLE_DEFENSE" }),
        schedule: {
          id: "sched-1",
          defenseType: "TITLE_DEFENSE",
          sessionStatus: "SCHEDULED",
          defenseDate: new Date(),
          thesis: {
            student: {
              user: { firstName: "Ana", lastName: "Student" },
              program: { programName: "MIT" },
            },
            thesisDocuments: [
              {
                id: "d1",
                docType: "TITLE_PROPOSAL",
                defenseStage: "TITLE",
              },
              {
                id: "d2",
                docType: "PROPOSAL_CHAPTERS",
                defenseStage: "PROPOSAL",
              },
            ],
          },
        },
      },
    ]);
    const rows = await repo.getPanelistAssignments("u1");
    const docs = rows[0].schedule.thesis.thesisDocuments as Array<{
      id: string;
    }>;
    expect(docs.map((d) => d.id)).toEqual(["d1"]);
  });
});
