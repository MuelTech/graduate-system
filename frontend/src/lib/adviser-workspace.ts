import type {
  AdviserWorkspaceReviewStage,
  AdviserWorkspaceReviewTaskDto,
} from "../types/adviser-workspace";

/** ADV-3 — stable parent workspace query key. */
export const adviserWorkspaceQueryKey = [
  "panelist",
  "adviser-workspace",
] as const;

/** ADV-4 — stable exact-advisee detail query key. */
export function adviserAdviseeDetailQueryKey(studentId: string) {
  return ["panelist", "adviser-workspace", "advisee", studentId] as const;
}

/** Human-facing research-stage labels. Never render raw stage enums. */
export function workspaceStageLabel(stage: string | null | undefined): string {
  switch (String(stage ?? "").toUpperCase()) {
    case "TITLE":
      return "Title";
    case "PROPOSAL":
      return "Proposal";
    case "FINAL":
      return "Final";
    default:
      return "Not set";
  }
}

/** Human-facing Adviser review status labels. */
export function adviserReviewStatusLabel(status: string): string {
  switch (String(status ?? "").toUpperCase()) {
    case "AWAITING_REVIEW":
      return "Awaiting review";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "ISSUED":
      return "Certification issued";
    case "NONE":
      return "Not started";
    default:
      return "Review pending";
  }
}

/** Concise open-review badge for an Active Advisee row. */
export function openReviewLabel(
  stages: readonly AdviserWorkspaceReviewStage[],
): string | null {
  const hasProposal = stages.includes("PROPOSAL");
  const hasFinal = stages.includes("FINAL");
  if (hasProposal && hasFinal) return "Proposal and Final reviews pending";
  if (hasProposal) return "Proposal review pending";
  if (hasFinal) return "Final review pending";
  return null;
}

/**
 * ADV-4 — one concise next-responsibility summary derived only from the
 * authoritative review-task context. No parallel thesis progression state.
 */
export function nextAdviserResponsibility(
  tasks: readonly AdviserWorkspaceReviewTaskDto[],
): string {
  if (tasks.length === 0) return "No manuscript review pending";

  const pending = tasks.filter(
    (task) => String(task.reviewStatus).toUpperCase() !== "ISSUED",
  );
  if (pending.length === 0) return "No manuscript review pending";

  if (
    pending.some(
      (task) => String(task.reviewStatus).toUpperCase() === "CHANGES_REQUESTED",
    )
  ) {
    return "Changes requested; awaiting student revision";
  }

  const stages = new Set<AdviserWorkspaceReviewStage>();
  for (const task of pending) stages.add(task.stage);
  if (stages.has("PROPOSAL") && stages.has("FINAL")) {
    return "Proposal and Final manuscript reviews pending";
  }
  if (stages.has("PROPOSAL")) return "Proposal manuscript review pending";
  if (stages.has("FINAL")) return "Final manuscript review pending";
  return "No manuscript review pending";
}

/** Institutional, readable date for workspace metadata. */
export function formatWorkspaceDate(
  value: string | null | undefined,
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
