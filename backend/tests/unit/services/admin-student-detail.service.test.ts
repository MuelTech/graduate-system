import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findStudentDetailById: vi.fn(),
  findStudentUserId: vi.fn(),
  findStudentById: vi.fn(),
  recordCompExamAttempt: vi.fn(),
  correctLatestCompExamAttempt: vi.fn(),
  findStudentForEdit: vi.fn(),
  findUserByEmailExcluding: vi.fn(),
  findStudentByNumberExcluding: vi.fn(),
  findProgramById: vi.fn(),
  updateStudentProfile: vi.fn(),
  resetStudentPassword: vi.fn(),
}));

const journey = vi.hoisted(() => ({ getJourney: vi.fn() }));
const compExamCert = vi.hoisted(() => ({
  getCertificateFoundationForStudentId: vi.fn(),
}));

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
    recordCompExamAttempt = repo.recordCompExamAttempt;
    correctLatestCompExamAttempt = repo.correctLatestCompExamAttempt;
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

vi.mock("../../../src/services/comp-exam-certificate.service", () => ({
  CompExamCertificateService: class {
    getCertificateFoundationForStudentId =
      compExamCert.getCertificateFoundationForStudentId;
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

describe("AdminStudentService Comprehensive Examination 3-attempt workflow", () => {
  function compExamStudent(overrides: Record<string, unknown> = {}) {
    return {
      id: "s1",
      userId: "u1",
      admissionStatus: "ENROLLED",
      user: {
        id: "u1",
        firstName: "Juan",
        lastName: "Dela Cruz",
        email: "juan@example.com",
      },
      program: { id: "prog-1", programName: "MBA" },
      thesisRecords: [],
      compExamRecords: [],
      adviserAssignments: [],
      ...overrides,
    };
  }

  it("records attempt 1 and attempt 2 failures without dismissing the student (Manual §7.15.4)", async () => {
    repo.findStudentById.mockResolvedValue(
      compExamStudent({
        compExamRecords: [
          {
            id: "ce-1",
            attemptNumber: 1,
            status: "FAILED",
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
          },
        ],
      }),
    );
    repo.recordCompExamAttempt.mockResolvedValue({
      id: "ce-2",
      studentId: "s1",
      attemptNumber: 2,
      status: "FAILED",
      examDate: new Date("2026-09-01T00:00:00.000Z"),
      remarks: "Needs retake",
      certificateNumber: null,
      certificateIssuedAt: null,
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
    });

    const res = await new AdminStudentService().recordCompExamAttempt(
      "s1",
      "admin-1",
      { status: "FAILED", examDate: "2026-09-01", remarks: "Needs retake" },
    );

    expect(res.dismissed).toBe(false);
    expect(res.summary.standing).toBe("RETAKE_REQUIRED");
    expect(res.summary.attemptsRemaining).toBe(1);
    expect(res.emailNotification.templateKey).toBe("comp_exam_recorded");
    expect(res.emailNotification.deliveryStatus).toBe(
      "DEFERRED_SMTP_NOT_CONFIGURED",
    );
    expect(repo.recordCompExamAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "s1",
        attemptNumber: 2,
        status: "FAILED",
        shouldDismiss: false,
      }),
    );
  });

  it("automatically dismisses the student on the 3rd failed attempt and blocks a 4th attempt", async () => {
    repo.findStudentById.mockResolvedValue(
      compExamStudent({
        compExamRecords: [
          { id: "ce-2", attemptNumber: 2, status: "FAILED", createdAt: new Date("2026-07-01") },
          { id: "ce-1", attemptNumber: 1, status: "FAILED", createdAt: new Date("2026-06-01") },
        ],
      }),
    );
    repo.recordCompExamAttempt.mockResolvedValue({
      id: "ce-3",
      studentId: "s1",
      attemptNumber: 3,
      status: "FAILED",
      examDate: null,
      remarks: null,
      certificateNumber: null,
      certificateIssuedAt: null,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
    });

    const thirdRes = await new AdminStudentService().recordCompExamAttempt(
      "s1",
      "admin-1",
      { status: "FAILED" },
    );

    expect(thirdRes.dismissed).toBe(true);
    expect(thirdRes.summary.standing).toBe("DISMISSED");
    expect(repo.recordCompExamAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptNumber: 3,
        shouldDismiss: true,
      }),
    );

    // 4th attempt blocked once 3 failures exist
    repo.findStudentById.mockResolvedValue(
      compExamStudent({
        admissionStatus: "DISMISSED",
        compExamRecords: [
          { id: "ce-3", attemptNumber: 3, status: "FAILED", createdAt: new Date("2026-10-01") },
          { id: "ce-2", attemptNumber: 2, status: "FAILED", createdAt: new Date("2026-07-01") },
          { id: "ce-1", attemptNumber: 1, status: "FAILED", createdAt: new Date("2026-06-01") },
        ],
      }),
    );
    await expect(
      new AdminStudentService().recordCompExamAttempt("s1", "admin-1", {
        status: "PASSED",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("blocks additional attempts once a student has already passed", async () => {
    repo.findStudentById.mockResolvedValue(
      compExamStudent({
        compExamRecords: [
          { id: "ce-1", attemptNumber: 1, status: "PASSED", createdAt: new Date("2026-06-01") },
        ],
      }),
    );

    await expect(
      new AdminStudentService().recordCompExamAttempt("s1", "admin-1", {
        status: "FAILED",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.recordCompExamAttempt).not.toHaveBeenCalled();
  });

  it("supports audited latest-attempt correction restoring a dismissed student to ENROLLED", async () => {
    repo.findStudentById.mockResolvedValue(
      compExamStudent({
        admissionStatus: "DISMISSED",
        compExamRecords: [
          { id: "ce-3", attemptNumber: 3, status: "FAILED", createdAt: new Date("2026-10-01") },
          { id: "ce-2", attemptNumber: 2, status: "FAILED", createdAt: new Date("2026-07-01") },
          { id: "ce-1", attemptNumber: 1, status: "FAILED", createdAt: new Date("2026-06-01") },
        ],
      }),
    );
    repo.correctLatestCompExamAttempt.mockResolvedValue({
      id: "ce-3",
      attemptNumber: 3,
      status: "PASSED",
      examDate: null,
      remarks: "Re-checked score",
      certificateNumber: "WCE-2026-CE3",
      certificateIssuedAt: new Date("2026-10-02"),
      createdAt: new Date("2026-10-01"),
    });

    const corrected = await new AdminStudentService().correctLatestCompExamAttempt(
      "s1",
      "admin-1",
      {
        status: "PASSED",
        remarks: "Re-checked score",
        reason: "Corrected encoding mistake after chair review.",
      },
    );

    expect(corrected.restoredToEnrolled).toBe(true);
    expect(corrected.summary.standing).toBe("PASSED");
    expect(repo.correctLatestCompExamAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: "ce-3",
        nextAdmissionStatus: "ENROLLED",
        reason: "Corrected encoding mistake after chair review.",
      }),
    );
  });

  it("blocks downgrading PASSED to FAILED with 409 when a thesis record already exists", async () => {
    repo.findStudentById.mockResolvedValue(
      compExamStudent({
        thesisRecords: [{ id: "t-1", stage: "TITLE", status: "PENDING" }],
        compExamRecords: [
          { id: "ce-1", attemptNumber: 1, status: "PASSED", createdAt: new Date("2026-06-01") },
        ],
      }),
    );

    await expect(
      new AdminStudentService().correctLatestCompExamAttempt("s1", "admin-1", {
        status: "FAILED",
        reason: "Attempted downgrade test",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.correctLatestCompExamAttempt).not.toHaveBeenCalled();
  });

  it("delegates certificate foundation lookup to CompExamCertificateService", async () => {
    compExamCert.getCertificateFoundationForStudentId.mockResolvedValue({
      studentId: "s1",
      eligible: true,
      templateStatus: "TEMPLATE_PENDING",
    });

    const res = await new AdminStudentService().getCompExamCertificateFoundation(
      "s1",
    );
    expect(res.templateStatus).toBe("TEMPLATE_PENDING");
    expect(
      compExamCert.getCertificateFoundationForStudentId,
    ).toHaveBeenCalledWith("s1");
  });
});
