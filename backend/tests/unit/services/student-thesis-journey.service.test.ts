import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  student: { findUnique: vi.fn() },
  thesisRecord: { findFirst: vi.fn() },
  rapReport: { findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({
  default: prismaMock,
}));

import { StudentThesisJourneyService } from "../../../src/services/student-thesis-journey.service";

function studentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "student-1",
    userId: "user-1",
    compExamRecords: [{ status: "PASSED" }],
    adviserAssignments: [],
    adviserRequests: [],
    ...overrides,
  };
}

function thesisRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "thesis-1",
    stage: "TITLE",
    status: "PENDING",
    outcome: null,
    thesisTitles: [{ id: "title-legacy", titleText: "Mutable title", isSelected: true }],
    defenseSchedules: [],
    plagiarismResults: [],
    ...overrides,
  };
}

function scheduleWithConclusion(
  defenseType: string,
  conclusion: Record<string, unknown> | null,
  overrides: Record<string, unknown> = {},
) {
  return {
    defenseType,
    sessionStatus: "CONCLUDED",
    conclusion,
    ...overrides,
  };
}

describe("StudentThesisJourneyService (WP5 loader)", () => {
  const svc = new StudentThesisJourneyService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.student.findUnique.mockResolvedValue(studentRow());
    prismaMock.thesisRecord.findFirst.mockResolvedValue(thesisRow());
    prismaMock.rapReport.findMany.mockResolvedValue([]);
  });

  it("selectedTitle comes from PASSED Title DefenseConclusion.selectedTitle only", async () => {
    prismaMock.rapReport.findMany.mockResolvedValue([
      { defenseType: "TITLE_DEFENSE", status: "FINALIZED" },
    ]);
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesisRow({
        defenseSchedules: [
          scheduleWithConclusion("TITLE_DEFENSE", {
            outcome: "PASSED",
            selectedTitle: { id: "title-formal", titleText: "Formal Title" },
          }),
        ],
      }),
    );

    const journey = await svc.getJourney("user-1");
    expect(journey.selectedTitle).toEqual({
      id: "title-formal",
      titleText: "Formal Title",
    });
    const title = journey.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.state).toBe("COMPLETED");
  });

  it("CP1: PASSED + selected title without finalized Title RAP is not COMPLETED", async () => {
    prismaMock.rapReport.findMany.mockResolvedValue([]);
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesisRow({
        defenseSchedules: [
          scheduleWithConclusion("TITLE_DEFENSE", {
            outcome: "PASSED",
            selectedTitle: { id: "title-formal", titleText: "Formal Title" },
          }),
        ],
      }),
    );

    const journey = await svc.getJourney("user-1");
    const title = journey.steps.find((s) => s.key === "TITLE_DEFENSE");
    const adviser = journey.steps.find((s) => s.key === "ADVISER_REQUEST");
    expect(title?.state).not.toBe("COMPLETED");
    expect(adviser?.state).toBe("LOCKED");
    expect(adviser?.lockReason).toMatch(/Title RAP/i);
  });

  it("ThesisTitle.isSelected alone does NOT complete Title", async () => {
    const journey = await svc.getJourney("user-1");
    expect(journey.selectedTitle).toBeNull();
    const title = journey.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.state).not.toBe("COMPLETED");
  });

  it("application APPROVED alone does NOT complete Title/Proposal/Final", async () => {
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesisRow({
        stage: "TITLE",
        status: "APPROVED",
      }),
    );

    const journey = await svc.getJourney("user-1");
    for (const key of ["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"]) {
      expect(
        journey.steps.find((s) => s.key === key)?.state,
      ).not.toBe("COMPLETED");
    }
  });

  it("Proposal PASSED is read from PROPOSAL_DEFENSE conclusion only", async () => {
    prismaMock.student.findUnique.mockResolvedValue(
      studentRow({
        adviserAssignments: [
          { adviser: { id: "a", firstName: "Ana", lastName: "Chair" } },
        ],
      }),
    );
    prismaMock.rapReport.findMany.mockResolvedValue([
      { defenseType: "TITLE_DEFENSE", status: "FINALIZED" },
    ]);
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesisRow({
        defenseSchedules: [
          scheduleWithConclusion("TITLE_DEFENSE", {
            outcome: "PASSED",
            selectedTitle: { id: "t", titleText: "T" },
          }),
          // Title conclusion must not count as Proposal.
          scheduleWithConclusion("PROPOSAL_DEFENSE", null),
        ],
      }),
    );
    let journey = await svc.getJourney("user-1");
    expect(
      journey.steps.find((s) => s.key === "PROPOSAL_DEFENSE")?.state,
    ).not.toBe("COMPLETED");

    prismaMock.rapReport.findMany.mockResolvedValue([
      { defenseType: "TITLE_DEFENSE", status: "FINALIZED" },
      { defenseType: "PROPOSAL_DEFENSE", status: "FINALIZED" },
    ]);
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesisRow({
        defenseSchedules: [
          scheduleWithConclusion("TITLE_DEFENSE", {
            outcome: "PASSED",
            selectedTitle: { id: "t", titleText: "T" },
          }),
          scheduleWithConclusion("PROPOSAL_DEFENSE", { outcome: "PASSED" }),
        ],
      }),
    );
    journey = await svc.getJourney("user-1");
    expect(
      journey.steps.find((s) => s.key === "PROPOSAL_DEFENSE")?.state,
    ).toBe("COMPLETED");
  });

  it("Final PASSED is read from FINAL_DEFENSE conclusion only", async () => {
    prismaMock.rapReport.findMany.mockResolvedValue([
      { defenseType: "TITLE_DEFENSE", status: "FINALIZED" },
      { defenseType: "PROPOSAL_DEFENSE", status: "FINALIZED" },
    ]);
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesisRow({
        defenseSchedules: [
          scheduleWithConclusion("TITLE_DEFENSE", {
            outcome: "PASSED",
            selectedTitle: { id: "t", titleText: "T" },
          }),
          scheduleWithConclusion("PROPOSAL_DEFENSE", { outcome: "PASSED" }),
          scheduleWithConclusion("FINAL_DEFENSE", { outcome: "PASSED" }),
        ],
      }),
    );
    prismaMock.student.findUnique.mockResolvedValue(
      studentRow({
        adviserAssignments: [
          {
            adviser: { id: "a", firstName: "Ana", lastName: "Chair" },
          },
        ],
      }),
    );

    const journey = await svc.getJourney("user-1");
    expect(
      journey.steps.find((s) => s.key === "FINAL_DEFENSE")?.state,
    ).toBe("COMPLETED");
    expect(journey.currentStep).toBeNull();
  });

  it("consumes persisted PlagiarismResult.isEligible", async () => {
    prismaMock.rapReport.findMany.mockResolvedValue([
      { defenseType: "TITLE_DEFENSE", status: "FINALIZED" },
      { defenseType: "PROPOSAL_DEFENSE", status: "FINALIZED" },
    ]);
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesisRow({
        plagiarismResults: [{ isEligible: true, submittedAt: new Date() }],
        defenseSchedules: [
          scheduleWithConclusion("TITLE_DEFENSE", {
            outcome: "PASSED",
            selectedTitle: { id: "t", titleText: "T" },
          }),
          scheduleWithConclusion("PROPOSAL_DEFENSE", { outcome: "PASSED" }),
        ],
      }),
    );
    prismaMock.student.findUnique.mockResolvedValue(
      studentRow({
        adviserAssignments: [
          { adviser: { id: "a", firstName: "Ana", lastName: "Chair" } },
        ],
      }),
    );

    const journey = await svc.getJourney("user-1");
    const strike = journey.steps.find((s) => s.key === "STRIKE");
    // Policy default is not required → STRIKE non-blocking COMPLETED.
    // Evidence is still loaded for when policy requires it.
    expect(strike?.state).toBe("COMPLETED");
    expect(journey.policy.strikeRequired).toBe(false);
  });

  it("mutable ThesisRecord.stage/status does not independently advance currentStep", async () => {
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesisRow({
        stage: "FINAL",
        status: "APPROVED",
      }),
    );

    const journey = await svc.getJourney("user-1");
    expect(journey.currentStep).toBe("TITLE_DEFENSE");
    expect(
      journey.steps.find((s) => s.key === "FINAL_DEFENSE")?.state,
    ).not.toBe("CURRENT");
  });

  it("rejected stage status maps to actionable CURRENT, not WAITING", async () => {
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesisRow({
        stage: "TITLE",
        status: "REJECTED",
      }),
    );

    const journey = await svc.getJourney("user-1");
    const title = journey.steps.find((s) => s.key === "TITLE_DEFENSE");
    expect(title?.state).toBe("CURRENT");
    expect(title?.detail).toMatch(/rejected/i);
    expect(title?.detail).not.toMatch(/under review/i);
  });

  it("prior-stage status does not make a later stage look submitted", async () => {
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesisRow({
        stage: "PROPOSAL",
        status: "PENDING",
      }),
    );

    const journey = await svc.getJourney("user-1");
    const final = journey.steps.find((s) => s.key === "FINAL_DEFENSE");
    // No Final session and stage is PROPOSAL — Final admin context is NONE.
    expect(String(final?.detail ?? "")).not.toMatch(/under review/i);
    expect(final?.state).toBe("LOCKED");
  });
});
