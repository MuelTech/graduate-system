import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn() },
  panelAssignment: { findMany: vi.fn() },
  oralExamScore: { findMany: vi.fn() },
  oralExamSummary: { findUnique: vi.fn(), create: vi.fn() },
  defenseConclusion: { create: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { OfficialDefenseRecordService } from "../../../src/services/official-defense-record.service";

const schedule = {
  id: "sched-1",
  defenseType: "TITLE_DEFENSE",
  sessionStatus: "AWAITING_CONCLUSION",
  defenseDate: new Date("2026-10-18T00:00:00Z"),
  defenseTime: new Date("1970-01-01T09:00:00Z"),
  venueOrLink: "Room 101",
  thesis: {
    student: {
      studentNumber: "2026-001",
      user: { firstName: "Juan", lastName: "Dela Cruz" },
      program: { programName: "MIT" },
    },
  },
};

const assignment = (id: string, role: "CHAIRMAN" | "PANELIST") => ({
  id,
  userId: `user-${id}`,
  role,
  user: { id: `user-${id}`, firstName: "Eval", lastName: id },
});

const v2Row = (
  panelId: string,
  groupA: unknown,
  groupB: unknown,
  overrides: Record<string, unknown> = {},
) => ({
  id: `score-${panelId}`,
  scheduleId: "sched-1",
  panelId,
  status: "FINALIZED",
  scoringVersion: "INSTITUTIONAL_MATRIX_V2",
  groupAAverage: groupA,
  groupBAverage: groupB,
  overallAverage: null,
  rating: null,
  recommendations: `Recommendation ${panelId}`,
  panel: {
    id: panelId,
    userId: `user-${panelId}`,
    role: "PANELIST",
    user: { id: `user-${panelId}`, firstName: "Eval", lastName: panelId },
  },
  ...overrides,
});

const fiveEvaluators = () => [
  assignment("p1", "CHAIRMAN"),
  assignment("p2", "PANELIST"),
  assignment("p3", "PANELIST"),
  assignment("p4", "PANELIST"),
  assignment("p5", "PANELIST"),
];

const fiveV2Rows = () => [
  v2Row("p1", 1.2, 1.25),
  v2Row("p2", 1.3, 1.2),
  v2Row("p3", 1.15, 1.25),
  v2Row("p4", 1.4, 1.4),
  v2Row("p5", 1.3, 1.3),
];

function mockCreateEcho() {
  prismaMock.oralExamSummary.create.mockImplementation(async (args: any) => ({
    id: "sum-1",
    ...args.data,
  }));
}

describe("FIX-4 institutional Oral Examination Summary", () => {
  const svc = new OfficialDefenseRecordService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(schedule);
    prismaMock.panelAssignment.findMany.mockResolvedValue(fiveEvaluators());
    prismaMock.oralExamScore.findMany.mockResolvedValue(fiveV2Rows());
    prismaMock.oralExamSummary.findUnique.mockResolvedValue(null);
    mockCreateEcho();
  });

  it("generates V2 rows with Group A, Group B and the confirmed row average", async () => {
    const result = await svc.ensureOralExamSummary("sched-1");

    expect(result).toMatchObject({
      created: true,
      evaluatorCount: 5,
      overallAverage: 1.28,
      finalRating: null,
    });

    const data = prismaMock.oralExamSummary.create.mock.calls[0][0].data;
    expect(data.overallAverage).toBe(1.28);
    expect(data.finalRating).toBeNull();
    expect(data.finalRemarks).toBeNull();

    const rows = data.snapshotData.evaluators;
    expect(rows).toHaveLength(5);
    expect(rows.map((r: any) => r.functionalRole)).toEqual([
      "CHAIRMAN",
      "PANELIST",
      "PANELIST",
      "PANELIST",
      "PANELIST",
    ]);
    expect(rows.map((r: any) => r.groupIValue)).toEqual([1.2, 1.3, 1.15, 1.4, 1.3]);
    expect(rows.map((r: any) => r.groupIIValue)).toEqual([1.25, 1.2, 1.25, 1.4, 1.3]);
    expect(rows.map((r: any) => r.averageValue)).toEqual([1.23, 1.25, 1.2, 1.4, 1.3]);
    expect(rows.every((r: any) => r.scoringVersion === "INSTITUTIONAL_MATRIX_V2")).toBe(
      true,
    );
    expect(rows.every((r: any) => r.rating === null)).toBe(true);
  });

  it("rounds an exact midpoint row average to two decimals (1.20 + 1.25 -> 1.23)", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignment("p1", "CHAIRMAN"),
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([v2Row("p1", 1.2, 1.25)]);

    await svc.ensureOralExamSummary("sched-1");

    const rows = prismaMock.oralExamSummary.create.mock.calls[0][0].data.snapshotData
      .evaluators;
    expect(rows[0].averageValue).toBe(1.23);
  });

  it("normalizes an older finalized group average to two decimals before summarizing", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignment("p1", "CHAIRMAN"),
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([v2Row("p1", 1.4, 1.375)]);

    await svc.ensureOralExamSummary("sched-1");

    const rows = prismaMock.oralExamSummary.create.mock.calls[0][0].data.snapshotData
      .evaluators;
    expect(rows[0].groupIIValue).toBe(1.38);
    expect(rows[0].averageValue).toBe(1.39);
  });

  it("includes only required evaluator assignments and excludes non-evaluators", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignment("p1", "CHAIRMAN"),
      assignment("p2", "PANELIST"),
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([
      v2Row("p1", 1.2, 1.25),
      v2Row("p2", 1.3, 1.2),
      v2Row("rap", 1.1, 1.1, {
        panel: {
          id: "rap",
          userId: "user-rap",
          role: "RAPPORTEUR",
          user: { id: "user-rap", firstName: "R", lastName: "P" },
        },
      }),
      v2Row("adv", 1.1, 1.1, {
        panel: {
          id: "adv",
          userId: "user-adv",
          role: "ADVISER",
          user: { id: "user-adv", firstName: "A", lastName: "D" },
        },
      }),
      v2Row("fac", 1.1, 1.1, {
        panel: {
          id: "fac",
          userId: "user-fac",
          role: "FACILITATOR",
          user: { id: "user-fac", firstName: "F", lastName: "C" },
        },
      }),
    ]);

    await svc.ensureOralExamSummary("sched-1");

    const rows = prismaMock.oralExamSummary.create.mock.calls[0][0].data.snapshotData
      .evaluators;
    expect(rows).toHaveLength(2);
    expect(
      rows.every(
        (r: any) =>
          r.functionalRole !== "RAPPORTEUR" &&
          r.functionalRole !== "ADVISER" &&
          r.functionalRole !== "FACILITATOR",
      ),
    ).toBe(true);
  });

  it("rejects Summary generation when no evaluator assignments exist", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([]);

    await expect(svc.ensureOralExamSummary("sched-1")).rejects.toThrow(
      /No evaluator assignments/i,
    );
    expect(prismaMock.oralExamSummary.create).not.toHaveBeenCalled();
  });

  it("rejects an out-of-scale finalized V2 group average", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignment("p1", "CHAIRMAN"),
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([v2Row("p1", 2.75, 1.25)]);

    await expect(svc.ensureOralExamSummary("sched-1")).rejects.toThrow(
      /invalid Group I average/i,
    );
    expect(prismaMock.oralExamSummary.create).not.toHaveBeenCalled();
  });

  it("rejects Summary generation until every required evaluator is FINALIZED", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignment("p1", "CHAIRMAN"),
      assignment("p2", "PANELIST"),
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([v2Row("p1", 1.2, 1.25)]);

    await expect(svc.ensureOralExamSummary("sched-1")).rejects.toThrow(
      /must be finalized/i,
    );
    expect(prismaMock.oralExamSummary.create).not.toHaveBeenCalled();
  });

  it("rejects a finalized V2 row that is missing a canonical group average", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignment("p1", "CHAIRMAN"),
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([v2Row("p1", null, 1.25)]);

    await expect(svc.ensureOralExamSummary("sched-1")).rejects.toThrow(
      /Group I|Group II|missing/i,
    );
    expect(prismaMock.oralExamSummary.create).not.toHaveBeenCalled();
  });

  it("rejects mixed LEGACY_POINTS_V1 and INSTITUTIONAL_MATRIX_V2 rows", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignment("p1", "CHAIRMAN"),
      assignment("p2", "PANELIST"),
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([
      v2Row("p1", 1.2, 1.25, { scoringVersion: "LEGACY_POINTS_V1" }),
      v2Row("p2", 1.3, 1.2),
    ]);

    await expect(svc.ensureOralExamSummary("sched-1")).rejects.toThrow(
      /mixed scoring versions/i,
    );
    expect(prismaMock.oralExamSummary.create).not.toHaveBeenCalled();
  });

  it("does not fabricate a zero when a legacy evaluator lacks an overall value", async () => {
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      assignment("p1", "CHAIRMAN"),
    ]);
    prismaMock.oralExamScore.findMany.mockResolvedValue([
      v2Row("p1", 1.2, 1.25, {
        scoringVersion: "LEGACY_POINTS_V1",
        overallAverage: null,
      }),
    ]);

    await expect(svc.ensureOralExamSummary("sched-1")).rejects.toThrow(
      /overall average|missing/i,
    );
    expect(prismaMock.oralExamSummary.create).not.toHaveBeenCalled();
  });

  it("returns an existing Summary unchanged on a second ensure", async () => {
    prismaMock.oralExamSummary.findUnique.mockResolvedValue({
      id: "sum-existing",
      overallAverage: 1.28,
      finalRating: null,
      snapshotData: { evaluatorCount: 5 },
    });

    const result = await svc.ensureOralExamSummary("sched-1");

    expect(result.created).toBe(false);
    expect(result.summaryId).toBe("sum-existing");
    expect(prismaMock.oralExamSummary.create).not.toHaveBeenCalled();
  });

  it("converges to the unique winner when a concurrent create loses with P2002", async () => {
    prismaMock.oralExamSummary.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sum-winner",
        overallAverage: 1.28,
        finalRating: null,
        snapshotData: { evaluatorCount: 5 },
      });
    prismaMock.oralExamSummary.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint"), { code: "P2002" }),
    );

    const result = await svc.ensureOralExamSummary("sched-1");

    expect(result.created).toBe(false);
    expect(result.summaryId).toBe("sum-winner");
    expect(prismaMock.oralExamSummary.create).toHaveBeenCalledTimes(1);
  });

  it("converges two simultaneous ensure calls to one authoritative Summary", async () => {
    let createCalls = 0;
    prismaMock.oralExamSummary.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: "sum-winner",
        overallAverage: 1.28,
        finalRating: null,
        snapshotData: { evaluatorCount: 5 },
      });
    prismaMock.oralExamSummary.create.mockImplementation(async (args: any) => {
      createCalls += 1;
      if (createCalls === 1) {
        return { id: "sum-winner", ...args.data };
      }
      throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
    });

    const [first, second] = await Promise.all([
      svc.ensureOralExamSummary("sched-1"),
      svc.ensureOralExamSummary("sched-1"),
    ]);

    expect([first.summaryId, second.summaryId]).toEqual([
      "sum-winner",
      "sum-winner",
    ]);
    expect(first.created || second.created).toBe(true);
    expect(prismaMock.oralExamSummary.create).toHaveBeenCalledTimes(2);
  });

  it("returns the winning Summary snapshot metadata on a P2002 loss", async () => {
    prismaMock.oralExamSummary.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sum-winner",
        overallAverage: 1.28,
        finalRating: null,
        snapshotData: { evaluatorCount: 4 },
      });
    prismaMock.oralExamSummary.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint"), { code: "P2002" }),
    );

    const result = await svc.ensureOralExamSummary("sched-1");

    expect(result.created).toBe(false);
    expect(result.summaryId).toBe("sum-winner");
    expect(result.evaluatorCount).toBe(4);
  });

  it("never writes a verdict from Summary generation", async () => {
    await svc.ensureOralExamSummary("sched-1");
    expect(prismaMock.defenseConclusion.create).not.toHaveBeenCalled();
  });
});
