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
    dateOfBirth: null,
    pinnacleApplicantId: "PIN-1",
    alignmentStatus: "ALIGNED",
    program: { id: "prog-1", programName: "MSIT", programType: "MASTERS" },
    undergraduateProgram: { id: "ug-1", programName: "BSIT" },
    previousMastersProgram: null,
    bridgingWaiver: null,
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
  it("exposes the Master's program type and the undergraduate prerequisite relation", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        program: { id: "prog-1", programName: "MSIT", programType: "MASTERS" },
        undergraduateProgram: { id: "ug-1", programName: "BSIT" },
        previousMastersProgram: null,
      }),
    );

    const detail = await new AdminApplicantService().getApplicantDetail("s1");

    expect(detail.program).toEqual({
      id: "prog-1",
      programName: "MSIT",
      programType: "MASTERS",
    });
    expect(detail.undergraduateProgram).toEqual({
      id: "ug-1",
      programName: "BSIT",
    });
    expect(detail.previousMastersProgram).toBeNull();
  });

  it("exposes the Doctoral program type and the previous Master's relation, not an undergraduate one", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        program: { id: "prog-2", programName: "DBA", programType: "DOCTORAL" },
        undergraduateProgram: null,
        previousMastersProgram: { id: "prog-1", programName: "MSIT" },
      }),
    );

    const detail = await new AdminApplicantService().getApplicantDetail("s1");

    expect(detail.program?.programType).toBe("DOCTORAL");
    expect(detail.previousMastersProgram).toEqual({
      id: "prog-1",
      programName: "MSIT",
    });
    expect(detail.undergraduateProgram).toBeNull();
  });
});

describe("AdminApplicantService alignment + admission stage", () => {
  it("keeps missing alignment authority as null/fail-closed instead of defaulting to ALIGNED", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({ alignmentStatus: null }),
    );

    const detail = await new AdminApplicantService().getApplicantDetail("s1");

    expect(detail.alignmentStatus).toBeNull();
    expect(detail.alignmentStatus).not.toBe("ALIGNED");
  });

  it("stays in Program Alignment when alignment is incomplete even with a historical PASSED exam", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        alignmentStatus: "PENDING_WAIVER",
        examApplications: [examApp({ status: "PASSED" })],
      }),
    );

    const detail = await new AdminApplicantService().getApplicantDetail("s1");

    expect(detail.admissionStage).toBe("ALIGNMENT");
    expect(detail.hasPassedExam).toBe(true);
  });

  it("derives Entrance Examination when alignment is complete and no authoritative PASSED exam exists", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        alignmentStatus: "ALIGNED",
        examApplications: [examApp({ status: "APPROVED" })],
      }),
    );

    const detail = await new AdminApplicantService().getApplicantDetail("s1");

    expect(detail.admissionStage).toBe("EXAM");
    expect(detail.hasPassedExam).toBe(false);
  });

  it("derives COR / Enrollment when alignment is complete and an authoritative PASSED exam exists", async () => {
    repo.findStudentById.mockResolvedValue(
      detailStudent({
        alignmentStatus: "CLEARED",
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
