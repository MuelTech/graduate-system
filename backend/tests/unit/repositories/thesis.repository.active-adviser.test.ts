import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  adviserAssignment: { findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { ThesisRepository } from "../../../src/repositories/thesis.repository";

/**
 * ADV-1: one canonical active AdviserAssignment. Invalid duplicate rows must
 * fail closed instead of silently resolving to the latest/arbitrary adviser.
 */
describe("ThesisRepository.getActiveAdviserAssignment", () => {
  const repo = new ThesisRepository();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the student has no active adviser", async () => {
    prismaMock.adviserAssignment.findMany.mockResolvedValue([]);

    await expect(repo.getActiveAdviserAssignment("student-1")).resolves.toBeNull();
    expect(prismaMock.adviserAssignment.findMany).toHaveBeenCalledWith({
      where: { studentId: "student-1", isActive: true },
      orderBy: { assignedDate: "desc" },
    });
  });

  it("returns exactly one active adviser", async () => {
    const adviser = {
      id: "asg-1",
      studentId: "student-1",
      adviserId: "adviser-1",
      isActive: true,
    };
    prismaMock.adviserAssignment.findMany.mockResolvedValue([adviser]);

    await expect(repo.getActiveAdviserAssignment("student-1")).resolves.toBe(
      adviser,
    );
  });

  it("fails closed with a conflict when duplicate active advisers exist", async () => {
    prismaMock.adviserAssignment.findMany.mockResolvedValue([
      { id: "asg-1", studentId: "student-1", adviserId: "adviser-a", isActive: true },
      { id: "asg-2", studentId: "student-1", adviserId: "adviser-b", isActive: true },
    ]);

    await expect(repo.getActiveAdviserAssignment("student-1")).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/more than one active adviser/i),
    });
  });
});
