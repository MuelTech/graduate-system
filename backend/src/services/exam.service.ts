import { ExamRepository } from "../repositories/exam.repository";
import { ExamAppStatus } from "@prisma/client";
import { EmailService } from "./email.service";
import { AppError } from "../utils/AppError";
import { ExamRecordDetail } from "../interfaces/exam.interfaces";
import { requireFutureSchedule, scheduleStartInstant } from "./exam-schedule-time";
import { BLOCKING_EXAM_STATUSES, requireConsistentCapacity, requireConsistentCounter, requireEligibleAlignment, scheduleIdentifier, validateSlotBody } from "./exam-schedule.rules";

function completedResultStatus(application: { status: string; score: { status: string } | null }): "PASSED" | "FAILED" | null {
  const status = application.status;
  return (status === "PASSED" || status === "FAILED") && application.score?.status === status ? status : null;
}

export class ExamService {
  private examRepo = new ExamRepository();

  async createSlot(input: unknown) {
    const data = validateSlotBody(input);
    await this.examRepo.requireProgram(data.programId);
    requireFutureSchedule(data.examDate, data.examTime);
    return this.examRepo.createSlot({ ...data, isActive: true });
  }

  async getAvailableSlots(userId: string, requestedProgramId?: unknown) {
    const student = await this.examRepo.getSchedulingStudent(userId);
    if (!student) throw new AppError("Student not found.", 404);
    requireEligibleAlignment(student.alignmentStatus);
    if (requestedProgramId !== undefined && scheduleIdentifier(requestedProgramId, "programId") !== student.programId.toLowerCase()) {
      throw new AppError("Requested Program does not match your Student Program.", 403);
    }
    const slots = await this.examRepo.getActiveProgramSlots(student.programId);
    const now = Date.now();
    return slots.filter(slot => {
      try {
        requireConsistentCapacity(slot, slot._count.examApplications);
        return slot.programId === student.programId && slot.isActive === true &&
          slot.slotsTaken < slot.maxSlots && scheduleStartInstant(slot.examDate, slot.examTime).getTime() > now;
      } catch (error) {
        // Invalid legacy records cannot authorize admission. Do not repair them.
        if (error instanceof AppError) {
          console.warn("Schedule excluded from booking; owner review required.", {
            slotId: slot.id, slotsTaken: slot.slotsTaken, assignedApplications: slot._count.examApplications, reason: error.message,
          });
          return false;
        }
        throw error;
      }
    }).map(({ _count, ...slot }) => slot);
  }

