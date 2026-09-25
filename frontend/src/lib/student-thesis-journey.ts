/**
 * Shared Student Thesis Journey query identity + canonical route map (WP7).
 *
 * Later packages (WP8–WP12) should invalidate with:
 *   queryClient.invalidateQueries({ queryKey: studentThesisJourneyQueryKey })
 */
import type { JourneyStepKey } from "@/types/student-thesis-journey";

export const studentThesisJourneyQueryKey = [
  "student",
  "thesis",
  "journey",
] as const;

export const JOURNEY_STEP_ROUTES: Record<JourneyStepKey, string> = {
  TITLE_DEFENSE: "/student/thesis/title-defense",
  ADVISER_REQUEST: "/student/thesis/adviser-request",
  PROPOSAL_DEFENSE: "/student/thesis/proposal-defense",
  STRIKE: "/student/thesis/strike",
  FINAL_DEFENSE: "/student/thesis/final-defense",
};

export const JOURNEY_STEP_ORDER: JourneyStepKey[] = [
  "TITLE_DEFENSE",
  "ADVISER_REQUEST",
  "PROPOSAL_DEFENSE",
  "STRIKE",
  "FINAL_DEFENSE",
];

/** User-facing labels — never render raw enum keys. */
export const JOURNEY_STEP_LABELS: Record<JourneyStepKey, string> = {
  TITLE_DEFENSE: "Title Defense",
  ADVISER_REQUEST: "Adviser Request",
  PROPOSAL_DEFENSE: "Proposal Defense",
  STRIKE: "STRIKE / Plagiarism",
  FINAL_DEFENSE: "Final Defense",
};

export function journeyLabelFor(
  key: JourneyStepKey,
  backendLabel?: string | null,
): string {
  return backendLabel?.trim() || JOURNEY_STEP_LABELS[key];
}

export function journeyRouteFor(key: JourneyStepKey): string {
  return JOURNEY_STEP_ROUTES[key];
}

/** Completed journey destination (Final remains viewable). */
export const JOURNEY_COMPLETED_ROUTE = "/student/thesis/final-defense";
