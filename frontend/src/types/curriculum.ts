export type CurriculumProgramType = "MASTERS" | "DOCTORAL";

export type CurriculumGroupType =
  | "FOUNDATION"
  | "MAJOR"
  | "COGNATE"
  | "THESIS"
  | "DISSERTATION"
  | "FOREIGN_LANGUAGE"
  | "BRIDGING"
  | "OTHER";

export type CourseProgressStatus =
  | "NOT_TAKEN"
  | "IN_PROGRESS"
  | "PASSED"
  | "FAILED"
  | "INCOMPLETE"
  | "DROPPED"
  | "CREDITED";

export type PublicationMilestoneStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "VERIFIED";

export interface GradingScaleOption {
  value: string;
  label: string;
  percentRange: string;
  outcome: "PASSED" | "FAILED" | "INCOMPLETE" | "DROPPED";
  numericValue: number | null;
}

export interface GradingScaleInfo {
  programType: CurriculumProgramType;
  retentionGwaThreshold: number;
  incRemovalNote: string;
  options: GradingScaleOption[];
}

export interface CurriculumCourseProgressView {
  status: CourseProgressStatus;
  rating: string | null;
  semester: string | null;
  schoolYear: string | null;
  remarks: string | null;
  encodedByRole: "STUDENT" | "ADMIN" | null;
  encodedByName: string | null;
  isVerifiedByAdmin: boolean;
  verifiedByName: string | null;
  verifiedAt: string | null;
  updatedAt: string | null;
}

export interface CurriculumChecklistCourse {
  id: string;
  courseCode: string;
  courseTitle: string;
  units: number;
  isRequired: boolean;
  prerequisiteNote: string | null;
  displayOrder: number;
  progress: CurriculumCourseProgressView;
}

export interface CurriculumChecklistGroup {
  id: string;
  groupType: CurriculumGroupType;
  label: string;
  requiredUnits: number;
  countsTowardWce: boolean;
  selectionNote: string | null;
  displayOrder: number;
  earnedUnitsRaw: number;
  earnedUnitsEffective: number;
  verifiedUnitsEffective: number;
  inProgressUnits: number;
  remainingUnits: number;
  isComplete: boolean;
  courses: CurriculumChecklistCourse[];
}

export interface CurriculumVersionSummary {
  id: string;
  programId?: string;
  versionCode: string;
  label: string;
  curriculumType: "NEW" | "OLD";
  effectiveSchoolYear: string | null;
  totalRequiredUnits: number;
  isDefaultForNewStudents: boolean;
  isActive: boolean;
  notes?: string | null;
  isFallbackAssignment?: boolean;
}

export interface CurriculumProgressSummary {
  programType: CurriculumProgramType;
  totalRequiredUnits: number;
  totalEarnedUnits: number;
  totalVerifiedUnits: number;
  totalInProgressUnits: number;
  totalRemainingUnits: number;
  completionPercent: number;
  wceRequiredUnits: number;
  wceEarnedUnits: number;
  wceVerifiedUnits: number;
  wceInProgressUnits: number;
  wceRemainingUnits: number;
  wceReadinessStatus: "READY" | "IN_PROGRESS" | "NOT_STARTED";
  unofficialGwa: number | null;
  retentionGwaThreshold: number;
  meetsRetentionGwa: boolean | null;
  incCount: number;
  encodedCourseCount: number;
  verifiedCourseCount: number;
}

export interface GraduationRequirementsView {
  comprehensiveExam: {
    status: "NOT_RECORDED" | "PENDING" | "RETAKE_REQUIRED" | "PASSED" | "DISMISSED";
    label: string;
    attemptsUsed: number;
    maxAttempts: number;
    passedAt: string | null;
  };
  thesisOrDissertation: {
    status: "NOT_STARTED" | "IN_PROGRESS" | "PASSED";
    label: string;
    requirementName: string;
    currentStage: string | null;
  };
  publication: {
    status: PublicationMilestoneStatus;
    requirementDescription: string;
    title: string | null;
    venue: string | null;
    url: string | null;
    year: string | null;
    notes: string | null;
    isVerified: boolean;
    verifiedAt: string | null;
    verifiedByName: string | null;
  };
}

export interface StudentCurriculumChecklistDto {
  student: {
    id: string;
    studentNumber: string | null;
    fullName: string;
    admissionStatus: string;
    programId: string;
    programName: string;
    degreeName: string | null;
    majorName: string | null;
    programCode: string | null;
    programType: CurriculumProgramType;
    curriculumType: string | null;
  };
  curriculumVersion: CurriculumVersionSummary | null;
  availableVersions: CurriculumVersionSummary[];
  gradingScale: GradingScaleInfo;
  summary: CurriculumProgressSummary | null;
  groups: CurriculumChecklistGroup[];
  graduationRequirements: GraduationRequirementsView;
}

export interface AdminCurriculumCourseItem {
  id: string;
  groupId: string;
  courseCode: string;
  courseTitle: string;
  units: number;
  isRequired: boolean;
  prerequisiteNote: string | null;
  displayOrder: number;
  _count?: { studentProgress: number };
}

export interface AdminCurriculumGroupItem {
  id: string;
  curriculumVersionId: string;
  groupType: CurriculumGroupType;
  label: string;
  requiredUnits: number;
  countsTowardWce: boolean;
  selectionNote: string | null;
  displayOrder: number;
  courses: AdminCurriculumCourseItem[];
}

export interface AdminCurriculumVersionDetail extends CurriculumVersionSummary {
  programId: string;
  program: {
    id: string;
    programName: string;
    degreeName: string | null;
    majorName: string | null;
    programCode: string | null;
    programType: CurriculumProgramType;
    isActive: boolean;
  };
  _count: { students: number };
  groups: AdminCurriculumGroupItem[];
}
