import prisma from "../config/database";

export class StudentRepository {
  async getStudentJourney(userId: string) {
    return prisma.student.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            title: true,
            firstName: true,
            lastName: true,
            suffix: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        program: true,
        residencyTracking: true,
        compExamRecords: {
          orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }],
        },
        thesisRecords: {
          include: {
            assignment: {
              include: {
                adviser: {
                  select: {
                    id: true,
                    email: true,
                    title: true,
                    firstName: true,
                    lastName: true,
                    suffix: true,
                  },
                },
              },
            },
            thesisTitles: true,
            defenseSchedules: {
              include: {
                oralExamSummary: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        studentRequirements: {
          include: {
            requirement: true,
          },
        },
        adviserAssignments: {
          where: { isActive: true },
          include: {
            adviser: {
              select: {
                id: true,
                email: true,
                title: true,
                firstName: true,
                lastName: true,
                suffix: true,
              },
            },
          },
        },
        adviserRequests: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  async getStudentById(studentId: string) {
    return prisma.student.findUnique({
      where: { id: studentId },
    });
  }
}
