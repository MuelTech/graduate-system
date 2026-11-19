import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  program: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import {
  AUTHORITATIVE_GRADUATE_PROGRAMS,
  defaultMaxResidencyYears,
  formatCanonicalProgramName,
  formatOfficialProgramDisplay,
  reconcileAuthoritativeGraduatePrograms,
} from "../../../src/config/graduate-programs";
import { ProgramService } from "../../../src/services/program.service";
import { AppError } from "../../../src/utils/AppError";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.program.findMany.mockResolvedValue([]);
  prismaMock.program.findUnique.mockResolvedValue(null);
  prismaMock.program.findFirst.mockResolvedValue(null);
  prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
});

describe("graduate-programs config & helpers", () => {
  it("defines all 16 authoritative Graduate School programs with 4/6-yr MRR", () => {
    expect(AUTHORITATIVE_GRADUATE_PROGRAMS).toHaveLength(16);

    const doctoral = AUTHORITATIVE_GRADUATE_PROGRAMS.filter(
      (p) => p.programType === "DOCTORAL",
    );
    const masters = AUTHORITATIVE_GRADUATE_PROGRAMS.filter(
      (p) => p.programType === "MASTERS",
    );

    expect(doctoral).toHaveLength(4);
    expect(masters).toHaveLength(12);
    expect(doctoral.every((p) => p.maxResidencyYears === 6)).toBe(true);
    expect(masters.every((p) => p.maxResidencyYears === 4)).toBe(true);
    expect(defaultMaxResidencyYears("DOCTORAL")).toBe(6);
    expect(defaultMaxResidencyYears("MASTERS")).toBe(4);
  });

  it("formats canonical display names and official PDF Course/Major labels", () => {
    expect(
      formatCanonicalProgramName({
        degreeName: "Master of Arts in Teaching",
        majorName: "Mathematics",
        programCode: "MAT",
      }),
    ).toBe("Master of Arts in Teaching major in Mathematics (MAT)");

    expect(
      formatCanonicalProgramName({
        degreeName: "Doctor of Public Administration",
        majorName: null,
        programCode: "DPA",
      }),
    ).toBe("Doctor of Public Administration (DPA)");

    expect(
      formatOfficialProgramDisplay({
        programName: "Master of Arts in Teaching major in Mathematics (MAT)",
        degreeName: "Master of Arts in Teaching",
        majorName: "Mathematics",
        programCode: "MAT",
      }),
    ).toBe("Master of Arts in Teaching major in Mathematics");

    // Legacy / fixture fallback when degreeName is absent
    expect(
      formatOfficialProgramDisplay({
        programName: "Master of Information Technology",
        degreeName: null,
        majorName: null,
      }),
    ).toBe("Master of Information Technology");
  });

  it("reconciles existing legacy rows in place and creates missing offerings", async () => {
    prismaMock.program.findFirst
      .mockResolvedValueOnce({ id: "legacy-edd" })
      .mockResolvedValue(null);
    prismaMock.program.update.mockResolvedValue({});
    prismaMock.program.create.mockResolvedValue({});
    prismaMock.program.updateMany.mockResolvedValue({ count: 1 });

    const res = await reconcileAuthoritativeGraduatePrograms(prismaMock as never);

    expect(res).toEqual({ updated: 1, created: 15 });
    expect(prismaMock.program.update).toHaveBeenCalledWith({
      where: { id: "legacy-edd" },
      data: expect.objectContaining({
        programName:
          "Doctor of Education major in Educational Management (Ed.D.-EM)",
        degreeName: "Doctor of Education",
        majorName: "Educational Management",
        programCode: "Ed.D.-EM",
        department: null,
        maxResidencyYears: 6,
        isActive: true,
      }),
    });
    expect(prismaMock.program.updateMany).toHaveBeenCalledWith({
      where: { department: "UIUX Fixture" },
      data: { isActive: false },
    });
  });
});

