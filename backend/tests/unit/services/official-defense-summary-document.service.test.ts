import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn() },
  panelAssignment: { findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { AppError } from "../../../src/utils/AppError";
import { OfficialDefenseRecordService } from "../../../src/services/official-defense-record.service";
import {
  OfficialDefenseDocumentService,
  mapOfficialSummaryToRenderInput,
} from "../../../src/services/official-defense-document.service";
import type { OfficialSummaryDocumentSource } from "../../../src/services/official-defense-record.service";
import type { OralExamSummarySnapshot } from "../../../src/services/official-defense-record.service";

const ADMIN = { userId: "admin-1", role: "ADMIN" };
const LOGOS = {
  earist: { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" as const },
  graduateSchool: { bytes: new Uint8Array([4, 5, 6]), mimeType: "image/jpeg" as const },
};

function evaluator(
  name: string,
  role: "CHAIRMAN" | "PANELIST",
  values: { groupI: number; groupII: number; average: number },
  panelAssignmentId = `p-${name}`,
) {
  return {
    panelAssignmentId,
    userId: `u-${name}`,
    evaluatorName: name,
    functionalRole: role,
    groupIValue: values.groupI,
    groupIIValue: values.groupII,
    averageValue: values.average,
    overallValue: null,
    rating: null,
    recommendations: null,
    scoringVersion: "INSTITUTIONAL_MATRIX_V2" as const,
  };
}

function snapshot(overrides: Partial<OralExamSummarySnapshot> = {}): OralExamSummarySnapshot {
  const evaluators = [
    evaluator("Chair One", "CHAIRMAN", { groupI: 1.25, groupII: 1.75, average: 1.5 }, "p1"),
    evaluator("Member Two", "PANELIST", { groupI: 1.5, groupII: 2, average: 1.75 }, "p2"),
    evaluator("Member Three", "PANELIST", { groupI: 1.75, groupII: 2.5, average: 2.13 }, "p3"),
  ];
  return {
    schemaVersion: 1,
    scheduleId: "sched-1",
    defenseType: "PROPOSAL_DEFENSE",
    studentName: "Frozen Student",
    studentNumber: "2026-999",
    program: "Frozen Program",
    defenseDate: "2026-09-28T00:00:00.000Z",
    defenseTime: null,
    venueOrLink: null,
    evaluators,
    evaluatorCount: evaluators.length,
    overallAverage: 1.79,
    generatedAt: "2026-09-28T10:05:00.000Z",
    ...overrides,
  };
}

function source(overrides: Partial<OfficialSummaryDocumentSource> = {}): OfficialSummaryDocumentSource {
  return {
    scheduleId: "sched-1",
    defenseType: "PROPOSAL_DEFENSE",
    summaryId: "sum-1",
    snapshot: snapshot(),
    adviserName: "Exact Adviser",
    ...overrides,
  };
}

function expectAppError(error: unknown, statusCode: number, message: RegExp): void {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).statusCode).toBe(statusCode);
  expect((error as AppError).message).toMatch(message);
}

function expectMappingError(
  input: OfficialSummaryDocumentSource,
  statusCode: number,
  message: RegExp,
): void {
  try {
    mapOfficialSummaryToRenderInput(input, LOGOS);
    throw new Error("expected rejection");
  } catch (error) {
    expectAppError(error, statusCode, message);
  }
}

const scheduleBase = {
  id: "sched-1",
  defenseType: "PROPOSAL_DEFENSE",
  oralExamSummary: { id: "sum-1", snapshotData: snapshot() },
  // Live/current identity must never be used by the GS-011 document source.
  thesis: {
    student: {
      studentNumber: "CURRENT-CHANGED",
      user: { firstName: "Current", lastName: "Student" },
      program: { programName: "Current Changed Program" },
    },
  },
};

const adviserAssignment = {
  id: "adv-1",
  scheduleId: "sched-1",
  userId: "adv-user",
  role: "ADVISER",
  user: { id: "adv-user", firstName: "Exact", lastName: "Adviser" },
};

