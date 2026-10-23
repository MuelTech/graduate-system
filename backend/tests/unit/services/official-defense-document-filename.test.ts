import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import {
  officialDefenseDocumentFilename,
  sanitizeOfficialNamePart,
} from "../../../src/services/official-defense-document-filename";
import { OfficialDefenseRecordService } from "../../../src/services/official-defense-record.service";
import { OfficialDefenseDocumentService } from "../../../src/services/official-defense-document.service";
import { AppError } from "../../../src/utils/AppError";

const KINDS = ["application", "evaluations", "summary"] as const;

describe("officialDefenseDocumentFilename", () => {
  it.each([
    ["TITLE_DEFENSE", "Title-Defense"],
    ["PROPOSAL_DEFENSE", "Proposal-Defense"],
    ["FINAL_DEFENSE", "Final-Defense"],
  ] as const)("uses readable stage wording for %s", (defenseType, stage) => {
    expect(
      officialDefenseDocumentFilename("Juan Dela Cruz", defenseType, "application"),
    ).toBe(`Juan-Dela-Cruz-${stage}-Application.pdf`);
  });

  it.each([
    ["application", "Application"],
    ["evaluations", "Individual-Evaluations"],
    ["summary", "Oral-Examination-Summary"],
  ] as const)("uses the canonical document suffix for %s", (kind, suffix) => {
    expect(
      officialDefenseDocumentFilename("Juan Dela Cruz", "TITLE_DEFENSE", kind),
    ).toBe(`Juan-Dela-Cruz-Title-Defense-${suffix}.pdf`);
  });

  it("produces all nine canonical stage/document filenames", () => {
    const expected = {
      TITLE_DEFENSE: "Title-Defense",
      PROPOSAL_DEFENSE: "Proposal-Defense",
      FINAL_DEFENSE: "Final-Defense",
    } as const;
    for (const [defenseType, stage] of Object.entries(expected)) {
      expect(
        officialDefenseDocumentFilename("Juan Dela Cruz", defenseType, "application"),
      ).toBe(`Juan-Dela-Cruz-${stage}-Application.pdf`);
      expect(
        officialDefenseDocumentFilename("Juan Dela Cruz", defenseType, "evaluations"),
      ).toBe(`Juan-Dela-Cruz-${stage}-Individual-Evaluations.pdf`);
      expect(
        officialDefenseDocumentFilename("Juan Dela Cruz", defenseType, "summary"),
      ).toBe(`Juan-Dela-Cruz-${stage}-Oral-Examination-Summary.pdf`);
    }
  });

  it("fails closed for an unsupported defense stage", () => {
    try {
      officialDefenseDocumentFilename("Juan Dela Cruz", "COMPREHENSIVE_EXAM", "summary");
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(422);
      expect((error as AppError).message).toMatch(/defense stage/i);
    }
  });

  it("never exposes a schedule UUID in a normal filename", () => {
    const name = officialDefenseDocumentFilename(
      "Juan Dela Cruz",
      "TITLE_DEFENSE",
      "evaluations",
    );
    expect(name).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });
});

describe("sanitizeOfficialNamePart", () => {
  it.each([
    ["Juan Dela Cruz", "Juan-Dela-Cruz"],
    ["  Juan   Dela   Cruz  ", "Juan-Dela-Cruz"],
    ["Ma. Juan Dela Cruz", "Ma-Juan-Dela-Cruz"],
    ["Juan Dela-Cruz", "Juan-Dela-Cruz"],
    ["O'Neil Santos", "O-Neil-Santos"],
    ["María José Dela Cruz", "Maria-Jose-Dela-Cruz"],
    ["Dela Cruz / Jr.", "Dela-Cruz-Jr"],
    ["../../etc/passwd", "etc-passwd"],
    ["Juan\r\nDela\tCruz", "Juan-Dela-Cruz"],
    ["   ", "Student"],
    [null, "Student"],
    ["!!!", "Student"],
  ])("sanitizes %j to %j", (input, expected) => {
    expect(sanitizeOfficialNamePart(input)).toBe(expected);
  });

  it("keeps the student part bounded and free of unsafe characters", () => {
    const value = sanitizeOfficialNamePart("A".repeat(300));
    expect(value.length).toBeLessThanOrEqual(60);
    expect(value).toMatch(/^[A-Za-z0-9-]+$/);
    expect(value).not.toMatch(/[\\/:*?"<>|\r\n]/);
    expect(value).not.toContain("..");
  });
});

describe("OfficialDefenseRecordService.getOfficialDocumentIdentity", () => {
  const records = new OfficialDefenseRecordService();

  beforeEach(() => vi.clearAllMocks());

  it("rejects non-Admin actors before reading the schedule", async () => {
    try {
      await records.getOfficialDocumentIdentity("sched-1", {
        userId: "u1",
        role: "PANELIST",
      });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(403);
    }
    expect(prismaMock.defenseSchedule.findUnique).not.toHaveBeenCalled();
  });

  it("uses the exact schedule student identity and defense stage", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      id: "sched-1",
      defenseType: "PROPOSAL_DEFENSE",
      thesis: {
        student: {
          user: { firstName: "Juan", lastName: "Dela Cruz" },
        },
      },
    });

    const identity = await records.getOfficialDocumentIdentity("sched-1", {
      userId: "admin-1",
      role: "ADMIN",
    });

    expect(identity).toEqual({
      scheduleId: "sched-1",
      defenseType: "PROPOSAL_DEFENSE",
      studentName: "Juan Dela Cruz",
    });
    expect(prismaMock.defenseSchedule.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sched-1" } }),
    );
  });

  it("rejects a missing schedule", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(null);
    await expect(
      records.getOfficialDocumentIdentity("sched-404", {
        userId: "admin-1",
        role: "ADMIN",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns a null student name when identity is absent (filename policy falls back)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      id: "sched-1",
      defenseType: "TITLE_DEFENSE",
      thesis: { student: null },
    });

    const identity = await records.getOfficialDocumentIdentity("sched-1", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(identity.studentName).toBeNull();
    expect(
      officialDefenseDocumentFilename(identity.studentName, identity.defenseType, "summary"),
    ).toBe("Student-Title-Defense-Oral-Examination-Summary.pdf");
  });
});

describe("OfficialDefenseDocumentService.buildOfficialDocumentFilename", () => {
  const actor = { userId: "admin-1", role: "ADMIN" };

  it("uses the exact-schedule identity source and canonical policy", async () => {
    const getOfficialDocumentIdentity = vi.fn().mockResolvedValue({
      scheduleId: "sched-1",
      defenseType: "FINAL_DEFENSE",
      studentName: "María José Dela Cruz",
    });
    const service = new OfficialDefenseDocumentService({
      filenameSource: { getOfficialDocumentIdentity },
    });

    const filename = await service.buildOfficialDocumentFilename(
      "sched-1",
      "evaluations",
      actor,
    );

    expect(getOfficialDocumentIdentity).toHaveBeenCalledWith("sched-1", actor);
    expect(filename).toBe(
      "Maria-Jose-Dela-Cruz-Final-Defense-Individual-Evaluations.pdf",
    );
  });

  it("rejects non-Admin actors before reading identity", async () => {
    const getOfficialDocumentIdentity = vi.fn();
    const service = new OfficialDefenseDocumentService({
      filenameSource: { getOfficialDocumentIdentity },
    });

    await expect(
      service.buildOfficialDocumentFilename("sched-1", "summary", {
        userId: "u1",
        role: "PANELIST",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(getOfficialDocumentIdentity).not.toHaveBeenCalled();
  });
});
