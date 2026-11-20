// backend/src/repositories/admin-student.repository.ts

import prisma from "../config/database";
import { NotificationType, Prisma } from "@prisma/client";
import {
  AdminStudentDetail,
  CompExamSummaryDto,
} from "../interfaces/admin-student.interfaces";
import {
  evaluateCompExamSummary,
  generateCompExamCertificateNumber,
} from "../services/comp-exam.rules";

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
            attemptNumber: true,
            createdAt: true,
          },
          orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }],
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
      const compExamEval = evaluateCompExamSummary(student.compExamRecords);
      const compExam = compExamEval.latestAttempt;
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
        compExamStrikes: compExamEval.failedCount,
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
            id: true,
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
            id: true,
            stage: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        compExamRecords: {
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            examDate: true,
            remarks: true,
            certificateNumber: true,
            certificateIssuedAt: true,
            createdAt: true,
          },
          orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }],
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
        curriculumVersion: {
          select: {
            id: true,
            versionCode: true,
            label: true,
            curriculumType: true,
            effectiveSchoolYear: true,
          },
        },
        compExamRecords: {
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            examDate: true,
            remarks: true,
            certificateNumber: true,
            certificateIssuedAt: true,
            createdAt: true,
            recordedBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }],
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

    const compExamRecords = student.compExamRecords as Array<{
      id?: string;
      attemptNumber?: number | null;
      status: string;
      examDate?: Date | null;
      remarks?: string | null;
      certificateNumber?: string | null;
      certificateIssuedAt?: Date | null;
      createdAt: Date;
      recordedBy?: { firstName: string; lastName: string } | null;
    }>;
    const compExamEval = evaluateCompExamSummary(compExamRecords);
    const compExam = compExamEval.latestAttempt;
    const gradedAttempts = compExamEval.orderedRecords.filter((r) => {
      const upper = String(r.status).toUpperCase();
      return upper === "PASSED" || upper === "FAILED";
    });
    const compExamSummary: CompExamSummaryDto = {
      standing: compExamEval.standing,
      isPassed: compExamEval.isPassed,
      isDismissed: compExamEval.isDismissed,
      attemptsUsed: compExamEval.attemptsUsed,
      failedAttempts: compExamEval.failedCount,
      attemptsRemaining: compExamEval.attemptsRemaining,
      maxAttempts: compExamEval.maxAttempts,
      nextAttemptNumber: compExamEval.nextAttemptNumber,
      canRecordAttempt:
        student.admissionStatus === "ENROLLED" &&
        !compExamEval.isPassed &&
        !compExamEval.isDismissed,
      canCorrectLatest:
        gradedAttempts.length > 0 && student.admissionStatus !== "GRADUATED",
      certificate: {
        eligible: compExamEval.isPassed,
        templateStatus: "TEMPLATE_PENDING",
        certificateNumber: compExamEval.passedAttempt?.certificateNumber ?? null,
        issuedAt: compExamEval.passedAttempt?.certificateIssuedAt
          ? compExamEval.passedAttempt.certificateIssuedAt.toISOString()
          : null,
      },
      attempts: compExamEval.orderedRecords.map((r, index) => ({
        id: r.id ?? `legacy-${index}`,
        attemptNumber:
          typeof r.attemptNumber === "number"
            ? r.attemptNumber
            : compExamEval.orderedRecords.length - index,
        status: r.status,
        examDate: r.examDate ? r.examDate.toISOString() : null,
        remarks: r.remarks ?? null,
        recordedAt: r.createdAt.toISOString(),
        recordedByName: r.recordedBy
          ? `${r.recordedBy.firstName} ${r.recordedBy.lastName}`.trim()
          : null,
        certificateNumber: r.certificateNumber ?? null,
        certificateIssuedAt: r.certificateIssuedAt
          ? r.certificateIssuedAt.toISOString()
          : null,
      })),
    };
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
      curriculumVersion:
        (
          student as {
            curriculumVersion?: {
              id: string;
              versionCode: string;
              label: string;
              curriculumType: string;
              effectiveSchoolYear: string | null;
            } | null;
          }
        ).curriculumVersion ?? null,
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
      compExamSummary,
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

  async recordCompExamAttempt(params: {
    studentId: string;
    userId: string;
    adminId: string;
    attemptNumber: number;
    pendingRecordId: string | null;
    status: "PASSED" | "FAILED";
    examDate: Date | null;
    remarks: string | null;
    shouldDismiss: boolean;
    notification: {
      title: string;
      message: string;
      type: NotificationType;
    };
    emailFoundation: Record<string, unknown>;
  }) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      let record = params.pendingRecordId
        ? await tx.compExamRecord.update({
            where: { id: params.pendingRecordId },
            data: {
              attemptNumber: params.attemptNumber,
              status: params.status,
              examDate: params.examDate,
              remarks: params.remarks,
              recordedById: params.adminId,
            },
          })
        : await tx.compExamRecord.create({
            data: {
              studentId: params.studentId,
              attemptNumber: params.attemptNumber,
              status: params.status,
              examDate: params.examDate,
              remarks: params.remarks,
              recordedById: params.adminId,
            },
          });

      if (params.status === "PASSED") {
        const certificateNumber = generateCompExamCertificateNumber(now, record.id);
        record = await tx.compExamRecord.update({
          where: { id: record.id },
          data: {
            certificateNumber,
            certificateIssuedAt: now,
          },
        });
      }

      if (params.shouldDismiss) {
        await tx.student.update({
          where: { id: params.studentId },
          data: { admissionStatus: "DISMISSED" },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: params.adminId,
          actionType: "COMP_EXAM_ATTEMPT_RECORDED",
          targetTable: "comp_exam_records",
          targetId: record.id,
          newValue: JSON.stringify({
            studentId: params.studentId,
            attemptNumber: record.attemptNumber,
            status: record.status,
            examDate: record.examDate ? record.examDate.toISOString() : null,
            remarks: record.remarks,
            certificateNumber: record.certificateNumber,
            dismissed: params.shouldDismiss,
            emailFoundation: params.emailFoundation,
          }),
          description: `Recorded Written Comprehensive Examination Attempt ${record.attemptNumber} (${record.status})${params.shouldDismiss ? " — student dismissed per Manual §7.15.4" : ""}.`,
        },
      });

      await tx.notification.create({
        data: {
          userId: params.userId,
          title: params.notification.title,
          message: params.notification.message,
          type: params.notification.type,
          relatedRecordType: "CompExamRecord",
          relatedRecordId: record.id,
        },
      });

      return record;
    });
  }

  async correctLatestCompExamAttempt(params: {
    studentId: string;
    userId: string;
    adminId: string;
    attemptId: string;
    attemptNumber: number;
    existingCertificateNumber: string | null;
    existingCertificateIssuedAt: Date | null;
    status: "PASSED" | "FAILED";
    examDate: Date | null;
    remarks: string | null;
    reason: string;
    nextAdmissionStatus: "ENROLLED" | "DISMISSED" | null;
    oldSnapshot: Record<string, unknown>;
    notification: {
      title: string;
      message: string;
      type: NotificationType;
    } | null;
    emailFoundation: Record<string, unknown> | null;
  }) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const nextCertificateNumber =
        params.status === "PASSED"
          ? (params.existingCertificateNumber ??
            generateCompExamCertificateNumber(now, params.attemptId))
          : null;
      const nextCertificateIssuedAt =
        params.status === "PASSED"
          ? (params.existingCertificateIssuedAt ?? now)
          : null;

      const updated = await tx.compExamRecord.update({
        where: { id: params.attemptId },
        data: {
          status: params.status,
          examDate: params.examDate,
          remarks: params.remarks,
          recordedById: params.adminId,
          certificateNumber: nextCertificateNumber,
          certificateIssuedAt: nextCertificateIssuedAt,
        },
      });

      if (params.nextAdmissionStatus) {
        await tx.student.update({
          where: { id: params.studentId },
          data: { admissionStatus: params.nextAdmissionStatus },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: params.adminId,
          actionType: "COMP_EXAM_ATTEMPT_CORRECTED",
          targetTable: "comp_exam_records",
          targetId: updated.id,
          oldValue: JSON.stringify(params.oldSnapshot),
          newValue: JSON.stringify({
            studentId: params.studentId,
            attemptNumber: updated.attemptNumber,
            status: updated.status,
            examDate: updated.examDate ? updated.examDate.toISOString() : null,
            remarks: updated.remarks,
            certificateNumber: updated.certificateNumber,
            nextAdmissionStatus: params.nextAdmissionStatus,
            emailFoundation: params.emailFoundation,
          }),
          description: params.reason,
        },
      });

      if (params.notification) {
        await tx.notification.create({
          data: {
            userId: params.userId,
            title: params.notification.title,
            message: params.notification.message,
            type: params.notification.type,
            relatedRecordType: "CompExamRecord",
            relatedRecordId: updated.id,
          },
        });
      }

      return updated;
    });
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

  async findCurriculumVersionForProgram(
    programId: string,
    preferredType?: "NEW" | "OLD" | null,
  ): Promise<{ id: string; curriculumType: "NEW" | "OLD" } | null> {
    if (!prisma.curriculumVersion?.findMany) return null;
    const versions = await prisma.curriculumVersion.findMany({
      where: { programId, isActive: true },
      orderBy: [{ isDefaultForNewStudents: "desc" }, { createdAt: "desc" }],
      select: { id: true, curriculumType: true, isDefaultForNewStudents: true },
    });
    if (versions.length === 0) return null;
    const match =
      (preferredType
        ? versions.find((v) => v.curriculumType === preferredType)
        : undefined) ??
      versions.find((v) => v.isDefaultForNewStudents) ??
      versions[0];
    return {
      id: match.id,
      curriculumType: match.curriculumType,
    };
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
      curriculumVersionId?: string | null;
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
