import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn(), updateMany: vi.fn() },
  panelAssignment: { findFirst: vi.fn() },
  rapReportSignature: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  rapReport: { findUnique: vi.fn(), updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import {
  buildPanelistDashboard,
  type DashboardAssignmentInput,
  type DashboardRapSlotInput,
} from "../../../src/services/panelist-dashboard.rules";
import { DefenseWorkspaceService } from "../../../src/services/defense-workspace.service";
import { RapReportService } from "../../../src/services/rap-report.service";
import {
  validateConclusionPreconditions,
  type ConclusionPreconditions,
} from "../../../src/services/defense-conclusion.service";
import { resolveRapSignatureRequirements } from "../../../src/services/rap-signature.policy";

const STAGES = ["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"] as const;

function assignment(
  overrides: Partial<DashboardAssignmentInput> = {},
): DashboardAssignmentInput {
  return {
    assignmentId: "pa-1",
    role: "CHAIRMAN",
    evaluationStatus: "FINALIZED",
    scheduleId: "sched-1",
    defenseType: "PROPOSAL_DEFENSE",
    sessionStatus: "AWAITING_CONCLUSION",
    defenseDate: "2026-10-20",
    defenseTime: "09:00:00",
    venueOrLink: "Room 101",
    conclusionPresent: false,
    rapporteurNotesFinalized: true,
    oralSummaryReady: true,
    rapStatus: "FINALIZED",
    studentName: "Ana Student",
    studentNumber: "2026-1",
    programName: "MIT",
    ...overrides,
  };
}

function rapSlot(overrides: Partial<DashboardRapSlotInput> = {}): DashboardRapSlotInput {
  return {
    id: "sig-1",
    rapId: "rap-1",
    scheduleId: "sched-1",
    roleAtDefense: "PANELIST",
    defenseType: "PROPOSAL_DEFENSE",
    generatedDate: "2026-10-05",
    studentName: "Ana Student",
    studentNumber: "2026-1",
    ...overrides,
  };
}

function build(assignments: DashboardAssignmentInput[], pendingRapSlots: DashboardRapSlotInput[] = []) {
  return buildPanelistDashboard({
    now: new Date(2026, 9, 8, 3, 0, 0),
    assignments,
    pendingRapSlots,
    signedRapSlots: [],
    adviserRequests: [],
    proposalReviewTasks: [],
    finalReviewTasks: [],
  });
}

describe("CDW-7 acceptance — dashboard must not enable conclusion before RAP FINALIZED", () => {
  it("A1: Chairman gets no conclusion task while the Committee Report is not FINALIZED (all stages)", () => {
    for (const stage of STAGES) {
      for (const rapStatus of [null, "DRAFT", "FOR_SIGNATURE", "PARTIALLY_SIGNED"]) {
        const view = build([assignment({ defenseType: stage, rapStatus })]);
        expect(
          view.needsAttention.filter((t) => t.category === "CHAIRMAN_CONCLUSION"),
          `${stage}/${rapStatus}`,
        ).toEqual([]);
      }
    }
  });

  it("A2: Chairman conclusion becomes actionable only when the RAP is FINALIZED (all stages)", () => {
    for (const stage of STAGES) {
      const view = build([assignment({ defenseType: stage, rapStatus: "FINALIZED" })]);
      expect(
        view.needsAttention.some((t) => t.category === "CHAIRMAN_CONCLUSION"),
        stage,
      ).toBe(true);
    }
  });

  it("A3: the blocked reason points at the Committee Report, not legacy Rapporteur notes", () => {
    const view = build([assignment({ defenseType: "TITLE_DEFENSE", rapStatus: "PARTIALLY_SIGNED" })]);
    const waiting = view.waitingOnOthers.find((w) => w.id === "chairman-prereq:sched-1");
    expect(waiting?.requirement).toMatch(/Committee Report/i);
  });

  it("A4: a pending RAP signature task opens the Defense Workspace, not a blind signature page", () => {
    const view = build([assignment({ role: "PANELIST", defenseType: "PROPOSAL_DEFENSE" })], [
      rapSlot({ scheduleId: "sched-xyz" }),
    ]);
    const task = view.needsAttention.find((t) => t.category === "RAP_SIGNATURE");
    expect(task?.href).toBe("/panelist/defense-workspace/sched-xyz");
  });
});

describe("CDW-7 acceptance — workspace capability mirrors RAP-C1 conclusion readiness", () => {
  function workspaceRow(rapStatus: string | null) {
    return {
      id: "sched-1",
      thesisId: "thesis-1",
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "AWAITING_CONCLUSION",
      defenseDate: new Date("2026-10-20T00:00:00Z"),
      defenseTime: new Date("1970-01-01T09:00:00Z"),
      venueOrLink: "Room 101",
      rapporteurNotes: null,
      rapporteurNotesFinalizedAt: new Date("2026-10-19T00:00:00Z"),
      rapporteurNotesFinalizedById: "u-chair",
      manuscriptDocument: {
        id: "doc-prop",
        docType: "PROPOSAL_CHAPTERS",
        defenseStage: "PROPOSAL",
        uploadedAt: new Date("2026-10-01T00:00:00Z"),
      },
      conclusion: null,
      oralExamSummary: { id: "summary-1" },
      rapReports: rapStatus ? [{ status: rapStatus }] : [],
      thesis: {
        student: {
          id: "st-1",
          studentNumber: "2026-1",
          user: { firstName: "Ana", lastName: "Student" },
          program: { programName: "MIT" },
        },
        thesisTitles: [],
        thesisDocuments: [],
        adviserCertifications: [],
      },
      panelAssignments: [
        {
          id: "pa-chair",
          userId: "u-chair",
          role: "CHAIRMAN",
          user: { id: "u-chair", firstName: "Carl", lastName: "Chair" },
        },
        {
          id: "pa-panel",
          userId: "u-panel",
          role: "PANELIST",
          user: { id: "u-panel", firstName: "Paula", lastName: "Panel" },
        },
      ],
      oralExamScores: [
        { panelId: "pa-chair", status: "FINALIZED" },
        { panelId: "pa-panel", status: "FINALIZED" },
      ],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      userId: "u-chair",
      role: "CHAIRMAN",
    });
  });

  it("B1: AWAITING_CONCLUSION + evaluations + Summary + finalized notes but a non-FINALIZED RAP → false", async () => {
    for (const rapStatus of [null, "DRAFT", "FOR_SIGNATURE", "PARTIALLY_SIGNED"]) {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(workspaceRow(rapStatus));
      const dto = await new DefenseWorkspaceService().getWorkspace("sched-1", "u-chair");
      expect(dto.capabilities.canRecordFormalResult, String(rapStatus)).toBe(false);
    }
  });

  it("B2: the capability is true only with a FINALIZED RAP", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(workspaceRow("FINALIZED"));
    const dto = await new DefenseWorkspaceService().getWorkspace("sched-1", "u-chair");
    expect(dto.capabilities.canRecordFormalResult).toBe(true);
  });
});

