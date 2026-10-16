import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn(), updateMany: vi.fn() },
  panelAssignment: { findFirst: vi.fn() },
  rapReport: { findFirst: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DefenseWorkspaceService } from "../../../src/services/defense-workspace.service";

function thesis(
  docs: Array<Record<string, unknown>>,
  certs: Array<Record<string, unknown>> = [],
) {
  return {
    student: {
      id: "st-1",
      studentNumber: "2026-1",
      user: { firstName: "Ana", lastName: "Student" },
      program: { programName: "MIT" },
    },
    thesisTitles: [{ id: "t1", titleText: "Title A" }],
    thesisDocuments: docs.map((d) => ({
      id: d.id,
      docType: d.docType,
      defenseStage: d.defenseStage ?? null,
      uploadedAt: d.uploadedAt ?? new Date("2026-01-01T00:00:00Z"),
      thesisId: "thesis-1",
    })),
    adviserCertifications: certs,
  };
}

function scheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    thesisId: "thesis-1",
    defenseType: "PROPOSAL_DEFENSE",
    sessionStatus: "IN_PROGRESS",
    defenseDate: new Date("2026-09-30T00:00:00Z"),
    defenseTime: new Date("1970-01-01T14:00:00Z"),
    venueOrLink: "Room 101",
    rapporteurNotes: null,
    conclusion: null,
    oralExamSummary: null,
    rapReports: [],
    manuscriptDocumentId: null,
    manuscriptDocument: null,
    thesis: thesis(
      [{ id: "doc-p", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" }],
      [{ defenseStage: "PROPOSAL_DEFENSE", status: "ISSUED", reviewedDocumentId: "doc-p" }],
    ),
    panelAssignments: [
      { id: "pa-eval", role: "PANELIST", user: { id: "u-eval", firstName: "Eva", lastName: "Evaluator" } },
    ],
    oralExamScores: [{ panelId: "pa-eval", status: "DRAFT" }],
    ...overrides,
  };
}

describe("DefenseWorkspaceService — CDW-2 exact attempt manuscript binding", () => {
  const svc = new DefenseWorkspaceService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-1",
      userId: "u-eval",
      role: "PANELIST",
    });
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns the BOUND attempt manuscript even when a newer current doc + cert exist", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        manuscriptDocumentId: "doc-A",
        manuscriptDocument: {
          id: "doc-A",
          docType: "PROPOSAL_CHAPTERS",
          defenseStage: "PROPOSAL",
          uploadedAt: new Date("2026-01-01T00:00:00Z"),
        },
        thesis: thesis(
          [
            { id: "doc-A", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", uploadedAt: new Date("2026-01-01T00:00:00Z") },
            { id: "doc-B", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", uploadedAt: new Date("2026-06-01T00:00:00Z") },
          ],
          [{ defenseStage: "PROPOSAL_DEFENSE", status: "ISSUED", reviewedDocumentId: "doc-B" }],
        ),
      }),
    );
    const ws = await svc.getWorkspace("sched-1", "u-eval");
    expect(ws.documents[0]?.id).toBe("doc-A");
    expect(prismaMock.defenseSchedule.updateMany).not.toHaveBeenCalled();
  });

  it("derives and one-time binds the authoritative doc for an unbound ACTIVE attempt", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow());
    const ws = await svc.getWorkspace("sched-1", "u-eval");
    expect(ws.documents[0]?.id).toBe("doc-p");
    expect(prismaMock.defenseSchedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sched-1", manuscriptDocumentId: null },
        data: { manuscriptDocumentId: "doc-p" },
      }),
    );
  });

  it("derives but does NOT bind for an unbound CONCLUDED attempt", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "CONCLUDED" }),
    );
    const ws = await svc.getWorkspace("sched-1", "u-eval");
    expect(ws.documents[0]?.id).toBe("doc-p");
    expect(prismaMock.defenseSchedule.updateMany).not.toHaveBeenCalled();
  });

  it("throws 409 for an unbound Proposal attempt with no certified manuscript", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ thesis: thesis([], []) }),
    );
    await expect(svc.getWorkspace("sched-1", "u-eval")).rejects.toMatchObject({ statusCode: 409 });
  });
});
