/**
 * Student Thesis Journey pure evaluation (WP5).
 *
 * Academic progression is derived from formal domain evidence only:
 * CompExam → Title DefenseConclusion (+ selectedTitleId) → AdviserRequest /
 * AdviserAssignment → Proposal DefenseConclusion → STRIKE (policy) →
 * Final DefenseConclusion.
 *
 * Never treat ThesisRecord.stage/status or application APPROVED as academic
 * completion. Those are administrative/session context only.
 */

export type JourneyStepKey =
  | "TITLE_DEFENSE"
  | "ADVISER_REQUEST"
  | "PROPOSAL_DEFENSE"
  | "STRIKE"
  | "FINAL_DEFENSE";

export type JourneyStepState =
  | "COMPLETED"
  | "CURRENT"
  | "AVAILABLE"
  | "WAITING"
  | "LOCKED";

export interface JourneyStepView {
  key: JourneyStepKey;
  label: string;
  state: JourneyStepState;
  lockReason: string | null;
  nextAction: string | null;
  /** Secondary administrative detail — not a Journey state. */
  detail?: string | null;
}

export interface JourneySnapshot {
  /** Comprehensive Examination PASSED (CompExamRecord). */
  compExamPassed: boolean;

  /** Formal Title Defense conclusion with selected title. */
  titlePassed: boolean;
  selectedTitleId: string | null;
  selectedTitleText: string | null;
  /** Administrative: title application/session context for WAITING text. */
  titleAdminState: AdminSessionState;

  /** GS-020 adviser request (latest relevant). */
  adviserRequest: {
    id: string;
    status: string;
    adviserStatus: string;
    deanStatus: string;
    requestedAdviserId: string;
    requestedAdviserName: string;
  } | null;
  activeAdviser: { userId: string; name: string } | null;

  proposalPassed: boolean;
  proposalAdminState: AdminSessionState;

  /** Persisted PlagiarismResult.isEligible (real evidence only). */
  strikeEligible: boolean;
  strikeRequired: boolean;

  finalPassed: boolean;
  finalAdminState: AdminSessionState;
}

export type AdminSessionState =
  | "NONE"
  | "SUBMITTED"
  | "APPROVED_READY"
  | "SCHEDULED"
  | "CONCLUDED_FAILED"
  | "CONCLUDED_PASSED"
  | "CONCLUDED_OTHER";

export interface StudentThesisJourneyDto {
  currentStep: JourneyStepKey | null;
  selectedTitle: { id: string; titleText: string } | null;
  activeAdviser: { userId: string; name: string } | null;
  adviserRequest: JourneySnapshot["adviserRequest"];
  policy: {
    strikeRequired: boolean;
  };
  steps: JourneyStepView[];
}

const STEP_LABELS: Record<JourneyStepKey, string> = {
  TITLE_DEFENSE: "Title Defense",
  ADVISER_REQUEST: "Adviser Request",
  PROPOSAL_DEFENSE: "Proposal Defense",
  STRIKE: "STRIKE / Plagiarism",
  FINAL_DEFENSE: "Final Defense",
};

function step(
  key: JourneyStepKey,
  state: JourneyStepState,
  lockReason: string | null = null,
  nextAction: string | null = null,
  detail: string | null = null,
): JourneyStepView {
  return {
    key,
    label: STEP_LABELS[key],
    state,
    lockReason,
    nextAction,
    detail,
  };
}

function adminWaitingText(
  admin: AdminSessionState,
  kind: "Title" | "Proposal" | "Final",
): string | null {
  switch (admin) {
    case "SUBMITTED":
      return `${kind} Defense application is under review.`;
    case "APPROVED_READY":
      return `${kind} Defense application is approved and waiting to be scheduled.`;
    case "SCHEDULED":
      return `${kind} Defense is scheduled and awaiting the formal conclusion.`;
    case "CONCLUDED_FAILED":
    case "CONCLUDED_OTHER":
      return `${kind} Defense was concluded without a passing result.`;
    default:
      return null;
  }
}

/**
 * Authoritative Journey evaluation.
 * selectedTitle must come from DefenseConclusion.selectedTitleId, not isSelected alone.
 */
