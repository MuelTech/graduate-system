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
  manuscriptUploadedAt: string | null;
}

export interface AdviserWorkspaceDto {
  activeAdvisees: AdviserActiveAdviseeDto[];
  incomingRequests: PanelistAdviserRequestDto[];
  reviewTasks: AdviserWorkspaceReviewTaskDto[];
}
