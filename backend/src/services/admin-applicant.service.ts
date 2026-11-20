// backend/src/services/admin-applicant.service.ts

import bcrypt from "bcryptjs";
import { AdminApplicantRepository } from "../repositories/admin-applicant.repository";
import {
  AdminApplicantListQuery,
  AdminApplicantListResponse,
  AdminApplicantDetail,
  VerifyCorInput,
  RejectCorInput,
  UpdateAdminApplicantInput,
} from "../interfaces/admin-applicant.interfaces";
import { AppError } from "../utils/AppError";
import { validatePhilippineMobile } from "../utils/phone";
import { CorService } from "./cor.service";
import {
  deriveAdmissionStage,
  hasAuthoritativePassedExam,
} from "./admin-applicant-list.rules";
import { EmailLifecycle } from "./email-lifecycle.helper";

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BLOCKING_PROGRAM_CHANGE_EXAM_STATUSES = new Set([
  "PENDING",
  "APPROVED",
  "TAKEN",
  "PASSED",
  "FAILED",
  "APPEALED",
  "DISQUALIFIED",
  "MISSED",
]);

const EXECUTED_OR_TERMINAL_EXAM_STATUSES = new Set([
  "TAKEN",
  "PASSED",
  "FAILED",
  "APPEALED",
  "DISQUALIFIED",
  "MISSED",
]);

interface ApplicantEligibilityStudent {
  admissionStatus: string;
  examApplications: Array<{
    status: string;
    actualStartedAt?: Date | null;
    finalizedAt?: Date | null;
    score?: unknown;
    resultDecision?: unknown;
  }>;
  corUploads: Array<{
    status: string;
    corRecord?: { isAdminVerified?: boolean } | null;
  }>;
}

function canApplicantChangeProgram(student: ApplicantEligibilityStudent): boolean {
  if (student.admissionStatus !== "APPLICANT") return false;
  if (student.corUploads.some((u) => u.corRecord?.isAdminVerified)) {
    return false;
  }
  return !student.examApplications.some(
    (app) =>
      Boolean(app.actualStartedAt || app.finalizedAt || app.score || app.resultDecision) ||
      BLOCKING_PROGRAM_CHANGE_EXAM_STATUSES.has(String(app.status)),
  );
}

function evaluateApplicantDeleteEligibility(
  student: ApplicantEligibilityStudent,
  hasPassedExam: boolean,
): { canDelete: boolean; deleteBlockedReason: string | null } {
  if (student.admissionStatus !== "APPLICANT") {
    return {
      canDelete: false,
      deleteBlockedReason:
        "Promoted or enrolled Student records cannot be deleted.",
    };
  }
  if (
    student.corUploads.some(
      (u) => String(u.status) === "VERIFIED" || Boolean(u.corRecord?.isAdminVerified),
    )
  ) {
    return {
      canDelete: false,
      deleteBlockedReason:
        "Cannot delete an applicant with a verified COR record.",
    };
  }
  const hasExamAttemptOrDecision =
    hasPassedExam ||
    student.examApplications.some(
      (app) =>
        Boolean(
          app.actualStartedAt ||
            app.finalizedAt ||
            app.score ||
            app.resultDecision,
        ) || EXECUTED_OR_TERMINAL_EXAM_STATUSES.has(String(app.status)),
    );
  if (hasExamAttemptOrDecision) {
    return {
      canDelete: false,
      deleteBlockedReason:
        "Cannot delete an applicant with an entrance examination attempt or result. Deactivate the account instead.",
    };
  }
  return { canDelete: true, deleteBlockedReason: null };
}

export class AdminApplicantService {
  private repository = new AdminApplicantRepository();
  /** DL-3: the canonical COR business authority (never duplicated here). */
  private corService = new CorService();

  async listApplicants(
    query: AdminApplicantListQuery
  ): Promise<AdminApplicantListResponse> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;

    // One validated decision set drives filtering, counts and row derivation.
    const passIds = await this.repository.effectivePassIds();
    const [applicants, total] = await Promise.all([
      this.repository.findApplicants(query,passIds),
      this.repository.countApplicants(query,passIds),
    ]);

