import { ExamRepository } from "../repositories/exam.repository";
import { ExamAppStatus } from "@prisma/client";

export class ExamService {
  private examRepo = new ExamRepository();

  async createSlot(data: {
    programId: string;
    examDate: string;
    examTime: string;
    maxSlots: number;
  }) {
    return this.examRepo.createSlot({
      programId: data.programId,
      examDate: new Date(data.examDate),
      examTime: new Date(data.examTime),
      maxSlots: data.maxSlots,
      isActive: true,
    });
  }

  async getAvailableSlots(programId: string) {
    const slots = await this.examRepo.getFutureActiveSlots(programId);
    return slots.filter((slot) => slot.slotsTaken < slot.maxSlots);
  }

  async scheduleExam(userId: string, slotId: string) {
    return this.examRepo.runInTransaction(async (tx) => {
      const student = await this.examRepo.getStudentWithExamApps(userId, tx);

      if (!student) throw new Error("Student not found");
      if (student.alignmentStatus === "PENDING_WAIVER") {
        throw new Error("Cannot schedule exam. Pending Bridging Waiver.");
      }

      const previousApps = student.examApplications;

      const pendingApp = previousApps.find(
        (app: any) => app.status === "PENDING",
      );
      if (pendingApp)
        throw new Error("You already have a pending exam schedule.");

      const slot = await this.examRepo.getSlotById(slotId, tx);
      if (!slot) throw new Error("Exam slot not found.");
      if (slot.slotsTaken >= slot.maxSlots)
        throw new Error("This slot is fully booked.");

      await this.examRepo.incrementSlotTaken(slotId, tx);

      const application = await this.examRepo.createApplication(
        {
          studentId: student.id,
          programId: student.programId,
          slotId: slot.id,
          examDate: slot.examDate,
          examTime: slot.examTime,
          status: ExamAppStatus.PENDING,
        },
        tx,
      );

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

    // Find the active confirmed slot if it exists
    const activeApp = applications.find((app: any) =>
      ["PENDING", "APPROVED", "TAKEN", "PASSED", "FAILED"].includes(app.status),
    );

    let confirmedSlot = null;
    if (activeApp && activeApp.slot) {
      confirmedSlot = {
        id: activeApp.slot.id,
        examDate: activeApp.slot.examDate,
        examTime: activeApp.slot.examTime,
        programName: activeApp.slot.program?.programName || "Unknown Program",
      };
    }

    return {
      alignmentStatus: student.alignmentStatus,
      programId: student.programId,
      confirmedSlot,
      examStatus: activeApp ? activeApp.status.toLowerCase() : "none",
    };
  }

  async updateSlot(
    slotId: string,
    data: {
      programId: string;
      examDate: string;
      examTime: string;
      maxSlots: number;
    },
  ) {
    const updatedSlot = await this.examRepo.updateSlot(slotId, {
      programId: data.programId,
      examDate: new Date(data.examDate),
      examTime: new Date(data.examTime),
      maxSlots: data.maxSlots,
    });

    // Email Notification Placeholder
    const applications = await this.examRepo.getApplicantsForSlot(slotId);
    if (applications.length > 0) {
      console.log(
        `[EMAIL QUEUE] Sending schedule change notification to ${applications.length} applicants for slot ${slotId}`,
      );
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

  async appealMissedExam(userId: string) {
    return this.examRepo.runInTransaction(async (tx) => {
      const student = await this.examRepo.getApplicantStatus(userId);
      if (!student) throw new Error("Student not found");

      const pendingApp = student.examApplications?.find(
        (app: any) => app.status === "PENDING",
      );
      if (!pendingApp) {
        throw new Error("No pending or missed exam found to appeal.");
      }

      // Update status to FAILED so it clears the way for a new schedule
      await tx.entranceExamApplication.update({
        where: { id: pendingApp.id },
        data: { status: "APPEALED" },
      });

      // TODO: In the future, you can integrate email notifications here to inform the admin

      return { success: true, message: "Appeal processed successfully." };
    });
  }

  async getAppealedExams() {
    return this.examRepo.getAppealedExams();
  }

  async approveAppeal(applicationId: string) {
    return this.examRepo.approveAppeal(applicationId);
  }

  async rejectAppeal(applicationId: string) {
    return this.examRepo.rejectAppeal(applicationId);
  }
}
