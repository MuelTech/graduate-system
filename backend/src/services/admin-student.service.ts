// backend/src/services/admin-student.service.ts

import { AdminStudentRepository, AdminStudentListQuery } from "../repositories/admin-student.repository";
import { AppError } from "../utils/AppError";
import { EmailService } from "./email.service";
import { StudentThesisJourneyService } from "./student-thesis-journey.service";
import { AdminStudentDetail } from "../interfaces/admin-student.interfaces";
import { StudentThesisJourneyDto } from "./student-thesis-journey.rules";

export class AdminStudentService {
  private repository = new AdminStudentRepository();
  /** UIUX-2G: reuse the authoritative journey read model (no duplicated rules). */
  private journeyService = new StudentThesisJourneyService();

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

  async updateCompExamStatus(studentId: string, status: "PENDING" | "PASSED" | "FAILED") {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Student not found!", 404);
    }

    // Check if student is already dismissed (2 strikes)
    const strikeCount = student.compExamRecords.filter((r) => r.status === "FAILED").length;
    if (strikeCount >= 2 && status === "FAILED") {
      throw new AppError("Student has reached maximum attempts (2 strikes). Cannot record another failure.", 400);
    }

    const updated = await this.repository.updateCompExamStatus(studentId, status);

    // Dispatch email notification if status is PASSED or FAILED
    if (student.email && (status === "PASSED" || status === "FAILED")) {
      EmailService.sendTemplateEmail(student.email, "comp_exam_recorded", {
        student_name: `${student.firstName} ${student.lastName}`,
        result: status,
        portal_link: process.env.FRONTEND_URL || "http://localhost:3000",
      }).catch((err) =>
        console.error("[EmailService] Failed to queue comp_exam_recorded email:", err.message)
      );
    }

    return updated;
  }
}
