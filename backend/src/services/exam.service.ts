import { ExamRepository } from "../repositories/exam.repository";
import { ExamAppStatus } from "@prisma/client";
import { EmailService } from "./email.service";
import { AppError } from "../utils/AppError";
import { ExamRecordDetail } from "../interfaces/exam.interfaces";
import { manilaCalendarDate, parseScheduleDate, requireFutureSchedule, requireSameDaySchedule, scheduleStartInstant } from "./exam-schedule-time";
import { BLOCKING_EXAM_STATUSES, requireConsistentCapacity, requireConsistentCounter, requireEligibleAlignment, scheduleIdentifier, validateSlotBody } from "./exam-schedule.rules";
import { essayScoreValue } from "./exam-essay-evaluation.rules";

function completedResultStatus(application: { status: string; score: { status: string } | null }): "PASSED" | "FAILED" | null {
  const status = application.status;
  return (status === "PASSED" || status === "FAILED") && application.score?.status === status ? status : null;
}

function assignmentBlockReason(student: {
  admissionStatus: string; pinnacleApplicantId: string | null; alignmentStatus: string | null;
  user: { role: string };
}, applications: { status: string }[]): string | null {
  if (student.admissionStatus !== "APPLICANT" || student.user.role !== "APPLICANT" || !student.pinnacleApplicantId?.trim()) {
    return "Select an existing registered Applicant with a Pinnacle Applicant ID.";
  }
  if (student.alignmentStatus !== "ALIGNED" && student.alignmentStatus !== "CLEARED") {
    return "Program alignment or bridging waiver clearance is required before assignment.";
  }
  if (applications.some(app => BLOCKING_EXAM_STATUSES.some(status => status === app.status))) {
    return "This Applicant already has an examination record that prevents another assignment.";
  }
  return null;
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
    return this.admitExam({ kind: "self", userId }, slotId);
  }

  async assignApplicant(requestedStudentId: unknown, requestedSlotId: unknown) {
    const studentId = scheduleIdentifier(requestedStudentId, "studentId");
    const slotId = scheduleIdentifier(requestedSlotId, "slotId");
    return this.admitExam({ kind: "admin", studentId }, slotId);
  }

  /** Selection is advisory; confirmation independently repeats every safeguard. */
  async getAssignmentOptions(requestedStudentId: unknown) {
    const studentId = scheduleIdentifier(requestedStudentId, "studentId");
    return this.examRepo.runInTransaction(async tx => {
      const student = await this.examRepo.lockAssignmentStudent(studentId, tx);
      const applications = await this.examRepo.getStudentApplications(student.id, tx);
      const reason = assignmentBlockReason(student, applications);
      const now = new Date();
      const candidates = reason ? [] : await this.examRepo.getActiveProgramSlots(student.programId, tx, parseScheduleDate(manilaCalendarDate(now)));
      const slots = candidates.filter(slot => {
        try {
          requireSameDaySchedule(slot.examDate, slot.examTime, now);
          requireConsistentCapacity(slot, slot._count.examApplications);
          return slot.programId === student.programId && slot.isActive === true && slot.slotsTaken < slot.maxSlots;
        } catch (error) {
          if (error instanceof AppError) return false;
          throw error;
        }
      }).map(slot => ({
        id: slot.id, examDate: slot.examDate.toISOString(), examTime: slot.examTime.toISOString(),
        maxSlots: slot.maxSlots, slotsTaken: slot.slotsTaken, remainingSeats: slot.maxSlots - slot.slotsTaken,
      }));
      return {
        applicant: {
          id: student.id, firstName: student.user.firstName, lastName: student.user.lastName,
          email: student.user.email, pinnacleApplicantId: student.pinnacleApplicantId,
          program: student.program, alignmentStatus: student.alignmentStatus,
        },
        eligible: reason === null, reason, date: manilaCalendarDate(now), timeZone: "Asia/Manila", slots,
      };
    });
  }

  /** Shared B3 admission; no caller-controlled time-bypass flag. */
  private async admitExam(target: { kind: "self"; userId: string } | { kind: "admin"; studentId: string }, slotId: string) {
    const requireSchedule = target.kind === "admin" ? requireSameDaySchedule : requireFutureSchedule;
    return this.examRepo.runInTransaction(async (tx) => {
      const student = target.kind === "admin"
        ? await this.examRepo.lockAssignmentStudent(target.studentId, tx).then(async selected => {
            const reason = assignmentBlockReason(selected, await this.examRepo.getStudentApplications(selected.id, tx));
            if (reason) throw new AppError(reason, 409);
            return selected;
          })
        : await this.examRepo.lockSchedulingStudent(target.userId, tx);
      requireEligibleAlignment(student.alignmentStatus);
      const slot = await this.examRepo.lockSlot(slotId, tx);
      if (slot.programId !== student.programId) throw new AppError(target.kind === "admin"
        ? "Choose a schedule for this Applicant's Program." : "Exam slot does not belong to your Program.", target.kind === "admin" ? 409 : 403);
      if (slot.isActive !== true) throw new AppError("This schedule is closed for booking.", 409);
      requireSchedule(slot.examDate, slot.examTime);
      const assignedCount = await this.examRepo.getAssignedCount(slotId, tx);
      try {
        requireConsistentCapacity(slot, assignedCount);
      } catch (error) {
        if (target.kind === "admin" && error instanceof AppError) {
          throw new AppError("This schedule's booked-seat information needs review. Contact the schedule administrator.", 409);
        }
        throw error;
      }
      if (slot.slotsTaken >= slot.maxSlots) throw new AppError("This slot is fully booked.", 409);
      const applications = await this.examRepo.getStudentApplications(student.id, tx);
      const blocking = applications.find(app => BLOCKING_EXAM_STATUSES.some(status => status === app.status));
      if (blocking) throw new AppError(target.kind === "admin"
        ? "This Applicant already has an examination record that prevents another assignment."
        : `You already have an application with status: ${blocking.status}`, 409);

      // Recheck actual time after all potentially waiting reads and before reserve.
      requireSchedule(slot.examDate, slot.examTime);
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
      essayEvaluation: app.essayEvaluation,
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
    return this.examRepo.gradeEssay(applicationId, essayScoreValue(essayScore), adminId);
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
