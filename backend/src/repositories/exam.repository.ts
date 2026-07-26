import prisma from '../config/database';
import { Prisma, PrismaClient } from '@prisma/client';

// Type for the transaction client that Prisma provides inside $transaction
type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class ExamRepository {
    async createSlot(data: Prisma.ExamSlotUncheckedCreateInput) {
        return prisma.examSlot.create({ data });
    }

    async getFutureActiveSlots(programId: string) {
        return prisma.examSlot.findMany({
            where: {
                programId: programId,
                isActive: true,
                examDate: { gte: new Date() }
            },
            orderBy: { examDate: 'asc' }
        });
    }

    // --- TRANSACTIONAL QUERIES ---
    async runInTransaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
        return prisma.$transaction(callback);
    }

    async getStudentWithExamApps(userId: string, tx: TransactionClient) {
        return tx.student.findUnique({
            where: { userId },
            include: { examApplications: true }
        });
    }

    async getSlotById(slotId: string, tx: TransactionClient) {
        return tx.examSlot.findUnique({ where: { id: slotId }});
    }

    async incrementSlotTaken(slotId: string, tx: TransactionClient) {
        return tx.examSlot.update({
            where: { id: slotId },
            data: { slotsTaken: { increment: 1 } }
        });
    }

    async createApplication(data: Prisma.EntranceExamApplicationUncheckedCreateInput, tx: TransactionClient) {
        return tx.entranceExamApplication.create({ data });
    }

        async getAllSlots() {
        return prisma.examSlot.findMany({
            include: { program: true },
            orderBy: { examDate: 'asc' }
        });
    }

    async getApplicantStatus(userId: string) {
        return prisma.student.findUnique({
            where: { userId },
            include: {
                examApplications: {
                    include: {
                        slot: {
                            include: { program: true }
                        }
                    }
                }
            }
        });
    }

        async updateSlot(slotId: string, data: Prisma.ExamSlotUncheckedUpdateInput) {
        return prisma.examSlot.update({
            where: { id: slotId },
            data
        });
    }

    async getApplicantsForSlot(slotId: string) {
        return prisma.entranceExamApplication.findMany({
            where: { slotId },
            include: { student: { include: { user: true } } }
        });
    }

    async getAllApplications() {
        return prisma.entranceExamApplication.findMany({
            include: {
                student: {
                    include: {
                        user: true,
                    }
                },
                program: true,
                slot: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async updateApplication(applicationId: string, data: Prisma.EntranceExamApplicationUncheckedUpdateInput) {
        return prisma.entranceExamApplication.update({
            where: { id: applicationId },
            data
        });
    }

        async getAppealedExams() {
        return prisma.entranceExamApplication.findMany({
            where: { status: 'APPEALED' },
            include: {
                student: {
                    include: {
                        user: { select: { firstName: true, lastName: true, email: true } },
                        program: { select: { programName: true } }
                    }
                },
                slot: { select: { examDate: true, examTime: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async approveAppeal(applicationId: string) {
        return prisma.$transaction(async (tx) => {
            const app = await tx.entranceExamApplication.findUnique({ where: { id: applicationId } });
            if (!app || app.status !== 'APPEALED') {
                throw new Error("Application must be in APPEALED state to approve");
            }
            return tx.entranceExamApplication.update({
                where: { id: applicationId },
                data: { status: 'FAILED' }
            });
        });
    }

    async rejectAppeal(applicationId: string) {
        return prisma.$transaction(async (tx) => {
            const app = await tx.entranceExamApplication.findUnique({ where: { id: applicationId } });
            if (!app || app.status !== 'APPEALED') {
                throw new Error("Application must be in APPEALED state to reject");
            }
            return tx.entranceExamApplication.update({
                where: { id: applicationId },
                data: { status: 'DISQUALIFIED' }
            });
        });
    }

    async getLatestResult(userId: string) {
        const app = await prisma.entranceExamApplication.findFirst({
            where: {
                student: { userId: userId },
                score: { isNot: null } // Only fetch if graded
            },
            include: {
                score: true,
                slot: true,
                program: true
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!app) return null;

        const mcqTotal = await prisma.examQuestion.count({ where: { type: 'MULTIPLE_CHOICE' } });
        
        return {
            ...app,
            program: {
                ...app.program,
                examMcqTotal: mcqTotal,
                examEssayTotal: 30, // Default max essay score
                examPassingScore: Math.floor((mcqTotal + 30) * 0.75) // 75% dynamic passing score
            }
        };
    }

    async getGradingQueue() {
        const applications = await prisma.entranceExamApplication.findMany({
            where: {
                status: 'TAKEN' // Only fetch exams that are submitted and needed grading
            },
            include: {
                student: {
                    include: {
                        user: true
                    }
                },
                program: true,
                score: true,
                answers: {
                    where: {
                        question: {
                            type: 'ESSAY'
                        }
                    },
                    include: {
                        question: true
                    }
                }
            },
            orderBy: { examDate: 'asc' }
        });

        // Make MCQ total dynamic based on current questions
        const mcqTotal = await prisma.examQuestion.count({ where: { type: 'MULTIPLE_CHOICE' } });
        
        return applications.map(app => ({
            ...app,
            program: {
                ...app.program,
                examMcqTotal: mcqTotal
            }
        }));
    }

    async gradeEssay(
        applicationId: string,
        essayScore: number,
        adminId: string
    ) {
        return prisma.$transaction(async (tx) => {
            const application = await tx.entranceExamApplication.findUnique({
                where: {
                    id: applicationId
                },
                include: {
                    score: true,
                    program: true
                }
            });

            if (!application || !application.score) throw new Error("Application or pending score not found.");

            const essayTotal = application.program?.examEssayTotal || 30; // Dynamic fallback instead of hardcoded 30
            if (typeof essayScore !== 'number' || isNaN(essayScore) || essayScore < 0 || essayScore > essayTotal) {
                 throw new Error(`Invalid essay score. Must be a number between 0 and ${essayTotal}.`);
            }

            // Dynamically calculate passing score (e.g., 75% of total possible points)
            const mcqTotal = await tx.examQuestion.count({ where: { type: 'MULTIPLE_CHOICE' } });
            const dynamicPassingScore = Math.floor((mcqTotal + essayTotal) * 0.75);

            const mcqScore = Number(application.score.multipleChoiceScore || 0);
            const totalScore = mcqScore + essayScore;
            const finalStatus = totalScore >= dynamicPassingScore ? 'PASSED' : 'FAILED';

            // Update the score record with the admin's grade and ID
            await tx.entranceExamScore.update({
                where: { applicationId },
                data: {
                    essayScore,
                    totalScore,
                    status: finalStatus,
                    gradedById: adminId
                }
            });

            // Update the application status
            return tx.entranceExamApplication.update({
                where: { id: applicationId },
                data: { status: finalStatus }
            });
        });
    }

    async getScoreReview() {
        const applications = await prisma.entranceExamApplication.findMany({
            where: {
                status: {
                    in: ['PASSED', 'FAILED']
                }
            },
            include: {
                student: {
                    include: {
                        user: true
                    }
                },
                program: true,
                score: {
                    include: {
                        gradedBy: true
                    }
                },
            },
            orderBy: { createdAt: 'desc' }
        });

        // Make MCQ total dynamic based on current questions
        const mcqTotal = await prisma.examQuestion.count({ where: { type: 'MULTIPLE_CHOICE' } });

        return applications.map(app => ({
            ...app,
            program: {
                ...app.program,
                examMcqTotal: mcqTotal
            }
        }));
    }

    async getApplicationDetailsForEmail(applicationId: string) {
        return prisma.entranceExamApplication.findUnique({
            where: {
                id: applicationId
            },
            include: {
                student: {
                    include: {
                        user: true
                    }
                },
                program: true
            }
        });
    }
}
