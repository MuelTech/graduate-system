import prisma from '../config/database';

export class ExamEngineRepository {
    async getQuestionsForApplicant() {
        return prisma.examQuestion.findMany({
            orderBy: { order: 'desc' },
            include: {
                options: {
                    select: {
                        id: true,
                        questionId: true,
                        optionText: true,
                    }
                }
            }
        });
    }

    async autoSaveAnswer(applicationId: string, questionId: string, essayAnswer: string) {
        return prisma.applicantAnswer.upsert({
            where: {
                applicationId_questionId: {
                    applicationId, questionId
                }
            },
            update: { essayAnswer },
            create: { applicationId, questionId, essayAnswer }
        });
    }

    async submitAnswers(applicationId: string, answers: any[]) {
        return prisma.$transaction(async (tx) => {
            //Upsert all answers
            for (const answer of answers) {
                await tx.applicantAnswer.upsert({
                    where: {
                        applicationId_questionId: {
                            applicationId, questionId: answer.questionId
                        }
                    },
                    update: {
                        selectedOptionId: answer.selectedOptionId || null,
                        essayAnswer: answer.essayAnswer || null
                    },
                    create: {
                        applicationId,
                        questionId: answer.questionId,
                        selectedOption: answer.selectedOptionId || null,
                        essayAnswer: answer.essayAnswer || null
                    }
                });
            }

            // Mark application as TAKEN
            await tx.entranceExamApplication.update({
                where: { id: applicationId },
                data: {
                    status: 'TAKEN'
                }
            });

            return { success: true };
        });
    }

    async getAllQuestionsForAdmin() {
        return prisma.examQuestion.findMany({
            orderBy: { order: 'asc' },
            include: { options: true } // Includes the 'isCorrect' flag
        });
    }

    async createQuestion(data: any) {
        return prisma.examQuestion.create({
            data: {
                questionText: data.questionText,
                type: data.type,
                order: data.order,
                options: data.options ? {
                    create: data.options
                } : undefined
            },
            include: { options: true }
        });
    }

    async updateQuestion(id: string, data: any) {
        if (data.options) {
            await prisma.examOption.deleteMany({
                where: { questionId: id }
            });
        }

        return prisma.examQuestion.update({
            where: { id },
            data: {
                questionText: data.questionText,
                type: data.type,
                order: data.order,
                options: data.options ? {
                    create: data.options
                } : undefined
            },
            include: { options: true }
        });
    }

    async deleteQuestion(id: string) {
        return prisma.examQuestion.delete({
            where: { id }
        });
    }
}