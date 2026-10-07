import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findStudentDetailById: vi.fn(),
  findStudentUserId: vi.fn(),
  findStudentById: vi.fn(),
  updateCompExamStatus: vi.fn(),
}));

const journey = vi.hoisted(() => ({ getJourney: vi.fn() }));

vi.mock("../../../src/repositories/admin-student.repository", () => ({
  AdminStudentRepository: class {
    findStudentDetailById = repo.findStudentDetailById;
    findStudentUserId = repo.findStudentUserId;
    findStudentById = repo.findStudentById;
    updateCompExamStatus = repo.updateCompExamStatus;
  },
}));

vi.mock("../../../src/services/student-thesis-journey.service", () => ({
  StudentThesisJourneyService: class {
    getJourney = journey.getJourney;
  },
}));

import { AdminStudentService } from "../../../src/services/admin-student.service";

const DETAIL = {
  id: "s1",
  firstName: "Juan",
  lastName: "Dela Cruz",
  email: "juan@example.com",
  studentNumber: "2026-00123",
  cellphone: null,
  dateOfBirth: null,
  program: { id: "prog-1", programName: "MSIT" },
  admissionStatus: "ENROLLED",
  enrollmentDate: null,
  curriculumType: null,
  alignmentStatus: null,
  residency: null,
  compExam: null,
  adviserAssignment: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminStudentService.getStudentDetail", () => {
  it("throws 404 when the student does not exist", async () => {
    repo.findStudentDetailById.mockResolvedValue(null);
    await expect(
      new AdminStudentService().getStudentDetail("missing"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns the explicit detail projection", async () => {
    repo.findStudentDetailById.mockResolvedValue(DETAIL);
    await expect(
      new AdminStudentService().getStudentDetail("s1"),
    ).resolves.toEqual(DETAIL);
  });
});

describe("AdminStudentService.getStudentJourney", () => {
  it("throws 404 and does not evaluate a journey for an unknown student", async () => {
    repo.findStudentUserId.mockResolvedValue(null);
    await expect(
      new AdminStudentService().getStudentJourney("missing"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(journey.getJourney).not.toHaveBeenCalled();
  });

  it("reuses the authoritative journey evaluator via the resolved user id", async () => {
    repo.findStudentUserId.mockResolvedValue("u1");
    journey.getJourney.mockResolvedValue({ currentStep: "TITLE_DEFENSE", steps: [] });

    const result = await new AdminStudentService().getStudentJourney("s1");

    expect(journey.getJourney).toHaveBeenCalledWith("u1");
    expect(result).toEqual({ currentStep: "TITLE_DEFENSE", steps: [] });
  });
});