describe("ProgramService CRUD & validation", () => {
  const service = new ProgramService();

  it("creates a program with handbook default residency and AuditLog", async () => {
    prismaMock.program.findMany.mockResolvedValue([]);
    prismaMock.program.create.mockResolvedValue({
      id: "prog-new",
      programName: "Doctor of Education major in Industrial Education Management (Ed.D.-IEM)",
      degreeName: "Doctor of Education",
      majorName: "Industrial Education Management",
      programCode: "Ed.D.-IEM",
      programType: "DOCTORAL",
      department: null,
      maxResidencyYears: 6,
      isActive: true,
      _count: { students: 0, examSlots: 0, examApplications: 0 },
    });

    const created = await service.createProgram(
      {
        programType: "DOCTORAL",
        degreeName: "Doctor of Education",
        majorName: "Industrial Education Management",
        programCode: "Ed.D.-IEM",
      },
      "admin-1",
    );

    expect(created.maxResidencyYears).toBe(6);
    expect(prismaMock.program.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          programName:
            "Doctor of Education major in Industrial Education Management (Ed.D.-IEM)",
          maxResidencyYears: 6,
          department: null,
          isActive: true,
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "admin-1",
          actionType: "program_created",
          targetTable: "programs",
        }),
      }),
    );
  });

  it("rejects duplicate program names case-insensitively with 409", async () => {
    prismaMock.program.findMany.mockResolvedValue([
      {
        id: "existing-1",
        programName: "Master in Business Administration (MBA)",
      },
    ]);

    await expect(
      service.createProgram(
        {
          programType: "MASTERS",
          degreeName: "master in business administration",
          programCode: "mba",
        },
        "admin-1",
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.program.create).not.toHaveBeenCalled();
  });

  it("rejects invalid program types, missing degree title, and out-of-range residency", async () => {
    await expect(
      service.createProgram(
        { programType: "BACHELORS", degreeName: "BSIT" },
        "admin-1",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.createProgram(
        { programType: "MASTERS", degreeName: "   " },
        "admin-1",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.createProgram(
        { programType: "MASTERS", degreeName: "Test", maxResidencyYears: 20 },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("updates an existing program and records old/new audit values", async () => {
    const existing = {
      id: "prog-1",
      programName: "Master in Business Administration (MBA)",
      degreeName: "Master in Business Administration",
      majorName: null,
      programCode: "MBA",
      programType: "MASTERS",
      department: null,
      maxResidencyYears: 4,
      isActive: true,
      _count: { students: 2, examSlots: 1, examApplications: 0 },
    };
    prismaMock.program.findUnique.mockResolvedValue(existing);
    prismaMock.program.findMany.mockResolvedValue([]);
    prismaMock.program.update.mockResolvedValue({
      ...existing,
      maxResidencyYears: 5,
    });

    const updated = await service.updateProgram(
      "prog-1",
      {
        programType: "MASTERS",
        degreeName: "Master in Business Administration",
        programCode: "MBA",
        maxResidencyYears: 5,
      },
      "admin-1",
    );

    expect(updated.maxResidencyYears).toBe(5);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "admin-1",
          actionType: "program_updated",
          targetId: "prog-1",
        }),
      }),
    );
  });

  it("blocks modifying UIUX Fixture programs as 404", async () => {
    prismaMock.program.findUnique.mockResolvedValue({
      id: "fixture-1",
      department: "UIUX Fixture",
      isActive: false,
    });

    await expect(
      service.updateProgramStatus("fixture-1", { isActive: true }, "admin-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("toggles active status and audits program_status_changed", async () => {
    const existing = {
      id: "prog-1",
      programName: "Master of Science in Mathematics (MSM)",
      degreeName: "Master of Science in Mathematics",
      majorName: null,
      programCode: "MSM",
      programType: "MASTERS",
      department: null,
      maxResidencyYears: 4,
      isActive: true,
      _count: { students: 1, examSlots: 0, examApplications: 0 },
    };
    prismaMock.program.findUnique.mockResolvedValue(existing);
    prismaMock.program.update.mockResolvedValue({ ...existing, isActive: false });

    const result = await service.updateProgramStatus(
      "prog-1",
      { isActive: false },
      "admin-1",
    );

    expect(result.isActive).toBe(false);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "program_status_changed",
          targetId: "prog-1",
        }),
      }),
    );
  });
});
