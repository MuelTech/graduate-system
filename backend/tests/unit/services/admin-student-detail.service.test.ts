import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findStudentDetailById: vi.fn(),
  findStudentUserId: vi.fn(),
  findStudentById: vi.fn(),
  updateCompExamStatus: vi.fn(),
  findStudentForEdit: vi.fn(),
  findUserByEmailExcluding: vi.fn(),
  findStudentByNumberExcluding: vi.fn(),
  findProgramById: vi.fn(),
  updateStudentProfile: vi.fn(),
  resetStudentPassword: vi.fn(),
}));

const journey = vi.hoisted(() => ({ getJourney: vi.fn() }));

vi.mock("../../../src/repositories/admin-student.repository", () => {
  class MockRepo {
    static canChangeProgram(
      admissionStatus: string,
      thesisRecords: Array<{ stage: string; status: string }>,
    ) {
      if (admissionStatus !== "ENROLLED") return false;
      return !thesisRecords.some(
        (rec) =>
          rec.stage === "PROPOSAL" ||
          rec.stage === "FINAL" ||
          (rec.stage === "TITLE" &&
            ["PASSED", "APPROVED", "COMPLETED"].includes(rec.status)),
      );
    }
    findStudentDetailById = repo.findStudentDetailById;
    findStudentUserId = repo.findStudentUserId;
    findStudentById = repo.findStudentById;
    updateCompExamStatus = repo.updateCompExamStatus;
    findStudentForEdit = repo.findStudentForEdit;
    findUserByEmailExcluding = repo.findUserByEmailExcluding;
    findStudentByNumberExcluding = repo.findStudentByNumberExcluding;
    findProgramById = repo.findProgramById;
    updateStudentProfile = repo.updateStudentProfile;
    resetStudentPassword = repo.resetStudentPassword;
  }
  return { AdminStudentRepository: MockRepo };
});

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
  program: { id: "prog-1", programName: "MSIT" },
  admissionStatus: "ENROLLED",
  enrollmentDate: null,
  curriculumType: null,
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

describe("AdminStudentService management mutations", () => {
  function studentForEdit(overrides: Record<string, unknown> = {}) {
    return {
      id: "s1",
      studentNumber: "2026-00123",
      cellphone: "+639171234567",
      programId: "prog-1",
      admissionStatus: "ENROLLED",
      curriculumType: "NEW",
      enrollmentDate: new Date("2026-06-01T00:00:00.000Z"),
      residencyStartDate: new Date("2026-06-01T00:00:00.000Z"),
      user: {
        id: "u1",
        firstName: "Juan",
        lastName: "Dela Cruz",
        suffix: null,
        email: "juan@example.com",
        role: "STUDENT",
        isActive: true,
        mustChangePassword: false,
      },
      thesisRecords: [],
      ...overrides,
    };
  }

  it("requires an audit reason when editing student identity/academic data and syncs student number + residency", async () => {
    repo.findStudentForEdit.mockResolvedValue(studentForEdit());
    repo.findStudentByNumberExcluding.mockResolvedValue(null);
    repo.updateStudentProfile.mockResolvedValue(undefined);
    repo.findStudentDetailById.mockResolvedValue(DETAIL);

    await expect(
      new AdminStudentService().updateStudent("s1", "admin-1", {
        studentNumber: "2026-00999",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await new AdminStudentService().updateStudent("s1", "admin-1", {
      studentNumber: "2026-00999",
      cellphone: "+639181234567",
      residencyStartDate: "2026-07-01",
      reason: "Corrected student number and residency date per Registrar record.",
    });

    expect(repo.updateStudentProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "s1",
        syncStudentNumberOnCor: "2026-00999",
        reason:
          "Corrected student number and residency date per Registrar record.",
      }),
    );
  });

  it("prohibits changing program once Title Defense is passed (Manual §7.14.3)", async () => {
    repo.findStudentForEdit.mockResolvedValue(
      studentForEdit({
        thesisRecords: [{ stage: "TITLE", status: "PASSED" }],
      }),
    );

    await expect(
      new AdminStudentService().updateStudent("s1", "admin-1", {
        programId: "prog-2",
        reason: "Program shift request",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.updateStudentProfile).not.toHaveBeenCalled();
  });

  it("resets student password with mustChangePassword = true and deferred email dispatch", async () => {
    repo.findStudentForEdit.mockResolvedValue(studentForEdit());
    repo.resetStudentPassword.mockResolvedValue(undefined);

    const res = await new AdminStudentService().resetStudentPassword(
      "s1",
      "admin-1",
    );

    expect(res.mustChangePassword).toBe(true);
    expect(res.emailDispatched).toBe(false);
    expect(repo.resetStudentPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "s1",
        userId: "u1",
        adminId: "admin-1",
      }),
    );
  });
});
