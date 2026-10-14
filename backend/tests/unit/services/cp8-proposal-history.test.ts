import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: {
    findUnique: vi.fn(),
  },
  panelAssignment: { findFirst: vi.fn() },
  defenseConclusion: { findFirst: vi.fn() },
  rapReport: { findFirst: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DefenseWorkspaceService } from "../../../src/services/defense-workspace.service";

const proposalDocA = {
  id: "doc-proposal-a",
  docType: "PROPOSAL_CHAPTERS",
  defenseStage: "PROPOSAL",
  uploadedAt: new Date("2026-08-01T00:00:00Z"),
  thesisId: "thesis-1",
};
const proposalDocB = {
  id: "doc-proposal-b",
  docType: "PROPOSAL_CHAPTERS",
  defenseStage: "PROPOSAL",
  uploadedAt: new Date("2026-09-01T00:00:00Z"),
  thesisId: "thesis-1",
};
const finalDocC = {
  id: "doc-final-c",
  docType: "FINAL_MANUSCRIPT",
  defenseStage: "FINAL",
  uploadedAt: new Date("2026-09-15T00:00:00Z"),
  thesisId: "thesis-1",
};

function finalWorkspaceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-final",
    defenseType: "FINAL_DEFENSE",
    sessionStatus: "IN_PROGRESS",
    defenseDate: new Date("2026-10-01T00:00:00Z"),
    defenseTime: new Date("1970-01-01T14:00:00Z"),
    venueOrLink: "Room 9",
    rapporteurNotes: null,
    rapporteurNotesFinalizedAt: null,
    rapporteurNotesFinalizedById: null,
    conclusion: null,
    oralExamSummary: null,
    rapReports: [],
    thesisId: "thesis-1",
    thesis: {
      student: {
        id: "st-1",
        studentNumber: "2026-1",
        user: { firstName: "Ana", lastName: "Student" },
        program: { programName: "MIT" },
      },
      thesisTitles: [],
      thesisDocuments: [proposalDocA, proposalDocB, finalDocC],
      adviserCertifications: [
        {
          defenseStage: "PROPOSAL_DEFENSE",
          status: "ISSUED",
          reviewedDocumentId: "doc-proposal-a",
        },
        {
          defenseStage: "FINAL_DEFENSE",
          status: "ISSUED",
          reviewedDocumentId: "doc-final-c",
        },
      ],
    },
    panelAssignments: [
      {
        id: "pa-eval",
        userId: "u-eval",
        role: "PANELIST",
        user: { id: "u-eval", firstName: "Eva", lastName: "Evaluator" },
      },
    ],
    oralExamScores: [],
    ...overrides,
  };
}

