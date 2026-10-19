import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  thesisRecord: { findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DefenseApplicationsRepository } from "../../../src/repositories/defense-applications.repository";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.thesisRecord.findUnique.mockResolvedValue(null);
});

/**
 * UIUX-2K: the ADMIN application-detail read model is read-only and must reuse
 * the exact same authoritative projection as the paginated list.
 */
describe("DefenseApplicationsRepository.getDefenseApplicationById", () => {
  it("returns null for an empty id without querying", async () => {
    const repo = new DefenseApplicationsRepository();

    const result = await repo.getDefenseApplicationById("");

    expect(result).toBeNull();
    expect(prismaMock.thesisRecord.findUnique).not.toHaveBeenCalled();
  });

  it("looks up exactly one ThesisRecord by id with the shared projection", async () => {
    const repo = new DefenseApplicationsRepository();

    await repo.getDefenseApplicationById("t1");

    const arg = prismaMock.thesisRecord.findUnique.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "t1" });
    expect(arg.include.student.include.user.select).toEqual({
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    });
    expect(arg.include.thesisTitles.select).toEqual({
      id: true,
      titleText: true,
      isSelected: true,
    });
    // Certifications remain stage-scoped + ISSUED-only: no policy duplication.
    expect(arg.include.adviserCertifications.where.status).toBe("ISSUED");
    // ADV-1: current Adviser comes from the Student's active AdviserAssignment,
    // not from the legacy ThesisRecord.assignment relation.
    expect(arg.include.student.include.adviserAssignments).toEqual({
      where: { isActive: true },
      select: {
        id: true,
        adviserId: true,
        adviser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  });

  it("returns null when no matching application exists (not an error)", async () => {
    const repo = new DefenseApplicationsRepository();
    prismaMock.thesisRecord.findUnique.mockResolvedValue(null);

    await expect(repo.getDefenseApplicationById("missing")).resolves.toBeNull();
  });

  it("maps a found row through the authoritative application projection", async () => {
    const repo = new DefenseApplicationsRepository();
    prismaMock.thesisRecord.findUnique.mockResolvedValue({
      id: "t1",
      stage: "PROPOSAL",
      status: "PENDING",
      outcome: null,
      rejectionReason: null,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      student: {
        programId: "p1",
        studentNumber: "2026-001",
        user: {
          id: "u1",
          firstName: "Ana",
          lastName: "Cruz",
          email: "ana@example.com",
        },
        program: { id: "p1", programName: "MS IT", programType: "MASTERS" },
      },
      thesisTitles: [],
      thesisDocuments: [],
      assignment: null,
      defenseSchedules: [],
    } as never);

    const result = await repo.getDefenseApplicationById("t1");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("t1");
    expect(result!.thesisId).toBe("t1");
    expect(result!.stage).toBe("PROPOSAL");
    expect(result!.rawApplicationStatus).toBe("PENDING");
    expect(result!.thesisDocuments).toEqual([]);
  });
});

/**
 * ADV-1: the Scheduling/Defense Applications projection must resolve the
 * current Adviser from the Student's active AdviserAssignment. ThesisRecord
 * assignment data remains legacy compatibility only.
 */
describe("DefenseApplicationsRepository current active Adviser projection", () => {
  function applicationRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "t1",
      stage: "PROPOSAL",
      status: "APPROVED",
      outcome: null,
      rejectionReason: null,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      student: {
        programId: "p1",
        studentNumber: "2026-001",
        user: {
          id: "student-user",
          firstName: "Ana",
          lastName: "Cruz",
          email: "ana@example.com",
        },
        program: { id: "p1", programName: "MS IT", programType: "MASTERS" },
        adviserAssignments: [],
      },
      thesisTitles: [],
      thesisDocuments: [],
      adviserCertifications: [],
      assignment: null,
      defenseSchedules: [],
      ...overrides,
    } as never;
  }

  function activeAssignment(
    id: string,
    adviserId: string,
    firstName: string,
    lastName: string,
  ) {
    return {
      id,
      adviserId,
      adviser: { id: adviserId, firstName, lastName },
    };
  }

  it("exposes the active Adviser when ThesisRecord.assignmentId is null", async () => {
    const repo = new DefenseApplicationsRepository();
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      applicationRow({
        student: {
          programId: "p1",
          studentNumber: "2026-001",
          user: {
            id: "student-user",
            firstName: "Ana",
            lastName: "Cruz",
            email: "ana@example.com",
          },
          program: { id: "p1", programName: "MS IT", programType: "MASTERS" },
          adviserAssignments: [
            activeAssignment("asg-1", "adviser-new", "Liza", "Ramos"),
          ],
        },
        assignment: null,
      }),
    );

    const result = await repo.getDefenseApplicationById("t1");

    expect(result!.assignment).toBeNull();
    expect(result!.activeAdviser).toEqual({
      assignmentId: "asg-1",
      userId: "adviser-new",
      firstName: "Liza",
      lastName: "Ramos",
    });
    expect(result!.activeAdviserConflict).toBe(false);
  });

  it("prefers the active AdviserAssignment over a stale legacy assignment relation", async () => {
    const repo = new DefenseApplicationsRepository();
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      applicationRow({
        student: {
          programId: "p1",
          studentNumber: "2026-001",
          user: {
            id: "student-user",
            firstName: "Ana",
            lastName: "Cruz",
            email: "ana@example.com",
          },
          program: { id: "p1", programName: "MS IT", programType: "MASTERS" },
          adviserAssignments: [
            activeAssignment("asg-new", "adviser-current", "Liza", "Ramos"),
          ],
        },
        assignment: {
          adviser: {
            id: "adviser-legacy",
            firstName: "Old",
            lastName: "Adviser",
          },
        },
      }),
    );

    const result = await repo.getDefenseApplicationById("t1");

    expect(result!.activeAdviser?.userId).toBe("adviser-current");
    // Legacy data is preserved for other consumers, but is not the authority.
    expect(
      (result!.assignment as { adviser: { id: string } }).adviser.id,
    ).toBe("adviser-legacy");
  });

  it("keeps the Adviser empty when the Student has no active AdviserAssignment", async () => {
    const repo = new DefenseApplicationsRepository();
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      applicationRow({
        student: {
          programId: "p1",
          studentNumber: "2026-001",
          user: {
            id: "student-user",
            firstName: "Ana",
            lastName: "Cruz",
            email: "ana@example.com",
          },
          program: { id: "p1", programName: "MS IT", programType: "MASTERS" },
          adviserAssignments: [],
        },
      }),
    );

    const result = await repo.getDefenseApplicationById("t1");

    expect(result!.activeAdviser).toBeNull();
    expect(result!.activeAdviserConflict).toBe(false);
  });

  it("fails closed (no arbitrary Adviser) when duplicate active assignments exist", async () => {
    const repo = new DefenseApplicationsRepository();
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      applicationRow({
        student: {
          programId: "p1",
          studentNumber: "2026-001",
          user: {
            id: "student-user",
            firstName: "Ana",
            lastName: "Cruz",
            email: "ana@example.com",
          },
          program: { id: "p1", programName: "MS IT", programType: "MASTERS" },
          adviserAssignments: [
            activeAssignment("asg-1", "adviser-a", "First", "Adviser"),
            activeAssignment("asg-2", "adviser-b", "Second", "Adviser"),
          ],
        },
      }),
    );

    const result = await repo.getDefenseApplicationById("t1");

    expect(result!.activeAdviser).toBeNull();
    expect(result!.activeAdviserConflict).toBe(true);
  });

  it("still projects an existing active Adviser for TITLE (Scheduling must ignore it)", async () => {
    const repo = new DefenseApplicationsRepository();
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      applicationRow({
        stage: "TITLE",
        student: {
          programId: "p1",
          studentNumber: "2026-001",
          user: {
            id: "student-user",
            firstName: "Ana",
            lastName: "Cruz",
            email: "ana@example.com",
          },
          program: { id: "p1", programName: "MS IT", programType: "MASTERS" },
          adviserAssignments: [
            activeAssignment("asg-1", "adviser-a", "First", "Adviser"),
          ],
        },
      }),
    );

    const result = await repo.getDefenseApplicationById("t1");

    expect(result!.stage).toBe("TITLE");
    expect(result!.activeAdviser?.userId).toBe("adviser-a");
  });
});
