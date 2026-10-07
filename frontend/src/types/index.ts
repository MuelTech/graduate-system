// APPLICANT & EXAM INTERFACES
export interface ApplicantStatus {
  alignmentStatus: string;
  programId: string;
  confirmedSlot?: {
    id: string;
    examDate: string;
    examTime: string;
    programName: string;
  };
}

export interface ExamSlot {
  id: string;
  programId: string;
  examDate: string;
  examTime: string;
  maxSlots: number;
  slotsTaken: number;
  isActive: boolean;
  program?: { programName: string };
}

export interface Program {
  id: string;
  programName: string;
}

/**
 * COR-3: assistive EARIST COR parser suggestions. Suggestion-only evidence for
 * Admin comparison; never authoritative profile data.
 */
export interface CorStudentNameSuggestion {
  raw: string | null;
  surname: string | null;
  firstName: string | null;
  middleNameOrInitial: string | null;
}

export interface CorExtractionSuggestions {
  studentNumber: string | null;
  registrationNumber: string | null;
  studentName: CorStudentNameSuggestion | null;
  program: string | null;
  college: string | null;
  emailAddress: string | null;
}

/** COR-2/COR-3: persisted extraction metadata + suggestions for Admin review. */
export interface CorExtractionReview {
  status: string;
  method: string | null;
  extractorVersion: string | null;
  parserVersion: string | null;
  processedAt: string | null;
  diagnostic: string | null;
  suggestions: CorExtractionSuggestions | null;
}

