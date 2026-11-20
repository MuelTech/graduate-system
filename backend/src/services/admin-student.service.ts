// backend/src/services/admin-student.service.ts

import bcrypt from "bcryptjs";
import { AdminStudentRepository, AdminStudentListQuery } from "../repositories/admin-student.repository";
import { AppError } from "../utils/AppError";
import { validatePhilippineMobile } from "../utils/phone";
import { StudentThesisJourneyService } from "./student-thesis-journey.service";
import {
  AdminStudentDetail,
  CorrectCompExamAttemptInput,
  RecordCompExamAttemptInput,
  UpdateAdminStudentInput,
} from "../interfaces/admin-student.interfaces";
import { StudentThesisJourneyDto } from "./student-thesis-journey.rules";
import {
  MAX_COMP_EXAM_ATTEMPTS,
  buildCompExamEmailFoundationPayload,
  buildCompExamNotificationCopy,
  evaluateCompExamSummary,
} from "./comp-exam.rules";
import { CompExamCertificateService } from "./comp-exam-certificate.service";
import { EmailLifecycle } from "./email-lifecycle.helper";

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseNullableDateInput(raw: string | null, label: string): Date | null {
  if (raw === null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const isoCandidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00.000Z`
    : trimmed;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${label} format.`, 400);
  }
  return parsed;
}

export class AdminStudentService {
  private repository = new AdminStudentRepository();
  /** UIUX-2G: reuse the authoritative journey read model (no duplicated rules). */
  private journeyService = new StudentThesisJourneyService();
  private compExamCertService = new CompExamCertificateService();

  async listStudents(query: AdminStudentListQuery) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;

    const [students, total] = await Promise.all([
      this.repository.findStudents(query),
      this.repository.countStudents(query),
    ]);

