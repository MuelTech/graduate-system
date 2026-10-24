/**
 * ADV-3 — frontend contract for the accepted ADV-2 Adviser workspace.
 *
 * These are workspace semantics, not raw persistence relations. Active Adviser
 * authority remains server-side.
 */
import type { PanelistAdviserRequestDto } from "../lib/panelist-adviser-requests";

export type AdviserWorkspaceReviewStage = "PROPOSAL" | "FINAL";

export interface AdviserWorkspaceStudentDto {
  id: string;
  name: string;
  studentNumber: string | null;
  program: string | null;
}

export interface AdviserWorkspaceResearchDto {
  thesisId: string | null;
  currentStage: string | null;
  currentStatus: string | null;
  workingTitle: string | null;
}

export interface AdviserActiveAdviseeDto {
  assignmentId: string;
  assignedDate: string;
  student: AdviserWorkspaceStudentDto;
  research: AdviserWorkspaceResearchDto;
  review: {
    hasOpenTask: boolean;
    stages: AdviserWorkspaceReviewStage[];
  };
}

export interface AdviserWorkspaceReviewTaskDto {
  stage: AdviserWorkspaceReviewStage;
  thesisId: string;
  student: {
    id: string;
    name: string;
    studentNumber: string | null;
  };
  officialTitle: string | null;
  reviewStatus: string;
  reviewRemarks: string | null;
  manuscriptDocumentId: string | null;
  manuscriptTitle: string | null;
  originalFilename: string | null;
  manuscriptUploadedAt: string | null;
}

export type AdviserResearchDocumentKind =
  | "TITLE_PROPOSAL_PACKAGE"
  | "PROPOSAL_MANUSCRIPT"
  | "FINAL_MANUSCRIPT";

export interface AdviserResearchDocumentDto {
  id: string;
  stage: "TITLE" | "PROPOSAL" | "FINAL";
  kind: AdviserResearchDocumentKind;
  uploadedAt: string;
  isCurrent: boolean;
  supersedesDocumentId: string | null;
}

export interface AdviserDefenseHistoryManuscriptDto {
  id: string;
  stage: "TITLE" | "PROPOSAL" | "FINAL";
  kind: AdviserResearchDocumentKind;
  uploadedAt: string | null;
}

export interface AdviserDefenseHistoryReportDto {
  finalizedAt: string | null;
  bodyDocument: unknown | null;
  text: string | null;
}

export interface AdviserDefenseHistoryEntryDto {
  scheduleId: string;
  stage: "TITLE" | "PROPOSAL" | "FINAL" | null;
  defenseDate: string | null;
  concludedAt: string | null;
  verdict: string;
  manuscript: AdviserDefenseHistoryManuscriptDto | null;
  committeeReport: AdviserDefenseHistoryReportDto | null;
}

export interface AdviserWorkspaceDto {
  activeAdvisees: AdviserActiveAdviseeDto[];
  incomingRequests: PanelistAdviserRequestDto[];
  reviewTasks: AdviserWorkspaceReviewTaskDto[];
}

/** ADV-4 — accepted exact-advisee detail contract. */
export interface AdviserAdviseeDetailDto {
  assignment: {
    assignmentId: string;
    assignedDate: string;
  };
  student: AdviserWorkspaceStudentDto;
  research: AdviserWorkspaceResearchDto;
  reviewContext: {
    stages: AdviserWorkspaceReviewStage[];
    tasks: AdviserWorkspaceReviewTaskDto[];
  };
  researchDocuments: AdviserResearchDocumentDto[];
  defenseHistory: AdviserDefenseHistoryEntryDto[];
}
