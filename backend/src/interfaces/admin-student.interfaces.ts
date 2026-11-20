/**
 * Bounded ADMIN read models for the Admin Student Profile.
 *
 * These are explicit, presentation-oriented projections of authoritative
 * Student/academic records. They never fabricate missing records and never
 * manufacture academic progression.
 */

import type { CompExamStanding } from "../services/comp-exam.rules";

export interface CompExamAttemptDto {
  id: string;
  attemptNumber: number;
  status: string;
  examDate: string | null;
  remarks: string | null;
  recordedAt: string;
  recordedByName: string | null;
  certificateNumber: string | null;
  certificateIssuedAt: string | null;
}

export interface CompExamSummaryDto {
  standing: CompExamStanding;
  isPassed: boolean;
  isDismissed: boolean;
  attemptsUsed: number;
  failedAttempts: number;
  attemptsRemaining: number;
  maxAttempts: number;
  nextAttemptNumber: number | null;
  canRecordAttempt: boolean;
  canCorrectLatest: boolean;
  certificate: {
    eligible: boolean;
    templateStatus: "TEMPLATE_PENDING";
    certificateNumber: string | null;
    issuedAt: string | null;
  };
  attempts: CompExamAttemptDto[];
}

export interface RecordCompExamAttemptInput {
  status: "PASSED" | "FAILED";
  examDate?: string | null;
  remarks?: string | null;
}

export interface CorrectCompExamAttemptInput {
  status: "PASSED" | "FAILED";
  examDate?: string | null;
  remarks?: string | null;
  reason: string;
}

export interface AdminStudentDetail {
  id: string;
  firstName: string;
  lastName: string;
  suffix?: string | null;
  email: string;
  studentNumber: string | null;
  pinnacleApplicantId?: string | null;
  cellphone: string | null;
  program: { id: string; programName: string } | null;
  admissionStatus: string;
  /** ISO string; null when not recorded. */
  enrollmentDate: string | null;
  curriculumType: string | null;
  curriculumVersion?: {
    id: string;
    versionCode: string;
    label: string;
    curriculumType: string;
    effectiveSchoolYear: string | null;
  } | null;
  isActive?: boolean;
  mustChangePassword?: boolean;
  canChangeProgram?: boolean;
  /** Residency context; null when neither start date nor max years is recorded. */
  residency: { startDate: string | null; maxYears: number | null } | null;
  /**
   * Latest recorded Comprehensive Examination status. null when no record
   * exists — distinct from a persisted PENDING record.
   */
  compExam: { status: string; recordedAt: string | null } | null;
  /** Authoritative 3-attempt Comprehensive Examination summary and certificate foundation. */
  compExamSummary: CompExamSummaryDto;
  adviserAssignment: {
    adviserId: string;
    adviserName: string;
    assignedDate: string | null;
  } | null;
}

export interface UpdateAdminStudentInput {
  firstName?: string;
  lastName?: string;
  suffix?: string | null;
  studentNumber?: string;
  email?: string;
  cellphone?: string;
  programId?: string;
  curriculumType?: "NEW" | "OLD" | null;
  enrollmentDate?: string | null;
  residencyStartDate?: string | null;
  isActive?: boolean;
  reason?: string;
}
