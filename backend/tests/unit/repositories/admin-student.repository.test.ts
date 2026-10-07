import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  student: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { AdminStudentRepository } from "../../../src/repositories/admin-student.repository";

const REGISTRY_SCOPE = ["ENROLLED", "GRADUATED", "DISMISSED"];

function studentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    studentNumber: "2026-00123",
    admissionStatus: "ENROLLED",
    programId: "prog-1",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    enrollmentDate: null,
    user: { firstName: "Juan", lastName: "Dela Cruz", email: "juan@example.com" },
    program: { id: "prog-1", programName: "MSIT" },
    thesisRecords: [{ stage: "PROPOSAL", status: "APPROVED" }],
    compExamRecords: [{ status: "PASSED" }],
    adviserAssignments: [],
    ...overrides,
  };
}

function whereOf(mock: { mock: { calls: unknown[][] } }) {
  return (mock.mock.calls[0][0] as { where: Record<string, unknown> }).where;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.student.findMany.mockResolvedValue([]);
  prismaMock.student.count.mockResolvedValue(0);
});

describe("AdminStudentRepository registry scope", () => {
  it("defaults to ENROLLED, GRADUATED and DISMISSED only", async () => {
    const repo = new AdminStudentRepository();

    await repo.findStudents({});
    await repo.countStudents({});

    expect(whereOf(prismaMock.student.findMany).admissionStatus).toEqual({
      in: REGISTRY_SCOPE,
    });
    expect(whereOf(prismaMock.student.count).admissionStatus).toEqual({
      in: REGISTRY_SCOPE,
    });
  });

  it("accepts each supported Student Status filter", async () => {
    const repo = new AdminStudentRepository();
    for (const status of REGISTRY_SCOPE) {
      prismaMock.student.findMany.mockClear();
      await repo.findStudents({ status });
      expect(whereOf(prismaMock.student.findMany).admissionStatus).toEqual({
        in: [status],
      });
    }
  });

  it("never lets APPLICANT (or unsupported values) into the registry", async () => {
    const repo = new AdminStudentRepository();
    for (const status of ["APPLICANT", "ON_LEAVE", "bogus", ""]) {
      prismaMock.student.findMany.mockClear();
      await repo.findStudents({ status });
      const admissionStatus = whereOf(prismaMock.student.findMany)
        .admissionStatus as { in: string[] };
      expect(admissionStatus).toEqual({ in: REGISTRY_SCOPE });
      expect(admissionStatus.in).not.toContain("APPLICANT");
    }
  });
});

describe("AdminStudentRepository filtering", () => {
  it("filters programs by exact id", async () => {
    const repo = new AdminStudentRepository();
    await repo.findStudents({ program: "prog-9" });
    expect(whereOf(prismaMock.student.findMany).programId).toBe("prog-9");
  });

  it("searches name, email and student number", async () => {
    const repo = new AdminStudentRepository();
    await repo.findStudents({ search: "juan" });
    expect(whereOf(prismaMock.student.findMany).OR).toEqual([
      { user: { firstName: { contains: "juan" } } },
      { user: { lastName: { contains: "juan" } } },
      { user: { email: { contains: "juan" } } },
      { studentNumber: { contains: "juan" } },
    ]);
  });

  it("applies pagination and deterministic ordering", async () => {
    const repo = new AdminStudentRepository();
    await repo.findStudents({ page: 3, pageSize: 10 });

    const args = prismaMock.student.findMany.mock.calls[0][0] as {
      skip: number;
      take: number;
      orderBy: unknown;
    };
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });
});

describe("AdminStudentRepository projection", () => {
  it("distinguishes a missing comprehensive exam from a persisted PENDING record", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      studentRow({ id: "s-none", compExamRecords: [] }),
      studentRow({ id: "s-pending", compExamRecords: [{ status: "PENDING" }] }),
    ]);

    const rows = await new AdminStudentRepository().findStudents({});

    expect(rows[0].compExamStatus).toBe("NOT_RECORDED");
    expect(rows[1].compExamStatus).toBe("PENDING");
  });

  it("reports missing thesis data as NONE without inferring completion", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      studentRow({ id: "s-none", thesisRecords: [] }),
      studentRow({ id: "s-final", thesisRecords: [{ stage: "FINAL", status: "PASSED" }] }),
    ]);

    const rows = await new AdminStudentRepository().findStudents({});

    expect(rows[0].thesisStage).toBe("NONE");
    expect(rows[0].thesisStatus).toBe("NONE");
    expect(rows[1].thesisStage).toBe("FINAL");
    expect(rows[1].thesisStatus).toBe("PASSED");
  });

  it("returns the authoritative admission status and identity", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      studentRow({ admissionStatus: "GRADUATED" }),
    ]);

    const rows = await new AdminStudentRepository().findStudents({});

    expect(rows[0]).toMatchObject({
      id: "s1",
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "juan@example.com",
      studentNumber: "2026-00123",
      admissionStatus: "GRADUATED",
      program: { id: "prog-1", programName: "MSIT" },
    });
  });
});

function detailStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    studentNumber: "2026-00123",
    cellphone: "+639170000000",
    dateOfBirth: new Date("1998-01-15T00:00:00.000Z"),
    admissionStatus: "ENROLLED",
    enrollmentDate: new Date("2026-06-01T00:00:00.000Z"),
    curriculumType: "NEW",
    alignmentStatus: "ALIGNED",
    residencyStartDate: null,
    userId: "u1",
    user: { firstName: "Juan", lastName: "Dela Cruz", email: "juan@example.com" },
    program: { id: "prog-1", programName: "MSIT" },
    compExamRecords: [],
    adviserAssignments: [],
    residencyTracking: null,
    ...overrides,
  };
}

describe("AdminStudentRepository.findStudentDetailById", () => {
  it("returns null when the student does not exist", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    expect(
      await new AdminStudentRepository().findStudentDetailById("missing"),
    ).toBeNull();
  });

  it("maps an explicit detail DTO and reports missing records honestly", async () => {
    prismaMock.student.findUnique.mockResolvedValue(detailStudent());

    const detail = await new AdminStudentRepository().findStudentDetailById("s1");

    expect(detail).toMatchObject({
      id: "s1",
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "juan@example.com",
      studentNumber: "2026-00123",
      cellphone: "+639170000000",
      admissionStatus: "ENROLLED",
      curriculumType: "NEW",
      alignmentStatus: "ALIGNED",
      program: { id: "prog-1", programName: "MSIT" },
      compExam: null,
      adviserAssignment: null,
      residency: null,
    });
    expect(detail?.dateOfBirth).toBe("1998-01-15T00:00:00.000Z");
    expect(detail?.enrollmentDate).toBe("2026-06-01T00:00:00.000Z");
  });

  it("reports the latest comprehensive exam status when a record exists", async () => {
    prismaMock.student.findUnique.mockResolvedValue(
      detailStudent({
        compExamRecords: [
          { status: "PASSED", createdAt: new Date("2026-07-01T00:00:00.000Z") },
          { status: "FAILED", createdAt: new Date("2026-05-01T00:00:00.000Z") },
        ],
      }),
    );

    const detail = await new AdminStudentRepository().findStudentDetailById("s1");

    expect(detail?.compExam).toEqual({
      status: "PASSED",
      recordedAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("maps residency and the active adviser assignment", async () => {
    prismaMock.student.findUnique.mockResolvedValue(
      detailStudent({
        residencyTracking: {
          startDate: new Date("2026-06-01T00:00:00.000Z"),
          maxYears: 5,
        },
        adviserAssignments: [
          {
            assignedDate: new Date("2026-08-01T00:00:00.000Z"),
            adviser: { id: "adv-1", firstName: "Maria", lastName: "Santos" },
          },
        ],
      }),
    );

    const detail = await new AdminStudentRepository().findStudentDetailById("s1");

    expect(detail?.residency).toEqual({
      startDate: "2026-06-01T00:00:00.000Z",
      maxYears: 5,
    });
    expect(detail?.adviserAssignment).toEqual({
      adviserId: "adv-1",
      adviserName: "Maria Santos",
      assignedDate: "2026-08-01T00:00:00.000Z",
    });
  });
});

describe("AdminStudentRepository.findStudentUserId", () => {
  it("returns the owning user id or null", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u1" });
    expect(await new AdminStudentRepository().findStudentUserId("s1")).toBe("u1");

    prismaMock.student.findUnique.mockResolvedValue(null);
    expect(await new AdminStudentRepository().findStudentUserId("s1")).toBeNull();
  });
});
