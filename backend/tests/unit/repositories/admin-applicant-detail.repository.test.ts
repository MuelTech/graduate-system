import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  student: { findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { AdminApplicantRepository } from "../../../src/repositories/admin-applicant.repository";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.student.findUnique.mockResolvedValue(null);
});

describe("AdminApplicantRepository detail read model", () => {
  it("looks up one student by id", async () => {
    const repo = new AdminApplicantRepository();

    await repo.findStudentById("student-9");

    expect(prismaMock.student.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "student-9" } }),
    );
  });

  it("fetches program type and correct academic prerequisite relations", async () => {
    const repo = new AdminApplicantRepository();

    await repo.findStudentById("student-9");

    const include = prismaMock.student.findUnique.mock.calls[0][0].include;
    expect(include.program.select).toEqual({
      id: true,
      programName: true,
      programType: true,
    });
    expect(include.undergraduateProgram.select).toEqual({
      id: true,
      programName: true,
    });
    expect(include.previousMastersProgram.select).toEqual({
      id: true,
      programName: true,
    });
  });

  it("selects related exam and COR rows deterministically (createdAt desc, id desc)", async () => {
    const repo = new AdminApplicantRepository();

    await repo.findStudentById("student-9");

    const include = prismaMock.student.findUnique.mock.calls[0][0].include;
    expect(include.examApplications.orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(include.corUploads.orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });
});