    return { students, total, page, pageSize };
  }

  async getStudentDetail(id: string): Promise<AdminStudentDetail> {
    const student = await this.repository.findStudentDetailById(id);
    if (!student) {
      throw new AppError("Student not found!", 404);
    }
    return student;
  }

  /**
   * ADMIN read of a student's Thesis Journey.
   * Resolves the student server-side, then delegates to the existing
   * authoritative journey evaluator so no progression rules are duplicated and
   * no cross-student data is exposed.
   */
  async getStudentJourney(studentId: string): Promise<StudentThesisJourneyDto> {
    const userId = await this.repository.findStudentUserId(studentId);
    if (!userId) {
      throw new AppError("Student not found!", 404);
    }
    return this.journeyService.getJourney(userId);
  }

  async recordCompExamAttempt(
    studentId: string,
    adminId: string,
    input: RecordCompExamAttemptInput,
  ) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    if (input.status !== "PASSED" && input.status !== "FAILED") {
      throw new AppError("Invalid status. Must be PASSED or FAILED.", 400);
    }

    const examDate = parseNullableDateInput(
      input.examDate ?? null,
      "examination date",
    );
    const trimmedRemarks =
      typeof input.remarks === "string" ? input.remarks.trim() : "";
    if (trimmedRemarks.length > 500) {
      throw new AppError(
        "Remarks must not exceed 500 characters.",
        400,
      );
    }
    const remarks = trimmedRemarks.length > 0 ? trimmedRemarks : null;

    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Student not found!", 404);
    }
    if (student.admissionStatus !== "ENROLLED") {
      throw new AppError(
        "Comprehensive examination attempts can only be recorded for enrolled students.",
        400,
      );
    }

    const evalSummary = evaluateCompExamSummary(student.compExamRecords);
    if (evalSummary.isPassed) {
      throw new AppError(
        "Student has already passed the Written Comprehensive Examination.",
        400,
      );
    }
    if (evalSummary.isDismissed || evalSummary.nextAttemptNumber === null) {
      throw new AppError(
        `Student has reached maximum attempts (${MAX_COMP_EXAM_ATTEMPTS}). Student is permanently disqualified under Manual §7.15.4.`,
        400,
      );
    }

    const solePending =
      evalSummary.orderedRecords.length === 1 &&
      String(evalSummary.orderedRecords[0].status).toUpperCase() === "PENDING" &&
      evalSummary.orderedRecords[0].id
        ? evalSummary.orderedRecords[0].id
        : null;

    const attemptNumber = solePending ? 1 : evalSummary.nextAttemptNumber;
    const shouldDismiss =
      input.status === "FAILED" && attemptNumber >= MAX_COMP_EXAM_ATTEMPTS;

    const notification = buildCompExamNotificationCopy({
      status: input.status,
      attemptNumber,
      maxAttempts: MAX_COMP_EXAM_ATTEMPTS,
      isDismissed: shouldDismiss,
      isCorrection: false,
    });

    const studentName = `${student.user.firstName} ${student.user.lastName}`.trim();
    const emailFoundation = buildCompExamEmailFoundationPayload({
      recipientEmail: student.user.email,
      studentName,
      status: input.status,
      attemptNumber,
      maxAttempts: MAX_COMP_EXAM_ATTEMPTS,
      isDismissed: shouldDismiss,
    });

    const record = await this.repository.recordCompExamAttempt({
      studentId,
      userId: student.userId,
      adminId,
      attemptNumber,
      pendingRecordId: solePending,
      status: input.status,
      examDate,
      remarks,
      shouldDismiss,
      notification,
      emailFoundation: { ...emailFoundation },
    });

    const nextRecords = solePending
      ? student.compExamRecords.map((r) => (r.id === solePending ? record : r))
      : [record, ...student.compExamRecords];
    const afterEval = evaluateCompExamSummary(nextRecords);

    if (student.user.email) {
      EmailLifecycle.sendCompExamRecorded({
        email: student.user.email,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        attemptNumber,
        result: input.status,
        isDismissed: shouldDismiss,
        attemptsRemaining: afterEval.attemptsRemaining,
        triggeredById: adminId,
      });
    }

    const message =
      input.status === "PASSED"
        ? `Comprehensive Examination Attempt ${attemptNumber} recorded as PASSED. Title Defense is now unlocked.`
        : shouldDismiss
          ? `Comprehensive Examination Attempt ${attemptNumber} recorded as FAILED. Student is now permanently disqualified (DISMISSED) per Manual §7.15.4.`
          : `Comprehensive Examination Attempt ${attemptNumber} of ${MAX_COMP_EXAM_ATTEMPTS} recorded as FAILED (${afterEval.attemptsRemaining} remaining attempt${afterEval.attemptsRemaining === 1 ? "" : "s"}).`;

    return {
      message,
      attempt: record,
      summary: {
        standing: afterEval.standing,
        isPassed: afterEval.isPassed,
        isDismissed: afterEval.isDismissed,
        attemptsUsed: afterEval.attemptsUsed,
        failedAttempts: afterEval.failedCount,
        attemptsRemaining: afterEval.attemptsRemaining,
        maxAttempts: afterEval.maxAttempts,
        nextAttemptNumber: afterEval.nextAttemptNumber,
      },
      dismissed: shouldDismiss,
      emailNotification: emailFoundation,
    };
  }

  async correctLatestCompExamAttempt(
    studentId: string,
    adminId: string,
    input: CorrectCompExamAttemptInput,
  ) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    if (input.status !== "PASSED" && input.status !== "FAILED") {
      throw new AppError("Invalid status. Must be PASSED or FAILED.", 400);
    }

    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason.length < 5) {
      throw new AppError(
        "A correction reason of at least 5 characters is required for audit logging.",
        400,
      );
    }
    if (reason.length > 500) {
      throw new AppError(
        "Correction reason must not exceed 500 characters.",
        400,
      );
    }

    const examDate = parseNullableDateInput(
      input.examDate ?? null,
      "examination date",
    );
    const trimmedRemarks =
      typeof input.remarks === "string" ? input.remarks.trim() : "";
    if (trimmedRemarks.length > 500) {
      throw new AppError(
        "Remarks must not exceed 500 characters.",
        400,
      );
    }
    const remarks = trimmedRemarks.length > 0 ? trimmedRemarks : null;

    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Student not found!", 404);
    }
    if (student.admissionStatus === "GRADUATED") {
      throw new AppError(
        "Cannot modify comprehensive examination records for a graduated student.",
        400,
      );
    }

    const evalSummary = evaluateCompExamSummary(student.compExamRecords);
    const latestGraded = evalSummary.latestGradedAttempt;
    if (!latestGraded || !latestGraded.id) {
      throw new AppError(
        "No recorded comprehensive examination attempt is available to correct.",
        400,
      );
    }

    const previousStatus = String(latestGraded.status).toUpperCase();
    if (
      previousStatus === "PASSED" &&
      input.status === "FAILED" &&
      student.thesisRecords.length > 0
    ) {
      throw new AppError(
        "Cannot downgrade a passing Comprehensive Examination attempt because a thesis record already exists for this student.",
        409,
      );
    }

    const attemptNumber = latestGraded.attemptNumber ?? 1;
    const simulatedRecords = student.compExamRecords.map((r) =>
      r.id === latestGraded.id ? { ...r, status: input.status } : r,
    );
    const simulatedAfter = evaluateCompExamSummary(simulatedRecords);

    let nextAdmissionStatus: "ENROLLED" | "DISMISSED" | null = null;
    if (simulatedAfter.isDismissed && student.admissionStatus !== "DISMISSED") {
      nextAdmissionStatus = "DISMISSED";
    } else if (
      !simulatedAfter.isDismissed &&
      student.admissionStatus === "DISMISSED"
    ) {
      nextAdmissionStatus = "ENROLLED";
    }

    const statusChanged = previousStatus !== input.status;
    const notification = statusChanged
      ? buildCompExamNotificationCopy({
          status: input.status,
          attemptNumber,
          maxAttempts: MAX_COMP_EXAM_ATTEMPTS,
          isDismissed: simulatedAfter.isDismissed,
          isCorrection: true,
        })
      : null;

    const studentName = `${student.user.firstName} ${student.user.lastName}`.trim();
    const emailFoundation = statusChanged
      ? buildCompExamEmailFoundationPayload({
          recipientEmail: student.user.email,
          studentName,
          status: input.status,
          attemptNumber,
          maxAttempts: MAX_COMP_EXAM_ATTEMPTS,
          isDismissed: simulatedAfter.isDismissed,
        })
      : null;

    const updated = await this.repository.correctLatestCompExamAttempt({
      studentId,
      userId: student.userId,
      adminId,
      attemptId: latestGraded.id,
      attemptNumber,
      existingCertificateNumber: latestGraded.certificateNumber ?? null,
      existingCertificateIssuedAt: latestGraded.certificateIssuedAt ?? null,
      status: input.status,
      examDate,
      remarks,
      reason,
      nextAdmissionStatus,
      oldSnapshot: {
        status: previousStatus,
        examDate: latestGraded.examDate
          ? new Date(latestGraded.examDate).toISOString()
          : null,
        remarks: latestGraded.remarks ?? null,
        certificateNumber: latestGraded.certificateNumber ?? null,
        admissionStatus: student.admissionStatus,
      },
      notification,
      emailFoundation: emailFoundation ? { ...emailFoundation } : null,
    });

    const restoredToEnrolled = nextAdmissionStatus === "ENROLLED";
    const dismissed = nextAdmissionStatus === "DISMISSED";

    if (statusChanged && student.user.email) {
      EmailLifecycle.sendCompExamRecorded({
        email: student.user.email,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        attemptNumber,
        result: input.status,
        isDismissed: simulatedAfter.isDismissed,
        attemptsRemaining: simulatedAfter.attemptsRemaining,
        triggeredById: adminId,
      });
    }
    const message = restoredToEnrolled
      ? `Comprehensive Examination Attempt ${attemptNumber} corrected to ${input.status} and student restored to ENROLLED.`
      : dismissed
        ? `Comprehensive Examination Attempt ${attemptNumber} corrected to FAILED. Student is now DISMISSED per Manual §7.15.4.`
        : `Comprehensive Examination Attempt ${attemptNumber} corrected.`;

    return {
      message,
      attempt: updated,
      summary: {
        standing: simulatedAfter.standing,
        isPassed: simulatedAfter.isPassed,
        isDismissed: simulatedAfter.isDismissed,
        attemptsUsed: simulatedAfter.attemptsUsed,
        failedAttempts: simulatedAfter.failedCount,
        attemptsRemaining: simulatedAfter.attemptsRemaining,
        maxAttempts: simulatedAfter.maxAttempts,
        nextAttemptNumber: simulatedAfter.nextAttemptNumber,
      },
      restoredToEnrolled,
      dismissed,
      emailNotification: emailFoundation,
    };
  }

  async getCompExamCertificateFoundation(studentId: string) {
    return this.compExamCertService.getCertificateFoundationForStudentId(
      studentId,
    );
  }

  async updateStudent(
    studentId: string,
    adminId: string,
    input: UpdateAdminStudentInput,
  ): Promise<AdminStudentDetail> {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const existing = await this.repository.findStudentForEdit(studentId);
    if (!existing) {
      throw new AppError("Student not found!", 404);
    }
    if (existing.admissionStatus === "APPLICANT") {
      throw new AppError(
        "Applicant records cannot be edited in Students management.",
        409,
      );
    }

    const userData: {
      firstName?: string;
      lastName?: string;
      suffix?: string | null;
      email?: string;
      isActive?: boolean;
    } = {};
    const studentData: {
      studentNumber?: string;
      cellphone?: string;
      programId?: string;
      curriculumType?: "NEW" | "OLD" | null;
      curriculumVersionId?: string | null;
      enrollmentDate?: Date | null;
      residencyStartDate?: Date | null;
    } = {};
    let syncStudentNumberOnCor: string | undefined;
    const syncResidencyTracking: { startDate?: Date; maxYears?: number } = {};

    if (input.firstName !== undefined) {
      const trimmed = String(input.firstName).trim();
      if (!trimmed) throw new AppError("First name is required.", 400);
      userData.firstName = trimmed;
    }

    if (input.lastName !== undefined) {
      const trimmed = String(input.lastName).trim();
      if (!trimmed) throw new AppError("Last name is required.", 400);
      userData.lastName = trimmed;
    }

    if (input.suffix !== undefined) {
      const trimmed =
        input.suffix === null ? "" : String(input.suffix).trim();
      userData.suffix = trimmed || null;
    }

    if (input.email !== undefined) {
      const trimmed = String(input.email).trim().toLowerCase();
      if (!trimmed || !EMAIL_FORMAT_REGEX.test(trimmed)) {
        throw new AppError("Please provide a valid email address.", 400);
      }
      if (trimmed !== existing.user.email.toLowerCase()) {
        const duplicateEmail = await this.repository.findUserByEmailExcluding(
          trimmed,
          existing.user.id,
        );
        if (duplicateEmail) {
          throw new AppError(
            "Email is already registered to another user.",
            409,
          );
        }
      }
      userData.email = trimmed;
    }

    if (input.isActive !== undefined) {
      if (typeof input.isActive !== "boolean") {
        throw new AppError("Account active status must be true or false.", 400);
      }
      userData.isActive = input.isActive;
    }

    if (input.studentNumber !== undefined) {
      const trimmed = String(input.studentNumber).trim();
      if (!trimmed) {
        throw new AppError("Student number is required.", 400);
      }
      if (trimmed !== (existing.studentNumber ?? "")) {
        const duplicateNum = await this.repository.findStudentByNumberExcluding(
          trimmed,
          existing.id,
        );
        if (duplicateNum) {
          throw new AppError(
            "Student number is already assigned to another student.",
            409,
          );
        }
        studentData.studentNumber = trimmed;
        syncStudentNumberOnCor = trimmed;
      }
    }

    if (input.cellphone !== undefined) {
      studentData.cellphone = validatePhilippineMobile(input.cellphone);
    }

    if (input.programId !== undefined) {
      const nextProgramId = String(input.programId).trim();
      if (!nextProgramId) {
        throw new AppError("Program selection is required.", 400);
      }
      if (nextProgramId !== existing.programId) {
        if (
          !AdminStudentRepository.canChangeProgram(
            existing.admissionStatus,
            existing.thesisRecords ?? [],
          )
        ) {
          throw new AppError(
            "Program changes are prohibited once Title Defense is completed or the student is no longer actively enrolled.",
            409,
          );
        }
        const program = await this.repository.findProgramById(nextProgramId);
        if (!program || program.isActive === false) {
          throw new AppError(
            "Selected graduate program is not available.",
            400,
          );
        }
        studentData.programId = program.id;
        if (program.maxResidencyYears != null) {
          syncResidencyTracking.maxYears = program.maxResidencyYears;
        }
        const matchedVersion = await this.repository.findCurriculumVersionForProgram?.(
          program.id,
          input.curriculumType ?? existing.curriculumType ?? null,
        );
        studentData.curriculumVersionId = matchedVersion?.id ?? null;
        if (matchedVersion && input.curriculumType === undefined) {
          studentData.curriculumType = matchedVersion.curriculumType;
        }
      }
    }

    if (input.curriculumType !== undefined) {
      if (
        input.curriculumType !== null &&
        input.curriculumType !== "NEW" &&
        input.curriculumType !== "OLD"
      ) {
        throw new AppError("Curriculum type must be NEW or OLD.", 400);
      }
      studentData.curriculumType = input.curriculumType;
      if (
        !studentData.programId &&
        input.curriculumType !== existing.curriculumType
      ) {
        if (input.curriculumType === null) {
          studentData.curriculumVersionId = null;
        } else {
          const matchedVersion =
            await this.repository.findCurriculumVersionForProgram?.(
              existing.programId,
              input.curriculumType,
            );
          if (matchedVersion) {
            studentData.curriculumVersionId = matchedVersion.id;
          }
        }
      }
    }

    if (input.enrollmentDate !== undefined) {
      studentData.enrollmentDate = parseNullableDateInput(
        input.enrollmentDate,
        "enrollment date",
      );
    }

    if (input.residencyStartDate !== undefined) {
      const parsedResidency = parseNullableDateInput(
        input.residencyStartDate,
        "residency start date",
      );
      studentData.residencyStartDate = parsedResidency;
      if (parsedResidency) {
        syncResidencyTracking.startDate = parsedResidency;
      }
    }

    const isStatusToggleOnly =
      input.isActive !== undefined &&
      Object.keys(userData).length === 1 &&
      Object.keys(studentData).length === 0;

    if (
      Object.keys(userData).length === 0 &&
      Object.keys(studentData).length === 0
    ) {
      return this.getStudentDetail(studentId);
    }

    const reasonText = String(input.reason ?? "").trim();
    if (!isStatusToggleOnly && reasonText.length < 3) {
      throw new AppError(
        "Please provide a brief reason for this student record update.",
        400,
      );
    }

    const oldSnapshot = {
      firstName: existing.user.firstName,
      lastName: existing.user.lastName,
      suffix: existing.user.suffix ?? null,
      email: existing.user.email,
      isActive: existing.user.isActive,
      studentNumber: existing.studentNumber ?? null,
      cellphone: existing.cellphone ?? null,
      programId: existing.programId,
      curriculumType: existing.curriculumType ?? null,
      enrollmentDate: existing.enrollmentDate?.toISOString() ?? null,
      residencyStartDate: existing.residencyStartDate?.toISOString() ?? null,
    };

    const newSnapshot = {
      firstName: userData.firstName ?? oldSnapshot.firstName,
      lastName: userData.lastName ?? oldSnapshot.lastName,
      suffix:
        userData.suffix !== undefined ? userData.suffix : oldSnapshot.suffix,
      email: userData.email ?? oldSnapshot.email,
      isActive: userData.isActive ?? oldSnapshot.isActive,
      studentNumber: studentData.studentNumber ?? oldSnapshot.studentNumber,
      cellphone: studentData.cellphone ?? oldSnapshot.cellphone,
      programId: studentData.programId ?? oldSnapshot.programId,
      curriculumType:
        studentData.curriculumType !== undefined
          ? studentData.curriculumType
          : oldSnapshot.curriculumType,
      enrollmentDate:
        studentData.enrollmentDate !== undefined
          ? (studentData.enrollmentDate?.toISOString() ?? null)
          : oldSnapshot.enrollmentDate,
      residencyStartDate:
        studentData.residencyStartDate !== undefined
          ? (studentData.residencyStartDate?.toISOString() ?? null)
          : oldSnapshot.residencyStartDate,
    };

    await this.repository.updateStudentProfile({
      studentId: existing.id,
      userId: existing.user.id,
      adminId,
      userData,
      studentData,
      syncStudentNumberOnCor,
      syncResidencyTracking:
        Object.keys(syncResidencyTracking).length > 0
          ? syncResidencyTracking
          : undefined,
      oldSnapshot,
      newSnapshot,
      reason:
        reasonText ||
        (isStatusToggleOnly
          ? `Admin updated student portal account access to ${input.isActive ? "Active" : "Inactive"}.`
          : "Admin updated student record."),
    });

    if (
      typeof userData.isActive === "boolean" &&
      userData.isActive !== oldSnapshot.isActive
    ) {
      EmailLifecycle.sendAccountStatusChanged({
        email: newSnapshot.email,
        firstName: newSnapshot.firstName,
        lastName: newSnapshot.lastName,
        isActive: userData.isActive,
        triggeredById: adminId,
      });
    }

    return this.getStudentDetail(studentId);
  }

  async resetStudentPassword(
    studentId: string,
    adminId: string,
  ): Promise<{
    message: string;
    mustChangePassword: boolean;
    emailDispatched: boolean;
  }> {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const existing = await this.repository.findStudentForEdit(studentId);
    if (!existing) {
      throw new AppError("Student not found!", 404);
    }
    if (existing.admissionStatus === "APPLICANT") {
      throw new AppError(
        "Student password reset is only available for Student registry accounts.",
        409,
      );
    }
    const defaultPassword = String(existing.user.lastName ?? "")
      .trim()
      .toUpperCase();
    if (!defaultPassword) {
      throw new AppError(
        "Student last name is required before resetting password.",
        400,
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    await this.repository.resetStudentPassword({
      studentId: existing.id,
      userId: existing.user.id,
      adminId,
      passwordHash,
      email: existing.user.email,
      studentNumber: existing.studentNumber ?? null,
    });

    const emailDispatched = await EmailLifecycle.sendAccountPasswordReset({
      email: existing.user.email,
      firstName: existing.user.firstName,
      lastName: existing.user.lastName,
      loginIdentifier: existing.studentNumber || existing.user.email,
      triggeredById: adminId,
    });

    return {
      message: emailDispatched
        ? "Password reset to temporary default (LAST NAME in ALL CAPS). Notification email queued for delivery."
        : "Password reset to temporary default (LAST NAME in ALL CAPS).",
      mustChangePassword: true,
      emailDispatched,
    };
  }
}
