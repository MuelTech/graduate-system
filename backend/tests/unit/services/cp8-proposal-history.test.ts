import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
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

/**
 * CDW-2 correction: the authoritative prior Proposal context is the manuscript
 * BOUND to the formally PASSED Proposal attempt, resolved as ONE historical unit
 * (passed conclusion -> exact schedule -> exact bound manuscript + that
 * schedule's FINALIZED RAP).
 */
function passedProposalConclusion(overrides: Record<string, unknown> = {}) {
  return {
    scheduleId: "sched-proposal",
    schedule: {
      manuscriptDocumentId: "doc-proposal-a",
      manuscriptDocument: proposalDocA,
    },
    ...overrides,
  };
}

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

describe("CDW-2 Final Workspace proposalHistory — passed Proposal attempt binding", () => {
  const svc = new DefenseWorkspaceService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-final",
      userId: "u-eval",
      role: "PANELIST",
    });
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(
      passedProposalConclusion(),
    );
    prismaMock.rapReport.findFirst.mockResolvedValue({
      id: "rap-proposal-1",
      finalizedAt: new Date("2026-08-20T00:00:00Z"),
      decisionsAndRecommendations:
        "Revise Chapter 3 sampling discussion before Final.",
    });
  });

  it("Test 1: Final workspace returns certified Final + bound prior Proposal + finalized Proposal RAP", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());

    const dto = await svc.getWorkspace("sched-final", "u-eval");

    expect(dto.documents).toHaveLength(1);
    expect(dto.documents[0].id).toBe("doc-final-c");
    expect(dto.documents[0].displayName).toBe("Certified Final Manuscript");

    expect(dto.proposalHistory?.manuscript?.id).toBe("doc-proposal-a");
    expect(dto.proposalHistory?.manuscript?.displayName).toBe(
      "Previous Proposal Manuscript",
    );
    expect(dto.proposalHistory?.rap?.id).toBe("rap-proposal-1");
    expect(dto.proposalHistory?.rap?.status).toBe("FINALIZED");
    expect(dto.proposalHistory?.rap?.decisionsAndRecommendations).toContain(
      "Revise Chapter 3",
    );
  });

  it("Test 2: bound Proposal manuscript wins even when today's cert points elsewhere", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      finalWorkspaceRow({
        thesis: {
          ...finalWorkspaceRow().thesis,
          // Current Proposal certification has drifted to the newer revision.
          adviserCertifications: [
            {
              defenseStage: "PROPOSAL_DEFENSE",
              status: "ISSUED",
              reviewedDocumentId: "doc-proposal-b",
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
    expect(dto.proposalHistory?.manuscript?.id).toBe("doc-proposal-a");
    expect(dto.proposalHistory?.manuscript?.id).not.toBe("doc-proposal-b");
  });

  it("resolves the passed Proposal conclusion by thesis + PASSED + PROPOSAL_DEFENSE", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    await svc.getWorkspace("sched-final", "u-eval");

    const call = prismaMock.defenseConclusion.findFirst.mock.calls[0][0];
    expect(call.where.thesisId).toBe("thesis-1");
    expect(call.where.outcome).toBe("PASSED");
    expect(call.where.schedule.defenseType).toBe("PROPOSAL_DEFENSE");
    expect(call.orderBy).toEqual({ concludedAt: "desc" });
  });

  it("binds the RAP to the SAME passed Proposal schedule as the manuscript", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    await svc.getWorkspace("sched-final", "u-eval");

    const rapCall = prismaMock.rapReport.findFirst.mock.calls[0][0];
    expect(rapCall.where.scheduleId).toBe("sched-proposal");
    expect(rapCall.where.status).toBe("FINALIZED");
    expect(rapCall.where.defenseType).toBe("PROPOSAL_DEFENSE");
  });

  it("REDEFENSE_REQUIRED Proposal attempt is never the authoritative prior context", async () => {
    // No PASSED Proposal conclusion exists → query returns null.
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(null);
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.manuscript ?? null).toBeNull();
    expect(dto.proposalHistory?.rap ?? null).toBeNull();
  });

  it("legacy PASSED Proposal attempt with NO binding → reconciliation (no today-fallback), RAP preserved", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(
      passedProposalConclusion({
        schedule: { manuscriptDocumentId: null, manuscriptDocument: null },
      }),
    );
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.manuscript).toBeNull();
    // The RAP is separately provable for the same passed attempt.
    expect(dto.proposalHistory?.rap?.id).toBe("rap-proposal-1");
  });

  it("does not expose a passed attempt when the bound manuscript id mismatches", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(
      passedProposalConclusion({
        schedule: {
          manuscriptDocumentId: "doc-proposal-a",
          manuscriptDocument: proposalDocB,
        },
      }),
    );
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.manuscript).toBeNull();
  });

  it("non-FINALIZED Proposal RAP is not exposed while the bound manuscript remains", async () => {
    prismaMock.rapReport.findFirst.mockResolvedValue(null);
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.rap).toBeNull();
    expect(dto.proposalHistory?.manuscript?.id).toBe("doc-proposal-a");
  });

  it("re-defense: the PASSED attempt's bound manuscript is the context (not the REDEFENSE attempt)", async () => {
    // Attempt 1 (REDEFENSE_REQUIRED) → doc-proposal-a; Attempt 2 (PASSED) → doc-proposal-b.
    // The passed-attempt query (outcome PASSED, latest concludedAt) must yield attempt 2.
    prismaMock.defenseConclusion.findFirst.mockResolvedValue({
      scheduleId: "sched-proposal-2",
      schedule: {
        manuscriptDocumentId: "doc-proposal-b",
        manuscriptDocument: proposalDocB,
      },
    });
    prismaMock.rapReport.findFirst.mockResolvedValue({
      id: "rap-proposal-2",
      finalizedAt: new Date("2026-09-30T00:00:00Z"),
      decisionsAndRecommendations: "Attempt 2 recommendations.",
    });
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(finalWorkspaceRow());
    const dto = await svc.getWorkspace("sched-final", "u-eval");
    expect(dto.proposalHistory?.manuscript?.id).toBe("doc-proposal-b");
    expect(dto.proposalHistory?.rap?.id).toBe("rap-proposal-2");

    const rapCall = prismaMock.rapReport.findFirst.mock.calls[0][0];
    expect(rapCall.where.scheduleId).toBe("sched-proposal-2");
  });

  it("Proposal workspace does not receive proposalHistory", async () => {
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
});
