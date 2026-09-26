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
 *
 * Title stage completion uses the shared stage-completion authority:
 * formal PASSED + official selected title + finalized Title RAP.
 */
import { isProposalStageComplete, isTitleStageComplete } from "./stage-completion";

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
  /** Required Title RAP is finalized/signed (ALL_SIGNED or FINALIZED). */
  titleRapFinalized: boolean;
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
  /** Required Proposal RAP is finalized/signed (ALL_SIGNED or FINALIZED). */
  proposalRapFinalized: boolean;
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
  | "REJECTED"
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

function rejectedApplicationStep(
  key: JourneyStepKey,
  kind: "Title" | "Proposal" | "Final",
): JourneyStepView {
  return step(
    key,
    "CURRENT",
    null,
    "Update the application requirements and resubmit.",
    `Your ${kind} Defense application was rejected. Review the feedback and resubmit.`,
  );
}

function adminActionableStep(
  key: JourneyStepKey,
  admin: AdminSessionState,
  kind: "Title" | "Proposal" | "Final",
  defaultNext: string,
): JourneyStepView {
  if (admin === "REJECTED") {
    return rejectedApplicationStep(key, kind);
  }
  if (admin === "NONE") {
    return step(key, "CURRENT", null, defaultNext);
  }
  return step(
    key,
    "WAITING",
    adminWaitingText(admin, kind) ?? `Waiting for ${kind} Defense completion.`,
    admin === "SCHEDULED"
      ? `Attend ${kind} Defense and await the formal conclusion.`
      : `Await ${kind} Defense review and formal conclusion.`,
  );
}

/**
 * Authoritative Journey evaluation — cumulative sequence.
 * selectedTitle must come from DefenseConclusion.selectedTitleId, not isSelected alone.
 *
 * Downstream steps require ALL preceding academic prerequisites, so orphaned
 * legacy evidence cannot unlock a later milestone early.
 */
export function evaluateStudentThesisJourney(
  snap: JourneySnapshot,
): StudentThesisJourneyDto {
  // Canonical Title completion: PASSED + official selected title + finalized Title RAP.
  const titleCompleted = isTitleStageComplete({
    outcome: snap.titlePassed ? "PASSED" : null,
    hasSelectedTitle: Boolean(snap.selectedTitleId),
    titleRapFinalized: snap.titleRapFinalized,
  });
  const titleResultAndTitleReady =
    snap.titlePassed && Boolean(snap.selectedTitleId);
  const titleRapPending = titleResultAndTitleReady && !snap.titleRapFinalized;
  const adviserCompleted = Boolean(snap.activeAdviser);
  const proposalCompleted = isProposalStageComplete({
    outcome: snap.proposalPassed ? "PASSED" : null,
    proposalRapFinalized: snap.proposalRapFinalized,
  });
  const strikeRequired = snap.strikeRequired;
  const strikeSatisfied = !strikeRequired || snap.strikeEligible;
  const finalCompleted = snap.finalPassed;

  // Cumulative academic gates (never skip an earlier milestone).
  const titleReady = snap.compExamPassed;
  const adviserReady = titleCompleted;
  const proposalReady = titleCompleted && adviserCompleted;
  const strikeReady = titleCompleted && adviserCompleted && proposalCompleted;
  const finalReady =
    titleCompleted && adviserCompleted && proposalCompleted && strikeSatisfied;

  // ── Title Defense ──────────────────────────────────────────────
  const titleStep = !titleReady
    ? step(
        "TITLE_DEFENSE",
        "LOCKED",
        "Pass the Comprehensive Examination before starting Title Defense.",
      )
    : titleCompleted
      ? step("TITLE_DEFENSE", "COMPLETED", null, "Continue to Adviser Request.")
      : titleRapPending
        ? step(
            "TITLE_DEFENSE",
            "WAITING",
            "Title Defense academic result and official title are recorded. Required Title RAP is still awaiting finalization/signatures.",
            "Finalizing Title Defense records.",
          )
        : adminActionableStep(
            "TITLE_DEFENSE",
            snap.titleAdminState,
            "Title",
            "Submit Title Defense application.",
          );

  // ── Adviser Request ────────────────────────────────────────────
  const adviserStep = !adviserReady
    ? step(
        "ADVISER_REQUEST",
        "LOCKED",
        titleRapPending
          ? "Title Defense academic result and official title are complete, but the required Title RAP must be finalized before Adviser Request."
          : "Complete and pass Title Defense with an official selected title first.",
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
  const proposalStep = !proposalReady
    ? step(
        "PROPOSAL_DEFENSE",
        "LOCKED",
        adviserCompleted
          ? "Complete and pass Title Defense with an official selected title first."
          : "Complete the Adviser Request process and obtain an approved adviser first.",
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
      : adminActionableStep(
          "PROPOSAL_DEFENSE",
          snap.proposalAdminState,
          "Proposal",
          "Submit Proposal Defense application.",
        );

  // ── STRIKE / Plagiarism ────────────────────────────────────────
  const strikeStep = !strikeReady
    ? step(
        "STRIKE",
        "LOCKED",
        !proposalCompleted && adviserCompleted
          ? "Pass Proposal Defense before continuing."
          : "Complete Title Defense, Adviser Request, and Proposal Defense before continuing.",
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
  const finalStep = !finalReady
    ? step(
        "FINAL_DEFENSE",
        "LOCKED",
        strikeRequired && proposalCompleted && !snap.strikeEligible
          ? "Complete the required plagiarism / STRIKE check before Final Defense."
          : !proposalCompleted
            ? "Pass Proposal Defense before continuing."
            : "Complete Title Defense, Adviser Request, and Proposal Defense before continuing.",
      )
    : finalCompleted
      ? step("FINAL_DEFENSE", "COMPLETED", null, "Thesis journey completed.")
      : adminActionableStep(
          "FINAL_DEFENSE",
          snap.finalAdminState,
          "Final",
          "Submit Final Defense application.",
        );

  const steps: JourneyStepView[] = [
    titleStep,
    adviserStep,
    proposalStep,
    strikeStep,
    finalStep,
  ];

  // Earliest non-COMPLETED step in canonical order (STRIKE skipped when
  // policy-not-required is already represented as COMPLETED).
  const order: JourneyStepKey[] = [
    "TITLE_DEFENSE",
    "ADVISER_REQUEST",
    "PROPOSAL_DEFENSE",
    "STRIKE",
    "FINAL_DEFENSE",
  ];
  const currentStep =
    order.find((k) => steps.find((s) => s.key === k)?.state !== "COMPLETED") ??
    null;

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
