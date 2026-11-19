import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/services/cor.service", () => ({
  CorService: class {},
}));

const repo = vi.hoisted(() => ({
  findStudentById: vi.fn(),
  findUserByEmailExcluding: vi.fn(),
  findStudentByApplicantIdExcluding: vi.fn(),
  findProgramById: vi.fn(),
  updateApplicantProfile: vi.fn(),
  resetApplicantPassword: vi.fn(),
  deleteApplicantAccount: vi.fn(),
}));

vi.mock("../../../src/repositories/admin-applicant.repository", () => ({
  AdminApplicantRepository: class {
    findStudentById = repo.findStudentById;
    findUserByEmailExcluding = repo.findUserByEmailExcluding;
    findStudentByApplicantIdExcluding = repo.findStudentByApplicantIdExcluding;
    findProgramById = repo.findProgramById;
    updateApplicantProfile = repo.updateApplicantProfile;
    resetApplicantPassword = repo.resetApplicantPassword;
    deleteApplicantAccount = repo.deleteApplicantAccount;
  },
}));

import { AdminApplicantService } from "../../../src/services/admin-applicant.service";

function detailStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    admissionStatus: "APPLICANT",
    studentNumber: null,
    enrollmentDate: null,
    cellphone: null,
    pinnacleApplicantId: "PIN-1",
    program: { id: "prog-1", programName: "MSIT", programType: "MASTERS" },
    examApplications: [],
    corUploads: [],
    user: {
      firstName: "Ana",
      lastName: "Dela",
      email: "ana@example.com",
    },
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function examApp(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    status: "PENDING",
    createdAt: new Date("2026-02-01"),
    score: null,
    slot: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminApplicantService academic background", () => {
  it("exposes the Master's program type without legacy prerequisite/waiver/DOB fields", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        program: { id: "prog-1", programName: "MSIT", programType: "MASTERS" },
      }),
    );

    const detail = await new AdminApplicantService().getApplicantDetail("s1");

    expect(detail.program).toEqual({
      id: "prog-1",
      programName: "MSIT",
      programType: "MASTERS",
    });
    expect(detail).not.toHaveProperty("undergraduateProgram");
    expect(detail).not.toHaveProperty("previousMastersProgram");
    expect(detail).not.toHaveProperty("alignmentStatus");
    expect(detail).not.toHaveProperty("bridgingWaiver");
    expect(detail).not.toHaveProperty("dateOfBirth");
  });

  it("exposes the Doctoral program type", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        program: { id: "prog-2", programName: "DBA", programType: "DOCTORAL" },
      }),
    );

    const detail = await new AdminApplicantService().getApplicantDetail("s1");

    expect(detail.program?.programType).toBe("DOCTORAL");
  });
});

describe("AdminApplicantService admission stage", () => {
  it("derives Entrance Examination when no authoritative PASSED exam exists (even if legacy alignmentStatus was PENDING_WAIVER)", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        alignmentStatus: "PENDING_WAIVER",
        examApplications: [examApp({ status: "APPROVED" })],
      }),
    );

    const detail = await new AdminApplicantService().getApplicantDetail("s1");

    expect(detail.admissionStage).toBe("EXAM");
    expect(detail.hasPassedExam).toBe(false);
  });

  it("derives COR / Enrollment when an authoritative PASSED exam exists", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        examApplications: [examApp({ status: "PASSED" })],
      }),
    );

    const detail = await new AdminApplicantService().getApplicantDetail("s1");

    expect(detail.admissionStage).toBe("COR");
    expect(detail.hasPassedExam).toBe(true);
  });
});

describe("AdminApplicantService removed profile-only projections", () => {
  it("does not expose the removed role/activityLog detail fields", async () => {
    repo.findStudentById.mockResolvedValue(detailStudent());

    const detail = await new AdminApplicantService().getApplicantDetail("s1");

    expect(detail).not.toHaveProperty("role");
    expect(detail).not.toHaveProperty("activityLog");
  });
});

