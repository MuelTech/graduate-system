import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const makeModels = () => ({
    defenseSchedule: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    panelAssignment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    oralExamScore: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    oralExamSummary: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    defenseConclusion: { create: vi.fn() },
    rapReport: {
      create: vi.fn(),
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
    thesisRecord: { update: vi.fn() },
    thesisTitle: { update: vi.fn(), updateMany: vi.fn() },
  });
  const root = makeModels();
  const tx = makeModels();
  return {
    ...root,
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import {
  OfficialDefenseRecordService,
} from "../../../src/services/official-defense-record.service";
import {
  RapporteurFinalizationService,
} from "../../../src/services/rapporteur-finalization.service";
import { RapReportService } from "../../../src/services/rap-report.service";

const finalizedScore = (panelId: string, overall = 80) => ({
  id: `score-${panelId}`,
  scheduleId: "sched-1",
  panelId,
  status: "FINALIZED",
  timelinessRelevance: 8,
  organization: 8,
  depthComprehensiveness: 12,
  relevanceConclusions: 8,
  evidenceOriginalThinking: 12,
  presentation: 8,
  masterySubject: 8,
  communicationSkill: 8,
  attitude: 8,
  groupAAverage: 20,
  groupBAverage: 16,
  overallAverage: overall,
  rating: null,
  recommendations: `Rec from ${panelId}`,
  signatureData: "data:image/png;base64,abc",
  signedAt: new Date("2026-09-28T10:00:00Z"),
  finalizedAt: new Date("2026-09-28T10:00:00Z"),
  officialSnapshot: null,
  panel: {
    id: panelId,
    userId: `user-${panelId}`,
    role: "PANELIST",
    user: { id: `user-${panelId}`, firstName: "Eval", lastName: panelId },
  },
});

const scheduleBase = {
  id: "sched-1",
  defenseType: "PROPOSAL_DEFENSE",
  sessionStatus: "AWAITING_CONCLUSION",
  defenseDate: new Date("2026-09-28T00:00:00Z"),
  defenseTime: new Date("1970-01-01T10:00:00Z"),
  venueOrLink: "Room 101",
  rapporteurNotes: "Defense notes content",
  rapporteurNotesFinalizedAt: null,
  rapporteurNotesFinalizedById: null,
  thesisId: "thesis-1",
  thesis: {
    student: {
      studentNumber: "2026-001",
      user: { firstName: "Juan", lastName: "Dela Cruz" },
      program: { programName: "MIT", programType: "MASTERS" },
    },
    thesisTitles: [
      { id: "t1", titleText: "Title One", isSelected: false },
      { id: "t2", titleText: "Title Two", isSelected: false },
      { id: "t3", titleText: "Title Three", isSelected: false },
    ],
  },
};

describe("CP7 Oral Examination Summary", () => {
  const svc = new OfficialDefenseRecordService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: Summary absent while one required evaluator remains DRAFT", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { id: "p1", userId: "u1", role: "CHAIRMAN", user: { id: "u1", firstName: "A", lastName: "B" } },
      { id: "p2", userId: "u2", role: "PANELIST", user: { id: "u2", firstName: "C", lastName: "D" } },
      { id: "p3", userId: "u3", role: "PANELIST", user: { id: "u3", firstName: "E", lastName: "F" } },
      { id: "p4", userId: "u4", role: "PANELIST", user: { id: "u4", firstName: "G", lastName: "H" } },
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([
      finalizedScore("p1"),
      finalizedScore("p2"),
      finalizedScore("p3"),
      // p4 still DRAFT — not included
    ]);
    prismaMock.oralExamSummary.findUnique.mockResolvedValue(null);

    await expect(svc.ensureOralExamSummary("sched-1")).rejects.toThrow(
      /must be finalized/i,
    );
    expect(prismaMock.oralExamSummary.create).not.toHaveBeenCalled();
  });

  it("Test 2: Summary uses FINALIZED evaluator assignments only (excludes non-evaluator rows)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { id: "p1", userId: "u1", role: "CHAIRMAN", user: { id: "u1", firstName: "A", lastName: "B" } },
      { id: "p2", userId: "u2", role: "PANELIST", user: { id: "u2", firstName: "C", lastName: "D" } },
      { id: "p3", userId: "u3", role: "PANELIST", user: { id: "u3", firstName: "E", lastName: "F" } },
      { id: "p4", userId: "u4", role: "PANELIST", user: { id: "u4", firstName: "G", lastName: "H" } },
    ]);
    // include a non-evaluator FINALIZED row (rapporteur) that must be excluded
    prismaMock.oralExamScore.findMany.mockResolvedValue([
      finalizedScore("p1"),
      finalizedScore("p2"),
      finalizedScore("p3"),
      finalizedScore("p4"),
      { ...finalizedScore("rap"), panel: { id: "rap", userId: "ur", role: "RAPPORTEUR", user: { id: "ur", firstName: "R", lastName: "P" } } },
    ]);
    prismaMock.oralExamSummary.findUnique.mockResolvedValue(null);
    prismaMock.oralExamSummary.create.mockImplementation(async (args: any) => ({
      id: "sum-1",
      ...args.data,
    }));

    // findMany filters by evaluator assignment IDs, so rapporteur row is never selected.
    // To prove exclusion we assert create snapshot has exactly 4 evaluator rows.
    const result = await svc.ensureOralExamSummary("sched-1");
    expect(result.created).toBe(true);
    expect(result.evaluatorCount).toBe(4);
    const createArgs = prismaMock.oralExamSummary.create.mock.calls[0][0];
    const snapshot = createArgs.data.snapshotData;
    expect(snapshot.evaluators).toHaveLength(4);
    expect(snapshot.evaluators.every((e: any) => e.functionalRole !== "RAPPORTEUR")).toBe(
      true,
    );
  });

  it("Test 3/4: last evaluator finalize creates Summary once; second call is idempotent", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { id: "p1", userId: "u1", role: "CHAIRMAN", user: { id: "u1", firstName: "A", lastName: "B" } },
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([finalizedScore("p1", 88)]);
    prismaMock.oralExamSummary.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sum-1",
        overallAverage: 88,
        finalRating: null,
        snapshotData: { evaluatorCount: 1 },
      });
    prismaMock.oralExamSummary.create.mockResolvedValue({
      id: "sum-1",
      overallAverage: 88,
      finalRating: null,
    });

    const first = await svc.ensureOralExamSummary("sched-1");
    const second = await svc.ensureOralExamSummary("sched-1");
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(prismaMock.oralExamSummary.create).toHaveBeenCalledTimes(1);
  });

  it("Test 5: generated Summary finalRating is null (no outcome/rating inference)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { id: "p1", userId: "u1", role: "CHAIRMAN", user: { id: "u1", firstName: "A", lastName: "B" } },
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([finalizedScore("p1", 95)]);
    prismaMock.oralExamSummary.findUnique.mockResolvedValue(null);
    prismaMock.oralExamSummary.create.mockImplementation(async (args: any) => ({
      id: "sum-1",
      ...args.data,
    }));

    const result = await svc.ensureOralExamSummary("sched-1");
    expect(result.finalRating).toBeNull();
    const createArgs = prismaMock.oralExamSummary.create.mock.calls[0][0];
    expect(createArgs.data.finalRating).toBeNull();
    expect(createArgs.data.attestedById).toBeNull();
  });

  it("rejects Title numerical Summary generation", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      ...scheduleBase,
      defenseType: "TITLE_DEFENSE",
    });
    await expect(svc.ensureOralExamSummary("sched-1")).rejects.toThrow(
      /Title Defense does not generate/i,
    );
  });

  it("concurrency: unique race converges to one Summary", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { id: "p1", userId: "u1", role: "CHAIRMAN", user: { id: "u1", firstName: "A", lastName: "B" } },
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([finalizedScore("p1")]);
    prismaMock.oralExamSummary.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sum-existing",
        overallAverage: 80,
        finalRating: null,
        snapshotData: { evaluatorCount: 1 },
      });
    const uniqueError = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    prismaMock.oralExamSummary.create.mockRejectedValue(uniqueError);

    const result = await svc.ensureOralExamSummary("sched-1");
    expect(result.created).toBe(false);
    expect(result.summaryId).toBe("sum-existing");
  });
});

