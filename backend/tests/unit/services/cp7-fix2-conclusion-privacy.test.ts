import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CP7-FIX2 REAL tests — ThesisRepository.concludeDefense transaction path
 * and repository RAP list privacy (production methods, not placeholders).
 */

const prismaMock = vi.hoisted(() => {
  const tx = {
    defenseSchedule: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    defenseConclusion: { create: vi.fn() },
    thesisRecord: { update: vi.fn() },
    thesisTitle: { update: vi.fn(), updateMany: vi.fn() },
    oralExamSummary: { findUnique: vi.fn(), create: vi.fn() },
    rapReport: {
      create: vi.fn(),
      findMany: vi.fn(),
      findManyCalled: false,
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    rapReportSignature: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    panelAssignment: {
      findMany: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return {
    defenseSchedule: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    defenseConclusion: { create: vi.fn() },
    thesisRecord: { update: vi.fn() },
    rapReport: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    rapReportSignature: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    panelAssignment: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    oralExamScore: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

// Mock RapReportService.createRapAfterConclusion for deterministic generatedById assertions.
vi.mock("../../../src/services/rap-report.service", () => ({
  RapReportService: class {
    createRapAfterConclusion = createRapAfterConclusion;
    signRapSlot = vi.fn();
    recomputeRapStatus = vi.fn();
    getStudentRapAccess = vi.fn();
  },
  buildRapContent: (input: {
    defenseType: string;
    outcome: string;
    rapporteurNotes: string | null;
  }) =>
    `Defense Type: ${input.defenseType}\n${input.outcome}\n${input.rapporteurNotes ?? ""}`,
}));

const createRapAfterConclusion = vi.fn();

import { ThesisRepository } from "../../../src/repositories/thesis.repository";
import { AppError } from "../../../src/utils/AppError";

function scheduleFixture({
  finalizerId,
  notesFinalizedAt = new Date("2026-09-28T11:00:00Z"),
  sessionStatus = "AWAITING_CONCLUSION",
}: {
  finalizerId: string | null;
  notesFinalizedAt?: Date | null;
  sessionStatus?: string;
}) {
  return {
    id: "sched-1",
    thesisId: "thesis-1",
    defenseType: "TITLE_DEFENSE",
    sessionStatus,
    venueOrLink: "Room 1",
    rapporteurNotes: "Official minutes",
    rapporteurNotesFinalizedAt: notesFinalizedAt,
    rapporteurNotesFinalizedById: finalizerId,
    conclusion: null,
    oralExamSummary: null,
    oralExamScores: [],
    panelAssignments: [
      { id: "pa-c", userId: "chair-1", role: "CHAIRMAN" },
      { id: "pa-p", userId: "panel-1", role: "PANELIST" },
      { id: "pa-r", userId: "rap-1", role: "RAPPORTEUR" },
      { id: "pa-f", userId: "fac-1", role: "FACILITATOR" },
    ],
    thesis: {
      thesisTitles: [
        { id: "t1", titleText: "Title One", isSelected: false },
        { id: "t2", titleText: "Title Two", isSelected: false },
      ],
      student: { studentNumber: "2026-001" },
    },
  };
}

describe("CP7-FIX2 REAL E–G: ThesisRepository.concludeDefense finalizer integrity", () => {
  const repo = new ThesisRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    createRapAfterConclusion.mockReset();
    createRapAfterConclusion.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    prismaMock.__tx.defenseConclusion.create.mockResolvedValue({
      id: "c-1",
    });
    prismaMock.__tx.thesisRecord.update.mockResolvedValue({});
    prismaMock.__tx.defenseSchedule.update.mockResolvedValue({});
    prismaMock.__tx.thesisTitle.updateMany.mockResolvedValue({});
    prismaMock.__tx.thesisTitle.update.mockResolvedValue({});
  });

  it("REAL E: null Rapporteur finalizer → 409 and no official writes", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({ finalizerId: null }),
    );

    await expect(
      repo.concludeDefense("sched-1", "chair-1", {
        outcome: "PASSED",
        selectedTitleId: "t1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
    expect(createRapAfterConclusion).not.toHaveBeenCalled();
    expect(prismaMock.__tx.thesisRecord.update).not.toHaveBeenCalled();
    expect(prismaMock.__tx.defenseSchedule.update).not.toHaveBeenCalled();
  });

  it("REAL F: non-Rapporteur finalizer → 409 and no official writes", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({ finalizerId: "panel-1" }),
    );

    await expect(
      repo.concludeDefense("sched-1", "chair-1", {
        outcome: "PASSED",
        selectedTitleId: "t1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
    expect(createRapAfterConclusion).not.toHaveBeenCalled();
    expect(prismaMock.__tx.thesisRecord.update).not.toHaveBeenCalled();
  });

  it("REAL G: valid Rapporteur finalizer becomes RAP generatedById (no Chairman fallback)", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({ finalizerId: "rap-1" }),
    );

    const result = await repo.concludeDefense("sched-1", "chair-1", {
      outcome: "PASSED",
      selectedTitleId: "t1",
    });

    expect(prismaMock.__tx.defenseConclusion.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.__tx.defenseConclusion.create.mock.calls[0][0].data).toMatchObject(
      {
        concludedById: "chair-1",
        outcome: "PASSED",
        selectedTitleId: "t1",
      },
    );
    expect(createRapAfterConclusion).toHaveBeenCalledTimes(1);
    expect(createRapAfterConclusion.mock.calls[0][1]).toMatchObject({
      generatedById: "rap-1",
    });
    expect(result.rapReport.id).toBe("rap-1");
    // No Chairman fallback
    expect(createRapAfterConclusion.mock.calls[0][1].generatedById).not.toBe(
      "chair-1",
    );
  });
});

describe("2026-10-04 Title conclusion — Chairman independent of Rapporteur finalization", () => {
  const repo = new ThesisRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    createRapAfterConclusion.mockReset();
    createRapAfterConclusion.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    prismaMock.__tx.defenseConclusion.create.mockResolvedValue({ id: "c-1" });
    prismaMock.__tx.thesisRecord.update.mockResolvedValue({});
    prismaMock.__tx.defenseSchedule.update.mockResolvedValue({});
    prismaMock.__tx.thesisTitle.updateMany.mockResolvedValue({});
    prismaMock.__tx.thesisTitle.update.mockResolvedValue({});
  });

  it("Title conclusion is allowed while notes are still draft; RAP creation is deferred", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: null,
        notesFinalizedAt: null,
        sessionStatus: "SCHEDULED",
      }),
    );

    const result = await repo.concludeDefense("sched-1", "chair-1", {
      outcome: "PASSED",
      selectedTitleId: "t1",
    });

    expect(prismaMock.__tx.defenseConclusion.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.__tx.defenseSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { sessionStatus: "CONCLUDED" } }),
    );
    // RAP must not be created until the minutes are finalized.
    expect(createRapAfterConclusion).not.toHaveBeenCalled();
    expect(result.rapReport).toBeNull();
  });

  it("Title conclusion before scheduling is rejected (session-state correctness)", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: null,
        notesFinalizedAt: null,
        sessionStatus: "UNSCHEDULED",
      }),
    );

    await expect(
      repo.concludeDefense("sched-1", "chair-1", {
        outcome: "PASSED",
        selectedTitleId: "t1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
    expect(createRapAfterConclusion).not.toHaveBeenCalled();
  });
});

