import type { DefensePanelRole } from "@/types";

export type ThesisStageName = "TITLE" | "PROPOSAL" | "FINAL";
export type ThesisStatusName =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SCHEDULED"
  | "PASSED"
  | "REVISION"
  | "FAILED";

export type WorkflowView = "NEEDS_REVIEW" | "READY" | "SCHEDULED" | "HISTORY";

export const STAGE_LABELS: Record<ThesisStageName | string, string> = {
  TITLE: "Title Defense",
  PROPOSAL: "Proposal Defense",
  FINAL: "Final Defense",
  title_defense: "Title Defense",
  proposal_defense: "Proposal Defense",
  final_defense: "Final Defense",
};

export const STATUS_LABELS: Record<ThesisStatusName | string, string> = {
  PENDING: "Needs Review",
  APPROVED: "Ready for Scheduling",
  SCHEDULED: "Scheduled",
  REJECTED: "Rejected",
  PASSED: "Passed",
  REVISION: "Revision Required",
  FAILED: "Failed",
};

export const DEFENSE_REQUIREMENT_LABELS: Record<string, string> = {
  COR: "Certificate of Registration",
  RECEIPT: "Proof of Payment",
  PROPOSAL_CHAPTERS: "Proposal Chapters 1–3",
  FINAL_MANUSCRIPT: "Final Manuscript (Chapters 1–5)",
  PLAGIARISM_REPORT: "Plagiarism / STRIKE Report",
  RESPONDENT_DATA: "Respondent Data",
  INSTRUMENTS: "Research Instruments",
};

export function requirementLabel(code: string): string {
  return DEFENSE_REQUIREMENT_LABELS[code] ?? code.replace(/_/g, " ");
}

export const HISTORY_STATUSES: ThesisStatusName[] = [
  "REJECTED",
  "PASSED",
  "REVISION",
  "FAILED",
];

export function viewForStatus(status: string): WorkflowView {
  if (status === "PENDING") return "NEEDS_REVIEW";
  if (status === "APPROVED") return "READY";
  if (status === "SCHEDULED") return "SCHEDULED";
  return "HISTORY";
}

export function statusFilterForView(view: WorkflowView): string {
  if (view === "NEEDS_REVIEW") return "PENDING";
  if (view === "READY") return "APPROVED";
  if (view === "SCHEDULED") return "SCHEDULED";
  return "HISTORY";
}

export type { DefensePanelRole };
