import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  findStudentByApplicantId: vi.fn(),
  findStudentByStudentNumber: vi.fn(),
  findUserById: vi.fn(),
  registerApplicant: vi.fn(),
  updatePassword: vi.fn(),
  findProgramById: vi.fn(),
  findProgramByName: vi.fn(),
}));

vi.mock("../../../src/repositories/auth.repository", () => ({
  AuthRepository: class {
    findUserByEmail = repo.findUserByEmail;
    findStudentByApplicantId = repo.findStudentByApplicantId;
    findStudentByStudentNumber = repo.findStudentByStudentNumber;
    findUserById = repo.findUserById;
    registerApplicant = repo.registerApplicant;
    updatePassword = repo.updatePassword;
    findProgramById = repo.findProgramById;
    findProgramByName = repo.findProgramByName;
  },
}));

const bcryptMock = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn(async () => "hashed-password"),
  genSalt: vi.fn(),
}));
vi.mock("bcryptjs", () => ({ default: bcryptMock }));

import { AuthService } from "../../../src/services/auth.service";

const BASE_INPUT = {
  applicantId: "APP-2026-001",
  firstName: "Maria",
  lastName: "Santos",
  email: "maria.santos@gmail.com",
  cellphone: "09171234567",
  programId: "prog-1",
  password: "StrongPassword123!",
};

beforeEach(() => {
  vi.clearAllMocks();
  repo.findUserByEmail.mockResolvedValue(null);
  repo.findStudentByApplicantId.mockResolvedValue(null);
  repo.findProgramById.mockResolvedValue({
    id: "prog-1",
    programName: "Master in Business Administration (MBA)",
    isActive: true,
  });
  repo.registerApplicant.mockResolvedValue({
    id: "user-1",
    email: BASE_INPUT.email,
    role: "APPLICANT",
  });
});

describe("AuthService.register (WAIVER-CLEANUP-1)", () => {
  it("registers an applicant without dateOfBirth, prerequisite program, or bridging waiver", async () => {
    const result = await new AuthService().register(BASE_INPUT);

    expect(result).toEqual({
      id: "user-1",
      email: "maria.santos@gmail.com",
      role: "APPLICANT",
      mustChangePassword: false,
    });
    expect(repo.registerApplicant).toHaveBeenCalledTimes(1);
    const [userData, studentData] = repo.registerApplicant.mock.calls[0];
    expect(userData).toMatchObject({
      email: "maria.santos@gmail.com",
      firstName: "Maria",
      lastName: "Santos",
      role: "APPLICANT",
    });
    expect(studentData).toEqual({
      cellphone: "09171234567",
      pinnacleApplicantId: "APP-2026-001",
      program: { connect: { id: "prog-1" } },
      admissionStatus: "APPLICANT",
    });
    expect(studentData).not.toHaveProperty("dateOfBirth");
    expect(studentData).not.toHaveProperty("alignmentStatus");
    expect(studentData).not.toHaveProperty("isProgramAligned");
    expect(studentData).not.toHaveProperty("undergraduateProgram");
    expect(studentData).not.toHaveProperty("previousMastersProgram");
    expect(repo.registerApplicant.mock.calls[0]).toHaveLength(2);
  });

  it("rejects inactive graduate programs from accepting applications", async () => {
    repo.findProgramById.mockResolvedValue({
      id: "prog-inactive",
      programName: "Archived Program",
      isActive: false,
    });

    await expect(
      new AuthService().register({ ...BASE_INPUT, programId: "prog-inactive" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Selected program is not currently accepting applications.",
    });
    expect(repo.registerApplicant).not.toHaveBeenCalled();
  });

  it("requires core fields without demanding dateOfBirth or undergraduateProgramId", async () => {
    await expect(
      new AuthService().register({ ...BASE_INPUT, applicantId: "   " }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
