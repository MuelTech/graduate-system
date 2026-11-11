"use client";

import { DefenseStatusPanel } from "@/components/student/defense-status-panel";
import type {
  DefenseSessionSummary,
  JourneyStepView,
} from "@/types/student-thesis-journey";

/** The three post-submission states owned by UIUX-4C. */
export type TitlePostSubmissionStatus =
  | "APPLICATION_UNDER_REVIEW"
  | "APPROVED_WAITING_SCHEDULE"
  | "SCHEDULED";

/**
 * UIUX-4C — Student Title Defense post-submission status presentation.
 * Delegates to the unified DefenseStatusPanel so Title, Proposal, and Final
 * Defense share one consistent 4-step visual tracker, schedule card, and
 * submitted documents experience.
 */
export function TitleDefensePostSubmission({
  defenseStatus,
  session,
  step,
  onRefresh,
  isRefreshing,
}: {
  defenseStatus: TitlePostSubmissionStatus;
  session: DefenseSessionSummary | null | undefined;
  step?: JourneyStepView;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const effectiveStep: JourneyStepView = step ?? {
    key: "TITLE_DEFENSE",
    label: "Title Defense",
    state: "WAITING",
    lockReason: null,
    nextAction: null,
    detail: null,
    defenseStatus,
    defenseSession: session ?? null,
  };

  return (
    <DefenseStatusPanel
      kind="Title"
      step={effectiveStep}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
    />
  );
}
