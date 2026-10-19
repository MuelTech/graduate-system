import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  adviserAssignment: { findMany: vi.fn() },
  student: { findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { AdviserWorkspaceRepository } from "../../../src/repositories/adviser-workspace.repository";

describe("AdviserWorkspaceRepository", () => {
  const repo = new AdviserWorkspaceRepository();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries only the authenticated adviser's active assignments", async () => {
    prismaMock.adviserAssignment.findMany.mockResolvedValue([]);

    await repo.listActiveAssignmentsForAdviser("adviser-a");

    const args = prismaMock.adviserAssignment.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ adviserId: "adviser-a", isActive: true });
    expect(args.include.student.select).toMatchObject({
      id: true,
      studentNumber: true,
      user: { select: { firstName: true, lastName: true } },
      program: { select: { programName: true } },
      thesisRecords: { take: 1, select: { id: true, stage: true, status: true } },
    });
    // No raw document/COR/evaluator/signature relation is selected.
    expect(JSON.stringify(args.include.student.select)).not.toMatch(
      /thesisDocuments|signatureData|signature_data|evaluator|"cor"|"receipt"/i,
    );
  });

  it("loads only active assignments for exact advisee authorization", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);

    await repo.findStudentForAdviseeDetail("student-1");

    const args = prismaMock.student.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: "student-1" });
    expect(args.select.adviserAssignments).toEqual({
      where: { isActive: true },
      select: { id: true, adviserId: true, assignedDate: true },
    });
    expect(args.select.thesisRecords).toEqual({
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { id: true, stage: true, status: true },
    });
    expect(JSON.stringify(args.select)).not.toMatch(
      /thesisDocuments|signatureData|signature_data|evaluator|"cor"|"receipt"/i,
    );
  });
});
