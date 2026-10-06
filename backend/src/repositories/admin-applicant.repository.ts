// backend/src/repositories/admin-applicant.repository.ts

import prisma from "../config/database";
import {
  AdminApplicantListQuery,
  AdminApplicantListRow,
} from "../interfaces/admin-applicant.interfaces";
import {
  buildApplicantListWhere,
  deriveAdmissionStage,
  hasAuthoritativePassedExam,
} from "../services/admin-applicant-list.rules";

export class AdminApplicantRepository {
  async countApplicants(filters: AdminApplicantListQuery): Promise<number> {
    return prisma.student.count({ where: buildApplicantListWhere(filters) });
  }

  async findApplicants(
    filters: AdminApplicantListQuery,
  ): Promise<AdminApplicantListRow[]> {
    const where = buildApplicantListWhere(filters);
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
          select: { id: true, status: true, createdAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        },
        corUploads: {
          select: { id: true, status: true, createdAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    return students.map((student) => {
      const hasPassedExam = hasAuthoritativePassedExam(
        student.examApplications,
      );
      const latestExam = student.examApplications[0];
      const latestCor = student.corUploads[0];

      return {
        id: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        pinnacleApplicantId: student.pinnacleApplicantId || "",
        program: student.program,
        alignmentStatus: student.alignmentStatus ?? null,
        admissionStage: deriveAdmissionStage({
          alignmentStatus: student.alignmentStatus,
          hasPassedExam,
        }),
        examStatus: latestExam ? latestExam.status : "NOT_SCHEDULED",
        hasPassedExam,
        corStatus: latestCor ? String(latestCor.status) : "NONE",
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
            role: true,
          },
        },
        program: {
          select: {
            id: true,
            programName: true,
            programType: true,
          },
        },
        undergraduateProgram: {
          select: {
            id: true,
            programName: true,
          },
        },
        previousMastersProgram: {
          select: {
            id: true,
            programName: true,
          },
        },
        bridgingWaiver: {
          include: {
            validatedBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        examApplications: {
          include: {
            score: true,
            slot: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        },
        corUploads: {
          include: {
            corRecord: {
              include: {
                verifiedBy: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            reviewedBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            extraction: {
              select: {
                status: true,
                method: true,
                processedAt: true,
                diagnostic: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
    validatedById?: string,
    adminNotes?: string
  ) {
    return prisma.applicantBridgingWaiver.update({
      where: { id: waiverId },
      data: {
        status: status as any,
        validatedById: validatedById || null,
        validatedAt: status === "validated" ? new Date() : null,
        adminNotes: adminNotes || null,
      },
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
}
