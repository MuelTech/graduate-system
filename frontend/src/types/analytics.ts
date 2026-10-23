/**
 * Academic Analytics & Institutional Reports Data Contracts.
 *
 * Modeled strictly after official EARIST GS-IS specifications:
 * - GS_System_Workflow_Revised-6-3-26_Updated.md (Section 11.4)
 * - GSIS_Requirements_Matrix.md (FR43, FR15)
 * - EARIST_GS_UIUX_Design_Documentation_v8.md (Section 1. Analytics & Reports)
 * - Capstone Manuscript Chapter 1 (AI Analytics Assistant)
 */

export type DegreeLevel = "MASTERS" | "DOCTORAL";
export type ThesisStage = "TITLE" | "PROPOSAL" | "FINAL";
export type ResidencyRiskStatus = "NORMAL" | "APPROACHING_LIMIT" | "OVERSTAYING";
export type AlignmentCategory = "ALIGNED" | "PENDING_WAIVER" | "CLEARED" | "REJECTED";

/**
 * High-level Summary KPI Card with sparkline mini-trend
 */
export interface AnalyticsKpiCard {
  id: string;
  label: string;
  value: string | number;
  sublabel?: string;
  changePercentage: number;
  isPositiveTrend: boolean;
  sparklineData: number[];
  iconName: "users" | "graduation-cap" | "trending-up" | "award" | "book-open";
}

/**
 * Admissions & Program Alignment Analytics
 */
export interface ProgramApplicationCount {
  programCode: string;
  programName: string;
  degreeLevel: DegreeLevel;
  applicantsCount: number;
  enrolledCount: number;
}

export interface MonthlyIntakeTrend {
  month: string;
  applicants: number;
  enrolled: number;
}

export interface AlignmentDistribution {
  aligned: number;
  pendingWaiver: number;
  cleared: number;
  rejected: number;
}

export interface UndergradFeederProgram {
  undergradDegree: string;
  category: string;
  applicantCount: number;
  intendedGraduateProgram: string;
  alignmentRate: number; // percentage 0-100
  pendingWaivers: number;
}

export interface AdmissionsAnalyticsData {
  applicationsByProgram: ProgramApplicationCount[];
  monthlyIntakeTrend: MonthlyIntakeTrend[];
  alignmentDistribution: AlignmentDistribution;
  feederPrograms: UndergradFeederProgram[];
}

/**
 * Examination Performance Analytics
 */
export interface EcatPassFailData {
  passed: number;
  failed: number;
  totalExaminees: number;
  passingRate: number;
}

export interface ProgramScoreAverage {
  programCode: string;
  programName: string;
  mcqAverage: number; // Out of 50
  essayAverage: number; // Out of 50
  totalAverage: number; // Out of 100
  passingScore: number;
}

export interface CompExamSummary {
  passed: number;
  failed: number;
  pending: number;
  totalTracked: number;
  passRate: number;
  byProgram: Array<{
    programName: string;
    passed: number;
    pending: number;
  }>;
}

export interface ExaminationAnalyticsData {
  ecatPassFail: EcatPassFailData;
  programScoreAverages: ProgramScoreAverage[];
  compExamSummary: CompExamSummary;
}

/**
 * Thesis & STRIKE Plagiarism Pipeline Analytics
 */
export interface DefenseFunnelStage {
  stage: ThesisStage;
  stageLabel: string;
  activeCount: number;
  completedCount: number;
  averageTurnaroundDays: number;
}

export interface PlagiarismAnalyticsData {
  monthlySimilarityTrend: Array<{
    month: string;
    averageSimilarity: number;
  }>;
  similarityBrackets: {
    belowTenPercent: number; // Highly original (<10%)
    tenToNineteenPercent: number; // Passed threshold (10-19%)
    twentyPercentAndAbove: number; // Revision required (>=20%)
  };
  highRevisionPrograms: Array<{
    programName: string;
    submissionCount: number;
    averageSimilarity: number;
    revisionRate: number; // percentage needing 2nd+ check
  }>;
}

export interface RepositoryActivityData {
  totalDownloads: number;
  totalPublications: number;
  downloadsByDepartment: Array<{
    department: string;
    publicationsCount: number;
    downloadsCount: number;
  }>;
  topDownloadedManuscripts: Array<{
    id: string;
    rank: number;
    title: string;
    author: string;
    program: string;
    publishedYear: number;
    downloads: number;
    views: number;
  }>;
}

export interface ThesisPipelineAnalyticsData {
  defenseFunnel: DefenseFunnelStage[];
  stageCompletionRates: Array<{
    programName: string;
    titlePassRate: number;
    proposalPassRate: number;
    finalPassRate: number;
  }>;
  plagiarism: PlagiarismAnalyticsData;
  repository: RepositoryActivityData;
}

/**
 * Institutional Compliance & Reports
 */
export interface ResidencyStudentItem {
  id: string;
  studentNumber: string;
  name: string;
  program: string;
  degreeLevel: DegreeLevel;
  enrollmentDate: string;
  elapsedYears: number;
  maxResidencyYears: number;
  remainingMonths: number;
  status: ResidencyRiskStatus;
  warningSentAt: string | null;
}

export interface AdviserLoadItem {
  id: string;
  name: string;
  department: string;
  specialization: string;
  activeAdviseesCount: number;
  maxCapacity: number;
  capacityStatus: "AVAILABLE" | "AT_CAPACITY";
  assignedPrograms: string[];
  advisees: Array<{
    studentName: string;
    studentNumber: string;
    program: string;
    stage: ThesisStage;
  }>;
}

export interface InstitutionalReportsData {
  residencyRegistry: ResidencyStudentItem[];
  adviserLoadMatrix: AdviserLoadItem[];
}

/**
 * Capstone Chapter 1: AI-Powered Analytics Assistant Briefing
 */
export interface AiAnalyticsBriefing {
  generatedAt: string;
  executiveSummary: string;
  keyObservations: string[];
  bottlenecks: string[];
  actionableRecommendations: string[];
}

/**
 * Complete Analytics Dashboard Read Model
 */
export interface AnalyticsDashboardData {
  academicYear: string;
  semester: string;
  lastUpdated: string;
  kpis: AnalyticsKpiCard[];
  admissions: AdmissionsAnalyticsData;
  examinations: ExaminationAnalyticsData;
  thesisPipeline: ThesisPipelineAnalyticsData;
  reports: InstitutionalReportsData;
  aiBriefing: AiAnalyticsBriefing;
}
