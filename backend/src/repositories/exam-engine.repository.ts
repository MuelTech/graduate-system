import prisma from "../config/database";

export class ExamEngineRepository {
  async getQuestionsForApplicant() {
    return prisma.examQuestion.findMany({
      orderBy: { order: "asc" },
      include: {
        options: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            questionId: true,
            optionText: true,
          },
        },
      },
    });
  }

  async autoSaveAnswer(
    applicationId: string,
    questionId: string,
    essayAnswer: string,
  ) {
    return prisma.applicantAnswer.upsert({
      where: {
        applicationId_questionId: {
          applicationId,
          questionId,
        },
      },
      update: { essayAnswer },
      create: { applicationId, questionId, essayAnswer },
    });
  }

  async submitAnswers(applicationId: string, answers: any[]) {
    return prisma.$transaction(async (tx) => {
      let mcqCorrect = 0;

      // 1. Upsert all answers and calculate MCQ Score
      for (const answer of answers) {
        // Check if it's correct
        const question = await tx.examQuestion.findUnique({
          where: { id: answer.questionId },
          include: { options: true },
        });

        if (question?.type === "MULTIPLE_CHOICE") {
          const selectedOpt = question.options.find(
            (o) => o.id === answer.selectedOptionId,
          );
          if (selectedOpt && selectedOpt.isCorrect) {
            mcqCorrect++;
          }
        }

        await tx.applicantAnswer.upsert({
          where: {
            applicationId_questionId: {
              applicationId,
              questionId: answer.questionId,
            },
          },
          update: {
            selectedOptionId: answer.selectedOptionId || null,
            essayAnswer: answer.essayAnswer || null,
          },
          create: {
            applicationId,
            questionId: answer.questionId,
            selectedOptionId: answer.selectedOptionId || null,
            essayAnswer: answer.essayAnswer || null,
          },
        });
      }

      // 2. Mark application as TAKEN
      await tx.entranceExamApplication.update({
        where: { id: applicationId },
        data: { status: "TAKEN" },
      });

      // 3. Create the Score Record with the Auto-Graded MCQ
      await tx.entranceExamScore.upsert({
        where: { applicationId },
        update: { multipleChoiceScore: mcqCorrect },
        create: {
          applicationId,
          multipleChoiceScore: mcqCorrect,
          status: "PENDING",
        },
      });

      return { success: true, mcqScore: mcqCorrect };
    });
  }

  async getAllQuestionsForAdmin() {
    return prisma.examQuestion.findMany({
      orderBy: { order: "asc" },
      include: {
        options: {
          orderBy: { order: "asc" },
        },
      },
    });
  }

  async createQuestion(data: any) {
    return prisma.examQuestion.create({
      data: {
        questionText: data.questionText,
        type: data.type,
        order: data.order,
        options: data.options
          ? {
              create: data.options.map((opt: any, index: number) => ({
                optionText: opt.optionText,
                isCorrect: opt.isCorrect,
                order: index,
              })),
            }
          : undefined,
      },
      include: { options: true },
    });
  }

  async updateQuestion(id: string, data: any) {
    if (data.options) {
      await prisma.examOption.deleteMany({
        where: { questionId: id },
      });
    }

    return prisma.examQuestion.update({
      where: { id },
      data: {
        questionText: data.questionText,
        type: data.type,
        order: data.order,
        options: data.options
          ? {
              create: data.options.map((opt: any, index: number) => ({
                optionText: opt.optionText,
                isCorrect: opt.isCorrect,
                order: index,
              })),
            }
          : undefined,
      },
      include: { options: true },
    });
  }

  async deleteQuestion(id: string) {
    return prisma.examQuestion.delete({
      where: { id },
    });
  }
}
