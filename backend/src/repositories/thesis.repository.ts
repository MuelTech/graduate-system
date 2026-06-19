import prisma from '../config/database';

export class ThesisRepository {
  
  async getStudentByUserId(userId: string) {
    return prisma.student.findUnique({ where: { userId } });
  }

  async getActiveAdviserAssignment(studentId: string) {
    return prisma.adviserAssignment.findFirst({
      where: { studentId, isActive: true },
      orderBy: { assignedDate: 'desc' }
    });
  }

  async getActiveThesis(studentId: string) {
    return prisma.thesisRecord.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTitleDefense(studentId: string, assignmentId: string, titles: string[], filePath: string) {
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

      // 3. Save the uploaded concept paper/document
      await tx.thesisDocument.create({
        data: {
          thesisId: thesis.id,
          docType: 'PROPOSAL_CHAPTERS',
          filePath: filePath,
          uploadedAt: new Date()
        }
      });

      return thesis;
    });
  }

  async updateThesisToProposal(thesisId: string, filePath: string) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: 'PROPOSAL', status: 'PENDING' }
      });

      await tx.thesisDocument.create({
        data: {
          thesisId,
          docType: 'PROPOSAL_CHAPTERS',
          filePath: filePath,
          uploadedAt: new Date()
        }
      });

      return thesis;
    });
  }

  async updateThesisToFinal(thesisId: string, filePath: string) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: 'FINAL', status: 'PENDING' }
      });

      await tx.thesisDocument.create({
        data: {
          thesisId,
          docType: 'FINAL_MANUSCRIPT',
          filePath: filePath,
          uploadedAt: new Date()
        }
      });

      return thesis;
    });
  }
}
