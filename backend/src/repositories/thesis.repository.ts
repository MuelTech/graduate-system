import prisma from '../config/database';

export class ThesisRepository {
  async getStudentByUserId(userId: string) {
    return prisma.student.findUnique({ where: { userId } });
  }

  async getPendingDefenses() {
    return prisma.thesisRecord.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        student: { include: { user: true } },
        thesisTitles: true,
        thesisDocuments: true,
        assignment: { include: { adviser: true } }
      }
    });
  }

  async getApprovedDefenses() {
    return prisma.thesisRecord.findMany({
      where: {
        status: 'APPROVED'
      },
      include: {
        student: { include: { user: true } },
        thesisTitles: { where: { isSelected: true } },
        thesisDocuments: true,
        assignment: { include: { adviser: true } }
      }
    });
  }

  async getActiveAdviserAssignment(studentId: string) {
    return prisma.adviserAssignment.findFirst({
      where: { studentId, isActive: true },
      orderBy: { assignedDate: 'desc' }
    });
  }

  async getAllAdviserRequests() {
    return prisma.adviserRequest.findMany({
      include: {
        student: { include: { user: true, program: true } },
        requestedAdviser: true,
      },
      orderBy: { requestDate: 'desc' }
    });
  }

  async getAllActiveAssignments() {
    return prisma.adviserAssignment.findMany({
      where: { isActive: true },
      include: {
        student: { include: { user: true, program: true } },
        adviser: { include: { panelist: true } },
        thesisRecords: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { assignedDate: 'desc' }
    });
  }

  async getAvailableAdvisers() {
    return prisma.user.findMany({
      where: { role: 'PANELIST', panelist: { isAvailableAsAdviser: true } },
      include: { panelist: true },
    });
  }

  async getActiveThesis(studentId: string) {
    return prisma.thesisRecord.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTitleDefense(studentId: string, assignmentId: string, titles: string[], conceptPaperPath: string, corPath: string, receiptPath: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Create the base Thesis Record linked to the Adviser Assignment
      const thesis = await tx.thesisRecord.create({
        data: {
          studentId,
          assignmentId,
          stage: 'TITLE',
          status: 'PENDING'
        }
      });

      // 2. Insert the 3 proposed titles
      for (const title of titles) {
        await tx.thesisTitle.create({
          data: { thesisId: thesis.id, titleText: title }
        });
      }

      // 3. Save the uploaded concept paper, cor, and receipt
      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId: thesis.id,
            docType: 'PROPOSAL_CHAPTERS',
            filePath: conceptPaperPath,
            uploadedAt: new Date()
          },
          {
            thesisId: thesis.id,
            docType: 'COR',
            filePath: corPath,
            uploadedAt: new Date()
          },
          {
            thesisId: thesis.id,
            docType: 'RECEIPT',
            filePath: receiptPath,
            uploadedAt: new Date()
          }
        ]
      });

      return thesis;
    });
  }

  async updateThesisToProposal(thesisId: string, filePath: string, corPath: string) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: 'PROPOSAL', status: 'PENDING' }
      });

      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId,
            docType: 'PROPOSAL_CHAPTERS',
            filePath: filePath,
            uploadedAt: new Date()
          },
          {
            thesisId,
            docType: 'COR',
            filePath: corPath,
            uploadedAt: new Date()
          }
        ]
      });

      return thesis;
    });
  }

  async updateThesisToFinal(thesisId: string, filePath: string, corPath: string) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: 'FINAL', status: 'PENDING' }
      });

      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId,
            docType: 'FINAL_MANUSCRIPT',
            filePath: filePath,
            uploadedAt: new Date()
          },
          {
            thesisId,
            docType: 'COR',
            filePath: corPath,
            uploadedAt: new Date()
          }
        ]
      });

      return thesis;
    });
  }

  async createAdviserRequest(studentId: string, requestedAdviserId: string, reason?: string) {
    return prisma.adviserRequest.create({
      data: {
        studentId,
        requestedAdviserId,
        reason,
        status: 'PENDING',
        requestDate: new Date(),
        // Temporary placeholder until admin approves
        approvedById: requestedAdviserId 
      }
    });
  }

  async approveAdviserRequest(requestId: string, adviserId: string, adminId: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.adviserRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', approvedById: adminId }
      });

      const assignment = await tx.adviserAssignment.create({
        data: {
          studentId: request.studentId,
          adviserId: adviserId,
          assignedDate: new Date()
        }
      });
      return assignment;
    });
  }

  async updateThesisStatus(thesisId: string, status: any, approvedTitleId?: string) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { status }
      });

      if (approvedTitleId && status === 'APPROVED') {
        await tx.thesisTitle.update({
          where: { id: approvedTitleId },
          data: { isSelected: true }
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
          defenseTime: new Date(data.defenseTime),
          venueOrLink: data.venueOrLink,
          defenseType: data.defenseType,
          setById: adminId
        }
      });

      // 2. Assign the panelists
      for (const panelistId of data.panelistIds) {
        await tx.panelAssignment.create({
          data: {
            scheduleId: schedule.id,
            userId: panelistId,
            role: 'PANELIST'
          }
        });
      }
      
      return schedule;
    });
  }
}
