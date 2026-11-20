import type {
  CourseProgressStatus,
  CurriculumGroupType,
  CurriculumType,
  PublicationMilestoneStatus,
} from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";

const VERSION_DETAIL_INCLUDE = {
  program: {
    select: {
      id: true,
      programName: true,
      degreeName: true,
      majorName: true,
      programCode: true,
      programType: true,
      isActive: true,
    },
  },
  _count: {
    select: { students: true },
  },
  groups: {
    orderBy: [{ displayOrder: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      courses: {
        orderBy: [{ displayOrder: "asc" as const }, { createdAt: "asc" as const }],
        include: {
          _count: {
            select: { studentProgress: true },
          },
        },
      },
    },
  },
};

const STUDENT_CHECKLIST_INCLUDE = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      suffix: true,
      email: true,
    },
  },
  program: {
    select: {
      id: true,
      programName: true,
      degreeName: true,
      majorName: true,
      programCode: true,
      programType: true,
    },
  },
  curriculumVersion: {
    include: {
      groups: {
        orderBy: [{ displayOrder: "asc" as const }, { createdAt: "asc" as const }],
        include: {
          courses: {
            orderBy: [{ displayOrder: "asc" as const }, { createdAt: "asc" as const }],
          },
        },
      },
    },
  },
  courseProgress: {
    include: {
      encodedBy: { select: { id: true, firstName: true, lastName: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  compExamRecords: {
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      examDate: true,
      createdAt: true,
    },
    orderBy: [{ attemptNumber: "desc" as const }, { createdAt: "desc" as const }],
  },
  thesisRecords: {
    select: {
      id: true,
      stage: true,
      status: true,
      outcome: true,
      createdAt: true,
      defenseSchedules: {
        select: {
          defenseType: true,
          conclusion: {
            select: { outcome: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
  graduationMilestone: {
    include: {
      publicationVerifiedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  },
};

function isUniqueError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export class CurriculumRepository {
  async listVersions(programId?: string) {
    return prisma.curriculumVersion.findMany({
      where: programId ? { programId } : undefined,
      include: VERSION_DETAIL_INCLUDE,
      orderBy: [
        { program: { programType: "asc" } },
        { program: { programName: "asc" } },
        { isDefaultForNewStudents: "desc" },
        { createdAt: "desc" },
      ],
    });
  }

  async getVersionById(versionId: string) {
    return prisma.curriculumVersion.findUnique({
      where: { id: versionId },
      include: VERSION_DETAIL_INCLUDE,
    });
  }

  async listVersionsByProgram(programId: string) {
    return prisma.curriculumVersion.findMany({
      where: { programId },
      orderBy: [
        { isActive: "desc" },
        { isDefaultForNewStudents: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        programId: true,
        versionCode: true,
        label: true,
        curriculumType: true,
        effectiveSchoolYear: true,
        totalRequiredUnits: true,
        isDefaultForNewStudents: true,
        isActive: true,
      },
    });
  }

  async findProgramById(programId: string) {
    return prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        programName: true,
        programType: true,
        isActive: true,
      },
    });
  }

  async findGroupById(groupId: string) {
    return prisma.curriculumCourseGroup.findUnique({
      where: { id: groupId },
      include: {
        curriculumVersion: {
          select: { id: true, programId: true, versionCode: true, label: true },
        },
      },
    });
  }

  async findCourseById(courseId: string) {
    return prisma.curriculumCourse.findUnique({
      where: { id: courseId },
      include: {
        group: {
          select: {
            id: true,
            curriculumVersionId: true,
            label: true,
          },
        },
      },
    });
  }

  async createVersion(
    adminId: string,
    data: {
      programId: string;
      versionCode: string;
      label: string;
      curriculumType: CurriculumType;
      effectiveSchoolYear: string | null;
      totalRequiredUnits: number;
      isDefaultForNewStudents: boolean;
      isActive: boolean;
      notes: string | null;
    },
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        if (data.isDefaultForNewStudents) {
          await tx.curriculumVersion.updateMany({
            where: { programId: data.programId, isDefaultForNewStudents: true },
            data: { isDefaultForNewStudents: false },
          });
        }

        const created = await tx.curriculumVersion.create({
          data: {
            programId: data.programId,
            versionCode: data.versionCode,
            label: data.label,
            curriculumType: data.curriculumType,
            effectiveSchoolYear: data.effectiveSchoolYear,
            totalRequiredUnits: data.totalRequiredUnits,
            isDefaultForNewStudents: data.isDefaultForNewStudents,
            isActive: data.isActive,
            notes: data.notes,
          },
          include: VERSION_DETAIL_INCLUDE,
        });

        await tx.auditLog.create({
          data: {
            actorId: adminId,
            actionType: "CURRICULUM_VERSION_CREATED",
            targetTable: "curriculum_versions",
            targetId: created.id,
            newValue: JSON.stringify({
              programId: created.programId,
              versionCode: created.versionCode,
              label: created.label,
              curriculumType: created.curriculumType,
              isDefaultForNewStudents: created.isDefaultForNewStudents,
            }),
            description: `Created curriculum version ${created.versionCode} (${created.label})`,
          },
        });

        return created;
      });
    } catch (error) {
      if (isUniqueError(error)) {
        throw new AppError(
          `A curriculum version with code "${data.versionCode}" already exists for this program.`,
          409,
        );
      }
      throw error;
    }
  }

  async updateVersion(
    adminId: string,
    versionId: string,
    existing: {
      id: string;
      programId: string;
      versionCode: string;
      label: string;
      curriculumType: CurriculumType;
      effectiveSchoolYear: string | null;
      isDefaultForNewStudents: boolean;
      isActive: boolean;
      notes: string | null;
    },
    data: {
      versionCode?: string;
      label?: string;
      curriculumType?: CurriculumType;
      effectiveSchoolYear?: string | null;
      isDefaultForNewStudents?: boolean;
      isActive?: boolean;
      notes?: string | null;
    },
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        if (data.isDefaultForNewStudents === true) {
          await tx.curriculumVersion.updateMany({
            where: {
              programId: existing.programId,
              id: { not: versionId },
              isDefaultForNewStudents: true,
            },
            data: { isDefaultForNewStudents: false },
          });
        }

        const updated = await tx.curriculumVersion.update({
          where: { id: versionId },
          data,
          include: VERSION_DETAIL_INCLUDE,
        });

        await tx.auditLog.create({
          data: {
            actorId: adminId,
            actionType: "CURRICULUM_VERSION_UPDATED",
            targetTable: "curriculum_versions",
            targetId: versionId,
            oldValue: JSON.stringify({
              versionCode: existing.versionCode,
              label: existing.label,
              curriculumType: existing.curriculumType,
              effectiveSchoolYear: existing.effectiveSchoolYear,
              isDefaultForNewStudents: existing.isDefaultForNewStudents,
              isActive: existing.isActive,
            }),
            newValue: JSON.stringify({
              versionCode: updated.versionCode,
              label: updated.label,
              curriculumType: updated.curriculumType,
              effectiveSchoolYear: updated.effectiveSchoolYear,
              isDefaultForNewStudents: updated.isDefaultForNewStudents,
              isActive: updated.isActive,
            }),
            description: `Updated curriculum version ${updated.versionCode} (${updated.label})`,
          },
        });

        return updated;
      });
    } catch (error) {
      if (isUniqueError(error)) {
        throw new AppError(
          `A curriculum version with code "${data.versionCode}" already exists for this program.`,
          409,
        );
      }
      throw error;
    }
  }

  private async syncVersionTotalUnits(
    tx: Pick<typeof prisma, "curriculumCourseGroup" | "curriculumVersion">,
    versionId: string,
  ) {
    const groups = await tx.curriculumCourseGroup.findMany({
      where: { curriculumVersionId: versionId },
      select: { requiredUnits: true },
    });
    const sum = groups.reduce((acc, g) => acc + g.requiredUnits, 0);
    await tx.curriculumVersion.update({
      where: { id: versionId },
      data: { totalRequiredUnits: sum },
    });
  }

  async createGroup(
    adminId: string,
    versionId: string,
    data: {
      groupType: CurriculumGroupType;
      label: string;
      requiredUnits: number;
      countsTowardWce: boolean;
      selectionNote: string | null;
      displayOrder: number;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.curriculumCourseGroup.create({
        data: {
          curriculumVersionId: versionId,
          ...data,
        },
        include: {
          courses: true,
        },
      });
      await this.syncVersionTotalUnits(tx, versionId);

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actionType: "CURRICULUM_GROUP_CREATED",
          targetTable: "curriculum_course_groups",
          targetId: created.id,
          newValue: JSON.stringify({
            curriculumVersionId: versionId,
            groupType: created.groupType,
            label: created.label,
            requiredUnits: created.requiredUnits,
          }),
          description: `Added course group "${created.label}" (${created.requiredUnits} units)`,
        },
      });

      return created;
    });
  }

  async updateGroup(
    adminId: string,
    groupId: string,
    versionId: string,
    data: {
      groupType?: CurriculumGroupType;
      label?: string;
      requiredUnits?: number;
      countsTowardWce?: boolean;
      selectionNote?: string | null;
      displayOrder?: number;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.curriculumCourseGroup.update({
        where: { id: groupId },
        data,
        include: {
          courses: {
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      });
      await this.syncVersionTotalUnits(tx, versionId);

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actionType: "CURRICULUM_GROUP_UPDATED",
          targetTable: "curriculum_course_groups",
          targetId: groupId,
          newValue: JSON.stringify({
            label: updated.label,
            requiredUnits: updated.requiredUnits,
            countsTowardWce: updated.countsTowardWce,
          }),
          description: `Updated course group "${updated.label}"`,
        },
      });

      return updated;
    });
  }

  async deleteGroupWithGuard(
    adminId: string,
    groupId: string,
    versionId: string,
    groupLabel: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const progressCount = await tx.studentCourseProgress.count({
        where: { curriculumCourse: { groupId } },
      });
      if (progressCount > 0) {
        throw new AppError(
          "Cannot delete this course group because students already have recorded coursework progress for its subjects.",
          409,
        );
      }

      await tx.curriculumCourseGroup.delete({ where: { id: groupId } });
      await this.syncVersionTotalUnits(tx, versionId);

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actionType: "CURRICULUM_GROUP_DELETED",
          targetTable: "curriculum_course_groups",
          targetId: groupId,
          oldValue: JSON.stringify({ curriculumVersionId: versionId, label: groupLabel }),
          description: `Deleted course group "${groupLabel}"`,
        },
      });
    });
  }

  async createCourse(
    adminId: string,
    groupId: string,
    data: {
      courseCode: string;
      courseTitle: string;
      units: number;
      isRequired: boolean;
      prerequisiteNote: string | null;
      displayOrder: number;
    },
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const created = await tx.curriculumCourse.create({
          data: {
            groupId,
            ...data,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: adminId,
            actionType: "CURRICULUM_COURSE_CREATED",
            targetTable: "curriculum_courses",
            targetId: created.id,
            newValue: JSON.stringify({
              groupId,
              courseCode: created.courseCode,
              courseTitle: created.courseTitle,
              units: created.units,
            }),
            description: `Added subject ${created.courseCode} — ${created.courseTitle}`,
          },
        });

        return created;
      });
    } catch (error) {
      if (isUniqueError(error)) {
        throw new AppError(
          `Course code "${data.courseCode}" already exists in this group.`,
          409,
        );
      }
      throw error;
    }
  }

  async updateCourse(
    adminId: string,
    courseId: string,
    data: {
      courseCode?: string;
      courseTitle?: string;
      units?: number;
      isRequired?: boolean;
      prerequisiteNote?: string | null;
      displayOrder?: number;
    },
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const updated = await tx.curriculumCourse.update({
          where: { id: courseId },
          data,
        });

        await tx.auditLog.create({
          data: {
            actorId: adminId,
            actionType: "CURRICULUM_COURSE_UPDATED",
            targetTable: "curriculum_courses",
            targetId: courseId,
            newValue: JSON.stringify({
              courseCode: updated.courseCode,
              courseTitle: updated.courseTitle,
              units: updated.units,
              isRequired: updated.isRequired,
            }),
            description: `Updated subject ${updated.courseCode} — ${updated.courseTitle}`,
          },
        });

        return updated;
      });
    } catch (error) {
      if (isUniqueError(error)) {
        throw new AppError(
          `Course code "${data.courseCode}" already exists in this group.`,
          409,
        );
      }
      throw error;
    }
  }

  async deleteCourseWithGuard(
    adminId: string,
    courseId: string,
    courseLabel: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const progressCount = await tx.studentCourseProgress.count({
        where: { curriculumCourseId: courseId },
      });
      if (progressCount > 0) {
        throw new AppError(
          "Cannot delete this subject because students already have recorded coursework progress for it.",
          409,
        );
      }

      await tx.curriculumCourse.delete({ where: { id: courseId } });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actionType: "CURRICULUM_COURSE_DELETED",
          targetTable: "curriculum_courses",
          targetId: courseId,
          oldValue: JSON.stringify({ label: courseLabel }),
          description: `Deleted subject ${courseLabel}`,
        },
      });
    });
  }

  async findStudentChecklistContextByUserId(userId: string) {
    return prisma.student.findUnique({
      where: { userId },
      include: STUDENT_CHECKLIST_INCLUDE,
    });
  }

  async findStudentChecklistContextByStudentId(studentId: string) {
    return prisma.student.findUnique({
      where: { id: studentId },
      include: STUDENT_CHECKLIST_INCLUDE,
    });
  }

  async findFallbackCurriculumVersionForProgram(
    programId: string,
    preferredType?: CurriculumType | null,
  ) {
    const versions = await prisma.curriculumVersion.findMany({
      where: { programId, isActive: true },
      orderBy: [{ isDefaultForNewStudents: "desc" }, { createdAt: "desc" }],
      include: {
        groups: {
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          include: {
            courses: {
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    });
    if (versions.length === 0) return null;
    if (preferredType) {
      const typeMatch = versions.find((v) => v.curriculumType === preferredType);
      if (typeMatch) return typeMatch;
    }
    return versions.find((v) => v.isDefaultForNewStudents) ?? versions[0];
  }

  async upsertStudentCourseProgress(params: {
    studentId: string;
    courseId: string;
    courseCode: string;
    actorUserId: string;
    actorRole: "STUDENT" | "ADMIN";
    status: CourseProgressStatus;
    rating: string | null;
    semester: string | null;
    schoolYear: string | null;
    remarks: string | null;
    isVerifiedByAdmin?: boolean;
    fallbackVersionToBind?: { id: string; curriculumType: CurriculumType } | null;
  }) {
    return prisma.$transaction(async (tx) => {
      if (params.fallbackVersionToBind) {
        await tx.student.updateMany({
          where: { id: params.studentId, curriculumVersionId: null },
          data: {
            curriculumVersionId: params.fallbackVersionToBind.id,
            curriculumType: params.fallbackVersionToBind.curriculumType,
          },
        });
      }

      const existing = await tx.studentCourseProgress.findUnique({
        where: {
          studentId_curriculumCourseId: {
            studentId: params.studentId,
            curriculumCourseId: params.courseId,
          },
        },
      });

      if (params.actorRole === "STUDENT" && existing?.isVerifiedByAdmin) {
        throw new AppError(
          "This subject has already been verified by the Graduate School and can no longer be edited.",
          409,
        );
      }

      const now = new Date();
      let verificationPatch: {
        isVerifiedByAdmin: boolean;
        verifiedById: string | null;
        verifiedAt: Date | null;
      };

      if (params.actorRole === "STUDENT") {
        verificationPatch = {
          isVerifiedByAdmin: false,
          verifiedById: null,
          verifiedAt: null,
        };
      } else if (params.isVerifiedByAdmin !== undefined) {
        verificationPatch = {
          isVerifiedByAdmin: params.isVerifiedByAdmin,
          verifiedById: params.isVerifiedByAdmin ? params.actorUserId : null,
          verifiedAt: params.isVerifiedByAdmin ? now : null,
        };
      } else {
        verificationPatch = {
          isVerifiedByAdmin: existing?.isVerifiedByAdmin ?? false,
          verifiedById: existing?.verifiedById ?? null,
          verifiedAt: existing?.verifiedAt ?? null,
        };
      }

      const saved = await tx.studentCourseProgress.upsert({
        where: {
          studentId_curriculumCourseId: {
            studentId: params.studentId,
            curriculumCourseId: params.courseId,
          },
        },
        update: {
          status: params.status,
          rating: params.rating,
          semester: params.semester,
          schoolYear: params.schoolYear,
          remarks: params.remarks,
          encodedByRole: params.actorRole,
          encodedById: params.actorUserId,
          ...verificationPatch,
        },
        create: {
          studentId: params.studentId,
          curriculumCourseId: params.courseId,
          status: params.status,
          rating: params.rating,
          semester: params.semester,
          schoolYear: params.schoolYear,
          remarks: params.remarks,
          encodedByRole: params.actorRole,
          encodedById: params.actorUserId,
          ...verificationPatch,
        },
      });

      if (params.actorRole === "ADMIN") {
        await tx.auditLog.create({
          data: {
            actorId: params.actorUserId,
            actionType: "STUDENT_COURSE_PROGRESS_UPDATED",
            targetTable: "student_course_progress",
            targetId: saved.id,
            oldValue: existing
              ? JSON.stringify({
                  status: existing.status,
                  rating: existing.rating,
                  semester: existing.semester,
                  schoolYear: existing.schoolYear,
                  isVerifiedByAdmin: existing.isVerifiedByAdmin,
                })
              : null,
            newValue: JSON.stringify({
              studentId: params.studentId,
              courseCode: params.courseCode,
              status: saved.status,
              rating: saved.rating,
              semester: saved.semester,
              schoolYear: saved.schoolYear,
              isVerifiedByAdmin: saved.isVerifiedByAdmin,
            }),
            description: `Admin updated ${params.courseCode} progress (${saved.status}${saved.rating ? `, ${saved.rating}` : ""})`,
          },
        });
      }

      return saved;
    });
  }

  async verifyAllPassedCourseProgress(params: {
    studentId: string;
    adminId: string;
    courseIds: string[];
  }): Promise<number> {
    if (params.courseIds.length === 0) return 0;

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const result = await tx.studentCourseProgress.updateMany({
        where: {
          studentId: params.studentId,
          curriculumCourseId: { in: params.courseIds },
          status: { in: ["PASSED", "CREDITED"] },
          isVerifiedByAdmin: false,
        },
        data: {
          isVerifiedByAdmin: true,
          verifiedById: params.adminId,
          verifiedAt: now,
        },
      });

      if (result.count > 0) {
        await tx.auditLog.create({
          data: {
            actorId: params.adminId,
            actionType: "STUDENT_CURRICULUM_VERIFIED",
            targetTable: "students",
            targetId: params.studentId,
            newValue: JSON.stringify({ verifiedCount: result.count }),
            description: `Admin verified ${result.count} completed coursework subject(s).`,
          },
        });
      }

      return result.count;
    });
  }

  async assignStudentCurriculumVersion(params: {
    studentId: string;
    adminId: string;
    oldVersionId: string | null;
    oldCurriculumType: CurriculumType | null;
    newVersion: {
      id: string;
      versionCode: string;
      label: string;
      curriculumType: CurriculumType;
    };
    reason: string;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: params.studentId },
        data: {
          curriculumVersionId: params.newVersion.id,
          curriculumType: params.newVersion.curriculumType,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: params.adminId,
          actionType: "STUDENT_CURRICULUM_VERSION_UPDATED",
          targetTable: "students",
          targetId: params.studentId,
          oldValue: JSON.stringify({
            curriculumVersionId: params.oldVersionId,
            curriculumType: params.oldCurriculumType,
          }),
          newValue: JSON.stringify({
            curriculumVersionId: params.newVersion.id,
            versionCode: params.newVersion.versionCode,
            label: params.newVersion.label,
            curriculumType: params.newVersion.curriculumType,
          }),
          description: params.reason,
        },
      });
    });
  }

  async upsertStudentGraduationMilestone(params: {
    studentId: string;
    actorUserId: string;
    actorRole: "STUDENT" | "ADMIN";
    publicationStatus: PublicationMilestoneStatus;
    publicationTitle: string | null;
    publicationVenue: string | null;
    publicationUrl: string | null;
    publicationYear: string | null;
    publicationNotes: string | null;
    isPublicationVerified?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.studentGraduationMilestone.findUnique({
        where: { studentId: params.studentId },
      });

      if (params.actorRole === "STUDENT" && existing?.isPublicationVerified) {
        throw new AppError(
          "Your publication milestone has already been verified by the Graduate School and cannot be modified.",
          409,
        );
      }

      const now = new Date();
      let isVerified = existing?.isPublicationVerified ?? false;
      let verifiedById = existing?.publicationVerifiedById ?? null;
      let verifiedAt = existing?.publicationVerifiedAt ?? null;
      let finalStatus = params.publicationStatus;

      if (params.actorRole === "STUDENT") {
        isVerified = false;
        verifiedById = null;
        verifiedAt = null;
      } else if (params.isPublicationVerified !== undefined) {
        isVerified = params.isPublicationVerified;
        verifiedById = isVerified ? params.actorUserId : null;
        verifiedAt = isVerified ? now : null;
        if (isVerified) {
          finalStatus = "VERIFIED";
        }
      } else if (finalStatus === "VERIFIED") {
        isVerified = true;
        verifiedById = params.actorUserId;
        verifiedAt = now;
      }

      const saved = await tx.studentGraduationMilestone.upsert({
        where: { studentId: params.studentId },
        update: {
          publicationStatus: finalStatus,
          publicationTitle: params.publicationTitle,
          publicationVenue: params.publicationVenue,
          publicationUrl: params.publicationUrl,
          publicationYear: params.publicationYear,
          publicationNotes: params.publicationNotes,
          isPublicationVerified: isVerified,
          publicationVerifiedById: verifiedById,
          publicationVerifiedAt: verifiedAt,
          updatedById: params.actorUserId,
        },
        create: {
          studentId: params.studentId,
          publicationStatus: finalStatus,
          publicationTitle: params.publicationTitle,
          publicationVenue: params.publicationVenue,
          publicationUrl: params.publicationUrl,
          publicationYear: params.publicationYear,
          publicationNotes: params.publicationNotes,
          isPublicationVerified: isVerified,
          publicationVerifiedById: verifiedById,
          publicationVerifiedAt: verifiedAt,
          updatedById: params.actorUserId,
        },
      });

      if (params.actorRole === "ADMIN") {
        await tx.auditLog.create({
          data: {
            actorId: params.actorUserId,
            actionType: "STUDENT_PUBLICATION_UPDATED",
            targetTable: "student_graduation_milestones",
            targetId: saved.id,
            oldValue: existing
              ? JSON.stringify({
                  publicationStatus: existing.publicationStatus,
                  isPublicationVerified: existing.isPublicationVerified,
                })
              : null,
            newValue: JSON.stringify({
              studentId: params.studentId,
              publicationStatus: saved.publicationStatus,
              isPublicationVerified: saved.isPublicationVerified,
              publicationTitle: saved.publicationTitle,
            }),
            description: `Admin updated student publication milestone (${saved.publicationStatus})`,
          },
        });
      }

      return saved;
    });
  }
}
