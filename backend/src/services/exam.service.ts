import { ExamRepository } from "../repositories/exam.repository";
import { ExamAppStatus } from "@prisma/client";
import { EmailService } from "./email.service";
import { AppError } from "../utils/AppError";
import { ExamRecordDetail } from "../interfaces/exam.interfaces";
import { manilaCalendarDate, parseScheduleDate, requireFutureSchedule, requireSameDaySchedule, scheduleStartInstant } from "./exam-schedule-time";
import { BLOCKING_EXAM_STATUSES, requireConsistentCapacity, requireConsistentCounter, requireEligibleAlignment, scheduleIdentifier, validateSlotBody } from "./exam-schedule.rules";
import { essayScoreValue } from "./exam-essay-evaluation.rules";
import { completedResultStatus, resultProjection, validatedResultBasis } from "./exam-result.rules";
import { canAmendAppointment, requireMissedDate } from "./exam-amendment.rules";
import { institutionalProjection } from "./exam-effective-result.rules";

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

    const applications = [...(student.examApplications || [])].sort((a,b) =>
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0) || b.id.localeCompare(a.id));
    const activeApp = applications.find(app => BLOCKING_EXAM_STATUSES.some(status => status === app.status));
    let canAppealMissedExam = false;
    if (activeApp && canAmendAppointment(activeApp)) {
      try { requireMissedDate(activeApp); canAppealMissedExam = student.user.role === "APPLICANT" && student.user.isActive; } catch { /* same-day and partial evidence stay closed */ }
    }
    return {
      alignmentStatus: student.alignmentStatus, programId: student.programId,
      applicationId: activeApp?.id ?? null,
      confirmedSlot: activeApp ? { id: activeApp.slot.id, examDate: activeApp.slot.examDate, examTime: activeApp.slot.examTime,
        programName: activeApp.slot.program?.programName || "Unknown Program" } : null,
      examStatus: activeApp ? activeApp.status.toLowerCase() : "none",
      canBookExam: !activeApp && ["ALIGNED","CLEARED"].includes(student.alignmentStatus ?? ""),
      canAppealMissedExam,
      amendment: activeApp?.scheduleAmendment ? {
        type: activeApp.scheduleAmendment.type, status: activeApp.scheduleAmendment.status,
        requestedAt: activeApp.scheduleAmendment.requestedAt.toISOString(),
        reason: activeApp.scheduleAmendment.reason,
      } : null,
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
      const historyCount = await tx.entranceExamApplication.count({ where: { slotId } });
      if (historyCount > 0 && (slot.programId !== data.programId ||
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
        // Compatibility fields are deliberately unknown; Program settings are
        // not an examination's historical denominator. Use result below.
        examMcqTotal: null,
        examEssayTotal: null,
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
      result: completedResultStatus(app) ? resultProjection(app) : null,
      resultEmailEligible: completedResultStatus(app) !== null && !app.resultDecision,
      canAmendAppointment: canAmendAppointment(app),
      canReconsiderResult: (() => { try { return !app.resultDecision && validatedResultBasis(app).result === "FAILED"; } catch { return false; } })(),
      ...institutionalProjection(app),
      seatReleasedAt: app.seatReleasedAt?.toISOString() ?? null,
      replacementOfApplicationId: app.replacementFor?.applicationId ?? null,
      scheduleAmendment: app.scheduleAmendment ? {
        id: app.scheduleAmendment.id, type: app.scheduleAmendment.type, status: app.scheduleAmendment.status,
        reason: app.scheduleAmendment.reason, requestedAt: app.scheduleAmendment.requestedAt.toISOString(), requestedBy: app.scheduleAmendment.requestedBy,
        decisionReason: app.scheduleAmendment.decisionReason, decidedAt: app.scheduleAmendment.decidedAt?.toISOString() ?? null,
        decidedBy: app.scheduleAmendment.decidedBy, replacementApplicationId: app.scheduleAmendment.replacementApplicationId,
        targetSlot: app.scheduleAmendment.targetSlot ? { id: app.scheduleAmendment.targetSlot.id, examDate: app.scheduleAmendment.targetSlot.examDate.toISOString(), examTime: app.scheduleAmendment.targetSlot.examTime.toISOString() } : null,
      } : null,
      reconsideration: app.resultDecision ? { ...institutionalProjection(app).institutionalDecision!, reason: app.resultDecision.reason, decidedBy: app.resultDecision.decidedBy } : null,
    };
  }

  async appealMissedExam(_userId: string) {
    throw new AppError("Reload Examination and use Appeal Missed Exam for the exact appointment with a reason.",409);
  }

  async getAppealedExams() {
    return this.examRepo.getAppealedExams();
  }

  async approveAppeal(applicationId: string) {
    throw new AppError("Use the exact missed-appeal approval action with a future appointment and decision reason.",409);
  }

  async rejectAppeal(applicationId: string) {
    throw new AppError("Use the exact missed-appeal rejection action with a decision reason.",409);
  }

  async getExamResult(userId: string) {
    const app = await this.examRepo.getLatestResult(userId);

    if (!app || !app.score) {
      throw new AppError("No examination result is available yet.", 404);
    }

    const finalStatus = completedResultStatus(app);
    if (!finalStatus) throw new AppError("Your examination result is not yet available. It may still be awaiting evaluation.", 409);

    return {
      ...resultProjection(app),
      ...institutionalProjection(app),
      examDate: app.slot?.examDate,
      finalizedAt: app.finalizedAt?.toISOString() ?? null,
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
    return this.examRepo.queueResultEmail(applicationId, (recipient, template, firstName, jobId) =>
      EmailService.sendTemplateEmail(recipient, template, {
        student_name: firstName, portal_link: process.env.FRONTEND_URL || "http://localhost:3000",
      }, { jobId, removeOnComplete: false, removeOnFail: false }));
  }

  finalizeResult(applicationId: string, adminId: string) { return this.examRepo.finalizeResult(applicationId, adminId); }
}