describe("CDW-7 acceptance — legacy signing route binds the frozen RAP snapshot", () => {
  const rap = new RapReportService();

  function frozenSlot(overrides: Record<string, unknown> = {}) {
    return {
      rapId: "rap-1",
      userId: "u-panel",
      isSigned: false,
      rapReport: {
        status: "FOR_SIGNATURE",
        frozenAt: new Date("2026-10-10T00:00:00Z"),
        frozenContentHash: "frozen-hash-1",
        contentVersion: 3,
        schedule: { sessionStatus: "IN_PROGRESS" },
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      Promise.resolve(fn(prismaMock)),
    );
    prismaMock.rapReportSignature.updateMany.mockResolvedValue({ count: 1 });
    vi.spyOn(
      RapReportService.prototype,
      "recomputeRapStatusWithTransition",
    ).mockResolvedValue({
      status: "PARTIALLY_SIGNED",
      transitionedToFinalized: false,
    });
  });

  it("C1: canonical frozen RAP → signature stores the frozen hash and version", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(frozenSlot());
    await rap.signRapSlot("sig-1", "u-panel", "data:image/png;base64,AAAA");

    const data = prismaMock.rapReportSignature.updateMany.mock.calls[0][0].data;
    expect(data.signedContentHash).toBe("frozen-hash-1");
    expect(data.signedContentVersion).toBe(3);
    expect(data.isSigned).toBe(true);
  });

  it("C2: a frozen RAP that is not open for signatures is rejected", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(
      frozenSlot({ rapReport: { ...frozenSlot().rapReport, status: "DRAFT" } }),
    );
    await expect(
      rap.signRapSlot("sig-1", "u-panel", "data:image/png;base64,AAAA"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.rapReportSignature.updateMany).not.toHaveBeenCalled();
  });

  it("C3: FINALIZED RAP slots cannot be re-signed", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(
      frozenSlot({ rapReport: { ...frozenSlot().rapReport, status: "FINALIZED" } }),
    );
    await expect(
      rap.signRapSlot("sig-1", "u-panel", "data:image/png;base64,AAAA"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("C4: another signer's slot is rejected", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(frozenSlot({ userId: "u-other" }));
    await expect(
      rap.signRapSlot("sig-1", "u-panel", "data:image/png;base64,AAAA"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("C5: a legacy RAP without a frozen snapshot keeps the compatibility path", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(
      frozenSlot({
        rapReport: {
          status: "FOR_SIGNATURE",
          frozenAt: null,
          frozenContentHash: null,
          contentVersion: 0,
          schedule: { sessionStatus: "IN_PROGRESS" },
        },
      }),
    );
    await rap.signRapSlot("sig-1", "u-panel", "data:image/png;base64,AAAA");
    const data = prismaMock.rapReportSignature.updateMany.mock.calls[0][0].data;
    expect(data.signedContentHash).toBeUndefined();
    expect(data.isSigned).toBe(true);
  });
});

describe("CDW-7 acceptance — all-stage conclusion gate matrix", () => {
  function preconditions(overrides: Partial<ConclusionPreconditions> = {}): ConclusionPreconditions {
    return {
      alreadyConcluded: false,
      sessionRole: "CHAIRMAN",
      isSessionChairman: true,
      evaluatorAssignments: 3,
      finalizedEvaluatorScores: 3,
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "AWAITING_CONCLUSION",
      rapporteurNotesFinalized: true,
      oralSummaryExists: true,
      outcomeProvided: true,
      rapReportStatus: "FINALIZED",
      ...overrides,
    };
  }

  it("blocks every non-FINALIZED RAP state at every stage, even with legacy notes finalized", () => {
    for (const stage of STAGES) {
      for (const rapStatus of [null, "DRAFT", "FOR_SIGNATURE", "PARTIALLY_SIGNED", "ALL_SIGNED", "DISTRIBUTED"]) {
        const result = validateConclusionPreconditions(
          preconditions({ defenseType: stage, rapReportStatus: rapStatus }),
          "PASSED",
        );
        expect(result.ok, `${stage}/${rapStatus}`).toBe(false);
        expect(result.statusCode).toBe(409);
      }
    }
  });

  it("accepts FINALIZED at every stage when every other prerequisite holds", () => {
    for (const stage of STAGES) {
      const result = validateConclusionPreconditions(
        preconditions({ defenseType: stage }),
        "PASSED",
      );
      expect(result.ok, stage).toBe(true);
      expect(result.outcome).toBe("PASSED");
    }
  });

  it("is Chairman-only, rejects a second conclusion, and rejects legacy/invalid verdicts", () => {
    expect(
      validateConclusionPreconditions(preconditions({ isSessionChairman: false, sessionRole: "PANELIST" }), "PASSED").statusCode,
    ).toBe(403);
    expect(
      validateConclusionPreconditions(preconditions({ alreadyConcluded: true }), "PASSED").statusCode,
    ).toBe(409);
    for (const invalid of ["FAILED", "REVISION_REQUIRED", "APPROVED", ""]) {
      const result = validateConclusionPreconditions(preconditions(), invalid);
      expect(result.ok, invalid).toBe(false);
      expect(result.outcome).toBeNull();
    }
  });
});

describe("CDW-7 acceptance — stage-aware RAP signer matrix", () => {
  const roster = [
    { userId: "adv", role: "ADVISER" },
    { userId: "chair", role: "CHAIRMAN" },
    { userId: "panel", role: "PANELIST" },
    { userId: "rap", role: "RAPPORTEUR" },
    { userId: "fac", role: "FACILITATOR" },
  ];

  it("Title signers = Chairman + Panelists + Rapporteur (no Adviser, no Facilitator)", () => {
    const roles = resolveRapSignatureRequirements(roster, "TITLE_DEFENSE").map((r) => r.roleAtDefense);
    expect(roles).toEqual(["CHAIRMAN", "PANELIST", "RAPPORTEUR"]);
  });

  it("Proposal/Final signers = active Adviser + Chairman + Panelists + Rapporteur (no Facilitator)", () => {
    for (const stage of ["PROPOSAL_DEFENSE", "FINAL_DEFENSE"]) {
      const roles = resolveRapSignatureRequirements(roster, stage).map((r) => r.roleAtDefense);
      expect(roles, stage).toEqual(["ADVISER", "CHAIRMAN", "PANELIST", "RAPPORTEUR"]);
      expect(roles).not.toContain("FACILITATOR");
    }
  });
});
