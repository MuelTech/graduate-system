import prisma from "../config/database";

export class ThesisRepository {
  async getStudentByUserId(userId: string) {
    return prisma.student.findUnique({ where: { userId } });
  }

  async getPendingDefenses() {
    return prisma.thesisRecord.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        student: { include: { user: true } },
        thesisTitles: true,
        thesisDocuments: true,
        assignment: { include: { adviser: true } },
      },
    });
  }

  async getApprovedDefenses() {
    return prisma.thesisRecord.findMany({
      where: {
        status: "APPROVED",
      },
      include: {
        student: { include: { user: true } },
        thesisTitles: { where: { isSelected: true } },
        thesisDocuments: true,
        assignment: { include: { adviser: true } },
      },
    });
  }

  async getAllDefenses() {
    return prisma.thesisRecord.findMany({
      include: {
        student: { include: { user: true } },
        thesisTitles: true,
        thesisDocuments: true,
        assignment: { include: { adviser: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getActiveAdviserAssignment(studentId: string) {
    return prisma.adviserAssignment.findFirst({
      where: { studentId, isActive: true },
      orderBy: { assignedDate: "desc" },
    });
  }

  async getAllAdviserRequests() {
    return prisma.adviserRequest.findMany({
      include: {
        student: { include: { user: true, program: true } },
        requestedAdviser: true,
      },
      orderBy: { requestDate: "desc" },
    });
  }

  async getAllActiveAssignments() {
    return prisma.adviserAssignment.findMany({
      where: { isActive: true },
      include: {
        student: { include: { user: true, program: true } },
        adviser: { include: { panelist: true } },
        thesisRecords: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { assignedDate: "desc" },
    });
  }

  async getAvailableAdvisers() {
    return prisma.user.findMany({
      where: { role: "PANELIST", panelist: { isAvailableAsAdviser: true } },
      include: { panelist: true },
    });
  }

  async getActiveThesis(studentId: string) {
    return prisma.thesisRecord.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createTitleDefense(
    studentId: string,
    assignmentId: string,
    titles: string[],
    conceptPaperPath: string,
    corPath: string,
    receiptPath: string,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Create the base Thesis Record linked to the Adviser Assignment
      const thesis = await tx.thesisRecord.create({
        data: {
          studentId,
          assignmentId,
          stage: "TITLE",
          status: "PENDING",
        },
      });

      // 2. Insert the 3 proposed titles
      for (const title of titles) {
        await tx.thesisTitle.create({
          data: { thesisId: thesis.id, titleText: title },
        });
      }

      // 3. Save the uploaded concept paper, cor, and receipt
      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId: thesis.id,
            docType: "PROPOSAL_CHAPTERS",
            filePath: conceptPaperPath,
            uploadedAt: new Date(),
          },
          {
            thesisId: thesis.id,
            docType: "COR",
            filePath: corPath,
            uploadedAt: new Date(),
          },
          {
            thesisId: thesis.id,
            docType: "RECEIPT",
            filePath: receiptPath,
            uploadedAt: new Date(),
          },
        ],
      });

      return thesis;
    });
  }

  async updateThesisToProposal(
    thesisId: string,
    filePath: string,
    corPath: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: "PROPOSAL", status: "PENDING" },
      });

      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId,
            docType: "PROPOSAL_CHAPTERS",
            filePath: filePath,
            uploadedAt: new Date(),
          },
          {
            thesisId,
            docType: "COR",
            filePath: corPath,
            uploadedAt: new Date(),
          },
        ],
      });

      return thesis;
    });
  }

  async updateThesisToFinal(
    thesisId: string,
    filePath: string,
    corPath: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: "FINAL", status: "PENDING" },
      });

      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId,
            docType: "FINAL_MANUSCRIPT",
            filePath: filePath,
            uploadedAt: new Date(),
          },
          {
            thesisId,
            docType: "COR",
            filePath: corPath,
            uploadedAt: new Date(),
          },
        ],
      });

      return thesis;
    });
  }

  async createAdviserRequest(
    studentId: string,
    requestedAdviserId: string,
    reason?: string,
  ) {
    return prisma.adviserRequest.create({
      data: {
        studentId,
        requestedAdviserId,
        reason,
        status: "PENDING",
        requestDate: new Date(),
        // Temporary placeholder until admin approves
        approvedById: requestedAdviserId,
      },
    });
  }

  async approveAdviserRequest(
    requestId: string,
    adviserId: string,
    adminId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.adviserRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", approvedById: adminId },
      });

      const assignment = await tx.adviserAssignment.create({
        data: {
          studentId: request.studentId,
          adviserId: adviserId,
          assignedDate: new Date(),
        },
      });
      return assignment;
    });
  }

  async updateThesisStatus(
    thesisId: string,
    status: any,
    approvedTitleId?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { status },
      });

      if (approvedTitleId && status === "APPROVED") {
        await tx.thesisTitle.update({
          where: { id: approvedTitleId },
          data: { isSelected: true },
        });
      }

      return thesis;
    });
  }

  async scheduleDefense(thesisId: string, adminId: string, data: any) {
    return prisma.$transaction(async (tx) => {
      // 1. Create the schedule record
      const schedule = await tx.defenseSchedule.create({
        data: {
          thesisId,
          defenseDate: new Date(data.defenseDate),
          defenseTime: new Date(`1970-01-01T${data.defenseTime}:00.000Z`),
          venueOrLink: data.venueOrLink,
          defenseType: data.defenseType.toUpperCase(),
          setById: adminId,
        },
      });

      // 2. Assign the specific panelists based on roles
      if (data.chairmanId) {
        await tx.panelAssignment.create({
          data: {
            scheduleId: schedule.id,
            userId: data.chairmanId,
            role: "CHAIRMAN",
          },
        });
      }

      if (data.leadPanelistId) {
        await tx.panelAssignment.create({
          data: {
            scheduleId: schedule.id,
            userId: data.leadPanelistId,
            role: "PANELIST",
          },
        });
      }

      if (data.externalPanelistId) {
        await tx.panelAssignment.create({
          data: {
            scheduleId: schedule.id,
            userId: data.externalPanelistId,
            role: "PANELIST",
          },
        });
      }

      // 3. Update the ThesisRecord status to SCHEDULED
      await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { status: "SCHEDULED" },
      });

      return schedule;
    });
  }

  async getPanelistAssignments(userId: string) {
    return prisma.panelAssignment.findMany({
      where: { userId },
      include: {
        schedule: {
          include: {
            thesis: {
              include: {
                student: {
                  include: {
                    user: true,
                  },
                },
                thesisDocuments: true
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async submitOralExamScore(panelId: string, scheduleId: string, data: any) {
    return prisma.$transaction(async (tx) => {
      // Save the individual panelist's score
      const score = await tx.oralExamScore.create({
        data: {
          panelId,
          scheduleId,
          timelinessRelevance: data.timelinessRelevance,
          organization: data.organization,
          depthComprehensiveness: data.depthComprehensiveness,
          relevanceConclusions: data.relevanceConclusions,
          evidenceOriginalThinking: data.evidenceOriginalThinking,
          groupAAverage: data.groupAAverage,
          presentation: data.presentation,
          masterySubject: data.masterySubject,
          communicationSkill: data.communicationSkill,
          attitude: data.attitude,
          groupBAverage: data.groupBAverage,
          overallAverage: data.overallAverage,
          rating: data.rating,
          recommendations: data.recommendations,
          scoredAt: new Date(),
        },
      });

      // The Asynchronous Scoring Check (Race Condition)
      const assignedCount = await tx.panelAssignment.count({
        where: { scheduleId },
      });

      const submittedCount = await tx.oralExamScore.count({
        where: { scheduleId },
      });

      if (submittedCount === assignedCount) {
        // All panelists have submitted
        // Calculate the grand final summary
        const allScores = await tx.oralExamScore.findMany({
          where: { scheduleId },
        });

        const grandOverAllAverage =
          allScores.reduce((acc, s) => acc + Number(s.overallAverage), 0) /
          submittedCount;
        let finalRating: any = "PASSED";
        if (grandOverAllAverage >= 1.0 && grandOverAllAverage <= 1.25)
          finalRating = "PASSED_WITH_MERIT";
        else if (grandOverAllAverage >= 3.0) finalRating = "FAILED";

        await tx.oralExamSummary.create({
          data: {
            scheduleId,
            overallAverage: grandOverAllAverage,
            finalRating,
          },
        });

        const scheduleRecord = await tx.defenseSchedule.findUnique({
          where: { id: scheduleId },
        });

        if (scheduleRecord) {
          // Update the Thesis status to PASSED or FAILED
          await tx.thesisRecord.update({
            where: { id: scheduleRecord.thesisId },
            data: { status: finalRating === "FAILED" ? "FAILED" : "PASSED" },
          });
        }
      }

      return score;
    });
  }
}
