import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/services/cor.service", () => ({
  CorService: class {},
}));

const repo = vi.hoisted(() => ({
  findStudentById: vi.fn(),
}));

vi.mock("../../../src/repositories/admin-applicant.repository", () => ({
  AdminApplicantRepository: class {
    findStudentById = repo.findStudentById;
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
