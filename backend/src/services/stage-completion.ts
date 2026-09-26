/**
 * Derived defense-stage completion (source of truth §6.5, §8.7).
 * A stage is COMPLETE only when formal outcome is PASSED and required
 * post-defense artifacts for that stage are satisfied.
 *
 * Final post-defense corrections/clearance remain OPEN_QUESTION — interim:
 * Final "passed" is outcome PASSED; COMPLETE for repository unlock is
 * deferred until the correction-clearance actor is confirmed.
 */

export type DefenseOutcomeName = "PASSED" | "REVISION_REQUIRED" | "FAILED";

export type StageCompletionState =
  | "NOT_STARTED"
  | "ELIGIBLE"
  | "APPLICATION_IN_PROGRESS"
  | "DEFENSE_IN_PROGRESS"
  | "POST_DEFENSE_IN_PROGRESS"
  | "COMPLETE"
  | "BLOCKED";

export interface TitleCompletionInput {
  outcome: DefenseOutcomeName | null;
  hasSelectedTitle: boolean;
  titleRapFinalized: boolean;
}

export interface ProposalCompletionInput {
  outcome: DefenseOutcomeName | null;
  proposalRapFinalized: boolean;
}

/**
 * RAP counts as finalized/signed for stage completion when status is
 * ALL_SIGNED or FINALIZED (same convention as eligibility lookups).
 */
export function isRapStatusComplete(
  status: string | null | undefined,
): boolean {
  return status === "ALL_SIGNED" || status === "FINALIZED";
}

/**
 * A required stage RAP must belong to the same defense session
 * (DefenseConclusion.scheduleId → RapReport.scheduleId).
 * A finalized RAP from another attempt/session must not satisfy completion.
 */
export function isRapCompleteForSchedule(
  rapRows: Array<{ scheduleId: string | null; status: string | null }>,
  scheduleId: string | null | undefined,
): boolean {
  if (!scheduleId) return false;
  return rapRows.some(
    (row) => row.scheduleId === scheduleId && isRapStatusComplete(row.status),
  );
}

export interface UnlockProposalInput {
  /** Formal Title DefenseConclusion outcome — not ThesisRecord.outcome. */
  outcome: DefenseOutcomeName | null;
  hasSelectedTitle: boolean;
  titleRapFinalized: boolean;
}

export interface UnlockFinalInput {
  /** Formal Proposal DefenseConclusion outcome — not ThesisRecord.outcome. */
  outcome: DefenseOutcomeName | null;
  proposalRapFinalized: boolean;
}

/** REVISION_REQUIRED never unlocks the next stage (safe interim §21.1). */
export function isPassingOutcome(
  outcome: DefenseOutcomeName | null | undefined,
): boolean {
  return outcome === "PASSED";
}

export function isTitleStageComplete(input: TitleCompletionInput): boolean {
  return (
    isPassingOutcome(input.outcome) &&
    input.hasSelectedTitle &&
    input.titleRapFinalized
  );
}

export function isProposalStageComplete(
  input: ProposalCompletionInput,
): boolean {
  return isPassingOutcome(input.outcome) && input.proposalRapFinalized;
}

export function isFinalDefensePassed(
  outcome: DefenseOutcomeName | null | undefined,
): boolean {
  return isPassingOutcome(outcome);
}

/**
 * Proposal is unlocked only when Title is formally complete
 * (PASSED + selected title + finalized Title RAP).
 * Do not infer unlock from ThesisRecord.stage alone.
 */
export function canUnlockProposal(input: UnlockProposalInput): boolean {
  return isTitleStageComplete({
    outcome: input.outcome,
    hasSelectedTitle: input.hasSelectedTitle,
    titleRapFinalized: input.titleRapFinalized,
  });
}

/**
 * Final is unlocked only when Proposal is formally complete
 * (PASSED + finalized Proposal RAP).
 * Do not infer unlock from ThesisRecord.stage alone.
 */
export function canUnlockFinal(input: UnlockFinalInput): boolean {
  return isProposalStageComplete({
    outcome: input.outcome,
    proposalRapFinalized: input.proposalRapFinalized,
  });
}

export interface StageProgressSnapshot {
  stage: "TITLE" | "PROPOSAL" | "FINAL" | null;
  applicationStatus: string | null;
  outcome: DefenseOutcomeName | null;
  hasSelectedTitle: boolean;
  titleRapFinalized: boolean;
  proposalRapFinalized: boolean;
}

export function computeStageCompletion(
  stage: "TITLE" | "PROPOSAL" | "FINAL",
  snap: StageProgressSnapshot,
): StageCompletionState {
  if (snap.stage !== stage) {
    // Record already advanced past this stage → treat prior stages as complete.
    const order = { TITLE: 0, PROPOSAL: 1, FINAL: 2 } as const;
    if (snap.stage && order[snap.stage] > order[stage]) {
      return "COMPLETE";
    }
    return "NOT_STARTED";
  }

  if (snap.applicationStatus === "REJECTED") {
    return "BLOCKED";
  }

  if (snap.outcome) {
    if (snap.outcome === "FAILED") return "BLOCKED";
    if (snap.outcome === "REVISION_REQUIRED") return "POST_DEFENSE_IN_PROGRESS";
    // PASSED
    if (stage === "TITLE") {
      return isTitleStageComplete({
        outcome: snap.outcome,
        hasSelectedTitle: snap.hasSelectedTitle,
        titleRapFinalized: snap.titleRapFinalized,
      })
        ? "COMPLETE"
        : "POST_DEFENSE_IN_PROGRESS";
    }
    if (stage === "PROPOSAL") {
      return isProposalStageComplete({
        outcome: snap.outcome,
        proposalRapFinalized: snap.proposalRapFinalized,
      })
        ? "COMPLETE"
        : "POST_DEFENSE_IN_PROGRESS";
    }
    // Final post-defense corrections are OPEN_QUESTION — PASSED is complete enough
    // to stop the pipeline here; repository unlock is a later explicit action.
    return "COMPLETE";
  }

  if (snap.applicationStatus === "PENDING") return "APPLICATION_IN_PROGRESS";
  if (snap.applicationStatus === "APPROVED") return "ELIGIBLE";
  return "NOT_STARTED";
}
