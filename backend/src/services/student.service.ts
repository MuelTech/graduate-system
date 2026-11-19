import { StudentRepository } from "../repositories/student.repository";
import { AdminStudentService } from "./admin-student.service";
import { CompExamCertificateService } from "./comp-exam-certificate.service";

export class StudentService {
  private studentRepo = new StudentRepository();
  private adminStudentService = new AdminStudentService();
  private compExamCertService = new CompExamCertificateService();

  async getStudentJourney(userId: string) {
    const journey = await this.studentRepo.getStudentJourney(userId);
    if (!journey) {
      throw new Error("Student profile not found");
    }
    return journey;
  }

  async updateCompExam(
    studentId: string,
    adminId: string,
    data: { status?: unknown; examDate?: unknown; remarks?: unknown },
  ) {
    return this.adminStudentService.recordCompExamAttempt(studentId, adminId, {
      status: data?.status as "PASSED" | "FAILED",
      examDate:
        typeof data?.examDate === "string" || data?.examDate === null
          ? data.examDate
          : undefined,
      remarks:
        typeof data?.remarks === "string" || data?.remarks === null
          ? data.remarks
          : undefined,
    });
  }

  async getCompExamCertificateFoundation(userId: string) {
    return this.compExamCertService.getCertificateFoundationForUserId(userId);
  }
}
