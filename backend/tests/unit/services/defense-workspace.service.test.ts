import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  panelAssignment: { findFirst: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DefenseWorkspaceService } from "../../../src/services/defense-workspace.service";

function scheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    defenseType: "PROPOSAL_DEFENSE",
    sessionStatus: "IN_PROGRESS",
    defenseDate: new Date("2026-09-30T00:00:00Z"),
    defenseTime: new Date("1970-01-01T14:00:00Z"),
    venueOrLink: "Room 101",
    rapporteurNotes: "draft notes",
    conclusion: null,
    thesis: {
      student: {
        id: "st-1",
        studentNumber: "2026-1",
        user: { firstName: "Ana", lastName: "Student" },
        program: { programName: "MIT" },
      },
      thesisTitles: [{ id: "t1", titleText: "Title A" }],
      thesisDocuments: [
        {
          id: "doc-p",
          docType: "PROPOSAL_CHAPTERS",
          defenseStage: "PROPOSAL",
          uploadedAt: new Date(),
        },
      ],
    },
    panelAssignments: [
      {
        id: "pa-eval",
        role: "PANELIST",
        user: { id: "u-eval", firstName: "Eva", lastName: "Evaluator" },
      },
      {
        id: "pa-rap",
        role: "RAPPORTEUR",
        user: { id: "u-rap", firstName: "Rob", lastName: "Rapporteur" },
      },
      {
        id: "pa-fac",
        role: "FACILITATOR",
        user: { id: "u-fac", firstName: "Fay", lastName: "Fac" },
      },
    ],
    oralExamScores: [{ panelId: "pa-eval", status: "DRAFT" }],
    ...overrides,
  };
}

describe("DefenseWorkspaceService (CP6)", () => {
  const svc = new DefenseWorkspaceService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow());
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-1",
      userId: "u-eval",
      role: "PANELIST",
    });
  });

  it("Test 1: unassigned caller gets 403", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(null);
    await expect(svc.getWorkspace("sched-1", "u-x")).rejects.toThrow(
      /not assigned/i,
    );
    expect(prismaMock.defenseSchedule.findUnique).toHaveBeenCalled();
  });

  it("Test 2/3: Proposal PANELIST canEvaluate, cannot edit notes", async () => {
    const ws = await svc.getWorkspace("sched-1", "u-eval");
    expect(ws.myAssignment.role).toBe("PANELIST");
    expect(ws.capabilities.canEvaluate).toBe(true);
    expect(ws.capabilities.canEditRapporteurNotes).toBe(false);
    expect(ws.rapporteurDraft).toBeNull();
  });

  it("Test 4: Proposal RAPPORTEUR can edit notes, cannot evaluate", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-rap",
      scheduleId: "sched-1",
      userId: "u-rap",
      role: "RAPPORTEUR",
    });
    const ws = await svc.getWorkspace("sched-1", "u-rap");
    expect(ws.capabilities.canEvaluate).toBe(false);
    expect(ws.capabilities.canEditRapporteurNotes).toBe(true);
    expect(ws.rapporteurDraft?.notes).toBe("draft notes");
  });

  it("Test 5/6: FACILITATOR and Title cannot evaluate", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-fac",
      scheduleId: "sched-1",
      userId: "u-fac",
      role: "FACILITATOR",
    });
    const fac = await svc.getWorkspace("sched-1", "u-fac");
    expect(fac.capabilities.canEvaluate).toBe(false);

    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType: "TITLE_DEFENSE" }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-1",
      userId: "u-eval",
      role: "PANELIST",
    });
    const title = await svc.getWorkspace("sched-1", "u-eval");
    expect(title.capabilities.canEvaluate).toBe(false);
    expect(title.proposedTitles.length).toBeGreaterThan(0);
  });

  it("Test 7/8: roster status + evaluation privacy", async () => {
    const ws = await svc.getWorkspace("sched-1", "u-eval");
    const evalRoster = ws.roster.find((r) => r.userId === "u-eval");
    expect(evalRoster?.evaluationStatus).toBe("DRAFT");
    const rapRoster = ws.roster.find((r) => r.userId === "u-rap");
    expect(rapRoster?.evaluationStatus).toBe("NONE");
    // No other evaluator criteria exposed
    expect(JSON.stringify(ws)).not.toContain("timelinessRelevance");
    expect(ws.rapporteurDraft).toBeNull();
  });

  it("Test 9–13: rapporteur notes authorization", async () => {
    // Panelist denied
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-eval", "x"),
    ).rejects.toThrow(/Rapporteur/i);

    // Unassigned denied
    prismaMock.panelAssignment.findFirst.mockResolvedValue(null);
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-x", "x"),
    ).rejects.toThrow(/not assigned/i);

    // Rapporteur allowed
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-rap",
      userId: "u-rap",
      role: "RAPPORTEUR",
    });
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-rap", "hello"),
    ).resolves.toEqual({ saved: true });

    // Closed session 409
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "CONCLUDED" }),
    );
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-rap", "hello"),
    ).rejects.toThrow(/closed/i);
  });

  it("Test 14–16: document stage isolation in workspace DTO", async () => {
    const titleWs = await (async () => {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(
        scheduleRow({
          defenseType: "TITLE_DEFENSE",
          thesis: {
            student: {
              id: "st-1",
              studentNumber: "1",
              user: { firstName: "A", lastName: "B" },
              program: { programName: "MIT" },
            },
            thesisTitles: [],
            thesisDocuments: [
              {
                id: "d-title",
                docType: "TITLE_PROPOSAL",
                defenseStage: "TITLE",
                uploadedAt: new Date(),
              },
              {
                id: "d-final",
                docType: "FINAL_MANUSCRIPT",
                defenseStage: "FINAL",
                uploadedAt: new Date(),
              },
            ],
          },
        }),
      );
      return svc.getWorkspace("sched-1", "u-eval");
    })();
    expect(titleWs.documents.map((d) => d.id)).toEqual(["d-title"]);
  });
});
