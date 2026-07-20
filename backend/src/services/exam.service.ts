import { ExamRepository } from '../repositories/exam.repository';
import { ExamAppStatus } from '@prisma/client';

export class ExamService {
    private examRepo = new ExamRepository();

    async createSlot(data: { programId: string, examDate: string, examTime: string, maxSlots: number }) {
        return this.examRepo.createSlot({
            programId: data.programId,
            examDate: new Date(data.examDate),
            examTime: new Date(data.examTime),
            maxSlots: data.maxSlots,
            isActive: true
        });
    }

    async getAvailableSlots(programId: string) {
        const slots = await this.examRepo.getFutureActiveSlots(programId);
        return slots.filter(slot => slot.slotsTaken < slot.maxSlots);
    }

    async scheduleExam(userId: string, slotId: string) {
        return this.examRepo.runInTransaction(async (tx) => {
            const student = await this.examRepo.getStudentWithExamApps(userId, tx);

            if (!student) throw new Error("Student not found");
            if (student.alignmentStatus === 'PENDING_WAIVER') {
                throw new Error("Cannot schedule exam. Pending Bridging Waiver.");
            }

            const previousApps = student.examApplications;
            const totalStrikes = previousApps.reduce((sum: number, app: any) => sum + app.strikeCount, 0);
            if (totalStrikes >= 2) {
                throw new Error("You have reached the maximum allowed attempts (Two strikes). You are disqualified.");
            }

            const pendingApp = previousApps.find((app: any) => app.status === 'PENDING');
            if (pendingApp) throw new Error("You already have a pending exam schedule.");

            const slot = await this.examRepo.getSlotById(slotId, tx);
            if (!slot) throw new Error("Exam slot not found.");
            if (slot.slotsTaken >= slot.maxSlots) throw new Error("This slot is fully booked.");

            await this.examRepo.incrementSlotTaken(slotId, tx);

            const application = await this.examRepo.createApplication({
                studentId: student.id,
                programId: student.programId,
                slotId: slot.id,
                applicationDate: new Date(),
                examDate: slot.examDate,
                examTime: slot.examTime,
                status: ExamAppStatus.PENDING
            }, tx);

            return application;
        });
    }

        async getAllSlots() {
        return this.examRepo.getAllSlots();
    }

    async getApplicantStatus(userId: string) {
        const student = await this.examRepo.getApplicantStatus(userId);
        if (!student) throw new Error("Student not found");

        const applications = student.examApplications || [];
        const totalStrikes = applications.reduce((sum: number, app: any) => sum + app.strikeCount, 0);

        // Find the active confirmed slot if it exists
        const activeApp = applications.find((app: any) => 
            ['PENDING', 'APPROVED', 'TAKEN', 'PASSED', 'FAILED'].includes(app.status)
        );

        let confirmedSlot = null;
        if (activeApp && activeApp.slot) {
            confirmedSlot = {
                id: activeApp.slot.id,
                examDate: activeApp.slot.examDate,
                examTime: activeApp.slot.examTime,
                programName: activeApp.slot.program?.programName || 'Unknown Program'
            };
        }

        return {
            alignmentStatus: student.alignmentStatus,
            strikeCount: totalStrikes,
            programId: student.programId,
            confirmedSlot,
            examStatus: activeApp ? activeApp.status.toLowerCase() : 'none'
        };
    }

        async updateSlot(slotId: string, data: { programId: string, examDate: string, examTime: string, maxSlots: number }) {
        const updatedSlot = await this.examRepo.updateSlot(slotId, {
            programId: data.programId,
            examDate: new Date(data.examDate),
            examTime: new Date(data.examTime),
            maxSlots: data.maxSlots
        });

        // Email Notification Placeholder
        const applications = await this.examRepo.getApplicantsForSlot(slotId);
        if (applications.length > 0) {
            console.log(`[EMAIL QUEUE] Sending schedule change notification to ${applications.length} applicants for slot ${slotId}`);
            // TODO: Implement actual Nodemailer logic here later
        }

        return updatedSlot;
    }

    async toggleSlotStatus(slotId: string, isActive: boolean) {
        return this.examRepo.updateSlot(slotId, { isActive });
    }

    async getAllApplications() {
        return this.examRepo.getAllApplications();
    }
}
