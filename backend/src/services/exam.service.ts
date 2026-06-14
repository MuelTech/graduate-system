import prisma from '../config/database';
import { ExamAppStatus } from '@prisma/client';

export class ExamService {
    // 1. ADMIN: Create a new exam slot
    async createSlot(data: { programId: string, examDate: string, examTime: string, maxSlots: number }) {
        return prisma.examSlot.create({
            data: {
                programId: data.programId,
                examDate: new Date(data.examDate),
                examTime: new Date(data.examTime),
                maxSlots: data.maxSlots,
                isActive: true
            }
        });
    }

    // 2. APPLICANT: Get available slots for their specific program
    async getAvailableSlots(programId: string) {
        const slots = await prisma.examSlot.findMany({
            where: {
                programId: programId,
                isActive: true,
                examDate: { gte: new Date() } // Only show future dates
            },
            orderBy: { examDate: 'asc' }
        });
        
        // Filter out slots that are already fully booked
        return slots.filter(slot => slot.slotsTaken < slot.maxSlots);
    }

    // 3. APPLICANT: Schedule an exam
    async scheduleExam(userId: string, slotId: string) {
        return prisma.$transaction(async (tx) => {
            const student = await tx.student.findUnique({
                where: { userId },
                include: { examApplications: true }
            });

            if (!student) throw new Error("Student not found");
            
            // SECURITY CHECK: Block scheduling if waiver is pending
            if (student.alignmentStatus === 'PENDING_WAIVER') {
                throw new Error("Cannot schedule exam. Pending Bridging Waiver.");
            }

            // STRIKE POLICY CHECK: Max 2 missed attempts
            const previousApps = student.examApplications;
            const totalStrikes = previousApps.reduce((sum, app) => sum + app.strikeCount, 0);
            if (totalStrikes >= 2) {
                throw new Error("You have reached the maximum allowed attempts (Two strikes). You are disqualified.");
            }

            // CHECK: Prevent booking multiple pending schedules
            const pendingApp = previousApps.find(app => app.status === 'PENDING');
            if (pendingApp) throw new Error("You already have a pending exam schedule.");

            const slot = await tx.examSlot.findUnique({ where: { id: slotId }});
            if (!slot) throw new Error("Exam slot not found.");
            if (slot.slotsTaken >= slot.maxSlots) throw new Error("This slot is fully booked.");

            // 1. Increment the slotsTaken count
            await tx.examSlot.update({
                where: { id: slotId },
                data: { slotsTaken: { increment: 1 } }
            });

            // 2. Create the Exam Application
            const application = await tx.entranceExamApplication.create({
                data: {
                    studentId: student.id,
                    programId: student.programId,
                    slotId: slot.id,
                    applicationDate: new Date(),
                    examDate: slot.examDate,
                    examTime: slot.examTime,
                    status: ExamAppStatus.PENDING
                }
            });

            return application;
        });
    }
}