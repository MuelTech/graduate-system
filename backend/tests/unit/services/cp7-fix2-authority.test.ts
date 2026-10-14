import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CP7-FIX2 — real production-method authority regression tests.
 * These invoke ThesisService.concludeDefense / ThesisRepository.concludeDefense
 * and OfficialDefenseRecordService, not local placeholder conditions.
 */

const getDefenseScheduleForConclude = vi.fn();
const getSessionPanelAssignments = vi.fn();
const concludeDefense = vi.fn();
const ensureOralExamSummary = vi.fn();

vi.mock("../../../src/repositories/thesis.repository", () => ({
  ThesisRepository: class {
    getDefenseScheduleForConclude = getDefenseScheduleForConclude;
    getSessionPanelAssignments = getSessionPanelAssignments;
    concludeDefense = concludeDefense;
  },
}));

vi.mock("../../../src/repositories/defense-applications.repository", () => ({
  DefenseApplicationsRepository: class {
    constructor() {}
  },
}));

vi.mock("../../../src/repositories/defense-eligibility.repository", () => ({
  DefenseEligibilityRepository: class {
    constructor() {}
  },
}));

vi.mock("../../../src/services/defense-eligibility.service", () => ({
  DefenseEligibilityService: class {
    constructor() {}
  },
}));

vi.mock("../../../src/services/oral-evaluation.service", () => ({
  OralEvaluationService: class {
    constructor() {}
  },
}));

vi.mock("../../../src/services/adviser-request.service", () => ({
  AdviserRequestService: class {
    constructor() {}
  },
}));

vi.mock("../../../src/services/official-defense-record.service", () => ({
  OfficialDefenseRecordService: class {
    ensureOralExamSummary = ensureOralExamSummary;
    getSummaryReadModel = vi.fn();
    getOfficialCriteria = vi.fn();
  },
}));

vi.mock("../../../src/services/rapporteur-finalization.service", () => ({
  RapporteurFinalizationService: class {
    constructor() {}
  },
}));

vi.mock("../../../src/services/rap-report.service", () => ({
  RapReportService: class {
    constructor() {}
  },
}));

// Keep real DefenseConclusionService + defense-workflow rules for outcome/assertCanConclude.
vi.mock("../../../src/services/defense-committee.policy", () => ({
  DefenseCommitteePolicy: class {
    getEvaluatorRoles() {
      return ["CHAIRMAN", "PANELIST"];
    }
    getPolicy() {
      return {};
    }
  },
}));

import { ThesisService } from "../../../src/services/thesis.service";
import { AppError } from "../../../src/utils/AppError";

function readySchedule(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    defenseType: "PROPOSAL_DEFENSE",
    alreadyConcluded: false,
    evaluatorAssignments: 4,
    finalizedEvaluatorScores: 4,
    sessionStatus: "AWAITING_CONCLUSION",
    rapporteurNotesFinalized: true,
    oralSummaryExists: false,
    thesisTitleIds: ["t1", "t2", "t3"],
    ...overrides,
  };
}

function chairmanAssignments(role = "CHAIRMAN") {
  return [{ id: "pa-c", userId: "chair-1", role }];
}

describe("CP7-FIX2 REAL tests — ThesisService.concludeDefense production path", () => {
  const service = new ThesisService();

  beforeEach(() => {
    vi.clearAllMocks();
    getDefenseScheduleForConclude.mockReset();
    getSessionPanelAssignments.mockReset();
    ensureOralExamSummary.mockReset();
    concludeDefense.mockReset();

    getSessionPanelAssignments.mockResolvedValue(chairmanAssignments());
    ensureOralExamSummary.mockResolvedValue({
      created: true,
      summaryId: "sum-1",
      evaluatorCount: 4,
      overallAverage: 88,
      finalRating: null,
    });
    concludeDefense.mockResolvedValue({
      conclusion: { id: "c1" },
      rapReport: { id: "rap-1", status: "FOR_SIGNATURE" },
    });
  });

  it("REAL A: Chairman conclusion recovers missing Summary then concludes once", async () => {
    getDefenseScheduleForConclude
      .mockResolvedValueOnce(readySchedule())
      .mockResolvedValueOnce(readySchedule({ oralSummaryExists: true }));

    const result = await service.concludeDefense("sched-1", "chair-1", {
      outcome: "PASSED",
    });

    expect(ensureOralExamSummary).toHaveBeenCalledTimes(1);
    expect(ensureOralExamSummary).toHaveBeenCalledWith("sched-1");
    expect(concludeDefense).toHaveBeenCalledTimes(1);
    expect(concludeDefense).toHaveBeenCalledWith("sched-1", "chair-1", {
      outcome: "PASSED",
      selectedTitleId: null,
      finalRemarks: null,
    });
    expect(result.rapReport.id).toBe("rap-1");
  });

  it("REAL B: non-Chairman actor gets 403 and does NOT trigger Summary recovery", async () => {
    getSessionPanelAssignments.mockResolvedValue([
      { id: "pa-p", userId: "panel-1", role: "PANELIST" },
    ]);
    getDefenseScheduleForConclude.mockResolvedValue(
      readySchedule({ oralSummaryExists: false }),
    );

    await expect(
      service.concludeDefense("sched-1", "panel-1", { outcome: "PASSED" }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(ensureOralExamSummary).not.toHaveBeenCalled();
    expect(concludeDefense).not.toHaveBeenCalled();
  });

  it("REAL C: incomplete evaluators → Summary ensure rejects → 409, no conclusion write", async () => {
    getDefenseScheduleForConclude.mockResolvedValue(
      readySchedule({
        evaluatorAssignments: 4,
        finalizedEvaluatorScores: 3,
        oralSummaryExists: false,
      }),
    );
    ensureOralExamSummary.mockRejectedValue(
      new AppError(
        "All required evaluator evaluations must be finalized before the Oral Examination Summary can be generated.",
        409,
      ),
    );

    await expect(
      service.concludeDefense("sched-1", "chair-1", { outcome: "PASSED" }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(concludeDefense).not.toHaveBeenCalled();
  });

  it("REAL D: P2002 from repository conclusion maps to AppError 409", async () => {
    getDefenseScheduleForConclude
      .mockResolvedValueOnce(readySchedule())
      .mockResolvedValueOnce(readySchedule({ oralSummaryExists: true }));
    concludeDefense.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    await expect(
      service.concludeDefense("sched-1", "chair-1", { outcome: "PASSED" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/already been concluded|another request/i),
    });
  });

  it("already concluded → 409 without recovery", async () => {
    getDefenseScheduleForConclude.mockResolvedValue(
      readySchedule({ alreadyConcluded: true }),
    );

    await expect(
      service.concludeDefense("sched-1", "chair-1", { outcome: "PASSED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(ensureOralExamSummary).not.toHaveBeenCalled();
    expect(concludeDefense).not.toHaveBeenCalled();
  });
});
