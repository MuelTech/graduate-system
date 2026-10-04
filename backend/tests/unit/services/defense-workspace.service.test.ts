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
    thesisId: "thesis-1",
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
          thesisId: "thesis-1",
        },
      ],
      adviserCertifications: [
        {
          defenseStage: "PROPOSAL_DEFENSE",
          status: "ISSUED",
          reviewedDocumentId: "doc-p",
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
    // Certified manuscript binding for Proposal workspace
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        thesis: {
          student: {
            id: "st-1",
            studentNumber: "2026-1",
            user: { firstName: "Ana", lastName: "Student" },
            program: { programName: "MIT" },
          },
          thesisTitles: [],
          thesisDocuments: [
            {
              id: "doc-a",
              docType: "PROPOSAL_CHAPTERS",
              defenseStage: "PROPOSAL",
              uploadedAt: new Date("2026-01-01"),
              thesisId: "thesis-1",
            },
            {
              id: "doc-b",
              docType: "PROPOSAL_CHAPTERS",
              defenseStage: "PROPOSAL",
              uploadedAt: new Date("2026-02-01"),
              thesisId: "thesis-1",
            },
          ],
          adviserCertifications: [
            {
              defenseStage: "PROPOSAL_DEFENSE",
              status: "ISSUED",
              reviewedDocumentId: "doc-a",
            },
          ],
        },
      }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-1",
      userId: "u-eval",
      role: "PANELIST",
    });
    const ws = await svc.getWorkspace("sched-1", "u-eval");
    expect(ws.myAssignment.role).toBe("PANELIST");
    expect(ws.capabilities.canEvaluate).toBe(true);
    expect(ws.capabilities.canEditRapporteurNotes).toBe(false);
    expect(ws.rapporteurDraft).toBeNull();
    // Test 4: exact certified manuscript A, not newer B
    expect(ws.documents.map((d) => d.id)).toEqual(["doc-a"]);
  });

  it("Test 6: missing certification binding returns 409 (no latest fallback)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        thesis: {
          student: {
            id: "st-1",
            studentNumber: "2026-1",
            user: { firstName: "Ana", lastName: "Student" },
            program: { programName: "MIT" },
          },
          thesisTitles: [],
          thesisDocuments: [
            {
              id: "doc-b",
              docType: "PROPOSAL_CHAPTERS",
              defenseStage: "PROPOSAL",
              uploadedAt: new Date("2026-02-01"),
              thesisId: "thesis-1",
            },
          ],
          adviserCertifications: [],
        },
      }),
    );
    await expect(svc.getWorkspace("sched-1", "u-eval")).rejects.toThrow(
      /Certified defense manuscript is unavailable/i,
    );
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
    expect(title.capabilities.canViewTitleChairmanResult).toBe(false);

    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      scheduleId: "sched-1",
      userId: "u-eval",
      role: "CHAIRMAN",
    });
    const titleChair = await svc.getWorkspace("sched-1", "u-eval");
    expect(titleChair.capabilities.canViewTitleChairmanResult).toBe(true);
    expect(titleChair.capabilities.canViewTitleDeliberation).toBe(true);
  });

  it("Test 8: notes updateMany count=0 → 409", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-rap",
      userId: "u-rap",
      role: "RAPPORTEUR",
    });
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "IN_PROGRESS" }),
    );
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-rap", "x"),
    ).rejects.toThrow(/state changed or notes are closed/i);
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

  it("2026-10-04: Title Chairman may record result with draft notes and no evaluator-progress gate", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        defenseType: "TITLE_DEFENSE",
        sessionStatus: "SCHEDULED",
        rapporteurNotesFinalizedAt: null,
      }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      scheduleId: "sched-1",
      userId: "u-chair",
      role: "CHAIRMAN",
    });
    const ws = await svc.getWorkspace("sched-1", "u-chair");
    expect(ws.capabilities.canRecordFormalResult).toBe(true);
    // Title has no numerical evaluator-completion gate.
    expect(ws.evaluationProgress.evaluatorAssignments).toBe(0);
    expect(ws.evaluationProgress.finalizedEvaluations).toBe(0);
  });

  it("2026-10-04: Title Rapporteur may save notes after conclusion until finalized", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        defenseType: "TITLE_DEFENSE",
        sessionStatus: "CONCLUDED",
        rapporteurNotesFinalizedAt: null,
      }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-rap",
      scheduleId: "sched-1",
      userId: "u-rap",
      role: "RAPPORTEUR",
    });
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-rap", "post-conclusion notes"),
    ).resolves.toEqual({ saved: true });
  });
});
