import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  findStudentByApplicantId: vi.fn(),
  findStudentByStudentNumber: vi.fn(),
  findUserById: vi.fn(),
  registerApplicant: vi.fn(),
  updatePassword: vi.fn(),
  findProgramById: vi.fn(),
  findUndergraduateProgramById: vi.fn(),
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
    findUndergraduateProgramById = repo.findUndergraduateProgramById;
    findProgramByName = repo.findProgramByName;
  },
}));

// Deterministic, non-production test doubles. No real secret is asserted.
const bcryptMock = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn(),
  genSalt: vi.fn(),
}));
vi.mock("bcryptjs", () => ({ default: bcryptMock }));

const jwtMock = vi.hoisted(() => ({ sign: vi.fn(() => "synthetic-token") }));
vi.mock("jsonwebtoken", () => ({ default: { sign: jwtMock.sign } }));

import { AuthService } from "../../../src/services/auth.service";

process.env.JWT_SECRET = "cor6-unit-test-secret";

function studentUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "student@example.com",
    role: "STUDENT",
    mustChangePassword: false,
    passwordHash: "synthetic-hash",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  bcryptMock.compare.mockResolvedValue(true);
});

describe("AuthService.login Student role (COR-6: Student Number + password)", () => {
  it("requires a Student Number", async () => {
    const svc = new AuthService();
    await expect(
      svc.login({ role: "student", password: "pw" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.findStudentByStudentNumber).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only Student Number", async () => {
    const svc = new AuthService();
    await expect(
      svc.login({ role: "student", studentNumber: "   ", password: "pw" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.findStudentByStudentNumber).not.toHaveBeenCalled();
  });

  it("trims the Student Number before lookup", async () => {
    repo.findStudentByStudentNumber.mockResolvedValue({ user: studentUser() });
    const svc = new AuthService();
    await svc.login({
      role: "student",
      studentNumber: "  2026-0001  ",
      password: "pw",
    });
    expect(repo.findStudentByStudentNumber).toHaveBeenCalledWith("2026-0001");
  });

  it("does not require or forward a legacy birthdate field", async () => {
    repo.findStudentByStudentNumber.mockResolvedValue({ user: studentUser() });
    const svc = new AuthService();

    await expect(
      svc.login({
        role: "student",
        studentNumber: "2026-0001",
        password: "pw",
        birthdate: "1990-01-01",
      } as never),
    ).resolves.toBeTruthy();

    expect(repo.findStudentByStudentNumber).toHaveBeenCalledWith("2026-0001");
  });

  it("authenticates with the linked User when the role is STUDENT", async () => {
    repo.findStudentByStudentNumber.mockResolvedValue({
      id: "student-1",
      studentNumber: "2026-0001",
      user: studentUser(),
    });
    const svc = new AuthService();

    const result = await svc.login({
      role: "student",
      studentNumber: "2026-0001",
      password: "secret-pw",
    });

    expect(bcryptMock.compare).toHaveBeenCalledWith(
      "secret-pw",
      "synthetic-hash",
    );
    expect(result.token).toBe("synthetic-token");
    expect(result.user.role).toBe("STUDENT");
  });

  it("fails with 401 for a wrong password", async () => {
    repo.findStudentByStudentNumber.mockResolvedValue({ user: studentUser() });
    bcryptMock.compare.mockResolvedValue(false);
    const svc = new AuthService();

    await expect(
      svc.login({ role: "student", studentNumber: "2026-0001", password: "wrong" }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("fails with 401 for an unknown Student Number", async () => {
    repo.findStudentByStudentNumber.mockResolvedValue(null);
    const svc = new AuthService();

    await expect(
      svc.login({ role: "student", studentNumber: "2026-9999", password: "pw" }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a Student Number linked to a non-STUDENT user", async () => {
    repo.findStudentByStudentNumber.mockResolvedValue({
      user: studentUser({ role: "APPLICANT" }),
    });
    const svc = new AuthService();

    await expect(
      svc.login({ role: "student", studentNumber: "2026-0001", password: "pw" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(bcryptMock.compare).not.toHaveBeenCalled();
  });
});

describe("AuthService.login Applicant + staff roles (regression)", () => {
  it("allows an APPLICANT to log in before promotion", async () => {
    repo.findStudentByApplicantId.mockResolvedValue({
      user: studentUser({ role: "APPLICANT" }),
    });
    const svc = new AuthService();

    const result = await svc.login({
      role: "applicant",
      applicantId: "APP-1",
      password: "pw",
    });

    expect(repo.findStudentByApplicantId).toHaveBeenCalledWith("APP-1");
    expect(result.user.role).toBe("APPLICANT");
  });

  it("rejects a promoted STUDENT through the Applicant portal", async () => {
    repo.findStudentByApplicantId.mockResolvedValue({
      user: studentUser({ role: "STUDENT" }),
    });
    const svc = new AuthService();

    await expect(
      svc.login({ role: "applicant", applicantId: "APP-1", password: "pw" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("requires an Applicant ID for Applicant login", async () => {
    const svc = new AuthService();
    await expect(
      svc.login({ role: "applicant", password: "pw" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("keeps Admin/Panelist/Other on the email + password path", async () => {
    for (const role of ["admin", "panelist", "other"]) {
      vi.clearAllMocks();
      bcryptMock.compare.mockResolvedValue(true);
      repo.findUserByEmail.mockResolvedValue(
        studentUser({ role: role.toUpperCase() }),
      );
      const svc = new AuthService();

      const result = await svc.login({
        role,
        email: `${role}@example.com`,
        password: "pw",
      });

      expect(repo.findUserByEmail).toHaveBeenCalledWith(`${role}@example.com`);
      expect(repo.findStudentByStudentNumber).not.toHaveBeenCalled();
      expect(result.user.role).toBe(role.toUpperCase());
    }
  });
});