describe("AdminApplicantService exam schedule contract", () => {
  it("projects the single examSlot contract with authoritative date/time and no fabricated venue", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        examApplications: [
          examApp({
            status: "PENDING",
            slot: {
              examDate: new Date("2026-03-01T00:00:00.000Z"),
              examTime: new Date("1970-01-01T09:00:00.000Z"),
            },
          }),
        ],
      }),
    );

    const detail = await new AdminApplicantService().getApplicantDetail("s1");
    const exam = detail.examApplications[0];

    expect(exam).toHaveProperty("examSlot");
    expect(exam).not.toHaveProperty("slot");
    expect(exam.examSlot).toEqual({
      examDate: "2026-03-01T00:00:00.000Z",
      examTime: "1970-01-01T09:00:00.000Z",
    });
    expect(JSON.stringify(detail)).not.toContain("venueOrLink");
  });
});

describe("AdminApplicantService management mutations", () => {
  it("updates applicant identity, PH mobile, and intended program before any exam booking", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        userId: "u1",
        programId: "prog-1",
        user: {
          id: "u1",
          firstName: "Ana",
          lastName: "Dela",
          email: "ana@gmail.com",
          isActive: true,
          mustChangePassword: false,
        },
      }),
    );
    repo.findUserByEmailExcluding.mockResolvedValue(null);
    repo.findStudentByApplicantIdExcluding.mockResolvedValue(null);
    repo.findProgramById.mockResolvedValue({
      id: "prog-2",
      programName: "MBA",
      isActive: true,
    });
    repo.updateApplicantProfile.mockResolvedValue(undefined);

    await new AdminApplicantService().updateApplicant("s1", "admin-1", {
      firstName: "Ana Maria",
      cellphone: "+639171234567",
      programId: "prog-2",
    });

    expect(repo.updateApplicantProfile).toHaveBeenCalledTimes(1);
    const call = repo.updateApplicantProfile.mock.calls[0][0];
    expect(call.userData).toEqual({ firstName: "Ana Maria" });
    expect(call.studentData).toEqual({
      cellphone: "+639171234567",
      programId: "prog-2",
    });
  });

  it("blocks program changes once an entrance exam booking or result exists", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        programId: "prog-1",
        examApplications: [examApp({ status: "PENDING" })],
      }),
    );

    await expect(
      new AdminApplicantService().updateApplicant("s1", "admin-1", {
        programId: "prog-2",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.updateApplicantProfile).not.toHaveBeenCalled();
  });

  it("resets applicant password with mustChangePassword = true and deferred email dispatch", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        userId: "u1",
        user: {
          id: "u1",
          firstName: "Ana",
          lastName: "Santos",
          email: "ana@gmail.com",
        },
      }),
    );
    repo.resetApplicantPassword.mockResolvedValue(undefined);

    const res = await new AdminApplicantService().resetApplicantPassword(
      "s1",
      "admin-1",
    );

    expect(res.mustChangePassword).toBe(true);
    expect(res.emailDispatched).toBe(false);
    expect(repo.resetApplicantPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "s1",
        userId: "u1",
        adminId: "admin-1",
      }),
    );
  });

  it("allows guarded applicant deletion only when no exam attempt or COR verification exists", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        userId: "u1",
        programId: "prog-1",
        examApplications: [examApp({ status: "PENDING" })],
      }),
    );
    repo.deleteApplicantAccount.mockResolvedValue(undefined);

    await new AdminApplicantService().deleteApplicant("s1", "admin-1");
    expect(repo.deleteApplicantAccount).toHaveBeenCalledTimes(1);

    repo.deleteApplicantAccount.mockClear();
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        userId: "u1",
        examApplications: [examApp({ status: "PASSED" })],
      }),
    );

    await expect(
      new AdminApplicantService().deleteApplicant("s1", "admin-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.deleteApplicantAccount).not.toHaveBeenCalled();
  });
});
