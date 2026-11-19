// backend/src/services/admin-student.service.ts

import bcrypt from "bcryptjs";
import { AdminStudentRepository, AdminStudentListQuery } from "../repositories/admin-student.repository";
import { AppError } from "../utils/AppError";
import { validatePhilippineMobile } from "../utils/phone";
import { StudentThesisJourneyService } from "./student-thesis-journey.service";
import {
  AdminStudentDetail,
  UpdateAdminStudentInput,
} from "../interfaces/admin-student.interfaces";
import { StudentThesisJourneyDto } from "./student-thesis-journey.rules";

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

    return this.repository.updateCompExamStatus(studentId, status);
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

    // TODO(email-integration): Dispatch student password-reset email once EmailService is enabled.
    return {
      message:
        "Password reset to temporary default (LAST NAME in ALL CAPS). Email notification will be sent once Email Integration is enabled.",
      mustChangePassword: true,
      emailDispatched: false,
    };
  }
}
