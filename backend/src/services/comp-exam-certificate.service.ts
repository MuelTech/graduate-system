import prisma from "../config/database";
import { formatOfficialProgramDisplay } from "../config/graduate-programs";
import { AppError } from "../utils/AppError";
import { evaluateCompExamSummary } from "./comp-exam.rules";
import { loadInstitutionalOfficials } from "./institutional-officials.service";

export type CompExamCertificateTemplateStatus = "TEMPLATE_PENDING";

export interface CompExamCertificatePayload {
  studentName: string;
  studentNumber: string | null;
  programDisplay: string;
  attemptNumber: number;
  examDate: string | null;
  recordedAt: string;
  result: "PASSED";
  remarks: string | null;
  signatoryDeanName: string | null;
}

export interface CompExamCertificateFoundationDto {
  studentId: string;
  eligible: boolean;
  templateStatus: CompExamCertificateTemplateStatus;
  templateNotice: string;
  certificateNumber: string | null;
  issuedAt: string | null;
  payload: CompExamCertificatePayload | null;
}

function formatPersonFullName(user: {
  title?: string | null;
  firstName: string;
  lastName: string;
  suffix?: string | null;
}): string {
  return [user.title, user.firstName, user.lastName, user.suffix]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export class CompExamCertificateService {
  async getCertificateFoundationForStudentId(
    studentId: string,
  ): Promise<CompExamCertificateFoundationDto> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        studentNumber: true,
        user: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
            suffix: true,
          },
        },
        program: {
          select: {
            programName: true,
            degreeName: true,
            majorName: true,
            programCode: true,
          },
        },
        compExamRecords: {
          orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            examDate: true,
            remarks: true,
            certificateNumber: true,
            certificateIssuedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!student) {
      throw new AppError("Student not found!", 404);
    }

    const summary = evaluateCompExamSummary(student.compExamRecords);
    const passed = summary.passedAttempt;

    if (!passed) {
      return {
        studentId: student.id,
        eligible: false,
        templateStatus: "TEMPLATE_PENDING",
        templateNotice:
          "Certificate issuance is available once a passing Written Comprehensive Examination result is recorded.",
        certificateNumber: null,
        issuedAt: null,
        payload: null,
      };
    }

    const officials = await loadInstitutionalOfficials(prisma);
    const signatoryDeanName = officials.dean.name.trim() || null;

    return {
      studentId: student.id,
      eligible: true,
      templateStatus: "TEMPLATE_PENDING",
      templateNotice:
        "Official EARIST Written Comprehensive Examination certificate PDF template is pending. Reference number and signatory metadata are prepared.",
      certificateNumber: passed.certificateNumber ?? null,
      issuedAt: passed.certificateIssuedAt
        ? passed.certificateIssuedAt.toISOString()
        : null,
      payload: {
        studentName: formatPersonFullName(student.user),
        studentNumber: student.studentNumber ?? null,
        programDisplay: student.program
          ? formatOfficialProgramDisplay(student.program)
          : "Graduate Program",
        attemptNumber: passed.attemptNumber ?? 1,
        examDate: passed.examDate ? passed.examDate.toISOString() : null,
        recordedAt: passed.createdAt
          ? passed.createdAt.toISOString()
          : new Date().toISOString(),
        result: "PASSED",
        remarks: passed.remarks ?? null,
        signatoryDeanName,
      },
    };
  }

  async getCertificateFoundationForUserId(
    userId: string,
  ): Promise<CompExamCertificateFoundationDto> {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) {
      throw new AppError("Student profile not found!", 404);
    }
    return this.getCertificateFoundationForStudentId(student.id);
  }

  async renderCertificatePdf(studentId: string): Promise<never> {
    const foundation =
      await this.getCertificateFoundationForStudentId(studentId);
    if (!foundation.eligible) {
      throw new AppError(
        "Student has not passed the Written Comprehensive Examination yet.",
        409,
      );
    }
    throw new AppError(
      "Official EARIST Written Comprehensive Examination certificate PDF template is not yet configured. Certificate metadata foundation is ready.",
      501,
    );
  }
}
