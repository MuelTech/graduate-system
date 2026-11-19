// backend/src/repositories/admin-student.repository.ts

import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import { AdminStudentDetail } from "../interfaces/admin-student.interfaces";

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

  /**
   * Manual of Operations §7.14.3: Program shifting/correction is prohibited once
   * Title Defense has been completed or the student is no longer actively enrolled.
   */
  static canChangeProgram(
    admissionStatus: string,
    thesisRecords: Array<{ stage: string; status: string }>,
  ): boolean {
    if (admissionStatus !== "ENROLLED") return false;
    return !thesisRecords.some(
      (rec) =>
        rec.stage === "PROPOSAL" ||
        rec.stage === "FINAL" ||
        (rec.stage === "TITLE" &&
          (rec.status === "PASSED" ||
            rec.status === "APPROVED" ||
            rec.status === "COMPLETED")),
    );
  }

  /**
   * Explicit, bounded detail projection for the Admin Student Profile.
   * Missing records are represented as null — never fabricated.
   */
  async findStudentDetailById(
    studentId: string,
  ): Promise<AdminStudentDetail | null> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            suffix: true,
            email: true,
            isActive: true,
            mustChangePassword: true,
          },
        },
        program: {
          select: { id: true, programName: true, maxResidencyYears: true },
        },
        compExamRecords: {
          select: { status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        thesisRecords: {
          select: { stage: true, status: true },
        },
        adviserAssignments: {
          where: { isActive: true },
          select: {
            assignedDate: true,
            adviser: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { assignedDate: "desc" },
          take: 1,
        },
        residencyTracking: {
          select: { startDate: true, maxYears: true },
        },
      },
    });

    if (!student) return null;

    const compExam = student.compExamRecords[0] ?? null;
    const assignment = student.adviserAssignments[0] ?? null;
    const residencyStart =
      student.residencyTracking?.startDate ?? student.residencyStartDate ?? null;
    const residencyMax =
      student.residencyTracking?.maxYears ??
      student.program?.maxResidencyYears ??
      null;
    const hasResidency = residencyStart !== null || residencyMax !== null;
    const userExtras = student.user as {
      suffix?: string | null;
      isActive?: boolean;
      mustChangePassword?: boolean;
    };
    const thesisRecords =
      (student as { thesisRecords?: Array<{ stage: string; status: string }> })
        .thesisRecords ?? [];

    return {
      id: student.id,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      suffix: userExtras.suffix ?? null,
      email: student.user.email,
      studentNumber: student.studentNumber ?? null,
      pinnacleApplicantId:
        (student as { pinnacleApplicantId?: string | null })
          .pinnacleApplicantId ?? null,
      cellphone: student.cellphone ?? null,
      program: student.program
        ? { id: student.program.id, programName: student.program.programName }
        : null,
      admissionStatus: student.admissionStatus,
      enrollmentDate: student.enrollmentDate?.toISOString() ?? null,
      curriculumType: student.curriculumType ?? null,
      isActive: userExtras.isActive ?? true,
      mustChangePassword: userExtras.mustChangePassword ?? false,
      canChangeProgram: AdminStudentRepository.canChangeProgram(
        student.admissionStatus,
        thesisRecords,
      ),
      residency: hasResidency
        ? {
            startDate: residencyStart ? residencyStart.toISOString() : null,
            maxYears: residencyMax,
          }
        : null,
      compExam: compExam
        ? {
            status: compExam.status,
            recordedAt: compExam.createdAt.toISOString(),
          }
        : null,
      adviserAssignment: assignment
        ? {
            adviserId: assignment.adviser.id,
            adviserName: `${assignment.adviser.firstName} ${assignment.adviser.lastName}`,
            assignedDate: assignment.assignedDate?.toISOString() ?? null,
          }
        : null,
    };
  }

  /** Light identity lookup used to reuse the authoritative journey read model. */
  async findStudentUserId(studentId: string): Promise<string | null> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });
    return student?.userId ?? null;
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

  async findStudentForEdit(studentId: string) {
    return prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            suffix: true,
            email: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
          },
        },
        program: {
          select: { id: true, programName: true, maxResidencyYears: true },
        },
        thesisRecords: {
          select: { stage: true, status: true },
        },
        residencyTracking: {
          select: { id: true, startDate: true, maxYears: true },
        },
      },
    });
  }

  async findUserByEmailExcluding(email: string, excludeUserId: string) {
    return prisma.user.findFirst({
      where: { email, id: { not: excludeUserId } },
      select: { id: true },
    });
  }

  async findStudentByNumberExcluding(
    studentNumber: string,
    excludeStudentId: string,
  ) {
    return prisma.student.findFirst({
      where: { studentNumber, id: { not: excludeStudentId } },
      select: { id: true },
    });
  }

  async findProgramById(programId: string) {
    return prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        programName: true,
        maxResidencyYears: true,
        isActive: true,
      },
    });
  }

  async updateStudentProfile(params: {
    studentId: string;
    userId: string;
    adminId: string;
    userData: {
      firstName?: string;
      lastName?: string;
      suffix?: string | null;
      email?: string;
      isActive?: boolean;
    };
    studentData: {
      studentNumber?: string;
      cellphone?: string;
      programId?: string;
      curriculumType?: "NEW" | "OLD" | null;
      enrollmentDate?: Date | null;
      residencyStartDate?: Date | null;
    };
    syncStudentNumberOnCor?: string;
    syncResidencyTracking?: {
      startDate?: Date;
      maxYears?: number;
    };
    oldSnapshot: Record<string, unknown>;
    newSnapshot: Record<string, unknown>;
    reason: string;
  }) {
    return prisma.$transaction(async (tx) => {
      if (Object.keys(params.userData).length > 0) {
        await tx.user.update({
          where: { id: params.userId },
          data: {
            ...params.userData,
            updatedById: params.adminId,
          },
        });
      }

      if (Object.keys(params.studentData).length > 0) {
        await tx.student.update({
          where: { id: params.studentId },
          data: params.studentData,
        });
      }

      if (params.syncStudentNumberOnCor) {
        const latestVerifiedCor = await tx.corRecord.findFirst({
          where: { studentId: params.studentId, isAdminVerified: true },
          orderBy: [{ verifiedAt: "desc" }, { createdAt: "desc" }],
          select: { id: true },
        });
        if (latestVerifiedCor) {
          await tx.corRecord.update({
            where: { id: latestVerifiedCor.id },
            data: { registrationNumber: params.syncStudentNumberOnCor },
          });
        }
      }

      if (
        params.syncResidencyTracking &&
        Object.keys(params.syncResidencyTracking).length > 0
      ) {
        const existingResidency = await tx.residencyTracking.findUnique({
          where: { studentId: params.studentId },
          select: { id: true },
        });
        if (existingResidency) {
          await tx.residencyTracking.update({
            where: { id: existingResidency.id },
            data: params.syncResidencyTracking,
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: params.adminId,
          actionType: "STUDENT_PROFILE_UPDATED",
          targetTable: "students",
          targetId: params.studentId,
          oldValue: JSON.stringify(params.oldSnapshot),
          newValue: JSON.stringify(params.newSnapshot),
          description: params.reason,
        },
      });
    });
  }

  async resetStudentPassword(params: {
    studentId: string;
    userId: string;
    adminId: string;
    passwordHash: string;
    email: string;
    studentNumber: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: params.userId },
        data: {
          passwordHash: params.passwordHash,
          mustChangePassword: true,
          updatedById: params.adminId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: params.adminId,
          actionType: "STUDENT_PASSWORD_RESET",
          targetTable: "users",
          targetId: params.userId,
          newValue: JSON.stringify({
            studentId: params.studentId,
            studentNumber: params.studentNumber,
            email: params.email,
            mustChangePassword: true,
            emailDispatched: false,
          }),
          description:
            "Admin reset student password to temporary default password (email dispatch deferred).",
        },
      });
    });
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
