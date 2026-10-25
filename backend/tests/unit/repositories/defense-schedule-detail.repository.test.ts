import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DefenseApplicationsRepository } from "../../../src/repositories/defense-applications.repository";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.defenseSchedule.findUnique.mockResolvedValue(null);
});

/**
 * UIUX-2L FIX-3: the ADMIN exact scheduled-defense read model is read-only,
 * identified by the exact scheduleId, and returns only schedule + committee
 * identity (no academic scoring/RAP authority).
 */
describe("DefenseApplicationsRepository.getScheduledDefenseById", () => {
  it("returns null for an empty id without querying", async () => {
    const repo = new DefenseApplicationsRepository();

    const result = await repo.getScheduledDefenseById("");

    expect(result).toBeNull();
    expect(prismaMock.defenseSchedule.findUnique).not.toHaveBeenCalled();
  });

  it("looks up exactly one DefenseSchedule by id with the schedule+committee projection", async () => {
    const repo = new DefenseApplicationsRepository();

    await repo.getScheduledDefenseById("s1");

    const arg = prismaMock.defenseSchedule.findUnique.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "s1" });
    expect(arg.include.thesis.include.student.include.user.select).toEqual({
      firstName: true,
      lastName: true,
    });
    expect(arg.include.thesis.include.student.include.program.select).toEqual({
      programName: true,
      programType: true,
    });
    expect(arg.include.panelAssignments.where).toEqual({ isActive: true });
    expect(arg.include.panelAssignments.include.user.select).toEqual({
      id: true,
      firstName: true,
      lastName: true,
    });
  });

  it("returns null when no schedule matches (not an error)", async () => {
    const repo = new DefenseApplicationsRepository();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(null);

    await expect(repo.getScheduledDefenseById("missing")).resolves.toBeNull();
  });

  it("maps the exact schedule and committee without academic fields", async () => {
    const repo = new DefenseApplicationsRepository();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      id: "s1",
      thesisId: "t1",
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "SCHEDULED",
      defenseDate: new Date("2026-10-20T00:00:00.000Z"),
      defenseTime: new Date("1970-01-01T14:00:00.000Z"),
      venueOrLink: "GS Conference Room",
      thesis: {
        student: {
          studentNumber: "2026-001",
          user: { firstName: "Maria", lastName: "Santos" },
          program: { programName: "MS IT", programType: "MASTERS" },
        },
      },
      panelAssignments: [
        {
          userId: "u-adviser",
          role: "ADVISER",
          user: { id: "u-adviser", firstName: "Ana", lastName: "Reyes" },
        },
        {
          userId: "u-chair",
          role: "CHAIRMAN",
          user: { id: "u-chair", firstName: "Juan", lastName: "Santos" },
        },
      ],
    } as never);

    const result = await repo.getScheduledDefenseById("s1");

    expect(result).not.toBeNull();
    expect(result!.scheduleId).toBe("s1");
    expect(result!.thesisId).toBe("t1");
    expect(result!.studentName).toBe("Maria Santos");
    expect(result!.studentNumber).toBe("2026-001");
    expect(result!.program).toBe("MS IT");
    expect(result!.programType).toBe("MASTERS");
    expect(result!.defenseType).toBe("PROPOSAL_DEFENSE");
    expect(result!.sessionStatus).toBe("SCHEDULED");
    expect(result!.defenseDate).toBe("2026-10-20T00:00:00.000Z");
    expect(result!.defenseTime).toBe("1970-01-01T14:00:00.000Z");
    expect(result!.venueOrLink).toBe("GS Conference Room");
    expect(result!.committee).toEqual([
      { userId: "u-adviser", name: "Ana Reyes", role: "ADVISER" },
      { userId: "u-chair", name: "Juan Santos", role: "CHAIRMAN" },
    ]);
    // Read-only: no score / result / RAP fields leaked.
    expect(Object.keys(result!)).not.toContain("oralExamScores");
    expect(Object.keys(result!)).not.toContain("conclusion");
  });
});
