import { beforeEach, describe, expect, it, vi } from "vitest";

const thesisRepo = vi.hoisted(() => ({
  getStudentById: vi.fn(),
  getActiveAdviserAssignment: vi.fn(),
  findNonCancelledSchedules: vi.fn(),
  scheduleDefense: vi.fn(),
}));

const eligibilityRepo = vi.hoisted(() => ({
  loadForThesis: vi.fn(),
}));

const eligibilityService = vi.hoisted(() => ({
  evaluateSchedule: vi.fn(),
  assertEligible: vi.fn(),
}));

vi.mock("../../../src/repositories/thesis.repository", () => ({
  ThesisRepository: class {
    getStudentById = thesisRepo.getStudentById;
    getActiveAdviserAssignment = thesisRepo.getActiveAdviserAssignment;
    findNonCancelledSchedules = thesisRepo.findNonCancelledSchedules;
    scheduleDefense = thesisRepo.scheduleDefense;
  },
}));

vi.mock("../../../src/repositories/defense-eligibility.repository", () => ({
  DefenseEligibilityRepository: class {
    loadForThesis = eligibilityRepo.loadForThesis;
  },
}));

vi.mock("../../../src/services/defense-eligibility.service", () => ({
  DefenseEligibilityService: class {
    evaluateSchedule = eligibilityService.evaluateSchedule;
    assertEligible = eligibilityService.assertEligible;
  },
}));

import { ThesisService } from "../../../src/services/thesis.service";
import { AppError } from "../../../src/utils/AppError";

const titleMasters = () => [
  { userId: "chair", role: "CHAIRMAN" as const },
  { userId: "p1", role: "PANELIST" as const },
  { userId: "p2", role: "PANELIST" as const },
  { userId: "p3", role: "PANELIST" as const },
  { userId: "p4", role: "PANELIST" as const },
  { userId: "fac", role: "FACILITATOR" as const },
  { userId: "rap", role: "RAPPORTEUR" as const },
];

const proposalMasters = (adviser = "adviser-1") => [
  { userId: adviser, role: "ADVISER" as const },
  { userId: "chair", role: "CHAIRMAN" as const },
  { userId: "p1", role: "PANELIST" as const },
  { userId: "p2", role: "PANELIST" as const },
  { userId: "p3", role: "PANELIST" as const },
  { userId: "fac", role: "FACILITATOR" as const },
  { userId: "rap", role: "RAPPORTEUR" as const },
];

const finalDoctoral = (adviser = "adviser-1") => [
  { userId: adviser, role: "ADVISER" as const },
  { userId: "chair", role: "CHAIRMAN" as const },
  { userId: "p1", role: "PANELIST" as const },
  { userId: "p2", role: "PANELIST" as const },
  { userId: "p3", role: "PANELIST" as const },
  { userId: "p4", role: "PANELIST" as const },
  { userId: "fac", role: "FACILITATOR" as const },
  { userId: "rap", role: "RAPPORTEUR" as const },
];

const scheduleInput = (defenseType: string, assignments: Array<{ userId: string; role: string }>) => ({
  defenseDate: "2026-11-10",
  defenseTime: "09:00",
  venueOrLink: "Room 201",
  defenseType,
  assignments,
});

describe("ADV-1 ThesisService.scheduleDefense active-Adviser authority", () => {
  let service: ThesisService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ThesisService();
    eligibilityRepo.loadForThesis.mockResolvedValue({ studentId: "student-1" });
    eligibilityService.evaluateSchedule.mockReturnValue({ eligible: true });
    eligibilityService.assertEligible.mockImplementation(() => undefined);
    thesisRepo.getStudentById.mockResolvedValue({
      id: "student-1",
      program: { programType: "MASTERS" },
    });
    thesisRepo.getActiveAdviserAssignment.mockResolvedValue({
      id: "asg-1",
      adviserId: "adviser-1",
      isActive: true,
    });
    thesisRepo.findNonCancelledSchedules.mockResolvedValue([]);
    thesisRepo.scheduleDefense.mockResolvedValue({ id: "sched-1" });
  });

  it("schedules Proposal Master's with the active Adviser as the automatic 7th seat", async () => {
    const assignments = proposalMasters("adviser-1");

    await service.scheduleDefense(
      "thesis-1",
      "admin-1",
      scheduleInput("PROPOSAL_DEFENSE", assignments),
    );

    expect(thesisRepo.getActiveAdviserAssignment).toHaveBeenCalledWith("student-1");
    expect(thesisRepo.scheduleDefense).toHaveBeenCalledWith(
      "thesis-1",
      "admin-1",
      expect.objectContaining({
        defenseType: "PROPOSAL_DEFENSE",
        assignments,
      }),
    );
    expect(assignments).toHaveLength(7);
  });

  it("uses the same active-Adviser authority for Final Defense", async () => {
    thesisRepo.getStudentById.mockResolvedValue({
      id: "student-1",
      program: { programType: "DOCTORAL" },
    });
    const assignments = finalDoctoral("adviser-1");

    await service.scheduleDefense(
      "thesis-1",
      "admin-1",
      scheduleInput("FINAL_DEFENSE", assignments),
    );

    expect(thesisRepo.getActiveAdviserAssignment).toHaveBeenCalledWith("student-1");
    expect(assignments).toHaveLength(8);
    expect(thesisRepo.scheduleDefense).toHaveBeenCalled();
  });

  it("blocks Proposal scheduling when no active Adviser exists", async () => {
    thesisRepo.getActiveAdviserAssignment.mockResolvedValue(null);

    await expect(
      service.scheduleDefense(
        "thesis-1",
        "admin-1",
        scheduleInput("PROPOSAL_DEFENSE", proposalMasters("adviser-1")),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(thesisRepo.scheduleDefense).not.toHaveBeenCalled();
  });

  it("fails closed when duplicate active Adviser rows are detected", async () => {
    thesisRepo.getActiveAdviserAssignment.mockRejectedValue(
      new AppError("More than one active adviser is recorded for this student.", 409),
    );

    await expect(
      service.scheduleDefense(
        "thesis-1",
        "admin-1",
        scheduleInput("FINAL_DEFENSE", finalDoctoral("adviser-1")),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(thesisRepo.scheduleDefense).not.toHaveBeenCalled();
  });

  it("rejects a submitted ADVISER seat that is not the authoritative active Adviser", async () => {
    await expect(
      service.scheduleDefense(
        "thesis-1",
        "admin-1",
        scheduleInput("PROPOSAL_DEFENSE", proposalMasters("different-adviser")),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(thesisRepo.scheduleDefense).not.toHaveBeenCalled();
  });

  it("does not resolve or require an Adviser for Title Defense", async () => {
    await service.scheduleDefense(
      "thesis-1",
      "admin-1",
      scheduleInput("TITLE_DEFENSE", titleMasters()),
    );

    expect(thesisRepo.getActiveAdviserAssignment).not.toHaveBeenCalled();
    expect(thesisRepo.scheduleDefense).toHaveBeenCalled();
  });
});