export interface PendingCorUpload {
  id: string;
  originalFilename: string;
  createdAt: string;
  extraction?: CorExtractionReview | null;
  /** Applicant/system baseline (authoritative) for suggestion comparison. */
  student: {
    programId: string;
    program: Program | null;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

// PANELIST INTERFACES
export type PanelistEvaluationStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "FINALIZED"
  | "NONE";

export interface PanelistAssignmentData {
  id: string;
  role: string;
  /** CP9: own evaluation status from own OralExamScore only. */
  evaluationStatus?: PanelistEvaluationStatus;
  schedule: {
    id: string;
    defenseDate: string;
    defenseTime?: string;
    venueOrLink?: string;
    defenseType: string;
    /** Authoritative DefenseSchedule.sessionStatus (not application status). */
    sessionStatus?: string;
    /** @deprecated legacy alias — use sessionStatus */
    status?: string;
    thesis: {
      student: {
        programId?: string;
        program?: { programName?: string } | null;
        user: {
          firstName: string;
          lastName: string;
        };
      };
      thesisDocuments?: DocumentData[];
    };
  };
}

export interface DefenseData {
  defenseType: string;
  defenseDate: string;
  thesis: {
    student: {
      programId: string;
      user: {
        firstName: string;
        lastName: string;
      };
    };
    thesisDocuments?: Array<{ id: string; docType: string; isCurrent?: boolean }>;
  };
}

export interface DocumentData {
  id: string;
  docType: string;
  filePath: string;
  uploadedAt: string;
}

export interface MissingRequirement {
  code: string;
  message: string;
  stage: string;
}

export type DefensePanelRole =
  | "CHAIRMAN"
  | "PANELIST"
  | "ADVISER"
  | "FACILITATOR"
  | "RAPPORTEUR";

export interface CommitteeAssignment {
  userId: string;
  role: DefensePanelRole;
}

export interface ScheduleDefensePayload {
  defenseDate: string;
  defenseTime: string;
  venueOrLink: string;
  defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE";
  assignments: CommitteeAssignment[];
}

export interface ActivePanelistCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  panelist?: {
    isAvailableAsAdviser?: boolean;
    isExternal?: boolean;
    specialization?: string | null;
    officeAffiliation?: string | null;
  } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApprovedApplicationDto {
  workflowBucket?: "NEEDS_REVIEW" | "READY" | "ACTIVE" | "HISTORY" | string;
  recordKind?: "APPLICATION" | "DEFENSE_HISTORY" | string;
  displayStatus?: string;
  rawApplicationStatus?: string | null;
  id: string;
  /** DL-8: canonical ThesisRecord id (differs from `id` for History rows). */
  thesisId?: string;
  stage: "TITLE" | "PROPOSAL" | "FINAL";
  status: string;
  createdAt: string;
  student: {
    studentNumber?: string | null;
    user: { id: string; firstName: string; lastName: string; email: string };
    program?: { id: string; programName: string; programType?: string } | null;
    programId?: string;
  };
  thesisTitles: Array<{ id: string; titleText: string; isSelected: boolean }>;
  assignment?: {
    adviser?: { id: string; firstName: string; lastName: string } | null;
  } | null;
  /** Current-stage defense session (stage-matched), when scheduled. */
  currentSchedule?: DefenseSessionDto | null;
}

export interface DefenseCommitteeSummary {
  chairman: string[];
  panelists: string[];
  facilitator: string[];
  rapporteur: string[];
  adviser: string[];
}

export interface DefensePanelSeatDto {
  role: DefensePanelRole | string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
}

export interface DefenseSessionDto {
  id: string;
  defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE" | string;
  sessionStatus: string;
  defenseDate: string | Date | null;
  defenseTime: string | Date | null;
  venueOrLink: string | null;
  panelAssignments: DefensePanelSeatDto[];
  committeeSummary: DefenseCommitteeSummary;
}

export interface CommitteePolicyDto {
  allowedRoles: DefensePanelRole[];
  requiredRoles: DefensePanelRole[];
  /** Confirmed session totals: Master's 7 / Doctoral 8 */
  sessionTotal: number;
  academicSeatCount: number;
  maximumRoleCount: Partial<Record<DefensePanelRole, number | null>>;
  evaluatorRoles: DefensePanelRole[];
  rapporteurRequired: boolean;
  facilitatorRequired: boolean;
  /** Exact scorer counts remain client-pending */
  scorerCountPolicy: "UNRESOLVED_DO_NOT_HARDCODE";
}

export interface RapReportSignatureDoc {
  id: string;
  rapReport: {
    defenseType: string;
    generatedAt: string;
    thesis: {
      student: {
        user: {
          firstName: string;
          lastName: string;
        };
      };
    };
  };
}

export interface Panelist {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
}

export interface PanelistResponse {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    title?: string;
    suffix?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy?: { firstName: string; lastName: string } | null;
    updatedBy?: { firstName: string; lastName: string } | null;
  };
  isExternal: boolean;
  highestEducationalAttainment: string;
  officeAffiliation: string;
  specialization: string;
  isAvailableAsAdviser: boolean;
  createdAt: string;
}

// ADMIN THESIS INTERFACES
export interface AdminThesisApplication {
  id: string;
  stage: string;
  status: string;
  createdAt: string;
  student: {
    programId: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  thesisDocuments?: ThesisDocument[];
  thesisTitles?: ThesisTitle[];
  assignment?: {
    adviser?: {
      firstName: string;
    };
  };
}

export interface ThesisDocument {
  id: string;
  docType: string;
  filePath: string;
}

export interface ThesisTitle {
  id: string;
  titleText: string;
  isSelected: boolean;
}

export interface MappedApplication {
  id: string;
  studentName: string;
  studentNumber: string;
  program: string;
  stage: string;
  dateSubmitted: string;
  status: string;
  requirements: {
    id: string;
    name: string;
    met: boolean;
    path: string;
  }[];
  proposedTitles: ThesisTitle[] | null;
  adviser: string | null;
}

export interface AdviserRequestUI {
  id: string;
  studentName: string;
  studentNumber: string;
  program: string;
  requestDate: string;
  preferredAdviser: string | null;
  researchInterest: string;
  status: string;
}

export interface ActiveAssignmentUI {
  id: string;
  studentName: string;
  studentNumber: string;
  program: string;
  adviserName: string;
  adviserType: string;
  assignedDate: string;
  thesisStage: string;
  lastActivity: string;
  progress: number;
}

export interface AvailableAdviserUI {
  id: string;
  name: string;
  advisees: number;
  maxAdvisees: number;
  specialization: string;
}

export interface AuditLogItem {
  id: string;
  createdAt: string;
  actionType: string;
  targetTable: string;
  targetId: string;
  description: string;
  actor?: {
    firstName: string;
    lastName: string;
    role: string;
  };
}

/**
 * DL-10: Research Repository publication projection.
 *
 * Public projection is metadata-only and identical for every viewer. The
 * publication artifact (full text/download) is an OPEN institutional policy, so
 * it is always unavailable and unresolved.
 */
export interface RepositoryArtifactPolicy {
  available: false;
  policyResolved: false;
}

export interface RepositoryPublication {
  id: string;
  title: string;
  author: string | null;
  program: string | null;
  abstract: string | null;
  keywords: string[];
  publishedAt: string | null;
  artifact: RepositoryArtifactPolicy;
}

/** ADMIN-only publication queue read model (no raw paths/files). */
export interface RepositoryAdminEntry {
  id: string;
  title: string;
  author: string | null;
  studentNumber: string | null;
  program: string | null;
  abstract: string | null;
  keywords: string[];
  archiveRegisteredAt: string;
  publication: {
    isPublished: boolean;
    publishedAt: string | null;
  };
  artifact: RepositoryArtifactPolicy;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}


export interface Waiver {
  id: string;
  createdAt: string;
  status: "PENDING" | "VALIDATED" | "REJECTED";
  waiverFormDownloadedAt: string | null;
  adminNotes: string | null;
  validatedAt: string | null;
  student: {
    pinnacleApplicantId: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  undergraduateProgram: {
    programName: string;
  } | null;
  intendedProgram: {
    programName: string;
  } | null;
  validatedBy: {
    firstName: string;
    lastName: string;
  } | null;
};
// ADMIN APPLICANT INTERFACES
export interface AdminApplicantListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  pinnacleApplicantId: string;
  program: { id: string; programName: string };
  alignmentStatus: string;
  examStatus: string;
  examScores: { mcq: number; essay: number; total: number } | null;
  corStatus: string;
  admissionStatus: string;
  createdAt: string;
}

export type AdminApplicantStage = "ALIGNMENT" | "EXAM" | "COR";

/**
 * Admin Applicants LIST row projection. `admissionStage` is a presentation/
 * read-model stage only — never persisted and never domain authority.
 */
export interface AdminApplicantListRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  pinnacleApplicantId: string;
  program: { id: string; programName: string };
  /** Raw authoritative alignment authority; null = unavailable (fail closed). */
  alignmentStatus: string | null;
  admissionStage: AdminApplicantStage;
  /** Latest Entrance Exam application status, or "NOT_SCHEDULED". */
  examStatus: string;
  /** Canonical passed-exam gate (authoritative existence of PASSED). */
  hasPassedExam: boolean;
  /** Latest current COR upload status, or "NONE". */
  corStatus: string;
  createdAt: string;
}

export interface AdminApplicantDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  pinnacleApplicantId: string;
  cellphone: string | null;
  dateOfBirth: string | null;
  program: { id: string; programName: string; programType: string } | null;
  /** Undergraduate prerequisite relation (Master's applicants). */
  undergraduateProgram: { id: string; programName: string } | null;
  /** Previous Master's relation (Doctoral applicants). */
  previousMastersProgram: { id: string; programName: string } | null;
  /** Raw authoritative alignment authority; null = unavailable (fail closed). */
  alignmentStatus: string | null;
  /** Presentation/read-model stage only — never persisted, never authority. */
  admissionStage: AdminApplicantStage;
  /** Latest Entrance Exam application status, or "NOT_SCHEDULED". */
  examStatus: string;
  /** Canonical passed-exam gate (authoritative existence of PASSED). */
  hasPassedExam: boolean;
  /** Latest current COR upload status, or "NONE". */
  corStatus: string;
  bridgingWaiver: BridgingWaiverDetail | null;
  examApplications: ExamApplicationDetail[];
  corUploads: CorUploadDetail[];
  admissionStatus: string;
  enrollmentDate: string | null;
  createdAt: string;
}

