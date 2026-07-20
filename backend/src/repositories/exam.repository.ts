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
}