describe("CP7-FIX2 REAL H: distributeRapReport retired — no RAP update", () => {
  it("repository distribute throws 409 and never updates RapReport", async () => {
    const repo = new ThesisRepository();
    await expect(repo.distributeRapReport("rap-1")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.rapReport.update).not.toHaveBeenCalled();
    expect(prismaMock.rapReport.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReport.update).not.toHaveBeenCalled();
  });
});

describe("CP7-FIX2 REAL 9–10: RAP list/pending/reminder signature privacy", () => {
  const repo = new ThesisRepository();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 9: getAllRapReports uses explicit select — no signatureData field", async () => {
    // Spy on findMany args rather than relying on implementation detail alone.
    const spy = vi
      .spyOn(prismaMock.rapReport, "findMany")
      .mockResolvedValue([]);

    await repo.getAllRapReports();

    expect(spy).toHaveBeenCalledTimes(1);
    const callArgs = spy.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.select).toBeTruthy();
    expect(callArgs.include).toBeUndefined();

    // Explicit signature select must not contain signatureData.
    const sigSelect = (
      callArgs.select as {
        signatures?: { select?: Record<string, unknown> };
      }
    ).signatures?.select;
    expect(sigSelect).toBeTruthy();
    expect(Object.keys(sigSelect!)).not.toContain("signatureData");
    expect(Object.keys(sigSelect!)).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "roleAtDefense",
        "required",
        "isSigned",
        "signedAt",
      ]),
    );
    spy.mockRestore();
  });

  it("Test 5: getPendingRapReports select excludes signatureData", async () => {
    const spy = vi
      .spyOn(prismaMock.rapReportSignature, "findMany")
      .mockResolvedValue([]);

    await repo.getPendingRapReports("user-1");

    const callArgs = spy.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.select).toBeTruthy();
    expect(callArgs.include).toBeUndefined();
    expect(JSON.stringify(callArgs)).not.toContain("signatureData");
    spy.mockRestore();
  });

  it("Test 6: getMissingSignaturesForRap select excludes signatureData", async () => {
    const spy = vi
      .spyOn(prismaMock.rapReportSignature, "findMany")
      .mockResolvedValue([]);

    await repo.getMissingSignaturesForRap("rap-1");

    const callArgs = spy.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.select).toBeTruthy();
    expect(callArgs.include).toBeUndefined();
    expect(JSON.stringify(callArgs)).not.toContain("signatureData");
    spy.mockRestore();
  });
});

