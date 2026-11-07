// backend/src/repositories/admin-applicant.repository.ts

import prisma from "../config/database";
import { validReconsideredApplicationIds } from "../services/exam-effective-result.rules";
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
  /** Exact operation context; never the Applicant registry/detail projection. */
  findAdmissionContext(id: string) {
    return prisma.student.findUnique({ where: { id }, select: { id: true, admissionStatus: true, studentNumber: true } });
  }

  findWaiverContext(id: string) {
    return prisma.student.findUnique({ where: { id }, select: {
      id: true, bridgingWaiver: { select: { id: true, status: true } },
    } });
  }

  effectivePassIds() { return validReconsideredApplicationIds(prisma); }

  async countApplicants(filters: AdminApplicantListQuery, decisionIds?: string[]): Promise<number> {
    return prisma.student.count({ where: buildApplicantListWhere(filters, decisionIds ?? await this.effectivePassIds()) });
  }

  async findApplicants(
    filters: AdminApplicantListQuery,
    decisionIds?: string[],
  ): Promise<AdminApplicantListRow[]> {
    const passIds = decisionIds ?? await this.effectivePassIds();
    const where = buildApplicantListWhere(filters,passIds);
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
      ) || student.examApplications.some(app => passIds.includes(app.id));
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
            score: true, resultDecision: true,
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
