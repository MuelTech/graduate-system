import prisma from '../config/database';

export class ExamRepository {
    async createSlot(data: any) {
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
    async runInTransaction(callback: (tx: any) => Promise<any>) {
        return prisma.$transaction(callback);
    }

    async getStudentWithExamApps(userId: string, tx: any) {
        return tx.student.findUnique({
            where: { userId },
            include: { examApplications: true }
        });
    }

    async getSlotById(slotId: string, tx: any) {
        return tx.examSlot.findUnique({ where: { id: slotId }});
    }

    async incrementSlotTaken(slotId: string, tx: any) {
        return tx.examSlot.update({
            where: { id: slotId },
            data: { slotsTaken: { increment: 1 } }
        });
    }

    async createApplication(data: any, tx: any) {
        return tx.entranceExamApplication.create({ data });
    }
}
