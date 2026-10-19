/**
 * CDW-6 — Defense History presentation helpers (pure).
 *
 * These are display-only derivations over the server-authoritative history read
 * model. They never determine authorization or academic authority, and they are
 * intentionally free of any "revision complied with" judgement — that remains a
 * human academic decision.
 */

import type {
  DefenseHistoryItem,
  DefenseHistoryRelationship,
  DefenseHistoryStage,
} from "@/types/defense-history";

export const HISTORY_RELATIONSHIP_LABELS: Record<DefenseHistoryRelationship, string> = {
  SAME_STAGE_REDEFENSE: "Previous Same-Stage Attempt",
  PREVIOUS_STAGE: "Previous Stage",
  OLDER_HISTORY: "Older History",
};

export const HISTORY_STAGE_LABELS: Record<DefenseHistoryStage, string> = {
  TITLE: "Title Defense",
  PROPOSAL: "Proposal Defense",
  FINAL: "Final Defense",
};

export function defenseTypeLabel(defenseType: string): string {
  if (defenseType === "TITLE_DEFENSE") return HISTORY_STAGE_LABELS.TITLE;
  if (defenseType === "PROPOSAL_DEFENSE") return HISTORY_STAGE_LABELS.PROPOSAL;
  if (defenseType === "FINAL_DEFENSE") return HISTORY_STAGE_LABELS.FINAL;
  return defenseType;
}

/**
 * Human-readable verdict. Legacy outcomes are labelled honestly rather than
 * shown as raw enum names.
 */
export function historyVerdictLabel(verdict: string | null | undefined): string | null {
  if (!verdict) return null;
  switch (verdict) {
    case "PASSED":
      return "Passed";
    case "REDEFENSE_REQUIRED":
      return "Re-defense Required";
    case "REVISION_REQUIRED":
    case "REVISION":
      return "Revision Required (legacy)";
    case "FAILED":
      return "Failed (legacy)";
    default:
      return verdict;
  }
}

export interface GroupedHistory {
  sameStage: DefenseHistoryItem[];
  previousStage: DefenseHistoryItem[];
  olderHistory: DefenseHistoryItem[];
}

export function groupHistoryItems(items: DefenseHistoryItem[]): GroupedHistory {
  return {
    sameStage: items.filter((item) => item.relationship === "SAME_STAGE_REDEFENSE"),
    previousStage: items.filter((item) => item.relationship === "PREVIOUS_STAGE"),
    olderHistory: items.filter((item) => item.relationship === "OLDER_HISTORY"),
  };
}

/**
 * Historical attempt numbers per stage (1-based, oldest first), derived only
 * from the authoritative concluded ordering. The CURRENT attempt is the next one
 * but is intentionally not assigned a number here.
 */
export function assignAttemptNumbers(items: DefenseHistoryItem[]): Record<string, number> {
  const byStage = new Map<DefenseHistoryStage, DefenseHistoryItem[]>();
  for (const item of items) {
    const list = byStage.get(item.stage) ?? [];
    list.push(item);
    byStage.set(item.stage, list);
  }
  const numbers: Record<string, number> = {};
  for (const list of byStage.values()) {
    const ordered = [...list].sort((a, b) => {
      const aTime = a.concludedAt ? Date.parse(a.concludedAt) : 0;
      const bTime = b.concludedAt ? Date.parse(b.concludedAt) : 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.scheduleId.localeCompare(b.scheduleId);
    });
    ordered.forEach((item, index) => {
      numbers[item.scheduleId] = index + 1;
    });
  }
  return numbers;
}

export function manuscriptAvailabilityLabel(item: DefenseHistoryItem): string {
  return item.manuscript ? item.manuscript.displayName : "Historical manuscript unavailable";
}

export function reportAvailabilityLabel(item: DefenseHistoryItem): string {
  if (!item.reportAvailable || !item.reportSource) {
    return "Historical report unavailable";
  }
  switch (item.reportSource) {
    case "STRUCTURED_RAP":
      return "Finalized Committee Report available";
    case "LEGACY_RAP_TEXT":
      return "Legacy Committee Report available";
    case "LEGACY_RAPPORTEUR_NOTES":
      return "Legacy Rapporteur Notes available";
    default:
      return "Historical report available";
  }
}

export function annotationsAvailabilityLabel(item: DefenseHistoryItem): string {
  if (item.annotationCount === 0 && item.commentCount === 0) {
    return "No historical annotations recorded";
  }
  const annotationText = `${item.annotationCount} highlight${item.annotationCount === 1 ? "" : "s"}`;
  const commentText = `${item.commentCount} comment${item.commentCount === 1 ? "" : "s"}`;
  return `${annotationText} · ${commentText}`;
}

export function formatHistoryDate(value: string | null | undefined): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
