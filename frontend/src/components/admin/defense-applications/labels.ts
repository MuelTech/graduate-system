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
  TITLE_PROPOSAL: "Title Defense Proposal Package",
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

export const SESSION_STATUS_LABELS: Record<string, string> = {
  UNSCHEDULED: "Unscheduled",
  SCHEDULED: "Scheduled",
  RESCHEDULED: "Rescheduled",
  IN_PROGRESS: "In Progress",
  AWAITING_CONCLUSION: "Awaiting Conclusion",
  CONCLUDED: "Concluded",
  CANCELLED: "Cancelled",
};

export const ROLE_LABELS: Record<string, string> = {
  CHAIRMAN: "Chairman",
  PANELIST: "Panelist",
  FACILITATOR: "Facilitator",
  RAPPORTEUR: "Rapporteur",
  ADVISER: "Adviser",
};

export function sessionStatusLabel(status?: string | null): string {
  if (!status) return "—";
  return SESSION_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function dialogTitleForStatus(status: string): string {
  if (status === "PENDING") return "Review Application";
  if (status === "SCHEDULED") return "View Defense Details";
  return "View Application";
}

export function viewButtonLabel(status: string): string {
  return dialogTitleForStatus(status);
}

export function committeeLine(label: string, names: string[]): string | null {
  if (!names.length) return null;
  const max = 3;
  const shown =
    names.length <= max
      ? names.join(", ")
      : `${names.slice(0, max).join(", ")} +${names.length - max} more`;
  return `${label} — ${shown}`;
}

/** Compact name list for cards: "Dr. A, Dr. B +2 more". */
export function compactNameList(names: string[], maxVisible = 3): string {
  if (!names.length) return "—";
  if (names.length <= maxVisible) return names.join(", ");
  return `${names.slice(0, maxVisible).join(", ")} +${names.length - maxVisible} more`;
}

export type VenueDisplay =
  | { kind: "empty" }
  | { kind: "url"; href: string; label: string }
  | { kind: "text"; text: string };

/** Parse venue/Teams so long URLs never force horizontal scroll. */
export function parseVenueOrLink(value?: string | null): VenueDisplay {
  if (!value || !value.trim()) return { kind: "empty" };
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    const isTeams = /teams\.(microsoft|live)\.com/i.test(trimmed);
    return {
      kind: "url",
      href: trimmed,
      label: isTeams ? "Microsoft Teams" : "Meeting link",
    };
  }
  return { kind: "text", text: trimmed };
}

export function formatDefenseDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDefenseTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
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
