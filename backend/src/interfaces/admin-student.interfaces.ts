/**
 * Bounded ADMIN read models for the Admin Student Profile.
 *
 * These are explicit, presentation-oriented projections of authoritative
 * Student/academic records. They never fabricate missing records and never
 * manufacture academic progression.
 */

export interface AdminStudentDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  studentNumber: string | null;
  cellphone: string | null;
  /** ISO string; null when not recorded. */
  dateOfBirth: string | null;
  program: { id: string; programName: string } | null;
  admissionStatus: string;
  /** ISO string; null when not recorded. */
  enrollmentDate: string | null;
  curriculumType: string | null;
  alignmentStatus: string | null;
  /** Residency context; null when neither start date nor max years is recorded. */
  residency: { startDate: string | null; maxYears: number | null } | null;
  /**
   * Latest recorded Comprehensive Examination status. null when no record
   * exists — distinct from a persisted PENDING record. The current model
   * overwrites the latest record for a student, so this is not attempt history.
   */
  compExam: { status: string; recordedAt: string | null } | null;
  adviserAssignment: {
    adviserId: string;
    adviserName: string;
    assignedDate: string | null;
  } | null;
}
