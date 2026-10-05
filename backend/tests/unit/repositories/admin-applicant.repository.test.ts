import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  student: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { AdminApplicantRepository } from "../../../src/repositories/admin-applicant.repository";
import { buildApplicantListWhere } from "../../../src/services/admin-applicant-list.rules";

function studentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    admissionStatus: "APPLICANT",
    pinnacleApplicantId: "PIN-1",
    alignmentStatus: "ALIGNED",
    programId: "prog-1",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    user: { firstName: "Ana", lastName: "Dela", email: "ana@example.com" },
    program: { id: "prog-1", programName: "MSIT" },
    examApplications: [],
    corUploads: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminApplicantRepository active scope + filtering", () => {
  it("counts with the active-Applicant where clause (fails closed on role/status)", async () => {
    prismaMock.student.count.mockResolvedValue(0);
    const repo = new AdminApplicantRepository();

    await repo.countApplicants({ programId: "prog-1", stage: "COR" });

    expect(prismaMock.student.count).toHaveBeenCalledWith({
      where: buildApplicantListWhere({ programId: "prog-1", stage: "COR" }),
    });
  });

  it("filters the same dataset it counts (find + count share the where clause)", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    const repo = new AdminApplicantRepository();
    const filters = { search: "ana", programId: "prog-3", stage: "EXAM" as const };

    await repo.findApplicants(filters);
    await repo.countApplicants(filters);

    const findWhere = prismaMock.student.findMany.mock.calls[0][0].where;
    const countWhere = prismaMock.student.count.mock.calls[0][0].where;
    expect(findWhere).toEqual(buildApplicantListWhere(filters));
    expect(countWhere).toEqual(buildApplicantListWhere(filters));
  });

  it("selects the current related exam/COR rows deterministically (createdAt desc, id desc)", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    const repo = new AdminApplicantRepository();

    await repo.findApplicants({ page: 1, pageSize: 10 });

    const args = prismaMock.student.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.include.examApplications.orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(args.include.corUploads.orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(args.include.corUploads.take).toBe(1);
  });
});

describe("AdminApplicantRepository list projection", () => {
  it("maps a fail-closed row: missing alignment + historical PASSED + latest DISQUALIFIED", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      studentRow({
        alignmentStatus: null,
        examApplications: [
          { id: "e2", status: "DISQUALIFIED", createdAt: new Date("2026-02-01") },
          { id: "e1", status: "PASSED", createdAt: new Date("2026-01-15") },
        ],
        corUploads: [{ id: "c1", status: "PENDING", createdAt: new Date("2026-03-01") }],
      }),
    ]);
    const repo = new AdminApplicantRepository();

    const rows = await repo.findApplicants({ page: 1, pageSize: 10 });

    expect(rows).toEqual([
      {
        id: "s1",
        firstName: "Ana",
        lastName: "Dela",
        email: "ana@example.com",
        pinnacleApplicantId: "PIN-1",
        program: { id: "prog-1", programName: "MSIT" },
        alignmentStatus: null,
        admissionStage: "ALIGNMENT",
        examStatus: "DISQUALIFIED",
        hasPassedExam: true,
        corStatus: "PENDING",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });

  it("keeps an unsuccessful exam in the Entrance Examination stage (DISQUALIFIED is an exam state, not COR)", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      studentRow({
        alignmentStatus: "ALIGNED",
        examApplications: [
          { id: "e1", status: "DISQUALIFIED", createdAt: new Date("2026-02-01") },
        ],
        corUploads: [],
      }),
    ]);
    const repo = new AdminApplicantRepository();

    const rows = await repo.findApplicants({ page: 1, pageSize: 10 });

    expect(rows[0].admissionStage).toBe("EXAM");
    expect(rows[0].examStatus).toBe("DISQUALIFIED");
    expect(rows[0].hasPassedExam).toBe(false);
    expect(rows[0].corStatus).toBe("NONE");
  });

  it("classifies a passed exam as COR / Enrollment and surfaces the current COR state", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      studentRow({
        alignmentStatus: "CLEARED",
        examApplications: [
          { id: "e1", status: "PASSED", createdAt: new Date("2026-02-01") },
        ],
        corUploads: [{ id: "c1", status: "REJECTED", createdAt: new Date("2026-03-01") }],
      }),
    ]);
    const repo = new AdminApplicantRepository();

    const rows = await repo.findApplicants({ page: 1, pageSize: 10 });

    expect(rows[0].admissionStage).toBe("COR");
    expect(rows[0].hasPassedExam).toBe(true);
    expect(rows[0].corStatus).toBe("REJECTED");
  });
});