describe("mapOfficialSummaryToRenderInput", () => {
  it("uses the persisted snapshot identity, not live schedule fields", () => {
    const input = mapOfficialSummaryToRenderInput(source(), LOGOS);
    expect(input.candidateName).toBe("Frozen Student");
    expect(input.course).toBe("Frozen Program");
    expect(input.studentNumber).toBe("2026-999");
    expect(input.date).toBe("28 September 2026");
  });

  it("maps persisted examiner values in persisted order", () => {
    const input = mapOfficialSummaryToRenderInput(source(), LOGOS);
    expect(input.examiners.map((row) => row.examinerName)).toEqual([
      "Chair One",
      "Member Two",
      "Member Three",
    ]);
    expect(input.examiners[0]).toEqual({
      examinerName: "Chair One",
      groupARating: "1.25",
      groupBRating: "1.75",
      average: "1.50",
    });
    expect(input.examiners[2].average).toBe("2.13");
  });

  it("uses persisted averageValue directly and never recalculates it", () => {
    const evaluators = [
      evaluator("Chair One", "CHAIRMAN", { groupI: 1.25, groupII: 1.75, average: 1.99 }, "p1"),
    ];
    const input = mapOfficialSummaryToRenderInput(
      source({ snapshot: snapshot({ evaluators, evaluatorCount: 1 }) }),
      LOGOS,
    );
    expect(input.examiners[0].groupARating).toBe("1.25");
    expect(input.examiners[0].groupBRating).toBe("1.75");
    expect(input.examiners[0].average).toBe("1.99");
    expect(input.examiners[0].average).not.toBe("1.50");
  });

  it("maps exactly one Chairman and preserves Panelist member order", () => {
    const input = mapOfficialSummaryToRenderInput(source(), LOGOS);
    expect(input.submittedBy.chairmanName).toBe("Chair One");
    expect(input.submittedBy.memberNames).toEqual(["Member Two", "Member Three"]);
  });

  it("leaves the Adviser blank for TITLE_DEFENSE", () => {
    const input = mapOfficialSummaryToRenderInput(
      source({ defenseType: "TITLE_DEFENSE", adviserName: null }),
      LOGOS,
    );
    expect(input.adviserName).toBe("");
  });

  it("uses the exact schedule Adviser for Proposal Defense", () => {
    const input = mapOfficialSummaryToRenderInput(source({ defenseType: "PROPOSAL_DEFENSE" }), LOGOS);
    expect(input.adviserName).toBe("Exact Adviser");
  });

  it("uses the exact schedule Adviser for Final Defense", () => {
    const input = mapOfficialSummaryToRenderInput(source({ defenseType: "FINAL_DEFENSE" }), LOGOS);
    expect(input.adviserName).toBe("Exact Adviser");
  });

  it("fails closed when Proposal/Final has no exact Adviser name", () => {
    expectMappingError(source({ defenseType: "PROPOSAL_DEFENSE", adviserName: null }), 409, /adviser/i);
    expectMappingError(source({ defenseType: "FINAL_DEFENSE", adviserName: "" }), 409, /adviser/i);
  });

  it("keeps the Dean blank and embeds no digital signatures", () => {
    const input = mapOfficialSummaryToRenderInput(source(), LOGOS);
    expect(input.deanName).toBe("");
    expect(input).not.toHaveProperty("signatureData");
    expect(input.examiners.every((row) => !("signatureData" in row))).toBe(true);
    expect(JSON.stringify(input)).not.toContain("data:image");
  });

  it("fails closed when the Oral Examination Summary is missing", () => {
    expectMappingError(source({ summaryId: null, snapshot: null }), 409, /not yet available/i);
  });

  it("fails closed when snapshotData is missing", () => {
    expectMappingError(source({ snapshot: null }), 409, /not yet available/i);
  });

  it("rejects an unsupported snapshot schema", () => {
    expectMappingError(
      source({ snapshot: { ...snapshot(), schemaVersion: 2 as never } }),
      422,
      /schema/i,
    );
  });

  it("rejects an empty evaluator array", () => {
    expectMappingError(
      source({ snapshot: snapshot({ evaluators: [], evaluatorCount: 0 }) }),
      422,
      /evaluator/i,
    );
  });

  it("rejects LEGACY_POINTS_V1 rows", () => {
    const evaluators = [
      {
        ...evaluator("Chair One", "CHAIRMAN", { groupI: 1.25, groupII: 1.75, average: 1.5 }),
        scoringVersion: "LEGACY_POINTS_V1" as const,
      },
    ];
    expectMappingError(
      source({ snapshot: snapshot({ evaluators, evaluatorCount: 1 }) }),
      422,
      /legacy/i,
    );
  });

  it("rejects mixed scoring-version rows", () => {
    const evaluators = [
      evaluator("Chair One", "CHAIRMAN", { groupI: 1.25, groupII: 1.75, average: 1.5 }),
      {
        ...evaluator("Member Two", "PANELIST", { groupI: 1.5, groupII: 2, average: 1.75 }),
        scoringVersion: "LEGACY_POINTS_V1" as const,
      },
    ];
    expectMappingError(
      source({ snapshot: snapshot({ evaluators, evaluatorCount: 2 }) }),
      422,
      /legacy|mixed/i,
    );
  });

  it("rejects missing or unknown scoringVersion rows", () => {
    const evaluators = [
      {
        ...evaluator("Chair One", "CHAIRMAN", { groupI: 1.25, groupII: 1.75, average: 1.5 }),
        scoringVersion: undefined as never,
      },
    ];
    expectMappingError(
      source({ snapshot: snapshot({ evaluators, evaluatorCount: 1 }) }),
      422,
      /scoring/i,
    );
  });

  it("rejects unsupported evaluator roles instead of printing them as Members", () => {
    const evaluators = [
      evaluator("Chair One", "CHAIRMAN", { groupI: 1.25, groupII: 1.75, average: 1.5 }),
      {
        ...evaluator("Rapporteur One", "PANELIST", { groupI: 1.5, groupII: 2, average: 1.75 }),
        functionalRole: "RAPPORTEUR",
      },
    ];
    expectMappingError(
      source({ snapshot: snapshot({ evaluators, evaluatorCount: 2 }) }),
      422,
      /role/i,
    );
  });

  it("rejects a missing Chairman", () => {
    const evaluators = [
      evaluator("Member Two", "PANELIST", { groupI: 1.5, groupII: 2, average: 1.75 }),
    ];
    expectMappingError(
      source({ snapshot: snapshot({ evaluators, evaluatorCount: 1 }) }),
      422,
      /chairman/i,
    );
  });

  it("rejects duplicate Chairmen", () => {
    const evaluators = [
      evaluator("Chair One", "CHAIRMAN", { groupI: 1.25, groupII: 1.75, average: 1.5 }),
      evaluator("Chair Two", "CHAIRMAN", { groupI: 1.5, groupII: 2, average: 1.75 }),
    ];
    expectMappingError(
      source({ snapshot: snapshot({ evaluators, evaluatorCount: 2 }) }),
      422,
      /chairman/i,
    );
  });

  it("rejects more than six examiner rows", () => {
    const evaluators = [
      evaluator("Chair One", "CHAIRMAN", { groupI: 1.25, groupII: 1.75, average: 1.5 }),
      ...Array.from({ length: 6 }, (_, i) =>
        evaluator(`Member ${i + 2}`, "PANELIST", { groupI: 1.5, groupII: 2, average: 1.75 }),
      ),
    ];
    expectMappingError(
      source({ snapshot: snapshot({ evaluators, evaluatorCount: evaluators.length }) }),
      422,
      /six/i,
    );
  });

  it("rejects more than five member rows", () => {
    const evaluators = [
      evaluator("Chair One", "CHAIRMAN", { groupI: 1.25, groupII: 1.75, average: 1.5 }),
      ...Array.from({ length: 6 }, (_, i) =>
        evaluator(`Member ${i + 2}`, "PANELIST", { groupI: 1.5, groupII: 2, average: 1.75 }),
      ),
    ];
    expectMappingError(
      source({ snapshot: snapshot({ evaluators, evaluatorCount: evaluators.length }) }),
      422,
      /member|six/i,
    );
  });

  it("rejects malformed Group A / Group B / Average values", () => {
    const cases = [
      { groupI: null, groupII: 1.75, average: 1.5 },
      { groupI: 1.25, groupII: 0.5, average: 1.5 },
      { groupI: 1.25, groupII: 1.75, average: 2.75 },
    ];
    for (const values of cases) {
      const evaluators = [
        evaluator(
          "Chair One",
          "CHAIRMAN",
          values as { groupI: number; groupII: number; average: number },
        ),
      ];
      expectMappingError(
        source({ snapshot: snapshot({ evaluators, evaluatorCount: 1 }) }),
        422,
        /group|average/i,
      );
    }
  });

  it("rejects missing required identity values", () => {
    for (const overrides of [
      { studentName: null },
      { program: null },
      { defenseDate: null },
      { studentNumber: null },
    ]) {
      expectMappingError(
        source({ snapshot: snapshot(overrides as Partial<OralExamSummarySnapshot>) }),
        422,
        /candidate|program|date|student number/i,
      );
    }
  });

  it("rejects a missing evaluator name", () => {
    const evaluators = [
      { ...evaluator("Chair One", "CHAIRMAN", { groupI: 1.25, groupII: 1.75, average: 1.5 }), evaluatorName: "" },
    ];
    expectMappingError(
      source({ snapshot: snapshot({ evaluators, evaluatorCount: 1 }) }),
      422,
      /evaluator/i,
    );
  });
});