    return { applicants, total, page, pageSize };
  }

  async getApplicantDetail(id: string): Promise<AdminApplicantDetail> {
    const student = await this.repository.findStudentById(id);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    const examApp = student.examApplications[0];
    const corUpload = student.corUploads[0];

    const examStatus = examApp ? examApp.status : "NOT_SCHEDULED";
    const corStatus = corUpload ? String(corUpload.status || "NONE") : "NONE";
    const hasPassedExam = hasAuthoritativePassedExam(student.examApplications);
    const admissionStage = deriveAdmissionStage({
      hasPassedExam,
    });
    const userFlags = student.user as {
      isActive?: boolean;
      mustChangePassword?: boolean;
    };
    const deleteCheck = evaluateApplicantDeleteEligibility(
      student,
      hasPassedExam,
    );

    return {
      id: student.id,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      pinnacleApplicantId: student.pinnacleApplicantId || "",
      cellphone: student.cellphone ?? null,
      program: student.program
        ? {
            id: student.program.id,
            programName: student.program.programName,
            programType: student.program.programType,
          }
        : null,
      admissionStage,
      examStatus,
      hasPassedExam,
      corStatus,
      admissionStatus: student.admissionStatus,
      enrollmentDate: student.enrollmentDate?.toISOString() || null,
      isActive: userFlags.isActive ?? true,
      mustChangePassword: userFlags.mustChangePassword ?? false,
      canChangeProgram: canApplicantChangeProgram(student),
      canDelete: deleteCheck.canDelete,
      deleteBlockedReason: deleteCheck.deleteBlockedReason,
      examApplications: student.examApplications.map((app) => ({
        id: app.id,
        status: app.status,
        examSlot: app.slot
          ? {
              examDate: app.slot.examDate.toISOString(),
              examTime: app.slot.examTime.toISOString(),
            }
          : null,
      })),
      corUploads: student.corUploads.map((upload, index) => ({
        id: upload.id,
        status: String(upload.status || "NONE"),
        ocrStatus: upload.ocrStatus,
        originalFilename: upload.originalFilename,
        detectedMimeType: upload.detectedMimeType,
        sizeBytes: upload.sizeBytes,
        uploadedAt: upload.uploadedAt.toISOString(),
        reviewedAt: upload.reviewedAt ? upload.reviewedAt.toISOString() : null,
        rejectionReason: upload.rejectionReason ?? null,
        reviewedBy: upload.reviewedBy
          ? {
              firstName: upload.reviewedBy.firstName,
              lastName: upload.reviewedBy.lastName,
            }
          : null,
        isCurrent: index === 0,
        extraction: upload.extraction
          ? {
              status: String(upload.extraction.status),
              method: upload.extraction.method ?? null,
              processedAt: upload.extraction.processedAt
                ? upload.extraction.processedAt.toISOString()
                : null,
              manualReviewRequired:
                upload.extraction.status === "MANUAL_REQUIRED" ||
                upload.extraction.status === "FAILED",
              diagnostic: upload.extraction.diagnostic ?? null,
            }
          : null,
        corRecord: upload.corRecord
          ? {
              registrationNumber: upload.corRecord.registrationNumber || "",
              academicYear: upload.corRecord.academicYear || "",
              semester: upload.corRecord.semester || "",
              extractedProgramName: upload.corRecord.extractedProgramName || "",
              extractedYearLevel: upload.corRecord.extractedYearLevel || "",
              isVerified: upload.corRecord.isAdminVerified,
              verificationMethod: upload.corRecord.verificationMethod,
              verifiedBy: upload.corRecord.verifiedBy,
              verifiedAt: upload.corRecord.verifiedAt?.toISOString() || null,
            }
          : null,
      })),
      createdAt: student.createdAt.toISOString(),
    };
  }

  /**
   * DL-3 compatibility: resolve the student's exact current PENDING COR and
   * delegate to the canonical COR verify-and-promote authority. No independent
   * verification logic lives here.
   */
  async verifyCor(
    studentId: string,
    adminId: string,
    input: VerifyCorInput
  ): Promise<{ message: string; corStatus: string; studentNumber?: string }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    const uploadId = await this.corService.findPendingUploadIdForStudent(studentId);
    if (!uploadId) {
      throw new AppError("No pending COR upload found!", 400);
    }

    const result = await this.corService.verifyCor(uploadId, adminId, input);

    return {
      message: "COR verified and applicant promoted to Student.",
      corStatus: "VERIFIED",
      studentNumber: result.studentNumber,
    };
  }

  /**
   * DL-3 compatibility: resolve the exact current PENDING COR and delegate to
   * the canonical rejection authority.
   */
  async rejectCor(
    studentId: string,
    adminId: string,
    input: RejectCorInput
  ): Promise<{ message: string; corStatus: string }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    const uploadId = await this.corService.findPendingUploadIdForStudent(studentId);
    if (!uploadId) {
      throw new AppError("No pending COR upload found!", 400);
    }

    await this.corService.rejectCor(uploadId, adminId, input.reason);

    return {
      message: "COR rejected. Applicant may resubmit a new COR.",
      corStatus: "REJECTED",
    };
  }

  /**
   * DL-3: standalone promotion is retired. Promotion happens exclusively
   * inside the canonical COR verify-and-promote transaction. This remains as a
   * read-only/idempotent compatibility endpoint.
   */
  async promoteToStudent(
    studentId: string,
    _adminId: string
  ): Promise<{ message: string; studentNumber: string | null }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    if (student.admissionStatus === "ENROLLED") {
      return {
        message: "Applicant was already promoted to Student through COR verification.",
        studentNumber: student.studentNumber ?? null,
      };
    }

    throw new AppError(
      "Promotion is performed by the canonical COR verify-and-promote operation. Verify the applicant's COR instead.",
      409,
    );
  }

  async updateApplicant(
    studentId: string,
    adminId: string,
    input: UpdateAdminApplicantInput,
  ): Promise<AdminApplicantDetail> {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }

    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }
    if (student.admissionStatus !== "APPLICANT") {
      throw new AppError(
        "Only pending Applicant records can be edited in Applicants management.",
        409,
      );
    }

    const userId = (student.user as { id?: string }).id ?? student.userId;
    const userData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      isActive?: boolean;
    } = {};
    const studentData: {
      pinnacleApplicantId?: string;
      cellphone?: string;
      programId?: string;
    } = {};

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

    if (input.email !== undefined) {
      const trimmed = String(input.email).trim().toLowerCase();
      if (!trimmed || !EMAIL_FORMAT_REGEX.test(trimmed)) {
        throw new AppError("Please provide a valid email address.", 400);
      }
      if (trimmed !== student.user.email.toLowerCase()) {
        const duplicateEmail = await this.repository.findUserByEmailExcluding(
          trimmed,
          userId,
        );
        if (duplicateEmail) {
          throw new AppError("Email is already registered to another user.", 409);
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

    if (input.pinnacleApplicantId !== undefined) {
      const trimmed = String(input.pinnacleApplicantId).trim();
      if (!trimmed) {
        throw new AppError("Applicant ID is required.", 400);
      }
      if (trimmed !== (student.pinnacleApplicantId ?? "")) {
        const duplicateApplicantId =
          await this.repository.findStudentByApplicantIdExcluding(
            trimmed,
            student.id,
          );
        if (duplicateApplicantId) {
          throw new AppError(
            "Applicant ID is already registered to another applicant.",
            409,
          );
        }
      }
      studentData.pinnacleApplicantId = trimmed;
    }

    if (input.cellphone !== undefined) {
      studentData.cellphone = validatePhilippineMobile(input.cellphone);
    }

    if (input.programId !== undefined) {
      const nextProgramId = String(input.programId).trim();
      if (!nextProgramId) {
        throw new AppError("Program selection is required.", 400);
      }
      if (nextProgramId !== student.programId) {
        if (!canApplicantChangeProgram(student)) {
          throw new AppError(
            "Cannot change intended program once the applicant has an active or completed entrance examination.",
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
      }
    }

    if (
      Object.keys(userData).length === 0 &&
      Object.keys(studentData).length === 0
    ) {
      return this.getApplicantDetail(studentId);
    }

    const oldSnapshot = {
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      isActive: (student.user as { isActive?: boolean }).isActive ?? true,
      pinnacleApplicantId: student.pinnacleApplicantId ?? null,
      cellphone: student.cellphone ?? null,
      programId: student.programId,
    };

    const newSnapshot = {
      firstName: userData.firstName ?? oldSnapshot.firstName,
      lastName: userData.lastName ?? oldSnapshot.lastName,
      email: userData.email ?? oldSnapshot.email,
      isActive: userData.isActive ?? oldSnapshot.isActive,
      pinnacleApplicantId:
        studentData.pinnacleApplicantId ?? oldSnapshot.pinnacleApplicantId,
      cellphone: studentData.cellphone ?? oldSnapshot.cellphone,
      programId: studentData.programId ?? oldSnapshot.programId,
    };

    await this.repository.updateApplicantProfile({
      studentId: student.id,
      userId,
      adminId,
      userData,
      studentData,
      oldSnapshot,
      newSnapshot,
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

    return this.getApplicantDetail(studentId);
  }

  async resetApplicantPassword(
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
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }
    if (student.admissionStatus !== "APPLICANT") {
      throw new AppError(
        "Applicant password reset is only available for active Applicants.",
        409,
      );
    }
    const defaultPassword = String(student.user.lastName ?? "")
      .trim()
      .toUpperCase();
    if (!defaultPassword) {
      throw new AppError(
        "Applicant last name is required before resetting password.",
        400,
      );
    }

    const userId = (student.user as { id?: string }).id ?? student.userId;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    await this.repository.resetApplicantPassword({
      studentId: student.id,
      userId,
      adminId,
      passwordHash,
      email: student.user.email,
    });

    const emailDispatched = await EmailLifecycle.sendAccountPasswordReset({
      email: student.user.email,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      loginIdentifier: student.pinnacleApplicantId || student.user.email,
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

  async deleteApplicant(
    studentId: string,
    adminId: string,
  ): Promise<{ message: string }> {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    const hasPassedExam = hasAuthoritativePassedExam(student.examApplications);
    const eligibility = evaluateApplicantDeleteEligibility(student, hasPassedExam);
    if (!eligibility.canDelete) {
      throw new AppError(
        eligibility.deleteBlockedReason ||
          "Applicant account cannot be deleted.",
        409,
      );
    }

    const userId = (student.user as { id?: string }).id ?? student.userId;
    await this.repository.deleteApplicantAccount({
      studentId: student.id,
      userId,
      adminId,
      deletedSnapshot: {
        studentId: student.id,
        userId,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        pinnacleApplicantId: student.pinnacleApplicantId ?? null,
        programId: student.programId,
      },
    });

    return { message: "Applicant account deleted." };
  }
}
