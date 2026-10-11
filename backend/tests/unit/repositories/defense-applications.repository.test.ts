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
