// backend/src/repositories/admin-student.repository.ts

import prisma from "../config/database";
import { Prisma } from "@prisma/client";

export interface AdminStudentListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  program?: string;
  status?: string;
}

/**
 * Authoritative Students-registry scope. Applicant records are intentionally
 * excluded; only ENROLLED, GRADUATED and DISMISSED records belong here.
 */
export const STUDENT_REGISTRY_STATUSES = [
  "ENROLLED",
  "GRADUATED",
  "DISMISSED",
] as const;

export type StudentRegistryStatus = (typeof STUDENT_REGISTRY_STATUSES)[number];

export function isStudentRegistryStatus(
  value: string | undefined,
): value is StudentRegistryStatus {
  return (STUDENT_REGISTRY_STATUSES as readonly string[]).includes(
    String(value ?? ""),
  );
}

export class AdminStudentRepository {
  async countStudents(filters: AdminStudentListQuery): Promise<number> {
    const where = this.buildWhereClause(filters);
    return prisma.student.count({ where });
  }

  async findStudents(filters: AdminStudentListQuery) {
    const where = this.buildWhereClause(filters);
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const students = await prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        program: {
          select: {
            id: true,
            programName: true,
          },
        },
        thesisRecords: {
          select: {
            stage: true,
            status: true,
          },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        compExamRecords: {
          select: {
            status: true,
          },
          orderBy: { createdAt: "desc" },
        },
        adviserAssignments: {
          where: { isActive: true },
          select: {
            adviser: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
    });

    return students.map((student) => {
      const thesis = student.thesisRecords[0];
      const compExam = student.compExamRecords[0];
      const adviser = student.adviserAssignments[0]?.adviser;

      return {
        id: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        studentNumber: student.studentNumber || "N/A",
        program: student.program,
        thesisStage: thesis?.stage || "NONE",
        thesisStatus: thesis?.status || "NONE",
        compExamStatus: compExam ? compExam.status : "NOT_RECORDED",
        compExamStrikes: student.compExamRecords.filter((r) => r.status === "FAILED").length,
        adviser: adviser ? `${adviser.firstName} ${adviser.lastName}` : "None",
        admissionStatus: student.admissionStatus,
        enrollmentDate: student.enrollmentDate?.toISOString() || null,
      };
    });
  }

  async findStudentById(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        program: {
          select: {
            id: true,
            programName: true,
          },
        },
        thesisRecords: {
          select: {
            stage: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        compExamRecords: {
          select: {
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        adviserAssignments: {
          where: { isActive: true },
          select: {
            adviser: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            assignedDate: true,
          },
          take: 1,
        },
        residencyTracking: {
          select: {
            startDate: true,
            maxYears: true,
          },
        },
      },
    });

    if (!student) return null;

    // Flatten user data to top level
    return {
      ...student,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
    };
  }

  async updateCompExamStatus(studentId: string, status: "PENDING" | "PASSED" | "FAILED") {
    const latestRecord = await prisma.compExamRecord.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });

    if (latestRecord) {
      return prisma.compExamRecord.update({
        where: { id: latestRecord.id },
        data: { status },
      });
    } else {
      return prisma.compExamRecord.create({
        data: {
          studentId,
          status,
        },
      });
    }
  }

  private buildWhereClause(filters: AdminStudentListQuery): Prisma.StudentWhereInput {
    // A valid Student Status narrows the registry to that status; anything else
    // (including APPLICANT or a malformed value) fails closed to the full
    // ENROLLED / GRADUATED / DISMISSED scope.
    const requested = filters.status?.trim().toUpperCase();
    const scope: StudentRegistryStatus[] = isStudentRegistryStatus(requested)
      ? [requested]
      : [...STUDENT_REGISTRY_STATUSES];

    const where: Prisma.StudentWhereInput = {
      admissionStatus: { in: scope },
    };

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { user: { firstName: { contains: search } } },
        { user: { lastName: { contains: search } } },
        { user: { email: { contains: search } } },
        { studentNumber: { contains: search } },
      ];
    }

    if (filters.program) {
      where.programId = filters.program;
    }

    return where;
  }
}