describe("CP7 Rapporteur notes finalization", () => {
  const svc = new RapporteurFinalizationService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 6: non-Rapporteur cannot finalize notes (403)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "p2",
      scheduleId: "sched-1",
      userId: "user-x",
      role: "PANELIST",
    });
    await expect(svc.finalizeDefenseNotes("sched-1", "user-x")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("Test 7: Proposal/Final notes cannot finalize before evaluator completion (409)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pr",
      scheduleId: "sched-1",
      userId: "user-r",
      role: "RAPPORTEUR",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { id: "p1" },
      { id: "p2" },
    ]);
    prismaMock.oralExamScore.count.mockResolvedValue(1);
    await expect(svc.finalizeDefenseNotes("sched-1", "user-r")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("Test 8: valid Rapporteur finalization records server timestamp/identity", async () => {
    prismaMock.defenseSchedule.findUnique
      .mockResolvedValueOnce(scheduleBase)
      .mockResolvedValueOnce({
        sessionStatus: "AWAITING_CONCLUSION",
        rapporteurNotesFinalizedAt: new Date("2026-09-28T12:00:00Z"),
        rapporteurNotesFinalizedById: "user-r",
      });
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pr",
      scheduleId: "sched-1",
      userId: "user-r",
      role: "RAPPORTEUR",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([{ id: "p1" }]);
    prismaMock.oralExamScore.count.mockResolvedValue(1);
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });

    const result = await svc.finalizeDefenseNotes("sched-1", "user-r");
    expect(result.finalized).toBe(true);
    expect(result.finalizedById).toBe("user-r");
    expect(result.finalizedAt).toBeTruthy();
    const updateArgs = prismaMock.defenseSchedule.updateMany.mock.calls[0][0];
    expect(updateArgs.data.rapporteurNotesFinalizedById).toBe("user-r");
    expect(updateArgs.data.rapporteurNotesFinalizedAt).toBeInstanceOf(Date);
  });

  it("Test 9: Save Notes after finalization is blocked (assertNotesEditable 409)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      rapporteurNotesFinalizedAt: new Date(),
      sessionStatus: "AWAITING_CONCLUSION",
    });
    await expect(svc.assertNotesEditable("sched-1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("Test 10: Title Rapporteur finalizes notes → AWAITING_CONCLUSION, no Summary/outcome", async () => {
    const titleSchedule = {
      ...scheduleBase,
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "IN_PROGRESS",
    };
    prismaMock.defenseSchedule.findUnique
      .mockResolvedValueOnce(titleSchedule)
      .mockResolvedValueOnce({
        sessionStatus: "AWAITING_CONCLUSION",
        rapporteurNotesFinalizedAt: new Date("2026-09-28T12:00:00Z"),
        rapporteurNotesFinalizedById: "user-r",
      });
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pr",
      scheduleId: "sched-1",
      userId: "user-r",
      role: "RAPPORTEUR",
    });
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });

    const result = await svc.finalizeDefenseNotes("sched-1", "user-r");
    expect(result.sessionStatus).toBe("AWAITING_CONCLUSION");
    expect(prismaMock.oralExamSummary.create).not.toHaveBeenCalled();
    expect(prismaMock.defenseConclusion.create).not.toHaveBeenCalled();
  });

  it("rejects empty notes before finalization", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      ...scheduleBase,
      rapporteurNotes: "   ",
    });
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pr",
      scheduleId: "sched-1",
      userId: "user-r",
      role: "RAPPORTEUR",
    });
    await expect(svc.finalizeDefenseNotes("sched-1", "user-r")).rejects.toThrow(
      /empty/i,
    );
  });

  it("already finalized notes → 409", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      ...scheduleBase,
      rapporteurNotesFinalizedAt: new Date(),
    });
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pr",
      scheduleId: "sched-1",
      userId: "user-r",
      role: "RAPPORTEUR",
    });
    await expect(svc.finalizeDefenseNotes("sched-1", "user-r")).rejects.toMatchObject(
      { statusCode: 409 },
    );
  });
});

