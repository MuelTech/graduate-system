import prisma from '../config/database';

export class EvaluationRepository {
  async createRequest(thesisId: string, type: string | undefined, desc: string | undefined, filePath: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Create the Evaluation Request
      const request = await tx.expertEvaluationRequest.create({
        data: {
          thesisId,
          instrumentType: type,
          instrumentDescription: desc,
          status: 'PENDING'
        }
      });

      // 2. Create the Document record so the Admin can download it
      await tx.thesisDocument.create({
        data: {
          thesisId,
          docType: 'INSTRUMENTS',
          filePath: filePath,
          uploadedAt: new Date()
        }
      });

      return request;
    });
  }

  async assignExpertToRequest(requestId: string, adminId: string) {
    return prisma.expertEvaluationRequest.update({
      where: { id: requestId },
      data: {
        assignedById: adminId,
        status: 'ASSIGNED'
      }
    });
  }

    async getActiveThesisForStudent(userId: string) {
    // 1. Find the student using the userId from the JWT
    const student = await prisma.student.findUnique({
      where: { userId }
    });

    if (!student) return null;

    // 2. Find their active thesis
    return prisma.thesisRecord.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' }
    });
  }
}