export interface BridgingWaiverDetail {
  id: string;
  status: string;
  waiverFormDownloadedAt: string | null;
  validatedBy: { firstName: string; lastName: string } | null;
  validatedAt: string | null;
  adminNotes: string | null;
}

export interface ExamApplicationDetail {
  id: string;
  status: string;
  /** Single canonical schedule contract; null when no authoritative slot. */
  examSlot: { examDate: string; examTime: string } | null;
}

export interface CorExtractionSummary {
  status: string;
  method: string | null;
  processedAt: string | null;
  manualReviewRequired: boolean;
  diagnostic: string | null;
}

export interface CorUploadDetail {
  id: string;
  status: string;
  ocrStatus: string;
  originalFilename: string | null;
  detectedMimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  reviewedBy: { firstName: string; lastName: string } | null;
  isCurrent: boolean;
  extraction: CorExtractionSummary | null;
  corRecord: CorRecordDetail | null;
}

export interface CorRecordDetail {
  registrationNumber: string;
  academicYear: string;
  semester: string;
  extractedProgramName: string;
  extractedYearLevel: string;
  isVerified: boolean;
  verificationMethod: string | null;
  verifiedBy: { firstName: string; lastName: string } | null;
  verifiedAt: string | null;
}

export interface ExamApplication {
  id: string;
  name: string;
  email: string;
  pinnacleId: string;
  program: string;
  scheduledSlot: string;
  alignmentStatus: string;
  status: string;
}

