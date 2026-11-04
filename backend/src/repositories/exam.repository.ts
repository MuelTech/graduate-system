import prisma from '../config/database';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { scheduleIdentifier } from '../services/exam-schedule.rules';
import { essayScoreValue } from '../services/exam-essay-evaluation.rules';
import { essayReviewProjection, requireEssayReview, evaluationAuthoritySelect, evaluationScoreSelect } from './exam-essay-evaluation.projection';

// Type for the transaction client that Prisma provides inside $transaction
type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class ExamRepository {
    async createSlot(data: Prisma.ExamSlotUncheckedCreateInput) {
        return prisma.examSlot.create({ data });
    }

    async getActiveProgramSlots(programId: string, tx?: TransactionClient, examDate?: Date) {
        return (tx ?? prisma).examSlot.findMany({
            where: {
                programId: programId,
                isActive: true,
                ...(examDate ? { examDate } : {}),
            },
            include: { _count: { select: { examApplications: true } } },
            orderBy: [{ examDate: 'asc' }, { examTime: 'asc' }, { id: 'asc' }]
        });
    }

    async getSchedulingStudent(userId: string) {
        return prisma.student.findUnique({ where: { userId }, select: { id: true, programId: true, alignmentStatus: true } });
    }

    async requireProgram(programId: string, tx?: TransactionClient) {
        const program = await (tx ?? prisma).program.findUnique({ where: { id: programId }, select: { id: true } });
        if (!program) throw new AppError('Program not found.', 404);
    }

    // --- TRANSACTIONAL QUERIES ---
    async runInTransaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
        // Post-lock ordinary reads must see committed state after waiting, even on
        // MariaDB hosts whose default is REPEATABLE READ. Every B3 writer shares
        // the Student -> ExamSlot lock order; Admin writers only lock ExamSlot.
        return prisma.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    }

    async lockSchedulingStudent(userId: string, tx: TransactionClient) {
        const rows = await tx.$queryRaw<{ id: string }[]>`
            SELECT student_id AS id FROM students WHERE user_id = ${userId} FOR UPDATE
        `;
        if (!rows.length) throw new AppError('Student not found.', 404);
        const student = await tx.student.findUnique({ where: { id: rows[0].id } });
        if (!student) throw new AppError('Student not found.', 404);
        return student;
    }

    async lockSlot(slotId: string, tx: TransactionClient) {
        const rows = await tx.$queryRaw<{ id: string }[]>`
            SELECT slot_id AS id FROM exam_slots WHERE slot_id = ${slotId} FOR UPDATE
        `;
        if (!rows.length) throw new AppError('Exam slot not found.', 404);
        const slot = await tx.examSlot.findUnique({ where: { id: slotId } });
        if (!slot) throw new AppError('Exam slot not found.', 404);
        return slot;
    }

    async lockAssignmentStudent(studentId: string, tx: TransactionClient) {
        // Same physical Student lock as self-booking, before any Slot lock.
        const rows = await tx.$queryRaw<{ id: string }[]>`
            SELECT student_id AS id FROM students WHERE student_id = ${studentId} FOR UPDATE
        `;
        if (!rows.length) throw new AppError('Applicant not found.', 404);
        const student = await tx.student.findUnique({
            where: { id: studentId },
            include: {
                user: { select: { role: true, firstName: true, lastName: true, email: true } },
                program: { select: { id: true, programName: true } },
            },
        });
        if (!student) throw new AppError('Applicant not found.', 404);
        return student;
    }

    async getAssignedCount(slotId: string, tx: TransactionClient) {
        return tx.entranceExamApplication.count({ where: { slotId } });
    }

    async getStudentApplications(studentId: string, tx: TransactionClient) {
        return tx.entranceExamApplication.findMany({ where: { studentId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
    }

    async incrementSlotTaken(slotId: string, slotsTaken: number, maxSlots: number, tx: TransactionClient) {
        const result = await tx.examSlot.updateMany({
            where: { id: slotId, isActive: true, slotsTaken, maxSlots, AND: { slotsTaken: { lt: maxSlots } } },
            data: { slotsTaken: { increment: 1 } }
        });
        if (result.count !== 1) throw new AppError('This slot is fully booked or no longer available.', 409);
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

        async updateSlot(slotId: string, data: Prisma.ExamSlotUncheckedUpdateInput, tx: TransactionClient) {
        return tx.examSlot.update({
            where: { id: slotId },
            data
        });
    }

    async getAllApplications() {
        const applications = await prisma.entranceExamApplication.findMany({
            include: {
                score: { select: { essayScore: true, gradedById: true, essayEvaluatedAt: true, status: true, totalScore: true } },
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
        return applications.map(({ score, ...application }) => ({ ...application,
            // Presentation only. The locked B7 resolver remains grading authority.
            essayEvaluationCompleted: application.status === "TAKEN" && application.finalizedAt !== null &&
                application.finalizationReceiptId !== null && application.finalizationReason !== null &&
                application.finalizationAnsweredCount !== null && application.finalizationQuestionCount !== null &&
                application.actualStartedAt !== null && application.deadlineAt !== null &&
                application.contentRevisionId !== null && application.executionConfiguration !== null &&
                score?.status === "PENDING" && score.totalScore === null && score.essayScore !== null &&
                score.gradedById !== null && score.essayEvaluatedAt !== null,
        }));
    }

    async updateApplication(applicationId: string, data: Prisma.EntranceExamApplicationUncheckedUpdateInput) {
        return prisma.entranceExamApplication.update({
            where: { id: applicationId },
            data
        });
    }

    /**
     * Bounded ADMIN detail read model for one exam record.
     * Only authoritative fields; essay answers are ESSAY-only and deterministically
     * ordered; no correct-answer/option data is selected.
     */
    async getApplicationDetail(applicationId: string) {
        return prisma.$transaction(async tx => {
            const app = await tx.entranceExamApplication.findUnique({
                where: { id: applicationId },
                select: {
                    id: true,
                    status: true,
                    ...evaluationAuthoritySelect,
                    student: {
                        select: {
                            id: true,
                            pinnacleApplicantId: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    email: true,
                                },
                            },
                        },
                    },
                    program: {
                        select: {
                            id: true,
                            programName: true,
                            examMcqTotal: true,
                            examEssayTotal: true,
                        },
                    },
                    slot: {
                        select: {
                            id: true,
                            examDate: true,
                            examTime: true,
                        },
                    },
                    score: {
                        select: {
                            ...evaluationScoreSelect,
                            multipleChoiceScore: true,
                            essayScore: true,
                            totalScore: true,
                            status: true,
                            gradedBy: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                        },
                    },
                    answers: {
                        where: {
                            question: {
                                type: "ESSAY",
                            },
                        },
                        select: {
                            questionId: true,
                            essayAnswer: true,
                            question: {
                                select: {
                                    id: true,
                                    questionText: true,
                                    order: true,
                                    type: true,
                                },
                            },
                        },
                        orderBy: [
                            { question: { order: "asc" } },
                            { questionId: "asc" },
                        ],
                    },
                },
            });
            if (!app) return null;
            return { ...app, answers: app.contentRevisionId ? [] : app.answers, essayEvaluation: await essayReviewProjection(tx, app) };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
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
                score: { isNot: null } // May still be PENDING; the service checks final application/score agreement.
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

    async gradeEssay(applicationId: string, essayScore: number, adminId: string) {
        const id = scheduleIdentifier(applicationId, "applicationId");
        essayScoreValue(essayScore);
        return prisma.$transaction(async tx => {
            const rows = await tx.$queryRaw<{ status: string }[]>`
                SELECT status FROM entrance_exam_applications WHERE application_id = ${id} FOR UPDATE
            `;
            if (!rows.length) throw new AppError("Exam record not found.", 404);
            const application = await tx.entranceExamApplication.findUnique({ where: { id }, select: {
                id: true, status: true, ...evaluationAuthoritySelect, score: { select: evaluationScoreSelect },
            } });
            if (!application) throw new AppError("Exam record not found.", 404);
            const admin = await tx.user.findUnique({ where: { id: adminId }, select: { role: true, isActive: true } });
            if (admin?.role !== "ADMIN" || !admin.isActive) throw new AppError("Only an active Admin may evaluate this essay.", 403);
            const evaluation = await requireEssayReview(tx, application);
            if (evaluation.status === "COMPLETED") throw new AppError("This essay has already been evaluated. Direct regrading is unavailable.", 409);
            if (essayScore > evaluation.maximumScore) throw new AppError(`Essay score cannot exceed the recorded maximum of ${evaluation.maximumScore}.`, 400);
            // The existing score column is DECIMAL(65,30). Reject loss of precision
            // rather than silently letting the database round a submitted value.
            if (new Prisma.Decimal(essayScore).decimalPlaces() > 30) throw new AppError("Essay score exceeds the supported decimal precision.", 400);
            const score = await tx.entranceExamScore.update({ where: { applicationId: id }, data: {
                essayScore, gradedById: adminId, essayEvaluatedAt: new Date(),
            }, select: evaluationScoreSelect });
            return await requireEssayReview(tx, { ...application, score });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    }

    async getApplicationDetailsForEmail(applicationId: string) {
        return prisma.entranceExamApplication.findUnique({
            where: {
                id: applicationId
            },
            select: {
                id: true,
                status: true,
                score: { select: { status: true } },
                student: {
                    select: {
                        user: { select: { email: true, firstName: true } }
                    }
                }
            }
        });
    }
}
