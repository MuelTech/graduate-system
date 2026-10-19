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
    auditLog: { create: vi.fn() },
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
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

// Mock RapReportService.createRapAfterConclusion for deterministic generatedById assertions.
// Spread the real module so shared pure helpers (e.g. resolveAttemptTitleContext)
// keep their production behavior.
vi.mock("../../../src/services/rap-report.service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../src/services/rap-report.service")
    >();
  return {
    ...actual,
    RapReportService: class {
      createRapAfterConclusion = createRapAfterConclusion;
      ensureRapAfterTitlePrerequisites = ensureRapAfterTitlePrerequisites;
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
  };
});

const createRapAfterConclusion = vi.fn();
const ensureRapAfterTitlePrerequisites = vi.fn();

import { ThesisRepository } from "../../../src/repositories/thesis.repository";
import { AppError } from "../../../src/utils/AppError";

function scheduleFixture({
  finalizerId,
  notesFinalizedAt = new Date("2026-09-28T11:00:00Z"),
  sessionStatus = "AWAITING_CONCLUSION",
  overrides = {},
}: {
  finalizerId: string | null;
  notesFinalizedAt?: Date | null;
  sessionStatus?: string;
  overrides?: Record<string, unknown>;
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
    // WF-C1b: Title now requires finalized evaluators + an Oral Summary before
    // the formal conclusion transaction will proceed.
    oralExamSummary: { id: "sum-1" },
    oralExamScores: [
      { panelId: "pa-c", status: "FINALIZED" },
      { panelId: "pa-p", status: "FINALIZED" },
    ],
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
    ...overrides,
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
    expect(prismaMock.__tx.auditLog.create).not.toHaveBeenCalled();
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

  it("REAL G: with an existing FINALIZED RapReport, conclusion succeeds WITHOUT creating or mutating a RAP", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: "rap-1",
        overrides: {
          rapReports: [
            { id: "rap-1", status: "FINALIZED", generatedAt: new Date("2026-10-01T00:00:00Z") },
          ],
        },
      }),
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
    // No post-conclusion RAP creation and no RAP mutation.
    expect(createRapAfterConclusion).not.toHaveBeenCalled();
    expect(ensureRapAfterTitlePrerequisites).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReport.update).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReport.updateMany).not.toHaveBeenCalled();
    expect(result.rapReport.id).toBe("rap-1");
    expect(prismaMock.__tx.auditLog.create).toHaveBeenCalledTimes(1);
    const audit = prismaMock.__tx.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      actorId: "chair-1",
      actionType: "DEFENSE_VERDICT_RECORDED",
      targetTable: "defense_conclusions",
      targetId: "c-1",
      oldValue: null,
      ipAddress: null,
    });
    expect(JSON.parse(audit.newValue)).toEqual({
      scheduleId: "sched-1",
      thesisId: "thesis-1",
      defenseType: "TITLE_DEFENSE",
      outcome: "PASSED",
    });
    expect(audit.newValue).not.toMatch(
      /signature|criteria|recommendation|reportBody|manuscript|finalRemarks|password|token|storagePath/i,
    );
  });

  it("CDW-5 FIX: a failing RAP-lifecycle (non-finalized report) aborts the conclusion (409 propagates)", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({ finalizerId: "rap-1" }),
    );
    // Same rejection the real RapReportService throws when the attempt already has
    // a DRAFT report (see cp7-official-defense-records). It must propagate out of
    // concludeDefense so the surrounding $transaction rolls back.
    createRapAfterConclusion.mockRejectedValue(
      new AppError(
        "The Committee Report must complete the required RAP lifecycle before the defense can be formally concluded.",
        409,
      ),
    );

    await expect(
      repo.concludeDefense("sched-1", "chair-1", {
        outcome: "PASSED",
        selectedTitleId: "t1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("CDW-5 FINAL: TITLE with an existing DRAFT report → 409 and NO official writes", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: null,
        notesFinalizedAt: null,
        overrides: { rapReports: [{ id: "rap-1", status: "DRAFT" }] },
      }),
    );

    await expect(
      repo.concludeDefense("sched-1", "chair-1", {
        outcome: "PASSED",
        selectedTitleId: "t1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    // The guard runs BEFORE any authoritative write, so nothing partial commits.
    expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.thesisRecord.update).not.toHaveBeenCalled();
    expect(prismaMock.__tx.defenseSchedule.update).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.createMany).not.toHaveBeenCalled();
    expect(createRapAfterConclusion).not.toHaveBeenCalled();
  });

  it("CDW-5 FINAL: TITLE with an existing FOR_SIGNATURE / PARTIALLY_SIGNED report → 409", async () => {
    for (const status of ["FOR_SIGNATURE", "PARTIALLY_SIGNED"]) {
      prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
        scheduleFixture({
          finalizerId: null,
          notesFinalizedAt: null,
          overrides: { rapReports: [{ id: "rap-1", status }] },
        }),
      );
      await expect(
        repo.concludeDefense("sched-1", "chair-1", {
          outcome: "PASSED",
          selectedTitleId: "t1",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
    }
  });

  it("CDW-5 FINAL: TITLE with an existing FINALIZED report → conclusion may proceed", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: "rap-1",
        overrides: { rapReports: [{ id: "rap-1", status: "FINALIZED" }] },
      }),
    );

    const result = await repo.concludeDefense("sched-1", "chair-1", {
      outcome: "PASSED",
      selectedTitleId: "t1",
    });
    expect(prismaMock.__tx.defenseConclusion.create).toHaveBeenCalledTimes(1);
    expect(result.conclusion.id).toBe("c-1");
  });

  it("CDW-5 FINAL: Proposal/Final with an existing DRAFT report → 409 (guard is all-stage)", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: "rap-1",
        overrides: {
          defenseType: "PROPOSAL_DEFENSE",
          rapReports: [{ id: "rap-1", status: "DRAFT" }],
        },
      }),
    );

    await expect(
      repo.concludeDefense("sched-1", "chair-1", { outcome: "PASSED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
  });

  it("RAP-C1 FIX: no existing RapReport → 409 and NO official writes / NO RAP created (Title)", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: null,
        notesFinalizedAt: null,
        overrides: { rapReports: [] },
      }),
    );

    await expect(
      repo.concludeDefense("sched-1", "chair-1", {
        outcome: "PASSED",
        selectedTitleId: "t1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.thesisRecord.update).not.toHaveBeenCalled();
    expect(prismaMock.__tx.defenseSchedule.update).not.toHaveBeenCalled();
    expect(createRapAfterConclusion).not.toHaveBeenCalled();
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
    ensureRapAfterTitlePrerequisites.mockReset();
    ensureRapAfterTitlePrerequisites.mockResolvedValue(null);
    prismaMock.__tx.defenseConclusion.create.mockResolvedValue({ id: "c-1" });
    prismaMock.__tx.thesisRecord.update.mockResolvedValue({});
    prismaMock.__tx.defenseSchedule.update.mockResolvedValue({});
    prismaMock.__tx.thesisTitle.updateMany.mockResolvedValue({});
    prismaMock.__tx.thesisTitle.update.mockResolvedValue({});
  });

  it("RAP-C1 FIX: Title cannot conclude before a FINALIZED in-system RAP exists (no deferred RAP)", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: null,
        notesFinalizedAt: null,
        sessionStatus: "AWAITING_CONCLUSION",
        overrides: { rapReports: [] },
      }),
    );

    await expect(
      repo.concludeDefense("sched-1", "chair-1", {
        outcome: "PASSED",
        selectedTitleId: "t1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.defenseSchedule.update).not.toHaveBeenCalled();
    expect(createRapAfterConclusion).not.toHaveBeenCalled();
    expect(ensureRapAfterTitlePrerequisites).not.toHaveBeenCalled();
  });

  it("RAP-C1 FIX: a FINALIZED report is never mutated by the conclusion (Title, REDEFENSE_REQUIRED)", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: "rap-1",
        overrides: {
          rapReports: [
            { id: "rap-1", status: "FINALIZED", generatedAt: new Date("2026-10-01T00:00:00Z") },
          ],
        },
      }),
    );

    const result = await repo.concludeDefense("sched-1", "chair-1", {
      outcome: "REDEFENSE_REQUIRED",
      selectedTitleId: "t1",
    });

    expect(prismaMock.__tx.defenseConclusion.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.__tx.defenseConclusion.create.mock.calls[0][0].data).toMatchObject({
      outcome: "REDEFENSE_REQUIRED",
    });
    // The frozen RAP is untouched: no body/hash/version update, no signature write.
    expect(prismaMock.__tx.rapReport.update).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReport.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.createMany).not.toHaveBeenCalled();
    expect(result.rapReport).toMatchObject({ id: "rap-1", status: "FINALIZED" });
  });

  it("WF-C1b: Title conclusion requires finalized evaluators + Summary in the transaction", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: "rap-1",
        notesFinalizedAt: null,
        sessionStatus: "AWAITING_CONCLUSION",
        overrides: { oralExamSummary: null, oralExamScores: [] },
      }),
    );

    await expect(
      repo.concludeDefense("sched-1", "chair-1", { outcome: "PASSED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.defenseSchedule.update).not.toHaveBeenCalled();
  });

  it("WF-C1b: Title conclusion rejected while the session is IN_PROGRESS", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: "rap-1",
        notesFinalizedAt: null,
        sessionStatus: "IN_PROGRESS",
      }),
    );

    await expect(
      repo.concludeDefense("sched-1", "chair-1", { outcome: "PASSED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
  });

  it("pre-defense SCHEDULED Title cannot be formally concluded", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
      scheduleFixture({
        finalizerId: null,
        notesFinalizedAt: null,
        sessionStatus: "SCHEDULED",
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
    expect(ensureRapAfterTitlePrerequisites).not.toHaveBeenCalled();
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

describe("RAP-C1 FIX — no-RAP fallback removed for NEW conclusions (repository, all stages)", () => {
  const repo = new ThesisRepository();
  const STAGES = ["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"];

  beforeEach(() => {
    vi.clearAllMocks();
    createRapAfterConclusion.mockReset();
    ensureRapAfterTitlePrerequisites.mockReset();
    prismaMock.__tx.defenseConclusion.create.mockResolvedValue({ id: "c-1" });
    prismaMock.__tx.thesisRecord.update.mockResolvedValue({});
    prismaMock.__tx.defenseSchedule.update.mockResolvedValue({});
  });

  for (const defenseType of STAGES) {
    it(`${defenseType}: NO RapReport → 409 with no authoritative writes and no RAP created`, async () => {
      prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
        scheduleFixture({
          finalizerId: "rap-1",
          overrides: { defenseType, rapReports: [] },
        }),
      );
      await expect(
        repo.concludeDefense("sched-1", "chair-1", { outcome: "PASSED", selectedTitleId: "t1" }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
      expect(prismaMock.__tx.thesisRecord.update).not.toHaveBeenCalled();
      expect(prismaMock.__tx.defenseSchedule.update).not.toHaveBeenCalled();
      expect(createRapAfterConclusion).not.toHaveBeenCalled();
      expect(prismaMock.__tx.rapReportSignature.createMany).not.toHaveBeenCalled();
    });

    for (const status of [
      "DRAFT",
      "FOR_SIGNATURE",
      "PARTIALLY_SIGNED",
      "ALL_SIGNED",
      "DISTRIBUTED",
    ]) {
      it(`${defenseType}: ${status} RapReport → 409`, async () => {
        prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
          scheduleFixture({
            finalizerId: "rap-1",
            overrides: { defenseType, rapReports: [{ id: "rap-1", status }] },
          }),
        );
        await expect(
          repo.concludeDefense("sched-1", "chair-1", { outcome: "PASSED" }),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
      });
    }

    it(`${defenseType}: FINALIZED RapReport → eligible (subject to other prerequisites)`, async () => {
      prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
        scheduleFixture({
          finalizerId: "rap-1",
          overrides: {
            defenseType,
            rapReports: [
              { id: "rap-1", status: "FINALIZED", generatedAt: new Date("2026-10-01T00:00:00Z") },
            ],
          },
        }),
      );
      const result = await repo.concludeDefense("sched-1", "chair-1", { outcome: "PASSED" });
      expect(prismaMock.__tx.defenseConclusion.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.__tx.defenseSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { sessionStatus: "CONCLUDED" } }),
      );
      expect(result.rapReport).toMatchObject({ id: "rap-1", status: "FINALIZED" });
    });
  }

  it("Proposal/Final with finalized legacy notes but NO RapReport still → 409", async () => {
    for (const defenseType of ["PROPOSAL_DEFENSE", "FINAL_DEFENSE"]) {
      prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue(
        scheduleFixture({
          finalizerId: "rap-1",
          notesFinalizedAt: new Date("2026-09-28T11:00:00Z"),
          overrides: { defenseType, rapReports: [] },
        }),
      );
      await expect(
        repo.concludeDefense("sched-1", "chair-1", { outcome: "PASSED" }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
    }
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

  it("Test 11 (CDW-4 FIX): session Chairman (non-Admin) denied through getSummaryReadModel", async () => {
    const svc = new OfficialDefenseRecordService();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      summarySchedule([{ role: "CHAIRMAN" }]),
    );
    prismaMock.panelAssignment.findMany.mockResolvedValue([{ id: "p1" }]);
    prismaMock.oralExamScore.count.mockResolvedValue(4);

    await expect(
      svc.getSummaryReadModel("sched-1", {
        userId: "chair-1",
        role: "PANELIST",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
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