export interface ApiExamApplication {
  id: string;
  slot?: {
    examDate: string;
    examTime: string;
  };
  student: {
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
    pinnacleApplicantId?: string;
    alignmentStatus?: string;
  };
  program: {
    programName: string;
  };
  status: string;
}

export interface ExamOption {
  id: string;
  optionText: string;
}

export interface ExamQuestion {
  id: string;
  questionText: string;
  type: string;
  order: number;
  options: ExamOption[];
}

export interface AdminOption extends ExamOption {
  isCorrect: boolean;
}

export interface AdminQuestion extends Omit<ExamQuestion, 'options'> {
  options: AdminOption[];
}

// ADMIN STUDENT INTERFACES
export interface AdminStudentListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  studentNumber: string;
  program: { id: string; programName: string };
  thesisStage: string;
  thesisStatus: string;
  compExamStatus: string;
  compExamStrikes: number;
  adviser: string;
  admissionStatus: string;
  enrollmentDate: string | null;
}

export interface AdminStudentDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  studentNumber: string | null;
  cellphone: string | null;
  dateOfBirth: string | null;
  program: { id: string; programName: string } | null;
  admissionStatus: string;
  enrollmentDate: string | null;
  curriculumType: string | null;
  alignmentStatus: string | null;
  residency: { startDate: string | null; maxYears: number | null } | null;
  /** Latest recorded Comprehensive Exam status; null when no record exists. */
  compExam: { status: string; recordedAt: string | null } | null;
  adviserAssignment: {
    adviserId: string;
    adviserName: string;
    assignedDate: string | null;
  } | null;
}

export interface ApiApplication {
  id: string;
  slot?: {
    examDate: string;
    examTime: string;
  };
  student: {
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
    pinnacleApplicantId?: string;
  };
  program: {
    id: string;
    programName: string;
  };
  status: string;
}

/**
 * Bounded ADMIN read model for a single Entrance Exam Record detail.
 * Never includes correct-answer/option data.
 */
export interface ExamRecordDetail {
  id: string;
  status: string;
  student: {
    id: string;
    pinnacleApplicantId: string | null;
    user: { firstName: string; lastName: string; email: string };
  };
  program: {
    id: string;
    programName: string;
    /** Configured maximum when present; null = not authoritatively available. */
    examMcqTotal: number | null;
    examEssayTotal: number | null;
  };
  slot: { id: string; examDate: string; examTime: string };
  score: {
    multipleChoiceScore: number | null;
    essayScore: number | null;
    totalScore: number | null;
    status: string;
    gradedBy: { id: string; firstName: string; lastName: string } | null;
  } | null;
  essayAnswers: {
    questionId: string;
    questionText: string;
    order: number;
    essayAnswer: string | null;
  }[];
}
