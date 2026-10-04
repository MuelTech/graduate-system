import { beforeEach, describe, expect, it, vi } from "vitest";

const corRepo = vi.hoisted(() => ({
  getUploadById: vi.fn(),
  checkPassedExam: vi.fn(),
  verifyAndPromote: vi.fn(),
}));

vi.mock("../../../src/repositories/cor.repository", () => ({
  CorRepository: class {
    getUploadById = corRepo.getUploadById;
    checkPassedExam = corRepo.checkPassedExam;
    verifyAndPromote = corRepo.verifyAndPromote;
  },
}));

vi.mock("../../../src/extraction/cor-extraction.service", () => ({
  CorExtractionService: class {
    processUpload = vi.fn(async () => ({ status: "PENDING" }));
  },
}));

vi.mock("../../../src/services/email.service", () => ({
  EmailService: { sendTemplateEmail: vi.fn(async () => undefined) },
}));

const authRepo = vi.hoisted(() => ({
  findStudentByStudentNumber: vi.fn(),
}));

vi.mock("../../../src/repositories/auth.repository", () => ({
  AuthRepository: class {
    findStudentByStudentNumber = authRepo.findStudentByStudentNumber;
  },
}));

const bcryptMock = vi.hoisted(() => ({ compare: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: bcryptMock }));

import { CorService } from "../../../src/services/cor.service";
import { AuthService } from "../../../src/services/auth.service";

process.env.JWT_SECRET = "cor8-unit-test-secret";

/**
 * COR-AUTH cross-package continuity regression.
 *
 * Promotion keeps the SAME User and the SAME password while synchronizing the
 * Admin-confirmed COR profile fields (Name/Email/Program). The Student must then
 * authenticate through Student login using the confirmed Student Number and the
 * SAME original password.
 */
describe("COR-AUTH promotion -> Student login original-password continuity", () => {
  const ORIGINAL_PASSWORD = "synthetic-original-pw";
  const EXISTING_HASH = "synthetic-existing-hash";
  const STUDENT_NUMBER = "2026-GS-00123";
  const CONFIRMED = {
    surname: "Dela Cruz",
    firstName: "Juan",
    middleNameOrInitial: "Santos",
    email: "juan.delacruz@example.com",
    programId: "prog-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bcryptMock.compare.mockResolvedValue(true);
  });

  it("synchronizes the confirmed COR profile fields and still accepts the original password for Student login", async () => {
    // 1. Canonical COR verification/promotion.
    corRepo.getUploadById.mockResolvedValue({
      id: "cor-1",
      status: "PENDING",
      studentId: "student-1",
      student: {
        id: "student-1",
        userId: "user-1",
        admissionStatus: "APPLICANT",
        user: {
          email: "a@b.c",
          firstName: "Ana",
          lastName: "Dela",
          role: "APPLICANT",
          passwordHash: EXISTING_HASH,
        },
      },
    });
    corRepo.checkPassedExam.mockResolvedValue({ id: "exam-1", status: "PASSED" });
    corRepo.verifyAndPromote.mockResolvedValue({ corRecord: { id: "rec-1" } });

    const corService = new CorService();
    await corService.verifyCor("cor-1", "admin-1", {
      studentNumber: STUDENT_NUMBER,
      ...CONFIRMED,
    });

    const forwarded = corRepo.verifyAndPromote.mock.calls[0][3] as Record<
      string,
      unknown
    >;
    expect(forwarded.studentNumber).toBe(STUDENT_NUMBER);
    expect(forwarded.email).toBe(CONFIRMED.email);
    // COR-AUTH-3: the confirmed COR name + Program are forwarded as authority.
    expect(forwarded.firstName).toBe(
      `${CONFIRMED.firstName} ${CONFIRMED.middleNameOrInitial}`,
    );
    expect(forwarded.lastName).toBe(CONFIRMED.surname);
    expect(forwarded.programId).toBe(CONFIRMED.programId);
    // Promotion carries no password material of any kind.
    expect(JSON.stringify(forwarded)).not.toMatch(/password|hash|birthdate|dob/i);

    // 2. Student login after promotion with the ORIGINAL password.
    authRepo.findStudentByStudentNumber.mockResolvedValue({
      id: "student-1",
      studentNumber: STUDENT_NUMBER,
      user: {
        id: "user-1",
        email: "a@b.c",
        role: "STUDENT",
        mustChangePassword: false,
        passwordHash: EXISTING_HASH,
      },
    });

    const authService = new AuthService();
    const result = await authService.login({
      role: "student",
      studentNumber: STUDENT_NUMBER,
      password: ORIGINAL_PASSWORD,
    });

    // The existing password hash is compared against the supplied original
    // password — no password was generated or reset by promotion.
    expect(bcryptMock.compare).toHaveBeenCalledWith(
      ORIGINAL_PASSWORD,
      EXISTING_HASH,
    );
    expect(result.user.role).toBe("STUDENT");
    expect(result.token).toBeTruthy();
  });
});
