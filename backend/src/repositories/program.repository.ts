import { AuditLog, Prisma, ProgramType } from "@prisma/client";
import prisma from "../config/database";

export const PROGRAM_WITH_COUNTS_INCLUDE = {
  _count: {
    select: {
      students: true,
      examSlots: true,
      examApplications: true,
    },
  },
} as const;

export type ProgramWithCounts = Prisma.ProgramGetPayload<{
  include: typeof PROGRAM_WITH_COUNTS_INCLUDE;
}>;

export interface ProgramWriteInput {
  programName: string;
  degreeName: string;
  majorName: string | null;
  programCode: string | null;
  programType: ProgramType;
  maxResidencyYears: number;
  isActive: boolean;
}

export interface ProgramSnapshot {
  id: string;
  programName: string;
  degreeName: string | null;
  majorName: string | null;
  programCode: string | null;
  programType: ProgramType;
  maxResidencyYears: number | null;
  isActive: boolean;
}

export function serializeProgramSnapshot(program: ProgramSnapshot): string {
  return JSON.stringify({
    programName: program.programName,
    degreeName: program.degreeName,
    majorName: program.majorName,
    programCode: program.programCode,
    programType: program.programType,
    maxResidencyYears: program.maxResidencyYears,
    isActive: program.isActive,
  });
}

export class ProgramRepository {
  async getAllGraduatePrograms() {
    return prisma.program.findMany({
      where: { isActive: true },
      orderBy: [{ programType: "asc" }, { programName: "asc" }],
    });
  }

  async getAllAdminGraduatePrograms(): Promise<ProgramWithCounts[]> {
    return prisma.program.findMany({
      where: {
        OR: [
          { department: null },
          { department: { not: "UIUX Fixture" } },
        ],
      },
      include: PROGRAM_WITH_COUNTS_INCLUDE,
      orderBy: [{ programType: "asc" }, { programName: "asc" }],
    });
  }

  async getAllUndergraduatePrograms() {
    return prisma.undergraduateProgram.findMany({
      where: { isActive: true },
      orderBy: {
        programName: "asc",
      },
    });
  }

  async findProgramById(id: string): Promise<ProgramWithCounts | null> {
    return prisma.program.findUnique({
      where: { id },
      include: PROGRAM_WITH_COUNTS_INCLUDE,
    });
  }

  async findProgramByNameInsensitive(
    programName: string,
    excludeId?: string,
  ): Promise<{ id: string; programName: string } | null> {
    const target = programName.trim().toLowerCase();
    const candidates = await prisma.program.findMany({
      where: excludeId ? { id: { not: excludeId } } : undefined,
      select: { id: true, programName: true },
    });
    return (
      candidates.find((item) => item.programName.trim().toLowerCase() === target) ??
      null
    );
  }

  async createProgram(
    data: ProgramWriteInput,
    actorId: string,
  ): Promise<{ program: ProgramWithCounts; auditLog: AuditLog }> {
    return prisma.$transaction(async (tx) => {
      const program = await tx.program.create({
        data: {
          programName: data.programName,
          degreeName: data.degreeName,
          majorName: data.majorName,
          programCode: data.programCode,
          programType: data.programType,
          department: null,
          maxResidencyYears: data.maxResidencyYears,
          isActive: data.isActive,
        },
        include: PROGRAM_WITH_COUNTS_INCLUDE,
      });

      const auditLog = await tx.auditLog.create({
        data: {
          actorId,
          actionType: "program_created",
          targetTable: "programs",
          targetId: program.id,
          newValue: serializeProgramSnapshot(program),
          description: `Created graduate program: ${program.programName}`,
        },
      });

      return { program, auditLog };
    });
  }

  async updateProgram(
    id: string,
    previous: ProgramSnapshot,
    data: ProgramWriteInput,
    actorId: string,
  ): Promise<{ program: ProgramWithCounts; auditLog: AuditLog }> {
    return prisma.$transaction(async (tx) => {
      const program = await tx.program.update({
        where: { id },
        data: {
          programName: data.programName,
          degreeName: data.degreeName,
          majorName: data.majorName,
          programCode: data.programCode,
          programType: data.programType,
          department: null,
          maxResidencyYears: data.maxResidencyYears,
          isActive: data.isActive,
        },
        include: PROGRAM_WITH_COUNTS_INCLUDE,
      });

      const auditLog = await tx.auditLog.create({
        data: {
          actorId,
          actionType: "program_updated",
          targetTable: "programs",
          targetId: program.id,
          oldValue: serializeProgramSnapshot(previous),
          newValue: serializeProgramSnapshot(program),
          description: `Updated graduate program: ${program.programName}`,
        },
      });

      return { program, auditLog };
    });
  }

  async updateProgramStatus(
    id: string,
    previous: ProgramSnapshot,
    isActive: boolean,
    actorId: string,
  ): Promise<{ program: ProgramWithCounts; auditLog: AuditLog }> {
    return prisma.$transaction(async (tx) => {
      const program = await tx.program.update({
        where: { id },
        data: { isActive },
        include: PROGRAM_WITH_COUNTS_INCLUDE,
      });

      const auditLog = await tx.auditLog.create({
        data: {
          actorId,
          actionType: "program_status_changed",
          targetTable: "programs",
          targetId: program.id,
          oldValue: JSON.stringify({ isActive: previous.isActive }),
          newValue: JSON.stringify({ isActive: program.isActive }),
          description: `${isActive ? "Activated" : "Deactivated"} graduate program: ${program.programName}`,
        },
      });

      return { program, auditLog };
    });
  }
}
