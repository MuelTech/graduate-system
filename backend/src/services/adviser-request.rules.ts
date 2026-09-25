/**
 * GS-020 pure domain rules (WP2).
 * Candidate eligibility + request-path gates only — no workflow transitions.
 */

/** Working ODP mapping: Chairman + evaluator Panelists only. */
export const ADVISER_CANDIDATE_ROLES = ["CHAIRMAN", "PANELIST"] as const;

/** Explicitly excluded from adviser candidacy. */
export const EXCLUDED_ADVISER_ROLES = [
  "FACILITATOR",
  "RAPPORTEUR",
  "ADVISER",
] as const;

export function isAdviserCandidateRole(role: string): boolean {
  return (ADVISER_CANDIDATE_ROLES as readonly string[]).includes(role);
}

export type AdviserRequestRowLike = {
  adviserStatus: string;
  deanStatus: string;
  status?: string;
};

/**
 * A request still waiting for Adviser response or Dean review blocks a new request.
 * DECLINED / Dean REJECTED allow retry.
 */
export function isOpenAdviserRequest(row: AdviserRequestRowLike): boolean {
  if (row.adviserStatus === "PENDING") return true;
  if (row.adviserStatus === "CONFORMED" && row.deanStatus === "PENDING") {
    return true;
  }
  return false;
}

export function isRetryableClosedRequest(row: AdviserRequestRowLike): boolean {
  return row.adviserStatus === "DECLINED" || row.deanStatus === "REJECTED";
}

export type TitleDefenseGateInput = {
  hasPassedTitleConclusion: boolean;
  hasOfficialSelectedTitle: boolean;
};

export type TitleDefenseGateResult =
  | { allowed: true }
  | { allowed: false; reason: string; statusCode: number };

/** Backend unlock: formal Title Defense PASSED + official selected title. */
export function evaluateTitleDefenseGate(
  input: TitleDefenseGateInput,
): TitleDefenseGateResult {
  if (!input.hasPassedTitleConclusion) {
    return {
      allowed: false,
      reason:
        "Adviser Request requires a formally PASSED Title Defense conclusion.",
      statusCode: 400,
    };
  }
  if (!input.hasOfficialSelectedTitle) {
    return {
      allowed: false,
      reason:
        "Adviser Request requires an official selected title from Title Defense conclusion.",
      statusCode: 400,
    };
  }
  return { allowed: true };
}

export type CandidateEligibilityInput = {
  defenseRole: string;
  userIsActive: boolean;
  /** Panelist profile may be missing for non-panelist seats. */
  panelistIsActive?: boolean | null;
  isAvailableAsAdviser?: boolean | null;
};

export type CandidateEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * ODP seat must be CHAIRMAN/PANELIST and still a valid adviser candidate
 * when panelist flags exist. Does not invent load caps.
 */
export function evaluateCandidateEligibility(
  input: CandidateEligibilityInput,
): CandidateEligibilityResult {
  if (!isAdviserCandidateRole(input.defenseRole)) {
    return {
      eligible: false,
      reason: `Role ${input.defenseRole} is not eligible for adviser candidacy.`,
    };
  }
  if (!input.userIsActive) {
    return { eligible: false, reason: "User account is inactive." };
  }
  if (input.panelistIsActive === false) {
    return { eligible: false, reason: "Panelist profile is inactive." };
  }
  if (input.isAvailableAsAdviser === false) {
    return {
      eligible: false,
      reason: "Panelist is not available as adviser.",
    };
  }
  return { eligible: true };
}
