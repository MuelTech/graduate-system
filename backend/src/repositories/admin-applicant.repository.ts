// backend/src/repositories/admin-applicant.repository.ts

import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import { AdminApplicantListQuery } from "../interfaces/admin-applicant.interfaces";

export class AdminApplicantRepository {
  async countApplicants(filters: AdminApplicantListQuery): Promise<number> {
    const where = this.buildWhereClause(filters);
    return prisma.student.count({ where });
  }

  async findApplicants(filters: AdminApplicantListQuery) {
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
        examApplications: {
          include: {
            examScores: {
              select: {
                multipleChoiceScore: true,
                essayScore: true,
                totalScore: true,
              },
            },
            examSlot: {
              select: {
                examDate: true,
                examTime: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        corUploads: {
          include: {
            corRecord: {
              select: {
                isVerified: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    return students.map((student) => {
      const examApp = student.examApplications[0];
      const corUpload = student.corUploads[0];

      let examStatus = "NOT_SCHEDULED";
      if (examApp) {
        examStatus = examApp.status;
      }

      let corStatus = "NONE";
      if (corUpload) {
        corStatus = corUpload.corRecord?.isVerified ? "VERIFIED" : "PENDING";
      }

      return {
        id: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        pinnacleApplicantId: student.pinnacleApplicantId || "",
        program: student.program,
        alignmentStatus: student.alignmentStatus || "ALIGNED",
        examStatus,
        examScores: examApp?.examScores
          ? {
              mcq: examApp.examScores.multipleChoiceScore,
              essay: examApp.examScores.essayScore,
              total: examApp.examScores.totalScore,
            }
          : null,
        corStatus,
        admissionStatus: student.admissionStatus,
        strikeCount: student.strikeCount || 0,
        createdAt: student.createdAt.toISOString(),
      };
    });
  }

  async findStudentById(studentId: string) {
    return prisma.student.findUnique({
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
        bridgingWaiver: {
          include: {
            validatedByUser: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        examApplications: {
          include: {
            examScores: true,
            examSlot: true,
          },
          orderBy: { createdAt: "desc" },
        },
        corUploads: {
          include: {
            corRecord: {
              include: {
                verifiedByUser: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async findActivityLog(studentId: string) {
    const logs = await prisma.auditLog.findMany({
      where: { targetId: studentId },
      include: {
        actor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return logs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      action: log.actionType,
      description: log.description || log.actionType,
      actor: log.actor
        ? `${log.actor.firstName} ${log.actor.lastName}`
        : "System",
    }));
  }

  async updateAlignmentStatus(studentId: string, status: string) {
    return prisma.student.update({
      where: { id: studentId },
      data: { alignmentStatus: status as any },
    });
  }

  async updateWaiverStatus(
    waiverId: string,
    status: string,
    validatedBy?: string,
    adminNotes?: string
  ) {
    return prisma.applicantBridgingWaiver.update({
      where: { id: waiverId },
      data: {
        status: status as any,
        validatedBy: validatedBy || null,
        validatedAt: status === "validated" ? new Date() : null,
        adminNotes: adminNotes || null,
      },
    });
  }

  async updateCorVerification(
    corRecordId: string,
    verified: boolean,
    verificationMethod?: string,
    verifiedBy?: string
  ) {
    return prisma.corRecord.update({
      where: { id: corRecordId },
      data: {
        isVerified: verified,
        verificationMethod: verificationMethod || null,
        verifiedBy: verifiedBy || null,
        verifiedAt: verified ? new Date() : null,
      },
    });
  }

  async promoteToStudent(studentId: string, studentNumber: string) {
    return prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: studentId },
        data: {
          admissionStatus: "ENROLLED",
          enrollmentDate: new Date(),
          studentNumber: studentNumber,
        },
      });

      await tx.user.update({
        where: {
          students: { some: { id: studentId } },
        },
        data: {
          role: "STUDENT",
        },
      });

      return { studentNumber };
    });
  }

  async resetStrikeCount(studentId: string) {
    return prisma.student.update({
      where: { id: studentId },
      data: { strikeCount: 0 },
    });
  }

  async createAuditLog(
    actorId: string | null,
    actionType: string,
    targetId: string,
    description: string,
    oldValue?: string,
    newValue?: string
  ) {
    return prisma.auditLog.create({
      data: {
        actorId,
        actionType,
        targetTable: "students",
        targetId,
        description,
        oldValue: oldValue || null,
        newValue: newValue || null,
      },
    });
  }

  private buildWhereClause(filters: AdminApplicantListQuery): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {
      user: { role: "APPLICANT" },
    };

    if (filters.search) {
      where.OR = [
        { user: { firstName: { contains: filters.search } } },
        { user: { lastName: { contains: filters.search } } },
        { user: { email: { contains: filters.search } } },
        { pinnacleApplicantId: { contains: filters.search } },
        { program: { programName: { contains: filters.search } } },
      ];
    }

    if (filters.alignment) {
      where.alignmentStatus = filters.alignment as any;
    }

    if (filters.status) {
      where.admissionStatus = filters.status as any;
    }

    return where;
  }
}
