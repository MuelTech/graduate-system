// backend/src/services/admin-applicant.service.ts

import { AdminApplicantRepository } from "../repositories/admin-applicant.repository";
import {
  AdminApplicantListQuery,
  AdminApplicantListResponse,
  AdminApplicantDetail,
  VerifyCorInput,
  RejectCorInput,
} from "../interfaces/admin-applicant.interfaces";
import { AppError } from "../utils/AppError";
import { CorService } from "./cor.service";
import {
  deriveAdmissionStage,
  hasAuthoritativePassedExam,
} from "./admin-applicant-list.rules";

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
}