describe("CP7-FIX2 REAL 11–12: OfficialDefenseRecordService Summary authorization", () => {
  // Use real service with prisma mock (already configured above).
  let OfficialDefenseRecordService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ OfficialDefenseRecordService } = await import(
      "../../../src/services/official-defense-record.service"
    ));
  });

  function summarySchedule(panelAssignments: Array<{ role: string }>) {
    return {
      id: "sched-1",
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "AWAITING_CONCLUSION",
      defenseDate: new Date(),
      defenseTime: new Date(),
      venueOrLink: null,
      panelAssignments,
      oralExamSummary: {
        overallAverage: 88,
        finalRating: null,
        createdAt: new Date(),
        snapshotData: { evaluators: [] },
      },
      conclusion: { outcome: "PASSED" },
      thesis: {
        student: {
          studentNumber: "1",
          user: { firstName: "A", lastName: "B" },
          program: { programName: "MIT" },
        },
      },
    };
  }

  it("Test 11: session Chairman allowed through production getSummaryReadModel", async () => {
    const svc = new OfficialDefenseRecordService();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      summarySchedule([{ role: "CHAIRMAN" }]),
    );
    prismaMock.panelAssignment.findMany.mockResolvedValue([{ id: "p1" }]);
    prismaMock.oralExamScore.count.mockResolvedValue(4);

    const result = await svc.getSummaryReadModel("sched-1", {
      userId: "chair-1",
      role: "PANELIST",
    });
    expect(result.ready).toBe(true);
  });

  it("Test 12: ordinary Panelist denied through production getSummaryReadModel", async () => {
    const svc = new OfficialDefenseRecordService();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      summarySchedule([{ role: "PANELIST" }]),
    );

    await expect(
      svc.getSummaryReadModel("sched-1", {
        userId: "panel-1",
        role: "PANELIST",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("ADMIN allowed through production getSummaryReadModel", async () => {
    const svc = new OfficialDefenseRecordService();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      summarySchedule([]),
    );
    prismaMock.panelAssignment.findMany.mockResolvedValue([{ id: "p1" }]);
    prismaMock.oralExamScore.count.mockResolvedValue(4);

    const result = await svc.getSummaryReadModel("sched-1", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(result.ready).toBe(true);
  });
});