describe("OfficialDefenseDocumentService.generateOralExamSummaryPdf", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeService(input: OfficialSummaryDocumentSource = source()) {
    const getOfficialSummaryDocumentSource = vi.fn().mockResolvedValue(input);
    const renderSummary = vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7 fake summary"));
    const service = new OfficialDefenseDocumentService({
      records: {
        getOfficialCriteria: vi.fn(),
        getOfficialSummaryDocumentSource,
      },
      loadLogos: async () => LOGOS,
      renderSummary,
    });
    return { service, getOfficialSummaryDocumentSource, renderSummary };
  }

  it("generates the GS-011 PDF for an ADMIN and passes the exact scheduleId", async () => {
    const { service, getOfficialSummaryDocumentSource, renderSummary } = makeService();

    const pdf = await service.generateOralExamSummaryPdf("sched-1", ADMIN);

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(getOfficialSummaryDocumentSource).toHaveBeenCalledWith("sched-1", ADMIN);
    expect(renderSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateName: "Frozen Student",
        course: "Frozen Program",
        studentNumber: "2026-999",
        adviserName: "Exact Adviser",
        deanName: "",
      }),
    );
  });

  it("produces real PDF bytes through the accepted TEMPLATE-2 renderer and logo loader", async () => {
    const service = new OfficialDefenseDocumentService({
      records: {
        getOfficialCriteria: vi.fn(),
        getOfficialSummaryDocumentSource: vi.fn().mockResolvedValue(source()),
      },
    });

    const pdf = await service.generateOralExamSummaryPdf("sched-1", ADMIN);

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("rejects non-Admin actors before reading the protected summary source", async () => {
    const { service, getOfficialSummaryDocumentSource } = makeService();
    for (const actor of [
      { userId: "u1", role: "PANELIST" },
      { userId: "s1", role: "STUDENT" },
    ]) {
      try {
        await service.generateOralExamSummaryPdf("sched-1", actor);
        throw new Error("expected rejection");
      } catch (error) {
        expectAppError(error, 403, /admin/i);
      }
    }
    expect(getOfficialSummaryDocumentSource).not.toHaveBeenCalled();
  });

  it("maps renderer content rejection to a controlled 422", async () => {
    const service = new OfficialDefenseDocumentService({
      records: {
        getOfficialCriteria: vi.fn(),
        getOfficialSummaryDocumentSource: vi.fn().mockResolvedValue(source()),
      },
      loadLogos: async () => LOGOS,
      renderSummary: async () => {
        throw new RangeError("Examiner row overflow.");
      },
    });
    try {
      await service.generateOralExamSummaryPdf("sched-1", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 422, /cannot/i);
    }
  });

  it("propagates a controlled asset failure", async () => {
    const service = new OfficialDefenseDocumentService({
      records: {
        getOfficialCriteria: vi.fn(),
        getOfficialSummaryDocumentSource: vi.fn().mockResolvedValue(source()),
      },
      loadLogos: async () => {
        throw new AppError("Official form assets are unavailable.", 500);
      },
      renderSummary: async () => Buffer.from("%PDF-1.7"),
    });
    try {
      await service.generateOralExamSummaryPdf("sched-1", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 500, /assets are unavailable/i);
    }
  });

  it("uses the real official-record source for a proposal with an exact Adviser", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    prismaMock.panelAssignment.findMany.mockResolvedValue([adviserAssignment]);

    const renderSummary = vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7 real summary"));
    const service = new OfficialDefenseDocumentService({
      records: new OfficialDefenseRecordService(),
      loadLogos: async () => LOGOS,
      renderSummary,
    });

    const pdf = await service.generateOralExamSummaryPdf("sched-1", ADMIN);

    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    const input = renderSummary.mock.calls[0][0];
    expect(input.candidateName).toBe("Frozen Student");
    expect(input.course).toBe("Frozen Program");
    expect(input.studentNumber).toBe("2026-999");
    expect(input.adviserName).toBe("Exact Adviser");
  });
});

