import prisma from "../config/database";
import { CompExamStatus } from "@prisma/client";

export class StudentRepository {
  async getStudentJourney(userId: string) {
    return prisma.student.findUnique({
      where: { userId },
      include: {
        program: true,
        undergraduateProgram: true,
        previousMastersProgram: true,
        residencyTracking: true,
        curriculumWaivers: true,
        bridgingWaiver: {
          include: {
            intendedProgram: true,
            undergraduateProgram: true,
          },
        },
        compExamRecords: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        thesisRecords: {
          include: {
            assignment: {
              include: { adviser: true },
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
      },
    });
  }

  async updateComprehensiveExamStatus(
    studentId: string,
    status: CompExamStatus,
  ) {
    // Check if an existing record exists; if so, update. If not, create.
    const existingRecord = await prisma.compExamRecord.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });

    if (existingRecord) {
      return prisma.compExamRecord.update({
        where: { id: existingRecord.id },
        data: { status },
      });
    } else {
      return prisma.compExamRecord.create({
        data: {
          studentId,
          status,
        },
      });
    }
  }

  async getStudentById(studentId: string) {
    return prisma.student.findUnique({
      where: { id: studentId },
    });
  }
}
