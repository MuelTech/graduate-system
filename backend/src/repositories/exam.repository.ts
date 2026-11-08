import { examAdministrationAuthorization } from "../access/exam-administration-authorization";
import prisma from '../config/database';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { scheduleIdentifier } from '../services/exam-schedule.rules';
import { essayScoreValue } from '../services/exam-essay-evaluation.rules';
import { essayReviewProjection, evaluationAuthoritySelect, evaluationScoreSelect } from './exam-essay-evaluation.projection';
import { scoreLockedApplication } from './exam-result.repository';
import { hasEffectiveExamPass } from "../services/exam-effective-result.rules";
import { completedResultStatus } from '../services/exam-result.rules';
import { amendmentInclude } from './exam-amendment.repository';
import { writeLockedEssayEvaluation } from './exam-essay-evaluation.writer';
import { facultyEssayAuthorization } from '../access/faculty-essay-authorization';

// Type for the transaction client that Prisma provides inside $transaction
type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class ExamRepository {
    constructor(private readonly access = examAdministrationAuthorization, private readonly essayAccess = facultyEssayAuthorization) {}
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
            include: { _count: { select: { examApplications: { where: { seatReleasedAt: null } } } } },
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
            select: {
                id: true, programId: true, admissionStatus: true, pinnacleApplicantId: true, alignmentStatus: true,
                user: { select: { role: true, firstName: true, lastName: true, email: true } },
                program: { select: { id: true, programName: true } },
            },
        });
        if (!student) throw new AppError('Applicant not found.', 404);
        return student;
    }

    async getAssignedCount(slotId: string, tx: TransactionClient) {
        return tx.entranceExamApplication.count({ where: { slotId, seatReleasedAt: null } });
    }

    async getStudentApplications(studentId: string, tx: TransactionClient) {
        return tx.entranceExamApplication.findMany({ where: { studentId }, select: { status: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
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
            include: { program: true, _count: { select: { examApplications: true } } },
            orderBy: { examDate: 'asc' }
        });
    }

    async getApplicantStatus(userId: string) {
        return prisma.student.findUnique({
            where: { userId },
            include: {
                user: { select: { role: true, isActive: true } },
                examApplications: {
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                    include: {
                        score: true, resultDecision: true, scheduleAmendment: { include: amendmentInclude }, _count: { select: { answers: true } },
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
            select: {
                id: true, status: true,
                // Internal evidence for the existing list flags, never response fields.
                ...evaluationAuthoritySelect,
                score: { select: {
                    id: true, status: true, multipleChoiceScore: true, essayScore: true,
                    totalScore: true, gradedById: true, essayEvaluatedAt: true,
                    scoredAt: true, scoringBasis: true,
                } },
                resultDecision: { select: {
                    applicationId: true, scoreId: true, decision: true,
                    reason: true, decidedById: true, decidedAt: true,
                } },
                student: { select: {
                    pinnacleApplicantId: true,
                    user: { select: { firstName: true, lastName: true, email: true } },
                } },
                program: { select: { id: true, programName: true } },
                slot: { select: { examDate: true, examTime: true } },
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return applications.map(application => ({
            id: application.id,
            status: application.status,
            student: {
                pinnacleApplicantId: application.student.pinnacleApplicantId,
                user: {
                    firstName: application.student.user.firstName,
                    lastName: application.student.user.lastName,
                    email: application.student.user.email,
                },
            },
            program: { id: application.program.id, programName: application.program.programName },
            slot: { examDate: application.slot.examDate, examTime: application.slot.examTime },
            reconsidered: application.resultDecision != null && hasEffectiveExamPass(application),
            // Presentation only. The locked B7 resolver remains grading authority.
            essayEvaluationCompleted: application.status === "TAKEN" && application.finalizedAt !== null &&
                application.finalizationReceiptId !== null && application.finalizationReason !== null &&
                application.finalizationAnsweredCount !== null && application.finalizationQuestionCount !== null &&
                application.actualStartedAt !== null && application.deadlineAt !== null &&
                application.contentRevisionId !== null && application.executionConfiguration !== null &&
                application.score?.status === "PENDING" && application.score.totalScore === null && application.score.essayScore !== null &&
                application.score.gradedById !== null && application.score.essayEvaluatedAt !== null,
        }));
    }

    /** Current occupants only. Internal state evidence never leaves this projection. */
    async getSlotBookings(slotId: string) {
        const slot = await prisma.examSlot.findUnique({
            where: { id: slotId },
            select: { examApplications: {
                where: { seatReleasedAt: null },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                select: {
                    id: true, status: true, createdAt: true,
                    ...evaluationAuthoritySelect,
                    student: { select: { pinnacleApplicantId: true,
                        user: { select: { firstName: true, lastName: true } },
                    } },
                    // Required solely for the existing Exam State presentation rules.
                    score: { select: { id: true, status: true, multipleChoiceScore: true,
                        essayScore: true, totalScore: true, gradedById: true,
                        essayEvaluatedAt: true, scoredAt: true, scoringBasis: true,
                    } },
                    resultDecision: { select: { id: true, applicationId: true, scoreId: true,
                        decision: true, reason: true, decidedById: true, decidedAt: true,
                    } },
                },
            } },
        });
        if (!slot) return null;
        return slot.examApplications.map(app => ({
            id: app.id, status: app.status, createdAt: app.createdAt, student: app.student,
            reconsidered: app.resultDecision != null && hasEffectiveExamPass(app),
            // Same presentation predicate as Exam Records; this grants no grading authority.
            essayEvaluationCompleted: app.status === 'TAKEN' && app.finalizedAt !== null &&
                app.finalizationReceiptId !== null && app.finalizationReason !== null &&
                app.finalizationAnsweredCount !== null && app.finalizationQuestionCount !== null &&
                app.actualStartedAt !== null && app.deadlineAt !== null &&
                app.contentRevisionId !== null && app.executionConfiguration !== null &&
                app.score?.status === 'PENDING' && app.score.totalScore === null && app.score.essayScore !== null &&
                app.score.gradedById !== null && app.score.essayEvaluatedAt !== null,
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
                    seatReleasedAt: true, startAuthorizedAt: true, startAuthorizedById: true, examDate: true, examTime: true,
                    _count: { select: { answers: true } },
                    scheduleAmendment: { include: amendmentInclude },
                    replacementFor: { select: { applicationId: true } },
                    resultDecision: { include: { decidedBy: { select: { id: true, firstName: true, lastName: true } } } },
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
                            id: true,
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

    async getLatestResult(userId: string) {
        const app = await prisma.entranceExamApplication.findFirst({
            where: {
                student: { userId: userId },
                score: { isNot: null } // May still be PENDING; the service checks final application/score agreement.
            },
            include: {
                score: true,
                resultDecision: true,
                slot: true
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!app) return null;

        return app;
    }

    async gradeEssay(applicationId: string, essayScore: number, adminId: string) {
        this.essayAccess.assertLegacyAdminGrading();
        this.access.assertExcluded("ESSAY_EVALUATION");
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
            return writeLockedEssayEvaluation(tx, application, essayScore, adminId);
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
                ...evaluationAuthoritySelect,
                score: true,
                student: {
                    select: {
                        user: { select: { email: true, firstName: true } }
                    }
                }
            }
        });
    }

    async finalizeResult(applicationId: string, adminId: string) {
        const id = scheduleIdentifier(applicationId, "applicationId");
        return prisma.$transaction(async tx => {
            await this.access.assertInTransaction(tx, adminId, "exam.results.finalize");
            const rows = await tx.$queryRaw`SELECT status FROM entrance_exam_applications WHERE application_id = ${id} FOR UPDATE`;
            if (!(rows as unknown[]).length) throw new AppError("Exam record not found.", 404);
            const admin = await tx.user.findUnique({ where: { id: adminId }, select: { role: true, isActive: true } });
            if (admin?.role !== "ADMIN" || !admin.isActive) throw new AppError("Only an active Admin may finalize a result.", 403);
            return scoreLockedApplication(tx, id);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    }

    async queueResultEmail(applicationId: string, enqueue: (recipient: string, template: string, firstName: string, jobId: string) => Promise<void>) {
        this.access.assertExcluded("RESULT_EMAIL");
        const id = scheduleIdentifier(applicationId, "applicationId");
        return prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT status FROM entrance_exam_applications WHERE application_id = ${id} FOR UPDATE`;
            const app = await tx.entranceExamApplication.findUnique({ where: { id }, include: {
                score: true, resultDecision: true, student: { select: { user: { select: { email: true, firstName: true } } } },
            } });
            if (!app) throw new AppError("Exam record not found.", 404);
            if (app.resultDecision) throw new AppError("An institutional reconsideration decision is recorded. The original computed-result email cannot be queued again. Refer to the portal decision.",409);
            const status = completedResultStatus(app);
            if (!status || !app.score) throw new AppError("A completed, consistent examination result is required before queueing a result email.", 409);
            const template = status === "PASSED" ? "ecat_result_pass" : "ecat_result_fail";
            const score = app.score;
            if ((score.resultEmailQueuedAt === null) !== (score.resultEmailTemplateKey === null) ||
                (score.resultEmailTemplateKey !== null && score.resultEmailTemplateKey !== template)) throw new AppError("Result email evidence requires staff review.", 409);
            if (score.resultEmailQueuedAt) return { success: true, alreadyQueued: true, message: "Result email already queued." };
            // Retained BullMQ identity also covers queue acceptance followed by DB failure.
            const jobId = `exam-result-${app.id}-${score.id}-${score.scoredAt?.getTime() ?? "legacy"}-${template}`;
            await enqueue(app.student.user.email, template, app.student.user.firstName, jobId);
            await tx.entranceExamScore.update({ where: { id: score.id }, data: { resultEmailQueuedAt: new Date(), resultEmailTemplateKey: template } });
            return { success: true, alreadyQueued: false, message: "Result email queued for delivery." };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    }
}
