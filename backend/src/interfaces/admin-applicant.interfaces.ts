// backend/src/interfaces/admin-applicant.interfaces.ts

export interface AdminApplicantListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  alignment?: string;
  exam?: string;
  cor?: string;
  status?: string;
}

export interface AdminApplicantListResponse {
  applicants: AdminApplicantListItem[];
  total: number;
  page: number;
  pageSize: number;
}

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

export interface AdminApplicantDetail extends AdminApplicantListItem {
  cellphone: string;
  dateOfBirth: string;
  undergraduateCourse: string;
  isProgramAligned: boolean;
  bridgingWaiver: BridgingWaiverDetail | null;
  examApplications: ExamApplicationDetail[];
  corUploads: CorUploadDetail[];
  enrollmentDate: string | null;
  activityLog: ActivityLogEntry[];
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
  examSlot: { examDate: string; examTime: string; venueOrLink: string } | null;
  examScores: { multipleChoiceScore: number; essayScore: number; totalScore: number } | null;
}

export interface CorUploadDetail {
  id: string;
  ocrStatus: string;
  filePath: string;
  originalFilename: string;
  uploadedAt: string;
  corRecord: CorRecordDetail | null;
}

export interface CorRecordDetail {
  registrationNumber: string;
  academicYear: string;
  semester: string;
  extractedProgramName: string;
  extractedYearLevel: string;
  totalAssessment: number;
  netAssessed: number;
  outstandingBalance: number;
  isVerified: boolean;
  verificationMethod: string | null;
  verifiedBy: { firstName: string; lastName: string } | null;
  verifiedAt: string | null;
}

export interface ActivityLogEntry {
  timestamp: string;
  action: string;
  description: string;
  actor: string;
}

export interface RejectWaiverInput {
  adminNotes: string;
}

export interface VerifyCorInput {
  verificationMethod: "manual" | "qr_auto" | "ocr_auto";
}

export interface RejectCorInput {
  reason: string;
}