export function evaluateStudentThesisJourney(
  snap: JourneySnapshot,
): StudentThesisJourneyDto {
  const titleCompleted = snap.titlePassed && Boolean(snap.selectedTitleId);
  const adviserCompleted = Boolean(snap.activeAdviser);
  const proposalCompleted = snap.proposalPassed;
  const strikeRequired = snap.strikeRequired;
  const strikeCompleted = !strikeRequired || snap.strikeEligible;
  const finalCompleted = snap.finalPassed;

  // ── Title Defense ──────────────────────────────────────────────
  const titleStep = !snap.compExamPassed
    ? step(
        "TITLE_DEFENSE",
        "LOCKED",
        "Pass the Comprehensive Examination before starting Title Defense.",
      )
    : titleCompleted
      ? step(
          "TITLE_DEFENSE",
          "COMPLETED",
          null,
          "Continue to Adviser Request.",
        )
      : snap.titleAdminState === "NONE"
        ? step(
            "TITLE_DEFENSE",
            "CURRENT",
            null,
            "Submit Title Defense application.",
          )
        : step(
            "TITLE_DEFENSE",
            "WAITING",
            adminWaitingText(snap.titleAdminState, "Title") ??
              "Waiting for Title Defense completion.",
            snap.titleAdminState === "SCHEDULED"
              ? "Attend Title Defense and await the formal conclusion."
              : "Await Title Defense review and formal conclusion.",
          );

  // ── Adviser Request ────────────────────────────────────────────
  const adviserStep = !titleCompleted
    ? step(
        "ADVISER_REQUEST",
        "LOCKED",
        "Complete and pass Title Defense with an official selected title first.",
      )
    : adviserCompleted
      ? step("ADVISER_REQUEST", "COMPLETED", null, "Continue to Proposal Defense.")
      : snap.adviserRequest?.adviserStatus === "PENDING"
        ? step(
            "ADVISER_REQUEST",
            "WAITING",
            "Waiting for adviser response.",
            "Await adviser CONFORME or decline.",
          )
        : snap.adviserRequest?.adviserStatus === "CONFORMED" &&
            snap.adviserRequest.deanStatus === "PENDING"
          ? step(
              "ADVISER_REQUEST",
              "WAITING",
              "Adviser accepted your request. Waiting for Dean approval.",
              "Await Dean decision.",
            )
          : snap.adviserRequest &&
              (snap.adviserRequest.adviserStatus === "DECLINED" ||
                snap.adviserRequest.deanStatus === "REJECTED")
            ? step(
                "ADVISER_REQUEST",
                "AVAILABLE",
                null,
                "Select another eligible Title Defense ODP member and submit a new request.",
              )
            : step(
                "ADVISER_REQUEST",
                "CURRENT",
                null,
                "Request an adviser from your Title Defense panel.",
              );

  // ── Proposal Defense ───────────────────────────────────────────
  const proposalStep = !adviserCompleted
    ? step(
        "PROPOSAL_DEFENSE",
        "LOCKED",
        "Complete the Adviser Request process and obtain an approved adviser first.",
      )
    : proposalCompleted
      ? step(
          "PROPOSAL_DEFENSE",
          "COMPLETED",
          null,
          strikeRequired && !snap.strikeEligible
            ? "Continue to STRIKE / Plagiarism."
            : "Continue to Final Defense.",
        )
      : snap.proposalAdminState === "NONE"
        ? step(
            "PROPOSAL_DEFENSE",
            "CURRENT",
            null,
            "Submit Proposal Defense application.",
          )
        : step(
            "PROPOSAL_DEFENSE",
            "WAITING",
            adminWaitingText(snap.proposalAdminState, "Proposal") ??
              "Waiting for Proposal Defense completion.",
            "Await Proposal Defense review and formal conclusion.",
          );

  // ── STRIKE / Plagiarism ────────────────────────────────────────
  const strikeStep = !proposalCompleted
    ? step(
        "STRIKE",
        "LOCKED",
        "Pass Proposal Defense before continuing.",
      )
    : !strikeRequired
      ? step(
          "STRIKE",
          "COMPLETED",
          "This check is not required for your current program workflow.",
          "Continue to Final Defense.",
          "Not required",
        )
      : snap.strikeEligible
        ? step("STRIKE", "COMPLETED", null, "Continue to Final Defense.")
        : step(
            "STRIKE",
            "CURRENT",
            null,
            "Complete the required plagiarism / STRIKE check before Final Defense.",
          );

  // ── Final Defense ──────────────────────────────────────────────
  const finalStep = !proposalCompleted
    ? step(
        "FINAL_DEFENSE",
        "LOCKED",
        "Pass Proposal Defense before continuing.",
      )
    : strikeRequired && !snap.strikeEligible
      ? step(
          "FINAL_DEFENSE",
          "LOCKED",
          "Complete the required plagiarism / STRIKE check before Final Defense.",
        )
      : finalCompleted
        ? step("FINAL_DEFENSE", "COMPLETED", null, "Thesis journey completed.")
        : snap.finalAdminState === "NONE"
          ? step(
              "FINAL_DEFENSE",
              "CURRENT",
              null,
              "Submit Final Defense application.",
            )
          : step(
              "FINAL_DEFENSE",
              "WAITING",
              adminWaitingText(snap.finalAdminState, "Final") ??
                "Waiting for Final Defense completion.",
              "Await Final Defense review and formal conclusion.",
            );

  const steps: JourneyStepView[] = [
    titleStep,
    adviserStep,
    proposalStep,
    strikeStep,
    finalStep,
  ];

  // Earliest academically incomplete step the Student should address.
  // Prefer CURRENT → WAITING → AVAILABLE → first LOCKED (so a fully locked
  // journey still points at the step that needs a prerequisite).
  const order: JourneyStepKey[] = [
    "TITLE_DEFENSE",
    "ADVISER_REQUEST",
    "PROPOSAL_DEFENSE",
    "STRIKE",
    "FINAL_DEFENSE",
  ];
  const byState = (state: JourneyStepState) =>
    order.find((k) => steps.find((s) => s.key === k)?.state === state) ?? null;

  const currentStep =
    byState("CURRENT") ??
    byState("WAITING") ??
    byState("AVAILABLE") ??
    byState("LOCKED");

  return {
    currentStep,
    selectedTitle:
      snap.selectedTitleId && snap.selectedTitleText
        ? { id: snap.selectedTitleId, titleText: snap.selectedTitleText }
        : null,
    activeAdviser: snap.activeAdviser,
    adviserRequest: snap.adviserRequest,
    policy: {
      strikeRequired: snap.strikeRequired,
    },
    steps,
  };
}