describe("CP8 Final Workspace proposalHistory", () => {
  const svc = new DefenseWorkspaceService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-final",
      userId: "u-eval",
      role: "PANELIST",
    });
    prismaMock.defenseConclusion.findFirst.mockResolvedValue({
      scheduleId: "sched-proposal",
      outcome: "PASSED",
    });
    prismaMock.rapReport.findFirst.mockResolvedValue({
      id: "rap-proposal-1",
      finalizedAt: new Date("2026-08-20T00:00:00Z"),
      decisionsAndRecommendations:
        "Revise Chapter 3 sampling discussion before Final.",
    });
  });

  it("Test 1: Final workspace returns certified Final + certified prior Proposal + finalized Proposal RAP", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());

    const dto = await svc.getWorkspace("sched-final", "u-eval");

    // Certified Final manuscript preserved
    expect(dto.documents).toHaveLength(1);
    expect(dto.documents[0].id).toBe("doc-final-c");
    expect(dto.documents[0].displayName).toBe("Certified Final Manuscript");

    // CP8: exact certified prior Proposal manuscript (A, not newer B)
    expect(dto.proposalHistory?.manuscript?.id).toBe("doc-proposal-a");
    expect(dto.proposalHistory?.manuscript?.displayName).toBe(
      "Previous Proposal Manuscript",
    );

    // Finalized Proposal RAP
    expect(dto.proposalHistory?.rap?.id).toBe("rap-proposal-1");
    expect(dto.proposalHistory?.rap?.status).toBe("FINALIZED");
    expect(dto.proposalHistory?.rap?.decisionsAndRecommendations).toContain(
      "Revise Chapter 3",
    );
  });

  it("Test 2: prior Proposal manuscript is certification-bound (A never B)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.manuscript?.id).toBe("doc-proposal-a");
    expect(dto.proposalHistory?.manuscript?.id).not.toBe("doc-proposal-b");
  });

  it("Test 3: certified Final manuscript selection does not regress", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.documents[0].id).toBe("doc-final-c");
    expect(dto.documents[0].id).not.toBe("doc-proposal-b");
  });

  it("Test 4: Proposal workspace does not receive proposalHistory", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      ...finalWorkspaceRow(),
      id: "sched-prop",
      defenseType: "PROPOSAL_DEFENSE",
      thesis: {
        ...finalWorkspaceRow().thesis,
        adviserCertifications: [
          {
            defenseStage: "PROPOSAL_DEFENSE",
            status: "ISSUED",
            reviewedDocumentId: "doc-proposal-a",
          },
        ],
      },
    });
    const dto = await svc.getWorkspace("sched-prop", "u-eval");
    expect(dto.proposalHistory).toBeNull();
  });

  it("Test 5: non-FINALIZED Proposal RAP is not exposed as history", async () => {
    prismaMock.rapReport.findFirst.mockResolvedValue(null);
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.rap).toBeNull();
    // Manuscript still present independently
    expect(dto.proposalHistory?.manuscript?.id).toBe("doc-proposal-a");
  });

  it("fails closed when Proposal cert binding is missing", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      finalWorkspaceRow({
        thesis: {
          ...finalWorkspaceRow().thesis,
          adviserCertifications: [
            {
              defenseStage: "FINAL_DEFENSE",
              status: "ISSUED",
              reviewedDocumentId: "doc-final-c",
            },
          ],
        },
      }),
    );
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.manuscript).toBeNull();
  });

  it("fails closed when Proposal cert points at wrong thesis document", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      finalWorkspaceRow({
        thesis: {
          ...finalWorkspaceRow().thesis,
          thesisDocuments: [
            proposalDocA,
            proposalDocB,
            finalDocC,
            {
              id: "doc-other-thesis",
              docType: "PROPOSAL_CHAPTERS",
              defenseStage: "PROPOSAL",
              uploadedAt: new Date(),
              thesisId: "other-thesis",
            },
          ],
          adviserCertifications: [
            {
              defenseStage: "PROPOSAL_DEFENSE",
              status: "ISSUED",
              reviewedDocumentId: "doc-other-thesis",
            },
            {
              defenseStage: "FINAL_DEFENSE",
              status: "ISSUED",
              reviewedDocumentId: "doc-final-c",
            },
          ],
        },
      }),
    );
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.manuscript).toBeNull();
  });

  it("CP8-FIX1: PASSED Proposal conclusion + FINALIZED RAP → exposed", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue({
      scheduleId: "sched-proposal",
      outcome: "PASSED",
    });
    prismaMock.rapReport.findFirst.mockResolvedValue({
      id: "rap-passed",
      finalizedAt: new Date("2026-08-20T00:00:00Z"),
      decisionsAndRecommendations: "ok",
    });
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.rap?.id).toBe("rap-passed");
    // Conclusion query must filter outcome PASSED
    const conclusionWhere = prismaMock.defenseConclusion.findFirst.mock.calls[0][0].where;
    expect(conclusionWhere.outcome).toBe("PASSED");
    expect(conclusionWhere.schedule.defenseType).toBe("PROPOSAL_DEFENSE");
  });

  it("CP8-FIX1: FAILED Proposal conclusion + FINALIZED RAP → not exposed", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue({
      scheduleId: "sched-proposal-failed",
      outcome: "FAILED",
    });
    prismaMock.rapReport.findFirst.mockResolvedValue({
      id: "rap-failed-conclusion",
      finalizedAt: new Date(),
      decisionsAndRecommendations: "should not appear",
    });
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.rap).toBeNull();
  });

  it("CP8-FIX1: REVISION_REQUIRED Proposal conclusion + FINALIZED RAP → not exposed", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue({
      scheduleId: "sched-proposal-rev",
      outcome: "REVISION_REQUIRED",
    });
    prismaMock.rapReport.findFirst.mockResolvedValue({
      id: "rap-rev-conclusion",
      finalizedAt: new Date(),
      decisionsAndRecommendations: "should not appear",
    });
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.rap).toBeNull();
  });

  it("CP8-FIX1: PASSED Proposal conclusion + non-finalized RAP → not exposed", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue({
      scheduleId: "sched-proposal",
      outcome: "PASSED",
    });
    prismaMock.rapReport.findFirst.mockResolvedValue(null);
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.rap).toBeNull();
    expect(dto.proposalHistory?.manuscript?.id).toBe("doc-proposal-a");
  });

  it("CP8-FIX1: RAP query bound to exact PASSED Proposal conclusion scheduleId", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue({
      scheduleId: "sched-proposal-passed",
      outcome: "PASSED",
    });
    prismaMock.rapReport.findFirst.mockResolvedValue({
      id: "rap-bound",
      finalizedAt: new Date(),
      decisionsAndRecommendations: "bound",
    });
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    await svc.getWorkspace("sched-final", "u-eval");

    const conclusionCall = prismaMock.defenseConclusion.findFirst.mock.calls[0][0];
    expect(conclusionCall.where.scheduleId).toBeUndefined();
    expect(conclusionCall.where.outcome).toBe("PASSED");

    const rapCall = prismaMock.rapReport.findFirst.mock.calls[0][0];
    expect(rapCall.where.scheduleId).toBe("sched-proposal-passed");
    expect(rapCall.where.status).toBe("FINALIZED");
    expect(rapCall.where.defenseType).toBe("PROPOSAL_DEFENSE");
  });
});
