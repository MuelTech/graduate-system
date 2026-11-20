import prisma from '../config/database';

export class PlagiarismRepository {
  /**
   * Retrieves the latest recorded PlagiarismResult for a thesis.
   */
  async getLatestByThesisId(thesisId: string) {
    return prisma.plagiarismResult.findFirst({
      where: { thesisId },
      orderBy: { submittedAt: 'desc' },
      include: {
        thesis: {
          select: {
            id: true,
            stage: true,
            status: true,
            student: {
              select: {
                id: true,
                studentNumber: true,
                user: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Finds the latest thesis and current active Proposal/Final manuscript for a student.
   */
  async findActiveThesisForStudent(userId: string) {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) return null;

    return prisma.thesisRecord.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            program: { select: { programName: true, degreeName: true } },
          },
        },
        thesisDocuments: {
          where: {
            isCurrent: true,
            docType: { in: ['PROPOSAL_CHAPTERS', 'FINAL_MANUSCRIPT', 'TITLE_PROPOSAL'] },
          },
          orderBy: { uploadedAt: 'desc' },
        },
        plagiarismResults: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Finds a thesis record by ID along with its current manuscript.
   */
  async findThesisById(thesisId: string) {
    return prisma.thesisRecord.findUnique({
      where: { id: thesisId },
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            program: { select: { programName: true, degreeName: true } },
          },
        },
        thesisDocuments: {
          where: {
            isCurrent: true,
            docType: { in: ['PROPOSAL_CHAPTERS', 'FINAL_MANUSCRIPT', 'TITLE_PROPOSAL'] },
          },
          orderBy: { uploadedAt: 'desc' },
        },
        plagiarismResults: {
          orderBy: { submittedAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  /**
   * Persists a newly completed or fetched PlagiarismResult into the database.
   */
  async createPlagiarismResult(data: {
    thesisId: string;
    filePath: string;
    similarityPercentage: number;
    isEligible: boolean;
    submissionDeadline?: Date | null;
  }) {
    return prisma.plagiarismResult.create({
      data: {
        thesisId: data.thesisId,
        filePath: data.filePath,
        similarityPercentage: data.similarityPercentage,
        isEligible: data.isEligible,
        submissionDeadline: data.submissionDeadline,
        submittedAt: new Date(),
      },
    });
  }
}
