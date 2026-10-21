import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  adviserAssignment: { findMany: vi.fn() },
  student: { findUnique: vi.fn() },
  thesisDocument: { findMany: vi.fn() },
  defenseSchedule: { findMany: vi.fn() },
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

  it("loads all active rows for candidate Student ids in one bounded query", async () => {
    prismaMock.adviserAssignment.findMany.mockResolvedValue([]);

    await repo.listActiveAdviserAssignmentsForStudents([
      "student-1",
      "student-2",
      "student-1",
    ]);

    const args = prismaMock.adviserAssignment.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      studentId: { in: ["student-1", "student-2"] },
      isActive: true,
    });
    expect(args.select).toEqual({
      id: true,
      studentId: true,
      adviserId: true,
      assignedDate: true,
    });
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

  it("queries only academic research document types with safe metadata", async () => {
    prismaMock.thesisDocument.findMany.mockResolvedValue([]);

    await repo.listAdviserResearchDocuments("thesis-1");

    const args = prismaMock.thesisDocument.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      thesisId: "thesis-1",
      docType: {
        in: ["TITLE_PROPOSAL", "PROPOSAL_CHAPTERS", "FINAL_MANUSCRIPT"],
      },
    });
    expect(args.select).toEqual({
      id: true,
      docType: true,
      defenseStage: true,
      uploadedAt: true,
      isCurrent: true,
      supersedesDocumentId: true,
    });
    expect(JSON.stringify(args.select)).not.toMatch(
      /filePath|storageKey|checksum|storageProvider|signatureData|evaluator/i,
    );
  });

  it("queries only concluded same-thesis attempts and FINALIZED reports", async () => {
    prismaMock.defenseSchedule.findMany.mockResolvedValue([]);

    await repo.listAdviserDefenseHistory("thesis-1");

    const args = prismaMock.defenseSchedule.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      thesisId: "thesis-1",
      conclusion: { isNot: null },
    });
    expect(args.select.rapReports).toMatchObject({
      where: { status: "FINALIZED" },
      take: 1,
    });
    expect(JSON.stringify(args.select)).not.toMatch(
      /signatureData|signature|oralExamScore|criteria|panelAssignments|teacher|adviser/i,
    );
  });
});