describe("OfficialDefenseRecordService.getOfficialSummaryDocumentSource", () => {
  const records = new OfficialDefenseRecordService();

  beforeEach(() => vi.clearAllMocks());

  it("rejects non-Admin actors before reading the schedule", async () => {
    try {
      await records.getOfficialSummaryDocumentSource("sched-1", {
        userId: "u1",
        role: "PANELIST",
      });
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 403, /admin/i);
    }
    expect(prismaMock.defenseSchedule.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing exact schedule", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(null);
    try {
      await records.getOfficialSummaryDocumentSource("sched-404", ADMIN);
      throw new Error("expected rejection");
    } catch (error) {
      expectAppError(error, 404, /Defense session not found/i);
    }
    expect(prismaMock.defenseSchedule.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sched-404" } }),
    );
  });

  it("returns the frozen snapshot and blanks the Adviser for TITLE_DEFENSE", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      ...scheduleBase,
      defenseType: "TITLE_DEFENSE",
    });

    const result = await records.getOfficialSummaryDocumentSource("sched-1", ADMIN);

    expect(result.snapshot?.studentName).toBe("Frozen Student");
    expect(result.adviserName).toBeNull();
    expect(prismaMock.panelAssignment.findMany).not.toHaveBeenCalled();
  });

  it("uses the exact schedule ADVISER assignment for Proposal/Final", async () => {
    for (const defenseType of ["PROPOSAL_DEFENSE", "FINAL_DEFENSE"]) {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue({ ...scheduleBase, defenseType });
      prismaMock.panelAssignment.findMany.mockResolvedValue([adviserAssignment]);

      const result = await records.getOfficialSummaryDocumentSource("sched-1", ADMIN);

      expect(result.adviserName).toBe("Exact Adviser");
      expect(prismaMock.panelAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { scheduleId: "sched-1", role: "ADVISER" },
        }),
      );
    }
  });

  it("fails closed when the exact Adviser seat is missing or ambiguous", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleBase);
    for (const advisers of [[], [adviserAssignment, { ...adviserAssignment, id: "adv-2", userId: "other" }]]) {
      prismaMock.panelAssignment.findMany.mockResolvedValue(advisers);
      try {
        await records.getOfficialSummaryDocumentSource("sched-1", ADMIN);
        throw new Error("expected rejection");
      } catch (error) {
        expectAppError(error, 409, /Adviser seat/i);
      }
    }
  });

  it("never substitutes a current/live Adviser for the historical seat", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      ...scheduleBase,
      thesis: {
        ...scheduleBase.thesis,
        // A current Adviser source that must not be consulted.
        student: {
          ...scheduleBase.thesis.student,
          adviserAssignments: [{ adviserId: "current-adviser", isActive: true }],
        },
      },
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { ...adviserAssignment, user: { id: "adv-user", firstName: "Historical", lastName: "Adviser" } },
    ]);

    const result = await records.getOfficialSummaryDocumentSource("sched-1", ADMIN);

    expect(result.adviserName).toBe("Historical Adviser");
    expect(prismaMock.panelAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scheduleId: "sched-1", role: "ADVISER" } }),
    );
  });

  it("returns a null snapshot when the summary row is absent (no regeneration)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      ...scheduleBase,
      oralExamSummary: null,
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([adviserAssignment]);

    const result = await records.getOfficialSummaryDocumentSource("sched-1", ADMIN);

    expect(result.summaryId).toBeNull();
    expect(result.snapshot).toBeNull();
  });
});