  async scheduleExam(userId: string, requestedSlotId: unknown) {
    const slotId = scheduleIdentifier(requestedSlotId, "slotId");
    return this.examRepo.runInTransaction(async (tx) => {
      const student = await this.examRepo.lockSchedulingStudent(userId, tx);
      requireEligibleAlignment(student.alignmentStatus);
      const slot = await this.examRepo.lockSlot(slotId, tx);
      if (slot.programId !== student.programId) throw new AppError("Exam slot does not belong to your Program.", 403);
      if (slot.isActive !== true) throw new AppError("This schedule is closed for booking.", 409);
      requireFutureSchedule(slot.examDate, slot.examTime);
      const assignedCount = await this.examRepo.getAssignedCount(slotId, tx);
      requireConsistentCapacity(slot, assignedCount);
      if (slot.slotsTaken >= slot.maxSlots) throw new AppError("This slot is fully booked.", 409);
      const applications = await this.examRepo.getStudentApplications(student.id, tx);
      const blocking = applications.find(app => BLOCKING_EXAM_STATUSES.some(status => status === app.status));
      if (blocking) throw new AppError(`You already have an application with status: ${blocking.status}`, 409);

      // Recheck actual time after all potentially waiting reads and before reserve.
      requireFutureSchedule(slot.examDate, slot.examTime);
      await this.examRepo.incrementSlotTaken(slotId, slot.slotsTaken, slot.maxSlots, tx);

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
      [
        "PENDING",
        "APPROVED",
        "TAKEN",
        "PASSED",
        "APPEALED",
        "DISQUALIFIED",
      ].includes(app.status),
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

  async updateSlot(requestedSlotId: unknown, input: unknown) {
    const slotId = scheduleIdentifier(requestedSlotId, "slotId");
    const data = validateSlotBody(input);
    return this.examRepo.runInTransaction(async tx => {
      const slot = await this.examRepo.lockSlot(slotId, tx);
      const assignedCount = await this.examRepo.getAssignedCount(slotId, tx);
      // The new validated capacity may correct an old invalid maximum, but the
      // historical assignment counter must agree before any Admin edit.
      requireConsistentCounter(slot, assignedCount);
      // Also validate the stored wall-clock rather than silently correcting it.
      scheduleStartInstant(slot.examDate, slot.examTime);
      if (assignedCount > 0 && (slot.programId !== data.programId ||
          slot.examDate.getTime() !== data.examDate.getTime() || slot.examTime.getTime() !== data.examTime.getTime())) {
        throw new AppError("Program, Exam Date and Start Time cannot change after applicants are booked.", 409);
      }
      if (data.maxSlots < assignedCount) throw new AppError("Capacity cannot be less than the booked applicant count.", 409);
      await this.examRepo.requireProgram(data.programId, tx);
      requireFutureSchedule(data.examDate, data.examTime);
      return this.examRepo.updateSlot(slotId, data, tx);
    });
  }

  async toggleSlotStatus(requestedSlotId: unknown, isActive: unknown) {
    const slotId = scheduleIdentifier(requestedSlotId, "slotId");
    if (typeof isActive !== "boolean") throw new AppError("isActive must be a boolean.", 400);
    return this.examRepo.runInTransaction(async tx => {
      const slot = await this.examRepo.lockSlot(slotId, tx);
      requireConsistentCapacity(slot, await this.examRepo.getAssignedCount(slotId, tx));
      requireFutureSchedule(slot.examDate, slot.examTime);
      return this.examRepo.updateSlot(slotId, { isActive }, tx);
    });
  }

  async getAllApplications() {
    return this.examRepo.getAllApplications();
  }

  /**
   * Bounded ADMIN detail read model. Maps the authoritative repository projection
   * into a safe DTO (Decimals -> numbers, Dates -> ISO strings). Read-only.
   */
  async getApplicationDetail(
    applicationId: string,
  ): Promise<ExamRecordDetail> {
    const app = await this.examRepo.getApplicationDetail(applicationId);
    if (!app) {
      throw new AppError("Exam record not found.", 404);
    }

    const toNumberOrNull = (value: unknown): number | null =>
      value === null || value === undefined ? null : Number(value);

    return {
      id: app.id,
      status: app.status,
      student: {
        id: app.student.id,
        pinnacleApplicantId: app.student.pinnacleApplicantId,
        user: {
          firstName: app.student.user.firstName,
          lastName: app.student.user.lastName,
          email: app.student.user.email,
        },
      },
      program: {
        id: app.program.id,
        programName: app.program.programName,
        examMcqTotal: app.program.examMcqTotal,
        examEssayTotal: app.program.examEssayTotal,
      },
      slot: {
        id: app.slot.id,
        examDate: app.slot.examDate.toISOString(),
        examTime: app.slot.examTime.toISOString(),
      },
      score: app.score
        ? {
            multipleChoiceScore: toNumberOrNull(
              app.score.multipleChoiceScore,
            ),
            essayScore: toNumberOrNull(app.score.essayScore),
            totalScore: toNumberOrNull(app.score.totalScore),
            status: app.score.status,
            gradedBy: app.score.gradedBy
              ? {
                  id: app.score.gradedBy.id,
                  firstName: app.score.gradedBy.firstName,
                  lastName: app.score.gradedBy.lastName,
                }
              : null,
          }
        : null,
      essayAnswers: app.answers.map((answer) => ({
        questionId: answer.questionId,
        questionText: answer.question.questionText,
        order: answer.question.order,
        essayAnswer: answer.essayAnswer,
      })),
    };
  }

  async appealMissedExam(userId: string) {
    return this.examRepo.runInTransaction(async (tx) => {
      // Share booking's Student authority. A delayed appeal must never resurrect
      // a formerly PENDING, now FAILED application after another booking wins.
      const student = await this.examRepo.lockSchedulingStudent(userId, tx);
      const pendingApp = await tx.entranceExamApplication.findFirst({
        where: { studentId: student.id, status: "PENDING" },
        include: { slot: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
      if (!pendingApp) {
        throw new Error("No pending or missed exam found to appeal.");
      }

      if (pendingApp.slot) {
        const d = new Date(pendingApp.slot.examDate);
        const t = new Date(pendingApp.slot.examTime);
        d.setHours(t.getHours(), t.getMinutes(), t.getSeconds());
        if (d > new Date()) {
          throw new Error("Cannot appeal an exam that has not happened yet.");
        }
      }

      // Update status to APPEALED so the admin can review it
      const updated = await tx.entranceExamApplication.updateMany({
        where: { id: pendingApp.id, status: "PENDING" },
        data: { status: "APPEALED" },
      });
      if (updated.count !== 1) throw new AppError("Application state changed; reload before appealing.", 409);

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

  async getExamResult(userId: string) {
    const app = await this.examRepo.getLatestResult(userId);

    if (!app || !app.score) {
      throw new AppError("No examination result is available yet.", 404);
    }

    const finalStatus = completedResultStatus(app);
    if (!finalStatus) throw new AppError("Your examination result is not yet available. It may still be awaiting evaluation.", 409);

    const mcqTotal = app.program?.examMcqTotal ?? 0;
    const essayTotal = app.program?.examEssayTotal ?? 0;
    const passingScore = app.program?.examPassingScore ?? 0;

    const totalPossible = mcqTotal + essayTotal;

    if (totalPossible <= 0) {
      throw new Error(
        "Exam scoring configuration is incomplete. Total possible score must be greater than zero.",
      );
    }

    return {
      status: finalStatus.toLowerCase(),
      mcqScore: Number(app.score.multipleChoiceScore || 0),
      mcqTotal: mcqTotal,
      essayScore: Number(app.score.essayScore || 0),
      essayTotal: essayTotal,
      totalScore: Number(app.score.totalScore || 0),
      totalPossible: totalPossible,
      passingScore: passingScore,
      examDate: app.slot?.examDate,
    };
  }

  async gradeEssay(
    applicationId: string,
    essayScore: number,
    adminId: string
  ) {
    if (typeof essayScore !== 'number' || isNaN(essayScore) || essayScore < 0 || essayScore > 30) {
      throw new Error("Essay score must be a valid number between 0 and 30.");
    }

    return this.examRepo.gradeEssay(applicationId, essayScore, adminId);
  }

  async confirmResultAndEmail(applicationId: string) {
    const application = await this.examRepo.getApplicationDetailsForEmail(applicationId);
    if (!application) throw new AppError("Exam record not found.", 404);

    const finalStatus = completedResultStatus(application);
    if (!finalStatus) throw new AppError("A completed, consistent examination result is required before queueing a result email.", 409);
    const template = finalStatus === 'PASSED' ? 'ecat_result_pass' : 'ecat_result_fail';

     // Dispatch actual email via BullMQ
    await EmailService.sendTemplateEmail(application.student.user.email, template, {
        student_name: application.student.user.firstName,
        portal_link: process.env.FRONTEND_URL || "http://localhost:3000"
    });

    return {
      success: true,
      message: "Grade confirmed and email successfully dispatched to the queue."
    };
    
  }
}