describe("CP7 RAP signing lifecycle", () => {
  const svc = new RapReportService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 21/22: createRapAfterConclusion uses evaluator-only signature slots", async () => {
    prismaMock.__tx.panelAssignment.findMany.mockResolvedValue([
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u2", role: "PANELIST" },
      { userId: "u3", role: "RAPPORTEUR" },
      { userId: "u4", role: "FACILITATOR" },
      { userId: "u5", role: "ADVISER" },
    ]);
    prismaMock.__tx.rapReport.create.mockResolvedValue({ id: "rap-1" });
    prismaMock.__tx.rapReportSignature.createMany.mockResolvedValue({ count: 2 });

    await svc.createRapAfterConclusion(prismaMock.__tx, {
      scheduleId: "sched-1",
      thesisId: "thesis-1",
      defenseType: "PROPOSAL_DEFENSE",
      decisionsAndRecommendations: "notes",
      generatedById: "user-r",
    });

    const createManyArgs = prismaMock.__tx.rapReportSignature.createMany.mock.calls[0][0];
    expect(createManyArgs.data).toHaveLength(2);
    expect(createManyArgs.data.map((d: any) => d.userId).sort()).toEqual(["u1", "u2"]);
    const rapCreate = prismaMock.__tx.rapReport.create.mock.calls[0][0];
    expect(rapCreate.data.status).toBe("FOR_SIGNATURE");
    expect(rapCreate.data.generatedById).toBe("user-r");
  });

  it("Test 25: last required signature FINALIZES RAP with server finalizedAt", async () => {
    const tx = prismaMock.__tx;
    tx.rapReportSignature.updateMany.mockResolvedValue({ count: 1 });
    tx.rapReportSignature.findUnique.mockResolvedValue({
      id: "sig-1",
      rapId: "rap-1",
      userId: "u1",
      isSigned: true,
    });
    // Post-commit recompute reads committed state on root prisma.
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      { required: true, isSigned: true },
      { required: true, isSigned: true },
    ]);
    prismaMock.rapReport.findUnique.mockResolvedValue({
      status: "PARTIALLY_SIGNED",
      finalizedAt: null,
    });
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });

    const result = await svc.signRapSlot(
      "sig-1",
      "u1",
      "data:image/png;base64,abc",
    );
    expect(result.status).toBe("FINALIZED");
    const updateArgs = prismaMock.rapReport.updateMany.mock.calls.find(
      (c: any) => c[0]?.data?.status === "FINALIZED",
    );
    expect(updateArgs).toBeTruthy();
    expect(updateArgs![0].data.finalizedAt).toBeInstanceOf(Date);
  });

  it("Test 24: first of two signatures → PARTIALLY_SIGNED", async () => {
    const tx = prismaMock.__tx;
    tx.rapReportSignature.updateMany.mockResolvedValue({ count: 1 });
    tx.rapReportSignature.findUnique.mockResolvedValue({
      id: "sig-1",
      rapId: "rap-1",
      userId: "u1",
    });
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      { required: true, isSigned: true },
      { required: true, isSigned: false },
    ]);
    prismaMock.rapReport.findUnique.mockResolvedValue({
      status: "FOR_SIGNATURE",
      finalizedAt: null,
    });
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });

    const result = await svc.signRapSlot(
      "sig-1",
      "u1",
      "data:image/png;base64,abc",
    );
    expect(result.status).toBe("PARTIALLY_SIGNED");
  });

  it("Test 25/26: double sign → 409", async () => {
    const tx = prismaMock.__tx;
    tx.rapReportSignature.updateMany.mockResolvedValue({ count: 0 });
    tx.rapReportSignature.findUnique.mockResolvedValue({
      id: "sig-1",
      rapId: "rap-1",
      userId: "u1",
      isSigned: true,
    });
    await expect(
      svc.signRapSlot("sig-1", "u1", "data:image/png;base64,abc"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("Test 26: another user cannot sign someone else's slot", async () => {
    const tx = prismaMock.__tx;
    tx.rapReportSignature.updateMany.mockResolvedValue({ count: 0 });
    tx.rapReportSignature.findUnique.mockResolvedValue({
      id: "sig-1",
      rapId: "rap-1",
      userId: "u1",
      isSigned: false,
    });
    await expect(
      svc.signRapSlot("sig-1", "u2", "data:image/png;base64,abc"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects blank signature evidence", async () => {
    await expect(svc.signRapSlot("sig-1", "u1", "   ")).rejects.toThrow(
      /required/i,
    );
  });

  it("rejects non-image signature evidence", async () => {
    await expect(svc.signRapSlot("sig-1", "u1", "John Doe")).rejects.toThrow(
      /image/i,
    );
  });
});

describe("CP7 official Criteria eligibility", () => {
  const svc = new OfficialDefenseRecordService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 31: DRAFT evaluator cannot retrieve official Criteria", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findUnique.mockResolvedValue({
      id: "p1",
      scheduleId: "sched-1",
      userId: "u1",
      role: "PANELIST",
      user: { id: "u1", firstName: "A", lastName: "B" },
    });
    prismaMock.oralExamScore.findUnique.mockResolvedValue({
      status: "DRAFT",
      signatureData: null,
      finalizedAt: null,
    });

    const result = await svc.getOfficialCriteria("sched-1", "p1");
    expect(result.available).toBe(false);
    expect(result.status).toBe("DRAFT");
  });

  it("Test 32: FINALIZED evaluator Criteria is available with signature/timestamps", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findUnique.mockResolvedValue({
      id: "p1",
      scheduleId: "sched-1",
      userId: "u1",
      role: "PANELIST",
      user: { id: "u1", firstName: "A", lastName: "B" },
    });
    prismaMock.oralExamScore.findUnique.mockResolvedValue(finalizedScore("p1", 88));
    prismaMock.oralExamScore.updateMany.mockResolvedValue({ count: 1 });

    const result = await svc.getOfficialCriteria("sched-1", "p1");
    expect(result.available).toBe(true);
    expect(result.signatureData).toContain("data:image/png");
    expect(result.finalizedAt).toBeTruthy();
    expect(result.signedAt).toBeTruthy();
  });

  it("rejects non-evaluator panel assignment for Criteria", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findUnique.mockResolvedValue({
      id: "pr",
      scheduleId: "sched-1",
      userId: "ur",
      role: "RAPPORTEUR",
      user: { id: "ur", firstName: "R", lastName: "P" },
    });
    await expect(svc.getOfficialCriteria("sched-1", "pr")).rejects.toThrow(
      /evaluator/i,
    );
  });
});
