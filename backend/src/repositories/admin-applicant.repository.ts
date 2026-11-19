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
        admissionStage: deriveAdmissionStage({
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
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
          },
        },
        program: {
          select: {
            id: true,
            programName: true,
            programType: true,
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

  async findUserByEmailExcluding(email: string, excludeUserId: string) {
    return prisma.user.findFirst({
      where: {
        email,
        id: { not: excludeUserId },
      },
      select: { id: true },
    });
  }

  async findStudentByApplicantIdExcluding(
    pinnacleApplicantId: string,
    excludeStudentId: string,
  ) {
    return prisma.student.findFirst({
      where: {
        pinnacleApplicantId,
        id: { not: excludeStudentId },
      },
      select: { id: true },
    });
  }

  async findProgramById(programId: string) {
    return prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, programName: true, isActive: true },
    });
  }

  async updateApplicantProfile(params: {
    studentId: string;
    userId: string;
    adminId: string;
    userData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      isActive?: boolean;
    };
    studentData: {
      pinnacleApplicantId?: string;
      cellphone?: string;
      programId?: string;
    };
    oldSnapshot: Record<string, unknown>;
    newSnapshot: Record<string, unknown>;
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
      await tx.auditLog.create({
        data: {
          actorId: params.adminId,
          actionType: "APPLICANT_PROFILE_UPDATED",
          targetTable: "students",
          targetId: params.studentId,
          oldValue: JSON.stringify(params.oldSnapshot),
          newValue: JSON.stringify(params.newSnapshot),
          description: "Admin updated applicant details.",
        },
      });
    });
  }

  async resetApplicantPassword(params: {
    studentId: string;
    userId: string;
    adminId: string;
    passwordHash: string;
    email: string;
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
          actionType: "APPLICANT_PASSWORD_RESET",
          targetTable: "users",
          targetId: params.userId,
          newValue: JSON.stringify({
            studentId: params.studentId,
            email: params.email,
            mustChangePassword: true,
            emailDispatched: false,
          }),
          description:
            "Admin reset applicant password to temporary default password (email dispatch deferred).",
        },
      });
    });
  }

  async deleteApplicantAccount(params: {
    studentId: string;
    userId: string;
    adminId: string;
    deletedSnapshot: Record<string, unknown>;
  }) {
    return prisma.$transaction(async (tx) => {
      const apps = await tx.entranceExamApplication.findMany({
        where: { studentId: params.studentId },
        select: {
          id: true,
          slotId: true,
          status: true,
          seatReleasedAt: true,
        },
      });
      const appIds = apps.map((a) => a.id);

      // Decrement exam slot counters for unstarted active reservations.
      for (const app of apps) {
        if (
          app.seatReleasedAt === null &&
          (app.status === "PENDING" || app.status === "APPROVED")
        ) {
          const slot = await tx.examSlot.findUnique({
            where: { id: app.slotId },
            select: { id: true, slotsTaken: true },
          });
          if (slot && slot.slotsTaken > 0) {
            await tx.examSlot.update({
              where: { id: slot.id },
              data: { slotsTaken: slot.slotsTaken - 1 },
            });
          }
        }
      }

      if (appIds.length > 0) {
        await tx.examScheduleAmendment.deleteMany({
          where: {
            OR: [
              { applicationId: { in: appIds } },
              { replacementApplicationId: { in: appIds } },
              { requestedById: params.userId },
            ],
          },
        });
        await tx.applicantAnswer.deleteMany({
          where: { applicationId: { in: appIds } },
        });
        await tx.entranceExamApplication.deleteMany({
          where: { id: { in: appIds } },
        });
      } else {
        await tx.examScheduleAmendment.deleteMany({
          where: { requestedById: params.userId },
        });
      }

      // Clean any unverified/rejected COR uploads if present.
      const corUploads = await tx.corUpload.findMany({
        where: { studentId: params.studentId },
        select: { id: true },
      });
      const corIds = corUploads.map((c) => c.id);
      if (corIds.length > 0) {
        await tx.corExtraction.deleteMany({
          where: { corUploadId: { in: corIds } },
        });
        await tx.corRecord.deleteMany({
          where: { corUploadId: { in: corIds } },
        });
        await tx.corUpload.deleteMany({
          where: { id: { in: corIds } },
        });
      }

      await tx.notification.deleteMany({
        where: { userId: params.userId },
      });
      await tx.userSignature.deleteMany({
        where: { userId: params.userId },
      });
      await tx.auditLog.updateMany({
        where: { actorId: params.userId },
        data: { actorId: null },
      });

      await tx.student.delete({
        where: { id: params.studentId },
      });
      await tx.user.delete({
        where: { id: params.userId },
      });

      await tx.auditLog.create({
        data: {
          actorId: params.adminId,
          actionType: "APPLICANT_DELETED",
          targetTable: "students",
          targetId: params.studentId,
          oldValue: JSON.stringify(params.deletedSnapshot),
          description:
            "Admin deleted eligible applicant account prior to entrance exam execution.",
        },
      });
    });
  }
}
