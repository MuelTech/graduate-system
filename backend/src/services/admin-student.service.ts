import { admissionStudentAuthorization } from "../access/admission-student-authorization";
// backend/src/services/admin-student.service.ts

import { AdminStudentRepository, AdminStudentListQuery } from "../repositories/admin-student.repository";
import { AppError } from "../utils/AppError";
import { StudentThesisJourneyService } from "./student-thesis-journey.service";
import { AdminStudentDetail } from "../interfaces/admin-student.interfaces";
import { StudentThesisJourneyDto } from "./student-thesis-journey.rules";

export class AdminStudentService {
  constructor(private readonly access = admissionStudentAuthorization) {}
  private repository = new AdminStudentRepository();
  /** UIUX-2G: reuse the authoritative journey read model (no duplicated rules). */
  private journeyService = new StudentThesisJourneyService();

  async listStudents(query: AdminStudentListQuery, actorId: string) {
    await this.access.assert(actorId, "students.view");
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;

    const [students, total] = await Promise.all([
      this.repository.findStudents(query),
      this.repository.countStudents(query),
    ]);

    return { students, total, page, pageSize };
  }

  async getStudentDetail(id: string, actorId: string): Promise<AdminStudentDetail> {
    await this.access.assert(actorId, "students.view");
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
  async getStudentJourney(studentId: string, actorId: string): Promise<StudentThesisJourneyDto> {
    await this.access.assert(actorId, "students.view");
    const userId = await this.repository.findStudentUserId(studentId);
    if (!userId) {
      throw new AppError("Student not found!", 404);
    }
    return this.journeyService.getJourney(userId);
  }

  async updateCompExamStatus(studentId: string, status: "PENDING" | "PASSED" | "FAILED", actorId: string) {
    await this.access.assert(actorId, "students.comprehensive_exam.manage");
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Student not found!", 404);
    }

    // Check if student is already dismissed (2 strikes)
    const strikeCount = student.compExamRecords.filter((r) => r.status === "FAILED").length;
    if (strikeCount >= 2 && status === "FAILED") {
      throw new AppError("Student has reached maximum attempts (2 strikes). Cannot record another failure.", 400);
    }

    return this.repository.updateCompExamStatus(studentId, status);
  }
}
