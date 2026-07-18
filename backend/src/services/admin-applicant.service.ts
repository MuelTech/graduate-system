// backend/src/services/admin-applicant.service.ts

import { AdminApplicantRepository } from "../repositories/admin-applicant.repository";
import {
  AdminApplicantListQuery,
  AdminApplicantListResponse,
  AdminApplicantDetail,
  RejectWaiverInput,
  VerifyCorInput,
  RejectCorInput,
} from "../interfaces/admin-applicant.interfaces";
import { AppError } from "../utils/AppError";

export class AdminApplicantService {
  private repository = new AdminApplicantRepository();

  async listApplicants(
    query: AdminApplicantListQuery
  ): Promise<AdminApplicantListResponse> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;

    const [applicants, total] = await Promise.all([
      this.repository.findApplicants(query),
      this.repository.countApplicants(query),
    ]);

    return { applicants, total, page, pageSize };
  }

  async getApplicantDetail(id: string): Promise<AdminApplicantDetail> {
    const student = await this.repository.findStudentById(id);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    const activityLog = await this.repository.findActivityLog(id);

    const examApp = student.examApplications[0];
    const corUpload = student.corUploads[0];

    let examStatus = "NOT_SCHEDULED";
    if (examApp) {
      examStatus = examApp.status;
    }

    let corStatus = "NONE";
    if (corUpload) {
      corStatus = corUpload.corRecord?.isAdminVerified ? "VERIFIED" : "PENDING";
    }

    return {
      id: student.id,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      pinnacleApplicantId: student.pinnacleApplicantId || "",
      cellphone: student.cellphone || "",
      dateOfBirth: student.dateOfBirth?.toISOString() || "",
      program: student.program,
      undergraduateCourse: student.undergraduateProgram?.programName || "",
      alignmentStatus: student.alignmentStatus || "ALIGNED",
      isProgramAligned: student.isProgramAligned || false,
      examStatus,
      examScores: examApp?.score
        ? {
            mcq: Number(examApp.score.multipleChoiceScore),
            essay: Number(examApp.score.essayScore),
            total: Number(examApp.score.totalScore),
          }
        : null,
      corStatus,
      admissionStatus: student.admissionStatus,
      enrollmentDate: student.enrollmentDate?.toISOString() || null,
      strikeCount: examApp?.strikeCount || 0,
      bridgingWaiver: student.bridgingWaiver
        ? {
            id: student.bridgingWaiver.id,
            status: student.bridgingWaiver.status,
            waiverFormDownloadedAt:
              student.bridgingWaiver.waiverFormDownloadedAt?.toISOString() || null,
            validatedBy: student.bridgingWaiver.validatedBy,
            validatedAt:
              student.bridgingWaiver.validatedAt?.toISOString() || null,
            adminNotes: student.bridgingWaiver.adminNotes,
          }
        : null,
      examApplications: student.examApplications.map((app) => ({
        id: app.id,
        status: app.status,
        slot: app.slot
          ? {
              examDate: app.slot.examDate.toISOString(),
              examTime: app.slot.examTime,
              venueOrLink: "",
            }
          : null,
        examScores: app.score
          ? {
              multipleChoiceScore: Number(app.score.multipleChoiceScore),
              essayScore: Number(app.score.essayScore),
              totalScore: Number(app.score.totalScore),
            }
          : null,
      })) as any,
      corUploads: student.corUploads.map((upload) => ({
        id: upload.id,
        ocrStatus: upload.ocrStatus,
        filePath: upload.filePath,
        originalFilename: upload.originalFilename,
        uploadedAt: upload.uploadedAt.toISOString(),
        corRecord: upload.corRecord
          ? {
              registrationNumber: upload.corRecord.registrationNumber || "",
              academicYear: upload.corRecord.academicYear || "",
              semester: upload.corRecord.semester || "",
              extractedProgramName: upload.corRecord.extractedProgramName || "",
              extractedYearLevel: upload.corRecord.extractedYearLevel || "",
              totalAssessment: Number(upload.corRecord.totalAssessment) || 0,
              netAssessed: Number(upload.corRecord.netAssessed) || 0,
              outstandingBalance: Number(upload.corRecord.outstandingBalance) || 0,
              isVerified: upload.corRecord.isAdminVerified,
              verificationMethod: upload.corRecord.verificationMethod,
              verifiedBy: upload.corRecord.verifiedBy,
              verifiedAt: upload.corRecord.verifiedAt?.toISOString() || null,
            }
          : null,
      })),
      activityLog,
      createdAt: student.createdAt.toISOString(),
    } as any;
  }

  async validateWaiver(
    studentId: string,
    adminId: string
  ): Promise<{ message: string; alignmentStatus: string }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    if (!student.bridgingWaiver) {
      throw new AppError("No pending waiver found!", 400);
    }

    if (student.bridgingWaiver.status !== "PENDING") {
      throw new AppError("Waiver is not in pending status!", 400);
    }

    await this.repository.updateWaiverStatus(
      student.bridgingWaiver.id,
      "VALIDATED",
      adminId
    );

    await this.repository.updateAlignmentStatus(studentId, "CLEARED");

    await this.repository.createAuditLog(
      adminId,
      "waiver_validated",
      studentId,
      "Bridging waiver validated"
    );

    return {
      message: "Waiver validated. Exam scheduling unlocked.",
      alignmentStatus: "CLEARED",
    };
  }

  async rejectWaiver(
    studentId: string,
    adminId: string,
    input: RejectWaiverInput
  ): Promise<{ message: string; alignmentStatus: string }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    if (!student.bridgingWaiver) {
      throw new AppError("No pending waiver found!", 400);
    }

    await this.repository.updateWaiverStatus(
      student.bridgingWaiver.id,
      "REJECTED",
      adminId,
      input.adminNotes
    );

    await this.repository.createAuditLog(
      adminId,
      "waiver_rejected",
      studentId,
      `Waiver rejected: ${input.adminNotes}`
    );

    return {
      message: "Waiver rejected.",
      alignmentStatus: "PENDING_WAIVER",
    };
  }

  async verifyCor(
    studentId: string,
    adminId: string,
    input: VerifyCorInput
  ): Promise<{ message: string; corStatus: string }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    const corUpload = student.corUploads[0];
    if (!corUpload) {
      throw new AppError("No COR upload found!", 400);
    }

    if (!corUpload.corRecord) {
      throw new AppError("No COR record found!", 400);
    }

    if (corUpload.corRecord.isAdminVerified) {
      throw new AppError("COR is already verified!", 400);
    }

    await this.repository.updateCorVerification(
      corUpload.corRecord.id,
      true,
      input.verificationMethod,
      adminId
    );

    await this.repository.createAuditLog(
      adminId,
      "cor_verified",
      studentId,
      `COR verified via ${input.verificationMethod}`
    );

    return {
      message: "COR verified.",
      corStatus: "VERIFIED",
    };
  }

  async rejectCor(
    studentId: string,
    adminId: string,
    input: RejectCorInput
  ): Promise<{ message: string; corStatus: string }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    const corUpload = student.corUploads[0];
    if (!corUpload) {
      throw new AppError("No COR upload found!", 400);
    }

    await this.repository.createAuditLog(
      adminId,
      "cor_rejected",
      studentId,
      `COR rejected: ${input.reason}`
    );

    return {
      message: "COR rejected. Applicant notified.",
      corStatus: "PENDING",
    };
  }

  async promoteToStudent(
    studentId: string,
    adminId: string
  ): Promise<{ message: string; studentNumber: string; credentials: { username: string; password: string } }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    if (student.admissionStatus !== "APPLICANT") {
      throw new AppError("Applicant is not in applicant status!", 400);
    }

    const examApp = student.examApplications.find(
      (app) => app.status === "PASSED"
    );
    if (!examApp) {
      throw new AppError("Applicant has not passed the entrance exam!", 400);
    }

    const corUpload = student.corUploads[0];
    if (!corUpload?.corRecord?.isAdminVerified) {
      throw new AppError("COR is not verified!", 400);
    }

    const studentNumber = corUpload.corRecord.registrationNumber || `STU-${Date.now()}`;

    const dob = student.dateOfBirth;
    const password = dob
      ? `${dob.getFullYear()}${String(dob.getMonth() + 1).padStart(2, "0")}${String(dob.getDate()).padStart(2, "0")}`
      : "password123";

    await this.repository.promoteToStudent(studentId, studentNumber);

    await this.repository.createAuditLog(
      adminId,
      "role_promoted",
      studentId,
      `Applicant promoted to Student. Student Number: ${studentNumber}`
    );

    return {
      message: "Applicant promoted to Student. Credentials dispatched.",
      studentNumber,
      credentials: {
        username: studentNumber,
        password,
      },
    };
  }

  async resetStrikes(
    studentId: string,
    adminId: string
  ): Promise<{ message: string; strikeCount: number }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    await this.repository.resetStrikeCount(studentId);

    await this.repository.createAuditLog(
      adminId,
      "strikes_reset",
      studentId,
      "Strike count reset to 0"
    );

    return {
      message: "Strike count reset.",
      strikeCount: 0,
    };
  }
}
